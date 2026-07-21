import {
  SignalingMessage,
  SignalingMessageType,
  JoinRoomMessage,
  LeaveRoomMessage,
  RoomInfoMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  ParticipantUpdateMessage,
  ErrorMessage,
} from './signaling-messages';

// Type guard functions
function isJoinRoomMessage(message: SignalingMessage): message is JoinRoomMessage {
  return message.type === SignalingMessageType.JOIN_ROOM;
}

function isLeaveRoomMessage(message: SignalingMessage): message is LeaveRoomMessage {
  return message.type === SignalingMessageType.LEAVE_ROOM;
}

function isRoomInfoMessage(message: SignalingMessage): message is RoomInfoMessage {
  return message.type === SignalingMessageType.ROOM_INFO;
}

function isOfferMessage(message: SignalingMessage): message is OfferMessage {
  return message.type === SignalingMessageType.OFFER;
}

function isAnswerMessage(message: SignalingMessage): message is AnswerMessage {
  return message.type === SignalingMessageType.ANSWER;
}

function isIceCandidateMessage(message: SignalingMessage): message is IceCandidateMessage {
  return message.type === SignalingMessageType.ICE_CANDIDATE;
}

function isParticipantUpdateMessage(message: SignalingMessage): message is ParticipantUpdateMessage {
  return message.type === SignalingMessageType.PARTICIPANT_UPDATED;
}

function isErrorMessage(message: SignalingMessage): message is ErrorMessage {
  return message.type === SignalingMessageType.ERROR;
}

export async function handleSignalingMessage(
  message: SignalingMessage,
  handlers: {
    createPeerConnection: (targetId: string, mesh?: boolean) => Promise<RTCPeerConnection>,
    handleRoomInfo: (payload: RoomInfoMessage['payload']) => void,
    handleOffer: (message: OfferMessage) => Promise<void>,
    handleAnswer: (message: AnswerMessage) => Promise<void>,
    handleIceCandidate: (message: IceCandidateMessage) => Promise<void>,
    handleParticipantUpdate: (message: ParticipantUpdateMessage) => void,
    handleParticipantLeft: (targetId: string) => void,
    handleError: (error: Error) => void,
  }
): Promise<void> {
  try {
    // Validate common message properties
    if (!message.senderId) {
      throw new Error('Missing senderId in signaling message');
    }

    if (!message.roomId) {
      throw new Error('Missing roomId in signaling message');
    }

    // Handle each message type with proper type guards
    if (isJoinRoomMessage(message)) {
      if (message.payload.initiator) {
        if (!message.targetId) {
          throw new Error('Missing targetId in JOIN_ROOM message');
        }
        await handlers.createPeerConnection(message.targetId, message.payload.mesh);
      }
    }
    else if (isLeaveRoomMessage(message)) {
      if (message.targetId) {
        handlers.handleParticipantLeft(message.targetId);
      }
    }
    else if (isRoomInfoMessage(message)) {
      handlers.handleRoomInfo(message.payload);
    }
    else if (isOfferMessage(message)) {
      if (!message.payload || !message.payload.type || !message.payload.sdp) {
        throw new Error('Invalid SDP in OFFER message');
      }
      await handlers.handleOffer(message);
    }
    else if (isAnswerMessage(message)) {
      if (!message.payload || !message.payload.type || !message.payload.sdp) {
        throw new Error('Invalid SDP in ANSWER message');
      }
      await handlers.handleAnswer(message);
    }
    else if (isIceCandidateMessage(message)) {
      if (!message.payload) {
        throw new Error('Missing payload in ICE_CANDIDATE message');
      }
      await handlers.handleIceCandidate(message);
    }
    else if (isParticipantUpdateMessage(message)) {
      if (!message.payload) {
        throw new Error('Missing payload in PARTICIPANT_UPDATED message');
      }
      handlers.handleParticipantUpdate(message);
    }
    else if (isErrorMessage(message)) {
      if (!message.payload || !message.payload.error) {
        throw new Error('Missing error message in ERROR message');
      }
      handlers.handleError(new Error(message.payload.error));
    }
    else {
      // Exhaustive type checking - will cause compile error if we miss a message type
      const _exhaustiveCheck: never = message;
      throw new Error(`Unhandled message type: ${(message as SignalingMessage).type}`);
    }
  } catch (error) {
    // Pass through signaling errors but wrap other errors
    if (error instanceof Error) {
      handlers.handleError(error);
    } else {
      handlers.handleError(new Error(`Error handling signaling message: ${String(error)}`));
    }
  }
}