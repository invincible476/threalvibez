export const CALL_ERROR_CODES = {
  ERR_MIC_DENIED: {
    code: 101,
    key: 'ERR_MIC_DENIED',
    title: 'Microphone Access Denied',
    message: 'Microphone access rejected by user or blocked by browser policy.',
  },
  ERR_MIC_UNSUPPORTED: {
    code: 102,
    key: 'ERR_MIC_UNSUPPORTED',
    title: 'Microphone Unsupported',
    message: 'mediaDevices.getUserMedia not available on current device context.',
  },
  ERR_SNAPSHOT_DESYNC: {
    code: 201,
    key: 'ERR_SNAPSHOT_DESYNC',
    title: 'Auth Context Desync',
    message: 'Auth/User context re-rendered during active ringing state.',
  },
  ERR_OFFER_MISSING: {
    code: 301,
    key: 'ERR_OFFER_MISSING',
    title: 'SDP Offer Missing',
    message: 'Call doc ringing but SDP offer payload is null/invalid.',
  },
  ERR_ANSWER_TIMEOUT: {
    code: 302,
    key: 'ERR_ANSWER_TIMEOUT',
    title: 'SDP Answer Timeout',
    message: 'Callee accepted but SDP answer failed to post within 10s.',
  },
  ERR_ICE_DISCONNECTED: {
    code: 401,
    key: 'ERR_ICE_DISCONNECTED',
    title: 'ICE Disconnected',
    message: 'WebRTC peer connection dropped or blocked by firewall/NAT.',
  },
} as const;

export type CallErrorCodeKey = keyof typeof CALL_ERROR_CODES;

export interface CallTelemetryState {
  status: string;
  currentStep: string;
  errorCode: string | null;
  errorDetails?: any;
}

export function logVoiceError(code: string | number, errorDetails?: any) {
  console.error(`[VoiceEngine Error ${code}]`, errorDetails || '');
}

type TelemetryListener = (state: CallTelemetryState) => void;

class CallTelemetryManager {
  private state: CallTelemetryState = {
    status: 'idle',
    currentStep: 'Idle',
    errorCode: null,
  };
  private listeners: Set<TelemetryListener> = new Set();

  public getSnapshot(): CallTelemetryState {
    return this.state;
  }

  public update(update: Partial<CallTelemetryState>) {
    const nextState = { ...this.state, ...update };
    this.state = nextState;
    if (update.errorCode && update.errorCode !== 'NONE') {
      logVoiceError(update.errorCode, update.errorDetails || nextState);
    }
    this.notify();
  }

  public setError(codeKey: CallErrorCodeKey, errorDetails?: any) {
    const errObj = CALL_ERROR_CODES[codeKey];
    const codeString = `${errObj.key} (${errObj.code})`;
    this.update({
      errorCode: codeString,
      errorDetails: errorDetails || errObj.message,
    });
  }

  public reset() {
    this.state = {
      status: 'idle',
      currentStep: 'Idle',
      errorCode: null,
    };
    this.notify();
  }

  public subscribe(listener: TelemetryListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l(this.state));
  }
}

export const callTelemetry = new CallTelemetryManager();

/**
 * Check microphone permissions and support safely across browsers
 */
export async function checkMicrophonePermission(): Promise<{
  granted: boolean;
  state: 'granted' | 'denied' | 'prompt' | 'unsupported';
  errorKey?: CallErrorCodeKey;
}> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return { granted: false, state: 'unsupported', errorKey: 'ERR_MIC_UNSUPPORTED' };
  }

  try {
    if (navigator.permissions && navigator.permissions.query) {
      const perm = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (perm.state === 'denied') {
        return { granted: false, state: 'denied', errorKey: 'ERR_MIC_DENIED' };
      }
      if (perm.state === 'granted') {
        return { granted: true, state: 'granted' };
      }
      return { granted: false, state: 'prompt' };
    }
  } catch (e) {
    // Firefox/Safari may throw when querying 'microphone' permission
  }

  return { granted: false, state: 'prompt' };
}
