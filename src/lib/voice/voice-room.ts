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
  private topology: VoiceTopology = VoiceTopology.MESH;
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
    // Standardized Room ID directly bound to chatId
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Join the voice room via Firestore targeted WebRTC signaling
   */
  public async join(): Promise<void> {
    console.log(`[Voice] Connected to Room ID: ${this.roomId}`);
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

      // 3. Setup WebRTC PeerConnections & Targeted Firestore Signaling
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
        // Close peer connection & remove remote stream for users who left
        const pc = this.peerConnections.get(existingId);
        if (pc) {
          pc.close();
          this.peerConnections.delete(existingId);
        }
        const stream = this.remoteStreams.get(existingId);
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          this.remoteStreams.delete(existingId);
          this.emit(VoiceRoomEvent.STREAM_REMOVED, existingId);
        }
        this.emit(VoiceRoomEvent.PARTICIPANT_LEFT, existingId);
      }
    }
  }

  /**
   * Firestore WebRTC SDP Offer/Answer and ICE candidate signaling using subcollection calls/${chatId}/signaling
   */
  private async setupFirestoreSignaling(): Promise<void> {
    const callDocRef = doc(db, 'calls', this.roomId);
    const signalingCol = collection(db, 'calls', this.roomId, 'signaling');

    // 1. Real-Time Active Room Discovery on Join
    const callSnap = await getDoc(callDocRef).catch(() => null);
    const exists = callSnap && callSnap.exists();
    const data = exists ? callSnap.data() : null;

    if (!exists || data?.status === 'ended') {
      await setDoc(
        callDocRef,
        {
          roomId: this.roomId,
          status: 'active',
          hostId: this.userId,
          participantIds: [this.userId],
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await updateDoc(callDocRef, {
        status: 'active',
        participantIds: arrayUnion(this.userId),
      }).catch(async () => {
        await setDoc(
          callDocRef,
          {
            roomId: this.roomId,
            status: 'active',
            participantIds: arrayUnion(this.userId),
          },
          { merge: true }
        );
      });
    }

    // 2. Subscribe to room doc for live participant list synchronization & initiation of WebRTC peer connections
    const unsubCallDoc = onSnapshot(callDocRef, (snapshot) => {
      const roomData = snapshot.data();
      if (!roomData) return;

      if (roomData.status === 'ended') {
        this.cleanup();
        return;
      }

      const participantIds: string[] = Array.isArray(roomData.participantIds) ? roomData.participantIds : [];
      console.log('[Voice] Active Participants in Room:', participantIds);

      this.syncParticipants(participantIds);

      // Connect to any newly joined remote participant
      participantIds.forEach((remoteUserId) => {
        if (remoteUserId !== this.userId && !this.peerConnections.has(remoteUserId)) {
          this.initiatePeerConnection(remoteUserId, signalingCol);
        }
      });
    });
    this.unsubscribes.push(unsubCallDoc);

    // 3. Subscribe to targeted signaling subcollection calls/${chatId}/signaling
    const unsubSignaling = onSnapshot(signalingCol, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type === 'added') {
          const sigData = change.doc.data();
          if (!sigData) return;

          // Filter out incoming signaling docs where from === currentUserId or to !== currentUserId
          if (sigData.from === this.userId) return;
          if (sigData.to !== this.userId) return;

          const fromUserId = sigData.from;
          const type = sigData.type;

          console.log(`[Voice] Received SDP ${type} from: ${fromUserId}`);

          if (type === 'offer') {
            await this.handleIncomingOffer(fromUserId, sigData.payload, signalingCol);
          } else if (type === 'answer') {
            await this.handleIncomingAnswer(fromUserId, sigData.payload);
          } else if (type === 'candidate') {
            await this.handleIncomingCandidate(fromUserId, sigData.payload);
          }
        }
      });
    });
    this.unsubscribes.push(unsubSignaling);
  }

  /**
   * Create or retrieve an RTCPeerConnection for a specific remoteUserId
   */
  private getOrCreatePeerConnection(remoteUserId: string, signalingCol: any): RTCPeerConnection | null {
    if (remoteUserId === this.userId) return null;
    if (this.peerConnections.has(remoteUserId)) {
      return this.peerConnections.get(remoteUserId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers,
    });
    this.peerConnections.set(remoteUserId, pc);

    // Attach local audio tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Handle remote audio stream
    pc.ontrack = (event) => {
      console.log(`Incoming remote audio track received from ${remoteUserId}:`, event.streams);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        this.remoteStreams.set(remoteUserId, remoteStream);
        this.emit(VoiceRoomEvent.STREAM_ADDED, remoteStream, remoteUserId);
      }
    };

    // Send ICE candidates targeted to remoteUserId
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        addDoc(signalingCol, {
          from: this.userId,
          to: remoteUserId,
          type: 'candidate',
          payload: event.candidate.toJSON(),
          createdAt: serverTimestamp(),
        }).catch(console.error);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`RTCPeerConnection state with ${remoteUserId}:`, pc.connectionState);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, pc.connectionState as any);
    };

    return pc;
  }

  /**
   * Initiate an SDP Offer to a newly discovered remote participant
   */
  private async initiatePeerConnection(remoteUserId: string, signalingCol: any): Promise<void> {
    const pc = this.getOrCreatePeerConnection(remoteUserId, signalingCol);
    if (!pc) return;

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await addDoc(signalingCol, {
        from: this.userId,
        to: remoteUserId,
        type: 'offer',
        payload: { sdp: offer.sdp, type: offer.type },
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(`Failed to initiate peer connection to ${remoteUserId}:`, err);
    }
  }

  /**
   * Handle incoming SDP Offer targeted to currentUserId
   */
  private async handleIncomingOffer(fromUserId: string, offerPayload: any, signalingCol: any): Promise<void> {
    const pc = this.getOrCreatePeerConnection(fromUserId, signalingCol);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offerPayload));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await addDoc(signalingCol, {
        from: this.userId,
        to: fromUserId,
        type: 'answer',
        payload: { sdp: answer.sdp, type: answer.type },
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(`Failed to handle offer from ${fromUserId}:`, err);
    }
  }

  /**
   * Handle incoming SDP Answer targeted to currentUserId
   */
  private async handleIncomingAnswer(fromUserId: string, answerPayload: any): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc && pc.signalingState !== 'stable' && !pc.currentRemoteDescription) {
      await pc.setRemoteDescription(new RTCSessionDescription(answerPayload)).catch(console.error);
    }
  }

  /**
   * Handle incoming ICE candidate targeted to currentUserId
   */
  private async handleIncomingCandidate(fromUserId: string, candidatePayload: any): Promise<void> {
    const pc = this.peerConnections.get(fromUserId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidatePayload)).catch(console.error);
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