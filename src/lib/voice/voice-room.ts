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
  LeaveRoomMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  RoomInfoMessage,
  ErrorMessage,
  ParticipantUpdateMessage
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

  constructor(
    private userId: string,
    private roomId: string,
    private config: VoiceConnectionConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Join the voice room
   */
  public async join(): Promise<void> {
    console.log('VoiceRoom join called:', { userId: this.userId, roomId: this.roomId });
    try {
      console.log('Setting up local stream...');
      await this.setupLocalStream();
      console.log('Local stream setup complete');
      
      console.log('Connecting to signaling server...');
      await this.connectToSignalingServer();
      console.log('Signaling server connection established');
      
      console.log('Sending join room message...');
      await this.sendJoinRoom();
      console.log('Join room message sent');
    } catch (error) {
      const formattedError = error instanceof Error ? error : new Error(String(error));
      this.handleError(formattedError);
      throw formattedError;
    }
  }

  /**
   * Leave the voice room
   */
  public async leave(): Promise<void> {
    try {
      this.sendLeaveRoom();
      this.cleanup();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Mute/unmute local audio
   */
  public setMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });

      this.sendParticipantUpdate({ isMuted: muted });
    }
  }

  /**
   * Register event handler
   */
  public on<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = [];
    }
    this.eventHandlers[event]?.push(handler);
  }

  /**
   * Remove event handler
   */
  public off<E extends VoiceRoomEvent>(event: E, handler: VoiceRoomEventHandler[E]) {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Setup local audio stream
   */
  private async setupLocalStream(): Promise<void> {
    try {
      // Check if browser supports required audio constraints
      const supported = await navigator.mediaDevices.getSupportedConstraints();
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: supported.echoCancellation ? true : undefined,
        noiseSuppression: supported.noiseSuppression ? true : undefined,
        autoGainControl: supported.autoGainControl ? true : undefined,
      };

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      // Setup audio level detection
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(this.localStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        if (!this.localStream) return;
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const isSpeaking = average > 30; // Adjust threshold as needed

        if (isSpeaking !== this.isSpeaking) {
          this.isSpeaking = isSpeaking;
          this.sendParticipantUpdate({ isSpeaking });
        }

        requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      throw new Error('Failed to access microphone: ' + error);
    }
  }

  /**
   * Connect to signaling server
   */
  private async connectToSignalingServer(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Determine the WebSocket protocol based on the current page protocol
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Log environment state
      console.log('Environment:', {
        NODE_ENV: process.env.NODE_ENV,
        NEXT_PUBLIC_WS_HOST: process.env.NEXT_PUBLIC_WS_HOST,
        NEXT_PUBLIC_WS_PORT: process.env.NEXT_PUBLIC_WS_PORT,
        windowProtocol: window.location.protocol,
        windowHostname: window.location.hostname,
        windowPort: window.location.port
      });

      let wsUrl: string;
      // In development, always use localhost with the WebSocket port
      if (process.env.NODE_ENV === 'development') {
        wsUrl = `ws://localhost:9000/api/voice?userId=${encodeURIComponent(this.userId)}`;
        console.log('Development WebSocket URL constructed:', wsUrl);
      } else {
        // In production, use the configured host and port or fallback to the current host
        const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.hostname;
        const port = process.env.NEXT_PUBLIC_WS_PORT || window.location.port;
        
        // Construct URL with port only if specified
        wsUrl = port
          ? `${protocol}//${host}:${port}/api/voice?userId=${encodeURIComponent(this.userId)}`
          : `${protocol}//${host}/api/voice?userId=${encodeURIComponent(this.userId)}`;
        console.log('Production WebSocket URL constructed:', wsUrl);
      }
      
      // Validate WebSocket URL
      try {
        const parsedUrl = new URL(wsUrl);
        const isDev = process.env.NODE_ENV !== 'production';
        
        // Verify WebSocket protocol
        if (!['ws:', 'wss:'].includes(parsedUrl.protocol)) {
          throw new Error(`Invalid WebSocket protocol: ${parsedUrl.protocol}`);
        }

        // Verify hostname and port configuration
        if (isDev) {
          if (parsedUrl.hostname !== 'localhost') {
            throw new Error('Development environment requires localhost');
          }
          if (parsedUrl.port !== '9000') {
            throw new Error('Development environment requires port 9000 for WebSocket server');
          }
        }

        // Log connection details
        console.log('WebSocket connection details:', {
          url: wsUrl,
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          pathname: parsedUrl.pathname,
          environment: isDev ? 'development' : 'production'
        });

        return wsUrl;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Invalid URL format';
        console.error('WebSocket URL validation failed:', errorMessage);
        throw new Error(`WebSocket URL validation failed: ${errorMessage}`);
      }
      
      const connectWithRetry = () => {
        console.log('Attempting WebSocket connection...');
        try {
          if (this.websocket?.readyState === WebSocket.CONNECTING) {
            console.log('WebSocket is already connecting');
            return;
          }

          // Setup connection timeout
          const connectionTimeout = setTimeout(() => {
            if (this.websocket?.readyState === WebSocket.CONNECTING) {
              this.websocket?.close();
              const timeoutError = new Error('WebSocket connection timed out');
              this.handleError(timeoutError);
              reject(timeoutError);
            }
          }, 10000); // 10 second timeout
          
          this.websocket = new WebSocket(wsUrl);

          this.websocket.onopen = () => {
            console.log('WebSocket connection established');
            clearTimeout(connectionTimeout);
            this.retryCount = 0;
            this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.CONNECTED);
            
            // Send an initial ping to verify connection
            try {
              this.sendSignalingMessage({
                type: SignalingMessageType.ROOM_INFO,
                senderId: this.userId,
                roomId: this.roomId,
                payload: { ping: true }
              });
            } catch (e) {
              console.warn('Failed to send initial ping:', e);
            }
            
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
            clearTimeout(connectionTimeout);
            
            // Handle different close scenarios
            const closeReason = this.getWebSocketCloseReason(event.code);
            console.log('WebSocket connection closed:', {
              code: event.code,
              reason: event.reason || closeReason,
              wasClean: event.wasClean
            });
            
            // Don't retry if it was a normal closure or if we're at max retries
            if (event.code === 1000 || event.code === 1001) {
              this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.DISCONNECTED);
              return;
            }
            
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
            const ws = event.target as WebSocket;
            
            // Enhanced error details with connection info
            const errorDetails = {
              type: event.type,
              timeStamp: event.timeStamp,
              readyState: ws.readyState,
              url: ws.url,
              protocol: ws.protocol,
              binaryType: ws.binaryType,
              bufferedAmount: ws.bufferedAmount,
              extensions: ws.extensions,
              host: new URL(ws.url).host,
              hostname: new URL(ws.url).hostname,
              port: new URL(ws.url).port,
              pathname: new URL(ws.url).pathname
            };
            
            // Log detailed error information with connection diagnosis
            console.error('WebSocket connection error:', {
              ...errorDetails,
              stateDescription: this.getWebSocketStateDescription(ws.readyState),
              retryCount: this.retryCount,
              maxRetries: this.config.maxRetries,
              diagnosis: this.diagnoseWebSocketError(ws)
            });
            
            const errorMessage = `WebSocket connection error - State: ${this.getWebSocketStateDescription(ws.readyState)}, URL: ${ws.url}`;
            this.handleError(new Error(errorMessage));
            
            // Only cleanup if we're not already in a cleanup state
            if (ws.readyState !== WebSocket.CLOSING && ws.readyState !== WebSocket.CLOSED) {
              this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED);
              this.cleanup();
            }
            
            // Implement exponential backoff for retries
            if (this.retryCount < (this.config.maxRetries || 3)) {
              const backoffDelay = Math.min(
                (Math.pow(2, this.retryCount) * 1000) + (Math.random() * 1000),
                30000 // Max 30 second delay
              );
              
              console.log(`Retrying connection in ${Math.round(backoffDelay/1000)}s (attempt ${this.retryCount + 1}/${this.config.maxRetries})`);
              
              setTimeout(() => {
                this.retryCount++;
                connectWithRetry();
              }, backoffDelay);
            } else {
              const maxRetriesError = new Error(
                `Failed to establish WebSocket connection after ${this.config.maxRetries} attempts. ` +
                `Last state: ${this.getWebSocketStateDescription(ws.readyState)}`
              );
              this.handleError(maxRetriesError);
              reject(maxRetriesError);
            }
          };
        } catch (error) {
          console.error('Error creating WebSocket connection:', error);
          this.handleError(error instanceof Error ? error : new Error(String(error)));
          
          if (this.retryCount < (this.config.maxRetries || 3)) {
            console.log(`Retrying connection (${this.retryCount + 1}/${this.config.maxRetries || 3})`);
            setTimeout(() => {
              this.retryCount++;
              connectWithRetry();
            }, this.config.reconnectDelay || 1000);
          } else {
            reject(new Error('Failed to create WebSocket connection after maximum retries'));
          }
        }
      };

      connectWithRetry();
    });
  }

  /**
   * Handle incoming signaling messages
   */
  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    try {
      switch (message.type) {
        case SignalingMessageType.JOIN_ROOM: {
          const joinMessage = message as JoinRoomMessage;
          if (joinMessage.payload.initiator) {
            await this.createPeerConnection(message.targetId!, joinMessage.payload.mesh);
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

  /**
   * Handle room information updates
   */
  private handleRoomInfo(roomInfo: RoomInfoMessage['payload']): void {
    // Handle ping messages
    if (roomInfo.ping) {
      return;
    }

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

    const participantMap = new Map(
      roomInfo.participants.map(p => [p.id, {
        ...p,
        joinedAt: Date.now(),
      }])
    );

    for (const participant of roomInfo.participants) {
      if (!prevParticipants.has(participant.id)) {
        this.emit(VoiceRoomEvent.PARTICIPANT_JOINED, participant);
      }
    }

    this.roomInfo = {
      id: roomInfo.id,
      participants: participantMap,
      createdAt: Date.now(),
    };

    this.updateTopology(participantMap.size);
  }

  /**
   * Create a new peer connection
   */
  private async createPeerConnection(targetId: string, mesh: boolean = false): Promise<RTCPeerConnection> {
    // Cleanup any existing connection
    this.cleanupPeerConnection(targetId);

    const pc = new RTCPeerConnection(this.config);
    this.peerConnections.set(targetId, pc);

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      console.log(`ICE connection state for ${targetId}:`, pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        this.handlePeerConnectionFailure(targetId);
      }
    };

    // Monitor connection state
    pc.onconnectionstatechange = () => {
      console.log(`Connection state for ${targetId}:`, pc.connectionState);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.handlePeerConnectionFailure(targetId);
      }
    };

    // Add local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.localStream && pc.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const iceMessage: IceCandidateMessage = {
          type: SignalingMessageType.ICE_CANDIDATE,
          senderId: this.userId,
          roomId: this.roomId,
          targetId,
          payload: event.candidate.toJSON()
        };
        this.sendSignalingMessage(iceMessage);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, pc.connectionState);
      if (pc.connectionState === 'failed') {
        this.handlePeerConnectionFailure(targetId);
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const stream = event.streams[0];
      this.remoteStreams.set(targetId, stream);
      this.emit(VoiceRoomEvent.STREAM_ADDED, stream, targetId);
    };

    if (!mesh) {
      this.createOffer(pc, targetId);
    }

    return pc;
  }

  /**
   * Create and send an offer
   */
  private async createOffer(pc: RTCPeerConnection, targetId: string): Promise<void> {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const offerMessage: OfferMessage = {
        type: SignalingMessageType.OFFER,
        senderId: this.userId,
        roomId: this.roomId,
        targetId,
        payload: offer
      };
      this.sendSignalingMessage(offerMessage);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handle incoming offer
   */
  private async handleOffer(message: OfferMessage): Promise<void> {
    const pc = this.peerConnections.get(message.senderId!) ||
               await this.createPeerConnection(message.senderId!);

    try {
      await pc.setRemoteDescription(message.payload);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const answerMessage: AnswerMessage = {
        type: SignalingMessageType.ANSWER,
        senderId: this.userId,
        roomId: this.roomId,
        targetId: message.senderId,
        payload: answer
      };
      this.sendSignalingMessage(answerMessage);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handle incoming answer
   */
  private async handleAnswer(message: AnswerMessage): Promise<void> {
    const pc = this.peerConnections.get(message.senderId);
    if (pc) {
      try {
        await pc.setRemoteDescription(message.payload);
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Handle incoming ICE candidate
   */
  private async handleIceCandidate(message: IceCandidateMessage): Promise<void> {
    const pc = this.peerConnections.get(message.senderId);
    if (pc) {
      try {
        await pc.addIceCandidate(message.payload);
      } catch (error) {
        this.handleError(error as Error);
      }
    }
  }

  /**
   * Handle peer connection failure
   */
  private async handlePeerConnectionFailure(targetId: string) {
    console.log(`Handling peer connection failure for ${targetId}`);
    
    this.cleanupPeerConnection(targetId);
    
    if (this.retryCount < (this.config.maxRetries || 3)) {
      this.retryCount++;
      this.emit(VoiceRoomEvent.PARTICIPANT_UPDATED, { id: targetId, isMuted: false, joinedAt: Date.now() });
      
      try {
        await new Promise(resolve => setTimeout(resolve, this.config.reconnectDelay || 1000));
        await this.createPeerConnection(targetId);
        console.log(`Reconnected to peer ${targetId}`);
      } catch (error) {
        console.error(`Failed to reconnect to peer ${targetId}:`, error);
        this.handleError(new Error(`Failed to reconnect to peer ${targetId}: ${error instanceof Error ? error.message : String(error)}`));
        this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED);
      }
    } else {
      console.log(`Max retries reached for peer ${targetId}`);
      this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.FAILED);
      this.handleError(new Error(`Failed to establish connection with peer ${targetId} after maximum retries`));
    }
  }

  /**
   * Update room topology based on participant count
   */
  private updateTopology(participantCount: number) {
    const newTopology = participantCount <= 2 
      ? VoiceTopology.P2P 
      : participantCount <= 4 
        ? VoiceTopology.MESH 
        : VoiceTopology.SFU;

    if (this.topology !== newTopology) {
      this.topology = newTopology;
      // Implement topology switch logic here if needed
    }
  }

  /**
   * Send message to signaling server
   */
  private sendSignalingMessage(message: SignalingMessage) {
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify(message));
    }
  }

  /**
   * Send join room message
   */
  private sendJoinRoom() {
    const joinMessage: JoinRoomMessage = {
      type: SignalingMessageType.JOIN_ROOM,
      senderId: this.userId,
      roomId: this.roomId,
      payload: {}
    };
    this.sendSignalingMessage(joinMessage);
  }

  /**
   * Send leave room message
   */
  private sendLeaveRoom() {
    const leaveMessage: LeaveRoomMessage = {
      type: SignalingMessageType.LEAVE_ROOM,
      senderId: this.userId,
      roomId: this.roomId
    };
    this.sendSignalingMessage(leaveMessage);
  }

  /**
   * Send participant update
   */
  private sendParticipantUpdate(update: Partial<ParticipantUpdateMessage['payload']>) {
    const updateMessage: ParticipantUpdateMessage = {
      type: SignalingMessageType.PARTICIPANT_UPDATED,
      senderId: this.userId,
      roomId: this.roomId,
      payload: update
    };
    this.sendSignalingMessage(updateMessage);
  }

  /**
   * Emit event to registered handlers
   */
  private emit<E extends VoiceRoomEvent>(event: E, ...args: Parameters<VoiceRoomEventHandler[E]>) {
    const handlers = this.eventHandlers[event];
    if (handlers) {
      handlers.forEach(handler => {
        (handler as Function)(...args);
      });
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error) {
    console.error('VoiceRoom error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    this.emit(VoiceRoomEvent.ERROR, error);
  }

  /**
   * Cleanup resources
   */
  /**
   * Clean up a specific peer connection
   */
  private cleanupPeerConnection(targetId: string) {
    const pc = this.peerConnections.get(targetId);
    if (pc) {
      // Remove all event listeners
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      pc.onconnectionstatechange = null;
      pc.onsignalingstatechange = null;

      // Close the connection
      pc.close();
      this.peerConnections.delete(targetId);

      // Clean up associated remote stream
      const remoteStream = this.remoteStreams.get(targetId);
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => {
          track.stop();
          remoteStream.removeTrack(track);
        });
        this.remoteStreams.delete(targetId);
        this.emit(VoiceRoomEvent.STREAM_REMOVED, targetId);
      }
    }
  }

  /**
   * Get a human-readable description of WebSocket state
   */
  private getWebSocketStateDescription(state: number): string {
    const states: Record<number, string> = {
      0: 'CONNECTING',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'CLOSED'
    };
    return states[state] || `UNKNOWN(${state})`;
  }

  /**
   * Get a human-readable description of WebSocket close codes
   */
  private getWebSocketCloseReason(code: number): string {
    const closeReasons: Record<number, string> = {
      1000: 'Normal closure',
      1001: 'Going away',
      1002: 'Protocol error',
      1003: 'Unsupported data',
      1004: 'Reserved',
      1005: 'No status received',
      1006: 'Abnormal closure',
      1007: 'Invalid frame payload data',
      1008: 'Policy violation',
      1009: 'Message too big',
      1010: 'Mandatory extension',
      1011: 'Internal server error',
      1012: 'Service restart',
      1013: 'Try again later',
      1014: 'Bad gateway',
      1015: 'TLS handshake'
    };
    return closeReasons[code] || `Unknown reason (${code})`;
  }

  /**
   * Diagnose WebSocket connection issues
   */
  private diagnoseWebSocketError(ws: WebSocket): string[] {
    const diagnosis: string[] = [];
    
    try {
      const url = new URL(ws.url);
      
      // Check URL format
      if (!url.protocol.match(/^wss?:/)) {
        diagnosis.push(`Invalid protocol: ${url.protocol}. Must be ws:// or wss://`);
      }

      // Check port configuration
      if (url.port) {
        const port = parseInt(url.port, 10);
        if (isNaN(port) || port < 1 || port > 65535) {
          diagnosis.push(`Invalid port number: ${url.port}`);
        }
      }

      // Check hostname
      if (!url.hostname || url.hostname === 'null') {
        diagnosis.push('Invalid or missing hostname');
      }

      // Check for common port conflicts
      if (url.protocol === 'wss:' && url.port === '80') {
        diagnosis.push('Using insecure port 80 with WSS protocol');
      }
      if (url.protocol === 'ws:' && url.port === '443') {
        diagnosis.push('Using secure port 443 with WS protocol');
      }

      // Check development environment
      if (process.env.NODE_ENV === 'development') {
        if (url.hostname === 'localhost' && !url.port) {
          diagnosis.push('Missing port in development environment');
        }
      }

      // Add readyState information
      diagnosis.push(`WebSocket state: ${this.getWebSocketStateDescription(ws.readyState)}`);

    } catch (error) {
      diagnosis.push(`URL parsing error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return diagnosis;
  }

  /**
   * Clean up all resources
   */
  private cleanup() {
    // Clean up audio context and analysis
    if (this.audioContext?.state !== 'closed') {
      this.audioContext?.close();
    }
    this.audioContext = null;
    this.audioAnalyser = null;

    // Stop and cleanup local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
      });
      this.localStream = null;
    }

    // Clean up all peer connections
    this.peerConnections.forEach((_, targetId) => {
      this.cleanupPeerConnection(targetId);
    });
    this.peerConnections.clear();

    // Close WebSocket connection
    if (this.websocket?.readyState === WebSocket.OPEN) {
      this.websocket.close();
    }
    this.websocket = null;

    // Reset all state
    this.retryCount = 0;
    this.roomInfo = null;
    this.topology = VoiceTopology.P2P;
    this.isSpeaking = false;

    this.emit(VoiceRoomEvent.CONNECTION_STATE_CHANGED, VoiceConnectionState.DISCONNECTED);
  }
}