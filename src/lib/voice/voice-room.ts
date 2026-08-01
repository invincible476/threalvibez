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
import { callTelemetry, checkMicrophonePermission, logVoiceError, CALL_ERROR_CODES } from './telemetry';

const DEFAULT_CONFIG: VoiceConnectionConfig = {
  iceServers: [
    {
      urls: [
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ],
    },
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
    callTelemetry.update({
      status: 'calling',
      currentStep: 'Checking Microphone Permission',
      errorCode: null,
    });

    const callDocRef = doc(db, 'calls', this.roomId);
    const callerCandidatesCol = collection(db, 'calls', this.roomId, 'callerCandidates');
    const calleeCandidatesCol = collection(db, 'calls', this.roomId, 'calleeCandidates');

    try {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTING as any);
      this.updateMetrics();

      // 1. Setup local audio stream with microphone permission checks
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
      callTelemetry.update({
        status: 'calling',
        currentStep: 'Creating WebRTC Offer',
      });

      const pc = new RTCPeerConnection({
        iceServers: this.config.iceServers,
      });
      this.pc = pc;

      this.attachPeerConnectionListeners(pc, callDocRef);

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
          }).catch((err) => logVoiceError('ICE_CANDIDATE_ADD_ERR', err));
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

      callTelemetry.update({
        status: 'ringing',
        currentStep: 'Writing Offer to Firestore (Calling)',
      });

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

      callTelemetry.update({
        status: 'ringing',
        currentStep: 'Ringing Callee',
      });

      // 30s Auto-hangup safety timeout on Caller side
      const callerTimeout = setTimeout(() => {
        if (pc.iceConnectionState !== 'connected' && pc.iceConnectionState !== 'completed') {
          console.log('[Voice] 30s timeout reached on Caller side with no answer. Cancelling call.');
          callTelemetry.update({
            status: 'cancelled',
            currentStep: 'Call Timed Out (30s)',
          });
          updateDoc(callDocRef, { status: 'cancelled' }).catch(() => {});
          this.cleanup();
        }
      }, 30000);
      this.unsubscribes.push(() => clearTimeout(callerTimeout));

      // Timer to check for 10s SDP Answer Timeout once status changes to 'accepted'
      let answerTimer: NodeJS.Timeout | null = null;

      // Listen for Callee acceptance/answer or decline
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'declined' || data.status === 'cancelled' || data.status === 'ended') {
          console.log('[Voice] Call status changed to:', data.status);
          callTelemetry.update({
            status: data.status,
            currentStep: `Call ${data.status}`,
          });
          this.cleanup();
          return;
        }

        if (data.status === 'failed') {
          callTelemetry.setError('ERR_UNKNOWN', data.errorDetails || 'Call document status marked as failed in Firestore.');
          callTelemetry.update({
            status: 'failed',
            currentStep: 'Call Failed',
          });
          this.cleanup();
          return;
        }

        if (Array.isArray(data.participantIds)) {
          this.syncParticipants(data.participantIds);
        }

        if (data.status === 'accepted') {
          callTelemetry.update({
            status: 'accepted',
            currentStep: 'Callee Accepted. Awaiting SDP Answer',
          });

          // Set 10s timeout for SDP Answer post after acceptance (ERR_ANSWER_TIMEOUT)
          if (!data.answer && !answerTimer) {
            answerTimer = setTimeout(() => {
              if (pc.signalingState !== 'stable' && !pc.currentRemoteDescription) {
                const timeoutMsg = 'Callee accepted call but failed to post SDP answer within 10s';
                logVoiceError(302, timeoutMsg);
                callTelemetry.setError('ERR_ANSWER_TIMEOUT', timeoutMsg);
                updateDoc(callDocRef, { status: 'failed', errorCode: 'ERR_ANSWER_TIMEOUT', errorDetails: timeoutMsg }).catch(() => {});
                this.cleanup();
              }
            }, 10000);
            this.unsubscribes.push(() => {
              if (answerTimer) clearTimeout(answerTimer);
            });
          }
        }

        if (
          data.status === 'accepted' &&
          data.answer &&
          data.answer.senderId !== this.userId &&
          pc.signalingState !== 'stable' &&
          !pc.currentRemoteDescription
        ) {
          if (answerTimer) {
            clearTimeout(answerTimer);
            answerTimer = null;
          }
          console.log('[Voice] Callee accepted call. Received SDP answer:', data.calleeId || 'callee');
          callTelemetry.update({
            status: 'connecting',
            currentStep: 'Processing Callee SDP Answer',
          });
          const answerDescription = new RTCSessionDescription(data.answer);
          await pc.setRemoteDescription(answerDescription).catch((err) => {
            logVoiceError('REMOTE_DESC_ERR', err);
            callTelemetry.setError('ERR_ANSWER_TIMEOUT', err);
          });
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
            await pc.addIceCandidate(candidate).catch((err) => {
              console.warn('[Voice] Add ICE candidate error:', err);
            });
          }
        });
      });
      this.unsubscribes.push(unsubCalleeCandidates);

    } catch (error: any) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      logVoiceError('START_CALL_FAIL', formattedError);

      if (formattedError.message.includes('ERR_MIC_DENIED') || formattedError.message.includes('Microphone access denied')) {
        callTelemetry.setError('ERR_MIC_DENIED', formattedError);
      } else if (formattedError.message.includes('ERR_MIC_UNSUPPORTED')) {
        callTelemetry.setError('ERR_MIC_UNSUPPORTED', formattedError);
      } else {
        callTelemetry.setError('ERR_UNKNOWN', formattedError);
      }

      await updateDoc(callDocRef, { status: 'failed', errorDetails: formattedError.message }).catch(() => {});
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
    callTelemetry.update({
      status: 'accepting',
      currentStep: 'Validating Incoming Offer Payload',
      errorCode: null,
    });

    const callDocRef = doc(db, 'calls', this.roomId);
    const callerCandidatesCol = collection(db, 'calls', this.roomId, 'callerCandidates');
    const calleeCandidatesCol = collection(db, 'calls', this.roomId, 'calleeCandidates');

    try {
      // Validate offer payload (ERR_OFFER_MISSING - 301)
      if (!incomingCallData || !incomingCallData.offer || !incomingCallData.offer.sdp) {
        const offerErrMsg = 'Call document ringing but SDP offer payload is null or invalid';
        logVoiceError(301, { incomingCallData, reason: offerErrMsg });
        callTelemetry.setError('ERR_OFFER_MISSING', offerErrMsg);
        await updateDoc(callDocRef, { status: 'failed', errorCode: 'ERR_OFFER_MISSING', errorDetails: offerErrMsg }).catch(() => {});
        throw new Error('ERR_OFFER_MISSING (301): Call doc ringing but SDP offer payload is null/invalid.');
      }

      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTING as any);
      this.updateMetrics();

      // 1. Setup local audio stream with mic permission checks
      callTelemetry.update({
        status: 'accepting',
        currentStep: 'Setting up Microphone Media Stream',
      });
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
      callTelemetry.update({
        status: 'accepting',
        currentStep: 'Creating Callee PeerConnection',
      });

      const pc = new RTCPeerConnection({
        iceServers: this.config.iceServers,
      });
      this.pc = pc;

      this.attachPeerConnectionListeners(pc, callDocRef);

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
          }).catch((err) => logVoiceError('CALLEE_ICE_ADD_ERR', err));
        }
      };

      // Set Remote Description from Caller Offer
      console.log('[Voice] Received SDP offer from caller:', incomingCallData.callerId);
      callTelemetry.update({
        status: 'accepting',
        currentStep: 'Setting Remote Description (Caller Offer)',
      });
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCallData.offer)).catch((err) => {
        logVoiceError(301, err);
        callTelemetry.setError('ERR_OFFER_MISSING', err);
        throw new Error('ERR_OFFER_MISSING (301): Invalid SDP Offer description.');
      });
      this.updateMetrics();

      // Create Answer
      callTelemetry.update({
        status: 'accepting',
        currentStep: 'Creating & Setting Local SDP Answer',
      });
      const answerDescription = await pc.createAnswer();
      await pc.setLocalDescription(answerDescription);

      const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
        senderId: this.userId,
        userId: this.userId,
      };

      callTelemetry.update({
        status: 'accepted',
        currentStep: 'Posting Answer to Firestore',
      });

      // Update call document status to 'accepted' and set answer within 10s deadline (ERR_ANSWER_TIMEOUT)
      const answerPostPromise = updateDoc(callDocRef, {
        calleeId: this.userId,
        participantIds: arrayUnion(this.userId),
        answer,
        status: 'accepted',
      }).catch(async () => {
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

      // Timeout race condition for posting answer
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('ERR_ANSWER_TIMEOUT (302): Callee accepted but SDP answer failed to post within 10s.'));
        }, 10000);
      });

      await Promise.race([answerPostPromise, timeoutPromise]).catch(async (err: any) => {
        if (err?.message?.includes('ERR_ANSWER_TIMEOUT')) {
          logVoiceError(302, err);
          callTelemetry.setError('ERR_ANSWER_TIMEOUT', err);
          await updateDoc(callDocRef, { status: 'failed', errorCode: 'ERR_ANSWER_TIMEOUT', errorDetails: err.message }).catch(() => {});
          throw err;
        }
      });

      callTelemetry.update({
        status: 'connecting',
        currentStep: 'Establishing ICE Connection',
      });

      // Listen for Call Document status updates
      const unsubCallDoc = onSnapshot(callDocRef, async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'ended' || data.status === 'cancelled' || data.status === 'failed') {
          if (data.status === 'failed') {
            callTelemetry.setError('ERR_UNKNOWN', data.errorDetails || 'Call document failed in Firestore.');
          }
          callTelemetry.update({
            status: data.status,
            currentStep: `Call ${data.status}`,
          });
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
            await pc.addIceCandidate(candidate).catch((err) => {
              console.warn('[Voice] Add ICE candidate error:', err);
            });
          }
        });
      });
      this.unsubscribes.push(unsubCallerCandidates);

    } catch (error: any) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      logVoiceError('ACCEPT_CALL_FAIL', formattedError);

      if (formattedError.message.includes('ERR_MIC_DENIED') || formattedError.message.includes('Microphone access denied')) {
        callTelemetry.setError('ERR_MIC_DENIED', formattedError);
      } else if (formattedError.message.includes('ERR_OFFER_MISSING')) {
        callTelemetry.setError('ERR_OFFER_MISSING', formattedError);
      } else if (formattedError.message.includes('ERR_ANSWER_TIMEOUT')) {
        callTelemetry.setError('ERR_ANSWER_TIMEOUT', formattedError);
      } else {
        callTelemetry.setError('ERR_UNKNOWN', formattedError);
      }

      await updateDoc(callDocRef, { status: 'failed', errorDetails: formattedError.message }).catch(() => {});
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
      callTelemetry.update({
        status: 'declined',
        currentStep: 'Declined Call',
      });
      const callDocRef = doc(db, 'calls', this.roomId);
      await updateDoc(callDocRef, { status: 'declined' }).catch(async () => {
        await setDoc(callDocRef, { status: 'declined' }, { merge: true }).catch(() => {});
      });
      this.cleanup();
    } catch (err) {
      logVoiceError('DECLINE_ERR', err);
    }
  }

  /**
   * Cancel an outgoing call invitation before answer
   */
  public async cancelCall(): Promise<void> {
    try {
      callTelemetry.update({
        status: 'cancelled',
        currentStep: 'Cancelled Outgoing Call',
      });
      const callDocRef = doc(db, 'calls', this.roomId);
      await updateDoc(callDocRef, { status: 'cancelled' }).catch(async () => {
        await setDoc(callDocRef, { status: 'cancelled' }, { merge: true }).catch(() => {});
      });
      this.cleanup();
    } catch (err) {
      logVoiceError('CANCEL_ERR', err);
    }
  }

  /**
   * Join the voice room via standard setup
   */
  public async join(): Promise<void> {
    console.log(`[Voice] Connected to Room ID: ${this.roomId}`);
    callTelemetry.update({
      status: 'connecting',
      currentStep: 'Joining Voice Room',
      errorCode: null,
    });
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
    } catch (error: any) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      logVoiceError('JOIN_ERR', formattedError);
      callTelemetry.setError('ERR_UNKNOWN', formattedError);
      this.handleError(formattedError);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED as any);
      throw formattedError;
    }
  }

  private attachPeerConnectionListeners(pc: RTCPeerConnection, callDocRef: any): void {
    pc.oniceconnectionstatechange = () => {
      console.log('[Voice] iceConnectionState:', pc.iceConnectionState);
      this.updateMetrics();

      // Catch WebRTC peer disconnection (ERR_ICE_DISCONNECTED - 401)
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        const iceMsg = `ICE connection state became: ${pc.iceConnectionState}. Local candidate pair or NAT traversal dropped.`;
        logVoiceError(401, iceMsg);
        callTelemetry.setError('ERR_ICE_DISCONNECTED', iceMsg);
        updateDoc(callDocRef, { status: 'failed', errorCode: 'ERR_ICE_DISCONNECTED', errorDetails: iceMsg }).catch(() => {});
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[Voice] signalingState:', pc.signalingState);
      this.updateMetrics();
    };

    pc.onconnectionstatechange = () => {
      console.log('[Voice] connectionState:', pc.connectionState);
      this.updateMetrics();
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        const connMsg = `Peer connection state became: ${pc.connectionState}`;
        logVoiceError(401, connMsg);
        callTelemetry.setError('ERR_ICE_DISCONNECTED', connMsg);
      }
    };

    pc.ontrack = (event) => {
      console.log('[Voice] Incoming remote audio track received:', event.streams);
      if (event.streams && event.streams[0]) {
        const remoteStream = event.streams[0];
        const remoteTargetId = 'remote_peer';
        this.remoteStreams.set(remoteTargetId, remoteStream);
        callTelemetry.update({
          status: 'connected',
          currentStep: 'Media Active (Remote Audio Playing)',
        });
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
      callTelemetry.update({
        status: 'connected',
        currentStep: 'P2P WebRTC Connected',
      });
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
      callTelemetry.update({
        status: 'ended',
        currentStep: 'Leaving Call Session',
      });
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
    } catch (error: any) {
      logVoiceError('LEAVE_ERR', error);
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
   * Setup local media stream with WebRTC audio constraints and explicit permission checks
   */
  private async setupLocalStream(): Promise<void> {
    try {
      const permResult = await checkMicrophonePermission();
      if (permResult.state === 'unsupported') {
        const unsuppMsg = 'navigator.mediaDevices.getUserMedia is unsupported on current context';
        logVoiceError(102, unsuppMsg);
        callTelemetry.setError('ERR_MIC_UNSUPPORTED', unsuppMsg);
        throw new Error(`ERR_MIC_UNSUPPORTED (102): ${unsuppMsg}`);
      }
      if (permResult.state === 'denied') {
        const deniedMsg = 'Microphone permission state is denied by browser policy';
        logVoiceError(101, deniedMsg);
        callTelemetry.setError('ERR_MIC_DENIED', deniedMsg);
        throw new Error(`ERR_MIC_DENIED (101): ${deniedMsg}`);
      }

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
    } catch (error: any) {
      if (error?.message?.includes('ERR_MIC_UNSUPPORTED') || error?.message?.includes('ERR_MIC_DENIED')) {
        throw error;
      }
      logVoiceError(101, error);
      callTelemetry.setError('ERR_MIC_DENIED', error);
      throw new Error(`ERR_MIC_DENIED (101): Microphone access rejected by user or blocked by browser policy. ${error?.message || ''}`);
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
      iceServers: this.config.iceServers,
    });
    this.pc = pc;

    this.attachPeerConnectionListeners(pc, callDocRef);

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
          }).catch((err) => logVoiceError('CALLER_ICE_ADD_ERR', err));
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

        if (data.status === 'ended' || data.status === 'declined' || data.status === 'cancelled' || data.status === 'failed') {
          if (data.status === 'failed') {
            callTelemetry.setError('ERR_UNKNOWN', data.errorDetails || 'Call status failed in Firestore snapshot.');
          }
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
          await pc.setRemoteDescription(answerDescription).catch((err) => logVoiceError('REMOTE_DESC_ERR', err));
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
            await pc.addIceCandidate(candidate).catch((err) => logVoiceError('ADD_ICE_ERR', err));
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
          }).catch((err) => logVoiceError('CALLEE_ICE_ADD_ERR', err));
        }
      };

      if (
        callData?.offer &&
        callData.offer.senderId !== this.userId &&
        callData.offer.userId !== this.userId
      ) {
        console.log('[Voice] Received SDP offer from caller:', callData.callerId || 'caller');
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer)).catch((err) => logVoiceError('REMOTE_OFFER_ERR', err));
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

        if (data.status === 'ended' || data.status === 'cancelled' || data.status === 'failed') {
          if (data.status === 'failed') {
            callTelemetry.setError('ERR_UNKNOWN', data.errorDetails || 'Call status failed in Firestore snapshot.');
          }
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
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer)).catch((err) => logVoiceError('SET_OFFER_ERR', err));
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
          }).catch((err) => logVoiceError('POST_ANSWER_ERR', err));
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
            await pc.addIceCandidate(candidate).catch((err) => logVoiceError('ADD_ICE_ERR', err));
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
    logVoiceError('VOICE_ROOM_EXCEPTION', error);
    callTelemetry.setError('ERR_UNKNOWN', error);
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
    callTelemetry.reset();
    this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.DISCONNECTED as any);
  }
}