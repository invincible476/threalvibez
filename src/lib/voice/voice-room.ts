import {
  VoiceRoom as VoiceRoomType,
  VoiceRoomParticipant,
  VoiceConnectionConfig,
  VoiceRoomEvent,
  VoiceRoomEventHandler,
  VoiceTopology,
  VoiceConnectionState,
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
        'stun:stun2.l.google.com:19302',
        'stun:stun3.l.google.com:19302',
        'stun:stun4.l.google.com:19302'
      ]
    }
  ],
  maxRetries: 3,
  reconnectDelay: 1000,
};

export class VoiceRoom {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
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
   * Join the voice room via Firestore WebRTC signaling
   */
  public async join(): Promise<void> {
    console.log('VoiceRoom joining room via Firestore signaling:', { userId: this.userId, roomId: this.roomId });
    try {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTING as any);
      
      // 1. Request Microphone Access & Setup Local MediaStream
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

      // 3. Setup WebRTC PeerConnection & Firestore Signaling
      await this.setupFirestoreSignaling();

      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTED as any);
    } catch (error) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      this.handleError(formattedError);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED as any);
      throw formattedError;
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

    // Add newly joined participants
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

    // Remove participants who left
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
    const callSnap = await getDoc(callDocRef);
    const callData = callSnap.exists() ? callSnap.data() : null;

    const isCaller = !callSnap.exists() || callData?.status === 'ended' || callData?.callerId === this.userId;
    const remoteTargetId = isCaller
      ? (callData?.calleeId && callData.calleeId !== this.userId ? callData.calleeId : 'remote_callee')
      : (callData?.callerId && callData.callerId !== this.userId ? callData.callerId : 'remote_caller');

    // Strict validation: NEVER attempt to create an RTCPeerConnection with currentUserId
    if (remoteTargetId === this.userId) {
      console.warn('Self-connection blocked: currentUserId cannot peer-connect to self', { userId: this.userId });
      return;
    }

    const callerCandidatesCol = collection(db, 'calls', this.roomId, 'callerCandidates');
    const calleeCandidatesCol = collection(db, 'calls', this.roomId, 'calleeCandidates');

    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });
    this.peerConnections.set(remoteTargetId, pc);

    // Attach local audio tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote track
    pc.ontrack = (event) => {
      console.log('Incoming remote audio track received:', event.streams);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        this.remoteStreams.set(remoteTargetId, remoteStream);
        this.emit(VoiceRoomEvent.STREAM_ADDED, remoteStream, remoteTargetId);
      }
    };

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      console.log('RTCPeerConnection connectionState:', pc.connectionState);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, pc.connectionState as any);
    };

    if (isCaller) {
      console.log('Setting up WebRTC as CALLER for room:', this.roomId);

      // Collect ICE candidates & write to callerCandidates subcollection with senderId & userId tag
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

      // Create doc at calls/${roomId} with status: 'calling', callerId: currentUserId, participantIds: [currentUserId]
      await setDoc(callDocRef, {
        roomId: this.roomId,
        callerId: this.userId,
        participantIds: [this.userId],
        offer,
        status: 'calling',
        createdAt: serverTimestamp(),
      }, { merge: true });

      // Listen for Answer and live participant sync
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'ended') {
          this.cleanup();
          return;
        }

        // Live participant sync
        if (Array.isArray(data.participantIds)) {
          this.syncParticipants(data.participantIds);
        }

        // Listen ONLY for callee's SDP Answer on caller device (ignore self-authored SDP answer payloads)
        if (
          data.answer &&
          data.answer.senderId !== this.userId &&
          data.answer.userId !== this.userId &&
          data.calleeId !== this.userId &&
          pc.signalingState !== 'stable' &&
          !pc.currentRemoteDescription
        ) {
          console.log('Caller received answer SDP from callee:', data.calleeId);
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription).catch(console.error);
        }
      });
      this.unsubscribes.push(unsubCallDoc);

      // Listen ONLY for Callee ICE Candidates (EXPLICITLY IGNORE any self-candidate payloads)
      const unsubCalleeCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            if (candidateData.senderId === this.userId || candidateData.userId === this.userId) {
              return;
            }
            const candidate = new RTCIceCandidate(candidateData);
            await pc.addIceCandidate(candidate).catch(console.error);
          }
        });
      });
      this.unsubscribes.push(unsubCalleeCandidates);

    } else {
      console.log('Setting up WebRTC as CALLEE for room:', this.roomId);

      // Strict role check: Callee must NEVER act as Caller
      if (callData?.callerId === this.userId) {
        console.warn('Callee role mismatch: current user is call owner, aborting callee init.');
        return;
      }

      // Collect ICE candidates & write to calleeCandidates subcollection with senderId & userId tag
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCol, {
            ...event.candidate.toJSON(),
            senderId: this.userId,
            userId: this.userId,
          }).catch(console.error);
        }
      };

      // Set Remote Description from Caller Offer (ignore if offer authored by current user)
      if (
        callData?.offer &&
        callData.offer.senderId !== this.userId &&
        callData.offer.userId !== this.userId &&
        callData.callerId !== this.userId
      ) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer)).catch(console.error);
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

      // Update doc adding currentUserId to participantIds array (arrayUnion) and set status: 'connected'
      await updateDoc(callDocRef, {
        calleeId: this.userId,
        participantIds: arrayUnion(this.userId),
        answer,
        status: 'connected',
      }).catch(async (err) => {
        console.warn('Fallback setDoc for callee update:', err);
        await setDoc(callDocRef, {
          calleeId: this.userId,
          participantIds: arrayUnion(this.userId),
          answer,
          status: 'connected',
        }, { merge: true });
      });

      // Listen for Call Document status changes & live participant sync
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'ended') {
          this.cleanup();
          return;
        }

        // Live participant sync
        if (Array.isArray(data.participantIds)) {
          this.syncParticipants(data.participantIds);
        }

        // If offer SDP arrives after callee init, set remote description
        if (
          data.offer &&
          data.offer.senderId !== this.userId &&
          data.offer.userId !== this.userId &&
          data.callerId !== this.userId &&
          pc.signalingState !== 'stable' &&
          !pc.currentRemoteDescription
        ) {
          console.log('Callee received offer SDP from caller:', data.callerId);
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer)).catch(console.error);
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

      // Listen ONLY for Caller ICE Candidates (EXPLICITLY IGNORE any self-candidate payloads)
      const unsubCallerCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidateData = change.doc.data();
            if (candidateData.senderId === this.userId || candidateData.userId === this.userId) {
              return;
            }
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

    this.peerConnections.forEach(pc => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    });
    this.peerConnections.clear();

    this.remoteStreams.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    this.remoteStreams.clear();

    this.participantsMap.clear();
    this.isSpeaking = false;
    this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.DISCONNECTED as any);
  }
}