import {
  VoiceRoom as VoiceRoomType,
  VoiceRoomParticipant,
  VoiceConnectionConfig,
  VoiceRoomEvent,
  VoiceRoomEventHandler,
  VoiceTopology,
  VoiceConnectionState,
} from './types';
import {
  SignalingMessage,
  SignalingMessageType,
  JoinRoomMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  RoomInfoMessage,
  ErrorMessage,
  ParticipantUpdateMessage,
} from './signaling-messages';

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
  private websocket: globalThis.WebSocket | null = null;
  private topology: VoiceTopology = VoiceTopology.P2P;
  private retryCount: number = 0;
  private roomInfo: VoiceRoomType | null = null;
  private isSpeaking: boolean = false;
  private audioContext: AudioContext | null = null;
  private audioAnalyser: AnalyserNode | null = null;
  private audioCheckInterval: number | null = null;

  constructor(
    private userId: string,
    private roomId: string,
    private config: VoiceConnectionConfig = DEFAULT_CONFIG
  ) {}

  public async join(): Promise<void> {
    try {
      await this.setupLocalStream();
      await this.connectToSignalingServer();
      await this.sendJoinRoom();
      this.startAudioLevelMonitoring();
    } catch (error) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      this.handleError(formattedError);
      throw formattedError;
    }
  }

  public async leave(): Promise<void> {
    try {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        await this.sendLeaveRoom();
      }
      this.cleanup();
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public setMuted(muted: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
      this.sendParticipantUpdate({ isMuted: muted });
    }
  }

  public on<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]): void {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event]?.push(handler);
  }

  public off<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]): void {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private async setupLocalStream(): Promise<void> {
    try {
      const supported = await navigator.mediaDevices.getSupportedConstraints();
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: supported.echoCancellation ? true : undefined,
        noiseSuppression: supported.noiseSuppression ? true : undefined,
        autoGainControl: supported.autoGainControl ? true : undefined,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.audioAnalyser = this.audioContext.createAnalyser();
      this.audioAnalyser.fftSize = 256;
      source.connect(this.audioAnalyser);

    } catch (error) {
      throw new Error('Failed to access microphone: ' + error);
    }
  }

  private startAudioLevelMonitoring(): void {
    if (!this.audioAnalyser) return;

    const bufferLength = this.audioAnalyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudioLevel = () => {
      if (!this.localStream || !this.audioAnalyser) return;
      
      this.audioAnalyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      const isSpeaking = average > 30;

      if (isSpeaking !== this.isSpeaking) {
        this.isSpeaking = isSpeaking;
        this.sendParticipantUpdate({ isSpeaking });
      }

      this.audioCheckInterval = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  }

  private async connectToSignalingServer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const protocol = process.env.NODE_ENV === 'production' || window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
      const wsUrl = `${protocol}//${host}/api/voice`;
      
      const connectWithRetry = () => {
        try {
          if (this.websocket?.readyState === WebSocket.CONNECTING) {
            return;
          }
          
          this.websocket = new WebSocket(wsUrl);

          this.websocket.onopen = () => {
            console.log('WebSocket connection established');
            this.retryCount = 0;
            this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, 'connected' as RTCPeerConnectionState);
            resolve();
          };

          this.websocket.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data) as SignalingMessage;
              this.handleSignalingMessage(message).catch(error => {
                console.error('Error handling signaling message:', error);
                this.handleError(error instanceof Error ? error : new Error(String(error)));
              });
            } catch (error) {
              console.error('Error parsing signaling message:', error);
              this.handleError(new Error('Invalid signaling message format'));
            }
          };

          this.websocket.onclose = (event) => {
            console.log('WebSocket connection closed', event.code, event.reason);
            
            if (this.retryCount < (this.config.maxRetries || 3)) {
              console.log(`Retrying connection (${this.retryCount + 1}/${this.config.maxRetries || 3})`);
              setTimeout(() => {
                this.retryCount++;
                connectWithRetry();
              }, this.config.reconnectDelay || 1000);
            } else {
              const error = new Error('Failed to connect to signaling server after maximum retries');
              this.handleError(error);
              reject(error);
            }
          };

          this.websocket.onerror = (event) => {
            console.error('WebSocket error occurred:', event);
          };
        } catch (error) {
          console.error('Error creating WebSocket connection:', error);
          this.handleError(error instanceof Error ? error : new Error(String(error)));
          reject(error);
        }
      };

      connectWithRetry();
    });
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    try {
      switch (message.type) {
        case SignalingMessageType.JOIN_ROOM: {
          const joinMessage = message as JoinRoomMessage;
          if (joinMessage.payload.initiator) {
            await this.createPeerConnection(joinMessage.targetId!, joinMessage.payload.mesh);
          }
          break;
        }

        case SignalingMessageType.ROOM_INFO: {
          const roomMessage = message as RoomInfoMessage;
          this.handleRoomInfo(roomMessage.payload);
          break;
        }

        case SignalingMessageType.OFFER: {
          const offerMessage = message as OfferMessage;
          await this.handleOffer(offerMessage);
          break;
        }

        case SignalingMessageType.ANSWER: {
          const answerMessage = message as AnswerMessage;
          await this.handleAnswer(answerMessage);
          break;
        }

        case SignalingMessageType.ICE_CANDIDATE: {
          const iceMessage = message as IceCandidateMessage;
          await this.handleIceCandidate(iceMessage);
          break;
        }

        case SignalingMessageType.ERROR: {
          const errorMessage = message as ErrorMessage;
          this.handleError(new Error(errorMessage.payload.error));
          break;
        }
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleRoomInfo(roomInfo: RoomInfoMessage['payload']): void {
    // Handle ping messages
    if (roomInfo.ping) {
      return;
    }

    // Validate required fields
    if (!roomInfo.id || !roomInfo.participants) {
      console.warn('Received invalid room info:', roomInfo);
      return;
    }

    const prevParticipants = new Set(this.roomInfo?.participants.keys() || []);
    const newParticipants = new Set(roomInfo.participants.map(p => p.id));

    // Handle left participants
    for (const participantId of prevParticipants) {
      if (!newParticipants.has(participantId)) {
        this.emit(VoiceRoomEvent.PARTICIPANT_LEFT, participantId);
        this.cleanupPeerConnection(participantId);
      }
    }

    // Validate and normalize participant data
    const validParticipants = roomInfo.participants.filter(p => {
      if (!p.id) {
        console.warn('Received participant without ID:', p);
        return false;
      }
      return true;
    });

    // Create participant map with validated participants
    const participantMap = new Map(
      validParticipants.map(p => [p.id, {
        id: p.id,
        joinedAt: p.joinedAt || Date.now(),
        isMuted: Boolean(p.isMuted),
        isSpeaking: Boolean(p.isSpeaking),
      }])
    );

    // Emit join events for new participants
    for (const participant of roomInfo.participants) {
      if (!prevParticipants.has(participant.id)) {
        this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, participant);
      }
    }

    // Update room info
    this.roomInfo = {
      id: roomInfo.id,
      participants: participantMap,
      createdAt: Date.now(),
    };

    this.updateTopology(participantMap.size);
  }

  private async createPeerConnection(targetId: string, mesh: boolean = false): Promise<RTCPeerConnection> {
    this.cleanupPeerConnection(targetId);

    const pc = new RTCPeerConnection(this.config);
    this.peerConnections.set(targetId, pc);

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${targetId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        this.handlePeerConnectionFailure(targetId);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetId}:`, pc.connectionState);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.handlePeerConnectionFailure(targetId);
      }
    };

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        if (this.localStream) {
          pc.addTrack(track, this.localStream);
        }
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage({
          type: SignalingMessageType.ICE_CANDIDATE,
          payload: event.candidate.toJSON(),
          targetId,
        } as IceCandidateMessage);
      }
    };

    pc.ontrack = (event) => {
      try {
        const stream = event.streams[0];
        if (stream) {
          this.remoteStreams.set(targetId, stream);
          this.emit(VoiceRoomEvent.STREAM_ADDED, stream, targetId);
        }
      } catch (error) {
        console.error('Error handling track event:', error);
        this.handleError(error instanceof Error ? error : new Error(String(error)));
      }
    };

    if (!mesh) {
      await this.createOffer(pc, targetId);
    }

    return pc;
  }

  private async createOffer(pc: RTCPeerConnection, targetId: string): Promise<void> {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignalingMessage({
        type: SignalingMessageType.OFFER,
        payload: offer,
        targetId,
      } as OfferMessage);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleOffer(message: OfferMessage): Promise<void> {
    const pc = this.peerConnections.get(message.senderId) ||
               await this.createPeerConnection(message.senderId);

    try {
      await pc.setRemoteDescription(message.payload);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignalingMessage({
        type: SignalingMessageType.ANSWER,
        payload: answer,
        targetId: message.senderId,
      } as AnswerMessage);
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async handleAnswer(message: AnswerMessage): Promise<void> {
    const pc = this.peerConnections.get(message.senderId);
    if (pc) {
      try {
        await pc.setRemoteDescription(message.payload);
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async handleIceCandidate(message: IceCandidateMessage): Promise<void> {
    const pc = this.peerConnections.get(message.senderId);
    if (pc) {
      try {
        await pc.addIceCandidate(message.payload);
      } catch (error) {
        this.handleError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private async handlePeerConnectionFailure(targetId: string): Promise<void> {
    console.log(`Handling peer connection failure for ${targetId}`);
    
    this.cleanupPeerConnection(targetId);
    
    if (this.retryCount < (this.config.maxRetries || 3)) {
      this.retryCount++;
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, 'failed' as RTCPeerConnectionState);
      
      try {
        await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay || 1000));
        await this.createPeerConnection(targetId);
        console.log(`Reconnected to peer ${targetId}`);
      } catch (error) {
        console.error(`Failed to reconnect to peer ${targetId}:`, error);
        this.handleError(new Error(`Failed to reconnect to peer ${targetId}: ${error instanceof Error ? error.message : String(error)}`));
      }
    } else {
      console.log(`Max retries reached for ${targetId}`);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, 'failed' as RTCPeerConnectionState);
      this.handleError(new Error(`Failed to establish connection with peer ${targetId} after maximum retries`));
    }
  }

  private updateTopology(participantCount: number): void {
    const newTopology = participantCount <= 2 
      ? VoiceTopology.P2P 
      : participantCount <= 4 
        ? VoiceTopology.MESH 
        : VoiceTopology.SFU;

    if (this.topology !== newTopology) {
      this.topology = newTopology;
    }
  }

  private cleanupPeerConnection(targetId: string): void {
    const pc = this.peerConnections.get(targetId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;

      pc.close();
      this.peerConnections.delete(targetId);

      const remoteStream = this.remoteStreams.get(targetId);
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
          track.stop();
        });
        this.remoteStreams.delete(targetId);
        this.emit(VoiceRoomEvent.STREAM_REMOVED, targetId);
      }
    }
  }

  private sendSignalingMessage(message: Partial<SignalingMessage>): void {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({
        ...message,
        senderId: this.userId,
        roomId: this.roomId,
      }));
    }
  }

  private sendJoinRoom(): void {
    this.sendSignalingMessage({
      type: SignalingMessageType.JOIN_ROOM,
      payload: {},
    } as JoinRoomMessage);
  }

  private sendLeaveRoom(): void {
    this.sendSignalingMessage({
      type: SignalingMessageType.LEAVE_ROOM,
    });
  }

  private sendParticipantUpdate(update: Partial<ParticipantUpdateMessage['payload']>): void {
    this.sendSignalingMessage({
      type: SignalingMessageType.PARTICIPANT_UPDATED,
      payload: update,
    } as ParticipantUpdateMessage);
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
    console.error('VoiceRoom error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    this.emit(VoiceRoomEvent.ERROR, error);
  }

  private cleanup(): void {
    if (this.audioCheckInterval) {
      cancelAnimationFrame(this.audioCheckInterval);
      this.audioCheckInterval = null;
    }

    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close();
    }
    this.audioContext = null;
    this.audioAnalyser = null;

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    this.peerConnections.forEach((_, targetId) => {
      this.cleanupPeerConnection(targetId);
    });
    this.peerConnections.clear();

    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }
    this.websocket = null;

    this.retryCount = 0;
    this.roomInfo = null;
    this.topology = VoiceTopology.P2P;
    this.isSpeaking = false;

    this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, 'closed' as RTCPeerConnectionState);
  }
}