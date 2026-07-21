import { User } from 'firebase/auth';

export interface DeviceRegistrationResult {
  success: boolean;
  deviceId?: string;
  error?: string;
}

/**
 * Register device securely using Firebase ID token
 * This replaces localStorage-based device tracking
 */
export async function registerDeviceSecurely(user: User): Promise<DeviceRegistrationResult> {
  try {
    // Get fresh ID token
    const idToken = await user.getIdToken();
    
    const response = await fetch('/api/device', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authToken: idToken,
        deviceType: 'web',
      }),
    });

    const result = await response.json();
    
    if (result.success) {
      return {
        success: true,
        deviceId: result.deviceId,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Device registration failed',
      };
    }
  } catch (error) {
    console.error('Device registration error:', error);
    return {
      success: false,
      error: 'Network error during device registration',
    };
  }
}

/**
 * Get device ID from secure HttpOnly cookie (server-side only)
 * This function is for documentation - actual reading happens server-side
 */
export function getDeviceIdNote(): string {
  return 'Device ID is stored securely in HttpOnly cookie and managed server-side only';
}