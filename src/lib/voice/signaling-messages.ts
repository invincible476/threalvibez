export enum SignalingMessageType {
  JOIN_ROOM = 'JOIN_ROOM',
  LEAVE_ROOM = 'LEAVE_ROOM',
  OFFER = 'OFFER',
  ANSWER = 'ANSWER',
  ICE_CANDIDATE = 'ICE_CANDIDATE',
  ROOM_INFO = 'ROOM_INFO',
  PARTICIPANT_UPDATED = 'PARTICIPANT_UPDATED',
  ERROR = 'ERROR',
}

export interface BaseSignalingMessage {
  type: SignalingMessageType;
  senderId: string;
  roomId: string;
  targetId?: string;
}

export interface JoinRoomMessage extends BaseSignalingMessage {
  type: SignalingMessageType.JOIN_ROOM;
  payload: {
    initiator?: boolean;
    mesh?: boolean;
  };
}

export interface LeaveRoomMessage extends BaseSignalingMessage {
  type: SignalingMessageType.LEAVE_ROOM;
}

export interface OfferMessage extends BaseSignalingMessage {
  type: SignalingMessageType.OFFER;
  payload: RTCSessionDescriptionInit;
}

export interface AnswerMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ANSWER;
  payload: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ICE_CANDIDATE;
  payload: RTCIceCandidateInit;
}

export interface RoomInfoMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ROOM_INFO;
  payload: {
    id?: string;
    participants?: Array<{
      id: string;
      joinedAt: number;
      isMuted: boolean;
      isSpeaking?: boolean;
    }>;
    ping?: boolean;
  };
}

export interface ParticipantUpdateMessage extends BaseSignalingMessage {
  type: SignalingMessageType.PARTICIPANT_UPDATED;
  payload: {
    isMuted?: boolean;
    isSpeaking?: boolean;
  };
}

export interface ErrorMessage extends BaseSignalingMessage {
  type: SignalingMessageType.ERROR;
  payload: {
    error: string;
  };
}

export type SignalingMessage =
  | JoinRoomMessage
  | LeaveRoomMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | RoomInfoMessage
  | ParticipantUpdateMessage
  | ErrorMessage;