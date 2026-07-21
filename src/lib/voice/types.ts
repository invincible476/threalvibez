/**
 * Voice room participant information
 */
export interface VoiceRoomParticipant {
  id: string;
  joinedAt: number;
  isMuted: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
}

/**
 * Voice room state
 */
export interface VoiceRoom {
  id: string;
  participants: Map<string, VoiceRoomParticipant>;
  createdAt: number;
}

/**
 * Voice connection configuration
 */
export interface VoiceConnectionConfig {
  iceServers: RTCIceServer[];
  maxRetries?: number;
  reconnectDelay?: number;
}

/**
 * Voice room event types
 */
export enum VoiceRoomEvent {
  PARTICIPANT_JOINED = 'PARTICIPANT_JOINED',
  PARTICIPANT_LEFT = 'PARTICIPANT_LEFT',
  PARTICIPANT_UPDATED = 'PARTICIPANT_UPDATED',
  STREAM_ADDED = 'STREAM_ADDED',
  STREAM_REMOVED = 'STREAM_REMOVED',
  CONNECTION_STATE_CHANGED = 'CONNECTION_STATE_CHANGED',
  ERROR = 'ERROR',
}

/**
 * Voice room event handler types
 */
export type VoiceRoomEventHandler = {
  [VoiceRoomEvent.PARTICIPANT_JOINED]: (participant: VoiceRoomParticipant) => void;
  [VoiceRoomEvent.PARTICIPANT_LEFT]: (participantId: string) => void;
  [VoiceRoomEvent.PARTICIPANT_UPDATED]: (participant: VoiceRoomParticipant) => void;
  [VoiceRoomEvent.STREAM_ADDED]: (stream: MediaStream, participantId: string) => void;
  [VoiceRoomEvent.STREAM_REMOVED]: (participantId: string) => void;
  [VoiceRoomEvent.CONNECTION_STATE_CHANGED]: (state: RTCPeerConnectionState) => void;
  [VoiceRoomEvent.ERROR]: (error: Error) => void;
};

/**
 * Voice connection states
 */
export enum VoiceConnectionState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
}

/**
 * Voice room connection topology
 */
export enum VoiceTopology {
  P2P = 'p2p',
  MESH = 'mesh',
  SFU = 'sfu',
}