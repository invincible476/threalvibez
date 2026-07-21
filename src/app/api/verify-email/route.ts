
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import crypto from 'crypto';

const zSendVerificationRequest = z.object({
  email: z.string().email(),
});

const zVerifyCodeRequest = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

// In-memory storage for development (use Redis in production)
const verificationStore = new Map<string, { 
  code: string; 
  expiresAt: number; 
  attempts: number; 
}>();

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 3; // Max 3 attempts per minute

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

// Use Firebase Admin and Gmail SMTP
async function sendEmailDirectly(to: string, subject: string, html: string, text: string): Promise<{ success: boolean; message?: string }> {
  const nodemailer = require('nodemailer');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_EMAIL || 'invincibleshinmen@gmail.com',
      pass: process.env.GMAIL_PASSWORD || 'qzyl czow daei xabj',
    },
  });

  try {
    const info = await transporter.sendMail({
      from: process.env.GMAIL_EMAIL || 'invincibleshinmen@gmail.com',
      to,
      subject,
      text,
      html,
    });

    console.log('Email sent successfully to:', to, 'Message ID:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Gmail SMTP error:', error);
    
    // In development, log the verification code for testing
    if (process.env.NODE_ENV === 'development') {
      console.log('\n=== EMAIL VERIFICATION CODE (For Development Testing) ===');
      console.log('To:', to);
      console.log('Subject:', subject);
      console.log('Content:', text);
      console.log('========================================================\n');
      return { success: true, message: 'Development mode - code logged to console' };
    }
    
    return { success: false, message: 'Email service unavailable' };
  }
}

async function sendVerificationCode(email: string, clientIP: string): Promise<{ success: boolean; message?: string }> {
  try {
    // Rate limiting per email and IP
    const emailKey = `email:${email}`;
    const ipKey = `ip:${clientIP}`;
    
    if (isRateLimited(emailKey) || isRateLimited(ipKey)) {
      return { success: false, message: 'Rate limit exceeded' };
    }

    const code = generateVerificationCode();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Store verification code in memory
    verificationStore.set(email, {
      code,
      expiresAt,
      attempts: 0,
    });

    // Send email directly
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; margin: 0;">Vibez</h1>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="margin: 0 0 20px 0;">Verify Your Email</h2>
          <p style="margin: 0 0 30px 0; font-size: 16px;">Welcome to Vibez! Please use the verification code below to complete your registration:</p>
          <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p style="margin: 20px 0 0 0; font-size: 14px; opacity: 0.9;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `;

    const text = `Welcome to Vibez! Your verification code is: ${code}. This code will expire in 10 minutes.`;

    const emailResult = await sendEmailDirectly(email, 'Vibez - Email Verification Code', html, text);
    return emailResult;
  } catch (error) {
    console.error('Error sending verification code:', error);
    return { success: false, message: 'Failed to send verification code' };
  }
}

async function sendPasswordResetEmail(email: string): Promise<{ success: boolean; message?: string }> {
  try {
    const resetCode = generateVerificationCode();
    const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes for password reset
    
    // Store reset code
    verificationStore.set(`reset:${email}`, {
      code: resetCode,
      expiresAt,
      attempts: 0,
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #6366f1; margin: 0;">Vibez</h1>
        </div>
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center;">
          <h2 style="margin: 0 0 20px 0;">Reset Your Password</h2>
          <p style="margin: 0 0 30px 0; font-size: 16px;">You requested a password reset. Use the code below to reset your password:</p>
          <div style="background: rgba(255,255,255,0.2); padding: 20px; border-radius: 8px; font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 20px 0;">
            ${resetCode}
          </div>
          <p style="margin: 20px 0 0 0; font-size: 14px; opacity: 0.9;">This code will expire in 30 minutes. If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    `;

    const text = `Password reset code for Vibez: ${resetCode}. This code will expire in 30 minutes.`;

    const emailResult = await sendEmailDirectly(email, 'Vibez - Password Reset Code', html, text);
    return emailResult;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, message: 'Failed to send password reset email' };
  }
}

async function verifyCode(email: string, code: string): Promise<{ success: boolean; message?: string }> {
  try {
    const record = verificationStore.get(email);
    
    if (!record) {
      return { 
        success: false, 
        message: 'No verification code found. Please request a new code.'
      };
    }

    const { code: storedCode, expiresAt, attempts } = record;

    // Check if expired
    if (Date.now() > expiresAt) {
      verificationStore.delete(email);
      return { 
        success: false, 
        message: 'Verification code has expired. Please request a new code.'
      };
    }

    // Check attempts (rate limiting)
    if (attempts >= 5) {
      verificationStore.delete(email);
      return { 
        success: false, 
        message: 'Too many attempts. Please request a new code.'
      };
    }

    // Verify the code
    if (code === storedCode) {
      // Code is correct, delete the verification record
      verificationStore.delete(email);
      return { 
        success: true, 
        message: 'Code verified successfully.'
      };
    } else {
      // Increment attempts
      record.attempts += 1;
      verificationStore.set(email, record);
      return { 
        success: false, 
        message: `Invalid code. ${5 - record.attempts} attempts remaining.`
      };
    }
  } catch (error) {
    console.error('Error verifying code:', error);
    return { 
      success: false, 
      message: 'An error occurred while verifying the code.'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const clientIP = headersList.get('x-forwarded-for') || 
                     headersList.get('x-real-ip') || 
                     'unknown';

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
          { status: 500 }
        );
      }
      
      return NextResponse.json({ success: true, message: result.message });
    }

    if (action === 'verify') {
      const body = await request.json();
      const parseResult = zVerifyCodeRequest.safeParse(body);
      
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid verification data' },
          { status: 400 }
        );
      }

      const { email, code } = parseResult.data;
      const result = await verifyCode(email, code);
      
      return NextResponse.json({
        success: result.success,
        message: result.message
      });
    }

    if (action === 'reset-password') {
      const body = await request.json();
      const parseResult = zSendVerificationRequest.safeParse(body);
      
      if (!parseResult.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid email address' },
          { status: 400 }
        );
      }

      const result = await sendPasswordResetEmail(parseResult.data.email);
      
      return NextResponse.json({ 
        success: result.success, 
        message: result.message,
        error: result.success ? undefined : result.message 
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Verification API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
