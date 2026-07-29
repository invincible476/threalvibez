import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import nodemailer from 'nodemailer';

const zSendVerificationRequest = z.object({
  email: z.string().email(),
});

const zVerifyCodeRequest = z.object({
  email: z.string().email(),
  code: z.string().min(1),
});

// Global storage for verification codes in Next.js dev & serverless execution contexts
const globalForVerification = globalThis as unknown as {
  verificationStore?: Map<string, { code: string; expiresAt: number; attempts: number }>;
  rateLimitStore?: Map<string, { count: number; resetTime: number }>;
};

const verificationStore =
  globalForVerification.verificationStore ||
  new Map<string, { code: string; expiresAt: number; attempts: number }>();

const rateLimitStore =
  globalForVerification.rateLimitStore ||
  new Map<string, { count: number; resetTime: number }>();

if (process.env.NODE_ENV !== 'production') {
  globalForVerification.verificationStore = verificationStore;
  globalForVerification.rateLimitStore = rateLimitStore;
}

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // Max 5 attempts per minute

  const record = rateLimitStore.get(identifier);
  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  record.count++;
  return false;
}

function getTransporter() {
  const user = process.env.GMAIL_EMAIL || process.env.GMAIL_USER || 'madara24uchihaa@gmail.com';
  const pass = process.env.GMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD || 'disi jmkj kefu htbo';

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

async function sendEmailDirectly(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; message?: string }> {
  const transporter = getTransporter();
  const from = process.env.GMAIL_EMAIL || process.env.GMAIL_USER || 'madara24uchihaa@gmail.com';

  try {
    const info = await transporter.sendMail({
      from: `Vibez Verification <${from}>`,
      to,
      subject,
      text,
      html,
    });

    console.log('Email sent successfully to:', to, 'Message ID:', info.messageId);
    return { success: true, message: 'Verification email sent successfully' };
  } catch (error: any) {
    console.error('Gmail SMTP error sending to', to, 'Error:', error);

    // If SMTP fails, log code in console for development fallback
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=== EMAIL VERIFICATION CODE (Console Fallback) ===');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Content:', text);
      console.log('==================================================\n');
    }

    return {
      success: false,
      message: error?.message || 'Failed to deliver verification email via SMTP. Please try again.',
    };
  }
}

async function sendVerificationCode(
  email: string,
  clientIP: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const emailKey = `email:${cleanEmail}`;
    const ipKey = `ip:${clientIP}`;

    if (isRateLimited(emailKey) || isRateLimited(ipKey)) {
      return { success: false, message: 'Too many verification requests. Please wait a minute and try again.' };
    }

    const code = generateVerificationCode();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity

    // Store verification code in global store
    verificationStore.set(cleanEmail, {
      code,
      expiresAt,
      attempts: 0,
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; margin: 0; font-size: 28px;">Vibez</h1>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
          <h2 style="margin: 0 0 15px 0;">Verify Your Email Address</h2>
          <p style="margin: 0 0 25px 0; font-size: 16px; opacity: 0.95;">Welcome to Vibez! Enter the code below to verify your email and complete your registration:</p>
          <div style="background: rgba(255,255,255,0.25); padding: 18px 24px; border-radius: 10px; font-size: 34px; font-weight: bold; letter-spacing: 10px; margin: 20px 0; display: inline-block;">
            ${code}
          </div>
          <p style="margin: 25px 0 0 0; font-size: 14px; opacity: 0.85;">This verification code will expire in 15 minutes.</p>
        </div>
      </div>
    `;

    const text = `Welcome to Vibez! Your email verification code is: ${code}. This code will expire in 15 minutes.`;

    const emailResult = await sendEmailDirectly(cleanEmail, 'Vibez - Email Verification Code', html, text);
    return emailResult;
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    return { success: false, message: error?.message || 'Failed to send verification code' };
  }
}

async function verifyCode(
  email: string,
  code: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.trim();
    const record = verificationStore.get(cleanEmail);

    if (!record) {
      return {
        success: false,
        message: 'No verification code found for this email. Please request a new code.',
      };
    }

    const { code: storedCode, expiresAt, attempts } = record;

    if (Date.now() > expiresAt) {
      verificationStore.delete(cleanEmail);
      return {
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      };
    }

    if (attempts >= 5) {
      verificationStore.delete(cleanEmail);
      return {
        success: false,
        message: 'Too many incorrect attempts. Please request a new verification code.',
      };
    }

    if (cleanCode === storedCode) {
      verificationStore.delete(cleanEmail);
      return {
        success: true,
        message: 'Email code verified successfully.',
      };
    } else {
      record.attempts += 1;
      verificationStore.set(cleanEmail, record);
      return {
        success: false,
        message: `Incorrect verification code. ${5 - record.attempts} attempt(s) remaining.`,
      };
    }
  } catch (error: any) {
    console.error('Error verifying code:', error);
    return {
      success: false,
      message: 'An error occurred while verifying the code.',
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const clientIP =
      headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown';

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    if (action === 'send') {
      const body = await request.json();
      const parseResult = zSendVerificationRequest.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid email address' },
          { status: 400 }
        );
      }

      const result = await sendVerificationCode(parseResult.data.email, clientIP);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.message || 'Failed to send email. Please try again.' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: result.message });
    }

    if (action === 'verify') {
      const body = await request.json();
      const parseResult = zVerifyCodeRequest.safeParse(body);

      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid verification data. Code must be provided.' },
          { status: 400 }
        );
      }

      const { email, code } = parseResult.data;
      const result = await verifyCode(email, code);

      return NextResponse.json({
        success: result.success,
        message: result.message,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action parameter' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Verification API error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
