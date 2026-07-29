// Client-side email service that calls API routes

export async function sendEmail(message: { to: string; subject: string; html: string; text?: string }) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) throw new Error('Failed to send email');
    return response.json();
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Server-backed verification API integration
export async function sendVerificationRequest(email: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout guard

    const response = await fetch('/api/verify-email?action=send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();
    if (!response.ok || !result.success) {
      console.warn('Verification send request failed:', result.error || result.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending verification request:', error);
    return false;
  }
}

export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch('/api/verify-email?action=verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    return {
      success: !!result.success,
      message: result.message || result.error || (result.success ? 'Verification successful' : 'Verification failed'),
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        message: 'Verification request timed out. Please try again.',
      };
    }
    console.error('Error verifying email code:', error);
    return {
      success: false,
      message: 'Failed to verify code. Please try again.',
    };
  }
}

export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}