import {
  VoiceRoom as VoiceRoomType,
  VoiceRoomParticipant,
  VoiceConnectionConfig,
  VoiceRoomEvent,
  VoiceRoomEventHandler,
  VoiceTopology,
  VoiceConnectionState,
  WebRTCMetrics,
  CallSession,
} from './types';
import { db } from '@/lib/firebase';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';

const DEFAULT_CONFIG: VoiceConnectionConfig = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ]
    }
  ],
  maxRetries: 3,
  reconnectDelay: 1000,
};

export class VoiceRoom {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private eventHandlers: Partial<{ [K in VoiceRoomEvent]: VoiceRoomEventHandler[K][] }> = {};
  private unsubscribes: Array<() => void> = [];
  private topology: VoiceTopology = VoiceTopology.P2P;
  private isSpeaking: boolean = false;
  private isMuted: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private participantsMap: Map<string, VoiceRoomParticipant> = new Map();
  private iceState: string = 'new';
  private signalingState: string = 'stable';

  constructor(
    private userId: string,
    private roomId: string,
    private config: VoiceConnectionConfig = DEFAULT_CONFIG
  ) {
    if (!this.roomId.startsWith('voice_room_') && !this.roomId.startsWith('call_')) {
      this.roomId = `voice_room_${this.roomId}`;
    }
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Initiate an outgoing voice call invitation (Caller Flow)
   */
  public async startCall(
    targetUser: { uid: string; name: string; photoURL?: string },
    currentUserProfile: { name: string; photoURL?: string }
  ): Promise<void> {
    console.log(`[Voice] Starting outgoing call to ${targetUser.name} in Room ID: ${this.roomId}`);
    try {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTING as any);
      this.updateMetrics();

      // 1. Setup local audio stream
      await this.setupLocalStream();

      // 2. Register Local Participant State
      const localParticipant: VoiceRoomParticipant = {
        id: this.userId,
        joinedAt: Date.now(),
        isMuted: this.isMuted,
        isSpeaking: false,
      };
      this.participantsMap.set(this.userId, localParticipant);
      this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, localParticipant);

      // 3. Initialize Caller RTCPeerConnection & SDP Offer
      const callDocRef = doc(db, 'calls', this.roomId);
      const callerCandidatesCol = collection(db, 'calls', this.roomId, 'callerCandidates');
      const calleeCandidatesCol = collection(db, 'calls', this.roomId, 'calleeCandidates');

      const pc = new RTCPeerConnection({
        iceServers: this.config.iceServers,
      });
      this.pc = pc;

      this.attachPeerConnectionListeners(pc);

      // Add local audio track
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
      }

      // Collect caller ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(callerCandidatesCol, {
            ...event.candidate.toJSON(),
            senderId: this.userId,
            userId: this.userId,
          }).catch(console.error);
        }
      };

      // Create Offer
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
        senderId: this.userId,
        userId: this.userId,
      };

      // Write calls/${roomId} document with status: 'ringing'
      await setDoc(
        callDocRef,
        {
          chatId: this.roomId,
          callerId: this.userId,
          callerName: currentUserProfile.name || 'User',
          callerAvatar: currentUserProfile.photoURL || '',
          receiverId: targetUser.uid,
          participantIds: [this.userId],
          status: 'ringing',
          offer,
          answer: null,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      // Listen for Callee acceptance/answer or decline
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'declined' || data.status === 'cancelled' || data.status === 'ended') {
          this.cleanup();
          return;
        }

        if (Array.isArray(data.participantIds)) {
          this.syncParticipants(data.participantIds);
        }

        if (
          data.status === 'accepted' &&
          data.answer &&
          data.answer.senderId !== this.userId &&
          pc.signalingState !== 'stable' &&
          !pc.currentRemoteDescription
        ) {
          console.log('[Voice] Callee accepted call. Received SDP answer:', data.calleeId || 'callee');
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription).catch(console.error);
          this.updateMetrics();
        }
      });
      this.unsubscribes.push(unsubCallDoc);

      // Listen ONLY for Callee ICE Candidates
      const unsubCalleeCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            if (candidateData.senderId === this.userId || candidateData.userId === this.userId) {
              return;
            }
            console.log('[Voice] Received SDP candidate from callee');
            const candidate = new RTCIceCandidate(candidateData);
            await pc.addIceCandidate(candidate).catch(console.error);
          }
        });
      });
      this.unsubscribes.push(unsubCalleeCandidates);

    } catch (error) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      this.handleError(formattedError);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED as any);
      throw formattedError;
    }
  }

  /**
   * Accept an incoming voice call invitation (Callee Flow)
   */
  public async acceptCall(incomingCallData: CallSession): Promise<void> {
    console.log(`[Voice] Accepting incoming call in Room ID: ${this.roomId}`);
    try {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTING as any);
      this.updateMetrics();

      // 1. Setup local audio stream
      await this.setupLocalStream();

      // 2. Register Local Participant State
      const localParticipant: VoiceRoomParticipant = {
        id: this.userId,
        joinedAt: Date.now(),
        isMuted: this.isMuted,
        isSpeaking: false,
      };
      this.participantsMap.set(this.userId, localParticipant);
      this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, localParticipant);

      // 3. Initialize Callee RTCPeerConnection & SDP Answer
      const callDocRef = doc(db, 'calls', this.roomId);
      const callerCandidatesCol = collection(db, 'calls', this.roomId, 'callerCandidates');
      const calleeCandidatesCol = collection(db, 'calls', this.roomId, 'calleeCandidates');

      const pc = new RTCPeerConnection({
        iceServers: this.config.iceServers,
      });
      this.pc = pc;

      this.attachPeerConnectionListeners(pc);

      // Add local audio tracks
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => pc.addTrack(track, this.localStream!));
      }

      // Collect callee ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCol, {
            ...event.candidate.toJSON(),
            senderId: this.userId,
            userId: this.userId,
          }).catch(console.error);
        }
      };

      // Set Remote Description from Caller Offer
      if (incomingCallData.offer) {
        console.log('[Voice] Received SDP offer from caller:', incomingCallData.callerId);
        await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer)).catch(console.error);
        this.updateMetrics();
      }

      // Create Answer
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
        senderId: this.userId,
        userId: this.userId,
      };

      // Update call document status to 'accepted' and set answer
      await updateDoc(callDocRef, {
        calleeId: this.userId,
        participantIds: arrayUnion(this.userId),
        answer,
        status: 'accepted',
      }).catch(async (err) => {
        await setDoc(
          callDocRef,
          {
            calleeId: this.userId,
            participantIds: arrayUnion(this.userId),
            answer,
            status: 'accepted',
          },
          { merge: true }
        );
      });

      // Listen for Call Document status updates
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'ended' || data.status === 'cancelled') {
          this.cleanup();
          return;
        }

        if (Array.isArray(data.participantIds)) {
          this.syncParticipants(data.participantIds);
        }
      });
      this.unsubscribes.push(unsubCallDoc);

      // Listen ONLY for Caller ICE Candidates
      const unsubCallerCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            if (candidateData.senderId === this.userId || candidateData.userId === this.userId) {
              return;
            }
            console.log('[Voice] Received SDP candidate from caller');
            const candidate = new RTCIceCandidate(candidateData);
            await pc.addIceCandidate(candidate).catch(console.error);
          }
        });
      });
      this.unsubscribes.push(unsubCallerCandidates);

    } catch (error) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      this.handleError(formattedError);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED as any);
      throw formattedError;
    }
  }

  /**
   * Decline an incoming call invitation
   */
  public async declineCall(): Promise<void> {
    try {
      const callDocRef = doc(db, 'calls', this.roomId);
      await updateDoc(callDocRef, { status: 'declined' }).catch(async () => {
        await setDoc(callDocRef, { status: 'declined' }, { merge: true }).catch(() => {});
      });
      this.cleanup();
    } catch (err) {
      console.error('Error declining call:', err);
    }
  }

  /**
   * Cancel an outgoing call invitation before answer
   */
  public async cancelCall(): Promise<void> {
    try {
      const callDocRef = doc(db, 'calls', this.roomId);
      await updateDoc(callDocRef, { status: 'cancelled' }).catch(async () => {
        await setDoc(callDocRef, { status: 'cancelled' }, { merge: true }).catch(() => {});
      });
      this.cleanup();
    } catch (err) {
      console.error('Error cancelling call:', err);
    }
  }

  /**
   * Join the voice room via standard setup
   */
  public async join(): Promise<void> {
    console.log(`[Voice] Connected to Room ID: ${this.roomId}`);
    try {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTING as any);
      this.updateMetrics();

      await this.setupLocalStream();

      const localParticipant: VoiceRoomParticipant = {
        id: this.userId,
        joinedAt: Date.now(),
        isMuted: this.isMuted,
        isSpeaking: false,
      };
      this.participantsMap.set(this.userId, localParticipant);
      this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, localParticipant);

      await this.setupFirestoreSignaling();
    } catch (error) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      this.handleError(formattedError);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED as any);
      throw formattedError;
    }
  }

  private attachPeerConnectionListeners(pc: RTCPeerConnection): void {
    pc.oniceconnectionstatechange = () => {
      console.log('[Voice] iceConnectionState:', pc.iceConnectionState);
      this.updateMetrics();
    };

    pc.onsignalingstatechange = () => {
      console.log('[Voice] signalingState:', pc.signalingState);
      this.updateMetrics();
    };

    pc.onconnectionstatechange = () => {
      console.log('[Voice] connectionState:', pc.connectionState);
      this.updateMetrics();
    };

    pc.ontrack = (event) => {
      console.log('[Voice] Incoming remote audio track received:', event.streams);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        const remoteTargetId = 'remote_peer';
        this.remoteStreams.set(remoteTargetId, remoteStream);
        this.updateMetrics();
        this.emit(VoiceRoomEvent.STREAM_ADDED, remoteStream, remoteTargetId);
      }
    };
  }

  /**
   * Update and emit live WebRTC metrics & connection state
   */
  private updateMetrics(): void {
    const iceState = this.pc ? (this.pc.iceConnectionState || 'new') : 'new';
    const signalingState = this.pc ? (this.pc.signalingState || 'stable') : 'stable';
    const hasRemoteTrack = this.remoteStreams.size > 0;

    this.iceState = iceState;
    this.signalingState = signalingState;

    this.emit(VoiceRoomEvent.METRICS_UPDATED, {
      iceState,
      signalingState,
      hasRemoteTrack,
    });

    if (iceState === 'connected' || iceState === 'completed') {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTED as any);
    } else if (iceState === 'disconnected' || iceState === 'failed' || iceState === 'closed') {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED as any);
    } else {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTING as any);
    }
  }

  /**
   * Leave the voice room and clean up resources
   */
  public async leave(): Promise<void> {
    try {
      const callDocRef = doc(db, 'calls', this.roomId);
      const callSnap = await getDoc(callDocRef).catch(() => null);

      if (callSnap && callSnap.exists()) {
        const data = callSnap.data();
        const currentParticipants: string[] = Array.isArray(data.participantIds) ? data.participantIds : [];
        const remainingParticipants = currentParticipants.filter(id => id !== this.userId);

        if (remainingParticipants.length === 0) {
          await updateDoc(callDocRef, {
            participantIds: arrayRemove(this.userId),
            status: 'ended',
          }).catch(async () => {
            await setDoc(callDocRef, { status: 'ended' }, { merge: true }).catch(() => {});
          });
        } else {
          await updateDoc(callDocRef, {
            participantIds: arrayRemove(this.userId),
          }).catch(() => {});
        }
      }

      this.cleanup();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Mute or unmute local audio tracks
   */
  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      const localParticipant = this.participantsMap.get(this.userId);
      if (localParticipant) {
        localParticipant.isMuted = muted;
        this.emit(VoiceRoomEvent.PARTICIPANT_UPDATED, { ...localParticipant });
      } else {
        this.emit(VoiceRoomEvent.PARTICIPANT_UPDATED, {
          id: this.userId,
          joinedAt: Date.now(),
          isMuted: muted,
          isSpeaking: this.isSpeaking,
        });
      }
    }
  }

  /**
   * Register event handler
   */
  public on<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event]?.push(handler);
  }

  /**
   * Remove event handler
   */
  public off<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]): void {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Setup local media stream with WebRTC audio constraints
   */
  private async setupLocalStream(): Promise<void> {
    try {
      const supported = await navigator.mediaDevices.getSupportedConstraints();
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: supported.echoCancellation ? true : undefined,
        noiseSuppression: supported.noiseSuppression ? true : undefined,
        autoGainControl: supported.autoGainControl ? true : undefined,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      this.setupAudioAnalysis();
    } catch (error) {
      throw new Error('Microphone access denied or unavailable: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  /**
   * Real-time audio level detection using Web Audio API
   */
  private setupAudioAnalysis(): void {
    if (!this.localStream) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      source.connect(this.audioAnalyser);

      const bufferLength = this.audioAnalyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!this.localStream || !this.audioAnalyser) return;
        this.audioAnalyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
        const nowSpeaking = average > 20 && !this.isMuted;

        if (nowSpeaking !== this.isSpeaking) {
          this.isSpeaking = nowSpeaking;
          const localParticipant = this.participantsMap.get(this.userId);
          if (localParticipant) {
            localParticipant.isSpeaking = nowSpeaking;
            this.emit(VoiceRoomEvent.PARTICIPANT_UPDATED, { ...localParticipant });
          } else {
            this.emit(VoiceRoomEvent.PARTICIPANT_UPDATED, {
              id: this.userId,
              joinedAt: Date.now(),
              isMuted: this.isMuted,
              isSpeaking: nowSpeaking,
            });
          }
        }

        this.animationFrameId = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      console.warn('Audio level analyzer setup warning:', err);
    }
  }

  /**
   * Sync participant list from live Firestore participantIds array
   */
  private syncParticipants(remoteParticipantIds: string[]): void {
    const uniqueIds = Array.from(new Set(remoteParticipantIds));
    const remoteIdSet = new Set(uniqueIds);

    uniqueIds.forEach((pId) => {
      if (!this.participantsMap.has(pId)) {
        const participantObj: VoiceRoomParticipant = {
          id: pId,
          joinedAt: Date.now(),
          isMuted: false,
          isSpeaking: false,
        };
        this.participantsMap.set(pId, participantObj);
        this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, participantObj);
      }
    });

    for (const [existingId] of Array.from(this.participantsMap.entries())) {
      if (!remoteIdSet.has(existingId)) {
        this.participantsMap.delete(existingId);
        this.emit(VoiceRoomEvent.PARTICIPANT_LEFT, existingId);
      }
    }
  }

  /**
   * Firestore WebRTC SDP Offer/Answer and ICE candidate signaling
   */
  private async setupFirestoreSignaling(): Promise<void> {
    const callDocRef = doc(db, 'calls', this.roomId);
    const callSnap = await getDoc(callDocRef).catch(() => null);
    const callData = callSnap && callSnap.exists() ? callSnap.data() : null;

    const callerCandidatesCol = collection(db, 'calls', this.roomId, 'callerCandidates');
    const calleeCandidatesCol = collection(db, 'calls', this.roomId, 'calleeCandidates');

    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });
    this.pc = pc;

    this.attachPeerConnectionListeners(pc);

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    const isCaller = !callSnap || !callSnap.exists() || callData?.status === 'ended' || callData?.callerId === this.userId;

    if (isCaller) {
      console.log('[Voice] Setting up WebRTC as CALLER for room:', this.roomId);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(callerCandidatesCol, {
            ...event.candidate.toJSON(),
            senderId: this.userId,
            userId: this.userId,
          }).catch(console.error);
        }
      };

      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
        senderId: this.userId,
        userId: this.userId,
      };

      await setDoc(callDocRef, {
        chatId: this.roomId,
        callerId: this.userId,
        participantIds: [this.userId],
        offer,
        status: 'calling',
        createdAt: serverTimestamp(),
      }, { merge: true });

      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'ended' || data.status === 'declined' || data.status === 'cancelled') {
          this.cleanup();
          return;
        }

        if (Array.isArray(data.participantIds)) {
          this.syncParticipants(data.participantIds);
        }

        if (
          data.answer &&
          data.answer.senderId !== this.userId &&
          data.answer.userId !== this.userId &&
          pc.signalingState !== 'stable' &&
          !pc.currentRemoteDescription
        ) {
          console.log('[Voice] Received SDP answer from callee:', data.calleeId || 'callee');
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription).catch(console.error);
          this.updateMetrics();
        }
      });
      this.unsubscribes.push(unsubCallDoc);

      const unsubCalleeCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            if (candidateData.senderId === this.userId || candidateData.userId === this.userId) {
              return;
            }
            console.log('[Voice] Received SDP candidate from callee');
            const candidate = new RTCIceCandidate(candidateData);
            await pc.addIceCandidate(candidate).catch(console.error);
          }
        });
      });
      this.unsubscribes.push(unsubCalleeCandidates);

    } else {
      console.log('[Voice] Setting up WebRTC as CALLEE for room:', this.roomId);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCol, {
            ...event.candidate.toJSON(),
            senderId: this.userId,
            userId: this.userId,
          }).catch(console.error);
        }
      };

      if (
        callData?.offer &&
        callData.offer.senderId !== this.userId &&
        callData.offer.userId !== this.userId
      ) {
        console.log('[Voice] Received SDP offer from caller:', callData.callerId || 'caller');
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer)).catch(console.error);
        this.updateMetrics();
      }

      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
        senderId: this.userId,
        userId: this.userId,
      };

      await updateDoc(callDocRef, {
        calleeId: this.userId,
        participantIds: arrayUnion(this.userId),
        answer,
        status: 'accepted',
      }).catch(async (err) => {
        await setDoc(callDocRef, {
          calleeId: this.userId,
          participantIds: arrayUnion(this.userId),
          answer,
          status: 'accepted',
        }, { merge: true });
      });

      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'ended' || data.status === 'cancelled') {
          this.cleanup();
          return;
        }

        if (Array.isArray(data.participantIds)) {
          this.syncParticipants(data.participantIds);
        }

        if (
          data.offer &&
          data.offer.senderId !== this.userId &&
          data.offer.userId !== this.userId &&
          pc.signalingState !== 'stable' &&
          !pc.currentRemoteDescription
        ) {
          console.log('[Voice] Received SDP offer from caller:', data.callerId || 'caller');
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer)).catch(console.error);
          this.updateMetrics();
          const answerDesc = await pc.createAnswer();
          await pc.setLocalDescription(answerDesc);
          await updateDoc(callDocRef, {
            answer: {
              type: answerDesc.type,
              sdp: answerDesc.sdp,
              senderId: this.userId,
              userId: this.userId,
            },
          }).catch(console.error);
        }
      });
      this.unsubscribes.push(unsubCallDoc);

      const unsubCallerCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            if (candidateData.senderId === this.userId || candidateData.userId === this.userId) {
              return;
            }
            console.log('[Voice] Received SDP candidate from caller');
            const candidate = new RTCIceCandidate(candidateData);
            await pc.addIceCandidate(candidate).catch(console.error);
          }
        });
      });
      this.unsubscribes.push(unsubCallerCandidates);
    }
  }

  private emit<E extends VoiceRoomEvent>(event: E, ...args: Parameters<VoiceRoomEventHandler[E]>): void {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      handlers.forEach(handler => {
        (handler as Function)(...args);
      });
    }
  }

  private handleError(error: Error): void {
    console.error('VoiceRoom error:', error);
    this.emit(VoiceRoomEvent.ERROR, error);
  }

  private cleanup(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
    }
    this.audioContext = null;
    this.audioAnalyser = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.unsubscribes.forEach(unsub => unsub());
    this.unsubscribes = [];

    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.onsignalingstatechange = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }

    this.remoteStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.remoteStreams.clear();

    this.participantsMap.clear();
    this.isSpeaking = false;
    this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.DISCONNECTED as any);
  }
}