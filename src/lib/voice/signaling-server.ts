import { WebSocket } from 'ws';
import { VoiceRoom, VoiceRoomParticipant } from '@/lib/voice/types';
import {
  SignalingMessage,
  SignalingMessageType,
  JoinRoomMessage,
  RoomInfoMessage,
  ErrorMessage
} from './signaling-messages';

export class VoiceSignalingServer {
  private rooms: Map<string, VoiceRoom> = new Map();
  private connections: Map<string, WebSocket> = new Map();

  constructor() {
    this.setupCleanupInterval();
  }

  /**
   * Handle a new WebSocket connection
   */
  public handleConnection(ws: WebSocket, userId: string) {
    this.connections.set(userId, ws);

    ws.on('message', (data: string) => {
      try {
        const message: SignalingMessage = JSON.parse(data);
        this.handleMessage(message, userId);
      } catch (error) {
        console.error('Error handling message:', error);
        this.sendError(userId, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      this.handleDisconnect(userId);
    });
  }

  /**
   * Handle incoming signaling messages
   */
  private handleMessage(message: SignalingMessage, senderId: string) {
    switch (message.type) {
      case SignalingMessageType.JOIN_ROOM:
        this.handleJoinRoom(message.roomId, senderId);
        break;

      case SignalingMessageType.LEAVE_ROOM:
        this.handleLeaveRoom(message.roomId, senderId);
        break;

      case SignalingMessageType.OFFER:
      case SignalingMessageType.ANSWER:
      case SignalingMessageType.ICE_CANDIDATE:
        this.forwardMessage(message);
        break;

      default:
        this.sendError(senderId, 'Unknown message type');
    }
  }

  /**
   * Handle a user joining a voice room
   */
  private handleJoinRoom(roomId: string, userId: string) {
    let room = this.rooms.get(roomId);
    
    if (!room) {
      room = {
        id: roomId,
        participants: new Map(),
        createdAt: Date.now(),
      };
      this.rooms.set(roomId, room);
    }

    const participant: VoiceRoomParticipant = {
      id: userId,
      joinedAt: Date.now(),
      isMuted: false,
    };

    room.participants.set(userId, participant);

    // Notify all participants about the new user
    this.broadcastRoomInfo(roomId);

    // For P2P connections (2 participants), initiate connection
    if (room.participants.size === 2) {
      this.initiateP2PConnection(roomId);
    }
    // For 3+ participants, switch to mesh/SFU mode
    else if (room.participants.size > 2) {
      this.switchToMeshNetwork(roomId, userId);
    }
  }

  /**
   * Handle a user leaving a voice room
   */
  private handleLeaveRoom(roomId: string, userId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.delete(userId);

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    } else {
      this.broadcastRoomInfo(roomId);
    }
  }

  /**
   * Handle user disconnection
   */
  private handleDisconnect(userId: string) {
    this.connections.delete(userId);

    // Remove user from all rooms they were in
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.participants.has(userId)) {
        this.handleLeaveRoom(roomId, userId);
      }
    }
  }

  /**
   * Forward WebRTC signaling messages between peers
   */
  private forwardMessage(message: SignalingMessage) {
    if (!message.targetId) return;

    const targetWs = this.connections.get(message.targetId);
    if (targetWs && targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast room information to all participants
   */
  private broadcastRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const roomInfo = {
      id: room.id,
      participants: Array.from(room.participants.values()),
    };

    const message: SignalingMessage = {
      type: SignalingMessageType.ROOM_INFO,
      payload: roomInfo,
      senderId: 'server',
      roomId,
    };

    room.participants.forEach((_: VoiceRoomParticipant, participantId: string) => {
      const ws = this.connections.get(participantId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Initiate P2P connections for a 2-participant room
   */
  private initiateP2PConnection(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.participants.size !== 2) return;

    const [participant1, participant2] = room.participants.keys();
    
    // Signal to the first participant to create an offer
    const initiateMessage: SignalingMessage = {
      type: SignalingMessageType.JOIN_ROOM,
      payload: { initiator: true },
      senderId: 'server',
      roomId,
      targetId: participant1,
    };

    const ws = this.connections.get(participant1);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(initiateMessage));
    }
  }

  /**
   * Switch to mesh network topology for rooms with more than 2 participants
   */
  private switchToMeshNetwork(roomId: string, newUserId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Signal to existing participants to connect with the new user
    room.participants.forEach((_: VoiceRoomParticipant, participantId: string) => {
      if (participantId === newUserId) return;

      const message: SignalingMessage = {
        type: SignalingMessageType.JOIN_ROOM,
        payload: { initiator: true, mesh: true },
        senderId: 'server',
        roomId,
        targetId: participantId,
      };

      const ws = this.connections.get(participantId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Send error message to a specific user
   */
  private sendError(userId: string, error: string) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      const message: SignalingMessage = {
        type: SignalingMessageType.ERROR,
        payload: { error },
        senderId: 'server',
        roomId: '',
      };
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Setup interval to clean up inactive rooms
   */
  private setupCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      for (const [roomId, room] of this.rooms.entries()) {
        // Clean up rooms inactive for more than 24 hours
        if (now - room.createdAt > 24 * 60 * 60 * 1000) {
          this.rooms.delete(roomId);
        }
      }
    }, 60 * 60 * 1000); // Run cleanup every hour
  }
}