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
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
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

  constructor(
    private userId: string,
    private roomId: string,
    private config: VoiceConnectionConfig = DEFAULT_CONFIG
  ) {}

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
      this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, {
        id: this.userId,
        joinedAt: Date.now(),
        isMuted: this.isMuted,
        isSpeaking: false,
      });

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
  public leave(): void {
    try {
      // Signal call end in Firestore
      const callDocRef = doc(db, 'calls', this.roomId);
      setDoc(callDocRef, { status: 'ended' }, { merge: true }).catch(() => {});

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
      this.emit(VoiceRoomEvent.PARTICIPANT_UPDATED, {
        id: this.userId,
        joinedAt: Date.now(),
        isMuted: muted,
        isSpeaking: this.isSpeaking,
      });
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
          this.emit(VoiceRoomEvent.PARTICIPANT_UPDATED, {
            id: this.userId,
            joinedAt: Date.now(),
            isMuted: this.isMuted,
            isSpeaking: nowSpeaking,
          });
        }

        this.animationFrameId = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (err) {
      console.warn('Audio level analyzer setup warning:', err);
    }
  }

  /**
   * Firestore WebRTC SDP Offer/Answer and ICE candidate signaling
   */
  private async setupFirestoreSignaling(): Promise<void> {
    const callDocRef = doc(db, 'calls', this.roomId);
    const callSnap = await getDoc(callDocRef);

    const callerCandidatesCol = collection(db, 'calls', this.roomId, 'callerCandidates');
    const calleeCandidatesCol = collection(db, 'calls', this.roomId, 'calleeCandidates');

    const pc = new RTCPeerConnection({
      iceServers: this.config.iceServers
    });
    this.peerConnections.set(this.roomId, pc);

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
        const remoteTargetId = this.roomId;
        this.remoteStreams.set(remoteTargetId, remoteStream);
        this.emit(VoiceRoomEvent.STREAM_ADDED, remoteStream, remoteTargetId);
      }
    };

    // Monitor connection states
    pc.onconnectionstatechange = () => {
      console.log('RTCPeerConnection connectionState:', pc.connectionState);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, pc.connectionState as any);
    };

    // Determine if Caller or Callee
    const isCaller = !callSnap.exists() || callSnap.data()?.status === 'ended' || callSnap.data()?.callerId === this.userId;

    if (isCaller) {
      console.log('Setting up WebRTC as CALLER for room:', this.roomId);

      // Collect ICE candidates & write to callerCandidates subcollection
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(callerCandidatesCol, event.candidate.toJSON()).catch(console.error);
        }
      };

      // Create Offer
      const offerDescription = await pc.createOffer();
      await pc.setLocalDescription(offerDescription);

      const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
      };

      await setDoc(callDocRef, {
        roomId: this.roomId,
        callerId: this.userId,
        offer,
        status: 'calling',
        createdAt: serverTimestamp(),
      });

      // Listen for Answer
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'ended') {
          this.leave();
          return;
        }

        if (data.calleeId && data.calleeId !== this.userId) {
          this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, {
            id: data.calleeId,
            joinedAt: Date.now(),
            isMuted: false,
            isSpeaking: false,
          });
        }

        if (data.answer && !pc.currentRemoteDescription) {
          console.log('Caller received answer SDP from callee');
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription);
        }
      });
      this.unsubscribes.push(unsubCallDoc);

      // Listen for Callee ICE Candidates
      const unsubCalleeCandidates = onSnapshot(calleeCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
            await pc.addIceCandidate(candidate).catch(console.error);
          }
        });
      });
      this.unsubscribes.push(unsubCalleeCandidates);

    } else {
      console.log('Setting up WebRTC as CALLEE for room:', this.roomId);

      const callData = callSnap.data();

      // Emit caller participant
      if (callData?.callerId) {
        this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, {
          id: callData.callerId,
          joinedAt: Date.now(),
          isMuted: false,
          isSpeaking: false,
        });
      }

      // Collect ICE candidates & write to calleeCandidates subcollection
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          addDoc(calleeCandidatesCol, event.candidate.toJSON()).catch(console.error);
        }
      };

      // Set Remote Description from Caller Offer
      if (callData?.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      }

      // Create Answer
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
      };

      await setDoc(callDocRef, {
        calleeId: this.userId,
        answer,
        status: 'connected',
      }, { merge: true });

      // Listen for Call Document status changes (e.g. ended)
      const unsubCallDoc = onSnapshot(callDocRef, (snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'ended') {
          this.leave();
        }
      });
      this.unsubscribes.push(unsubCallDoc);

      // Listen for Caller ICE Candidates
      const unsubCallerCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const candidate = new RTCIceCandidate(change.doc.data());
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

    this.isSpeaking = false;
    this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.DISCONNECTED as any);
  }
}