import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { z } from 'zod';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL || 'invincibleshinmen@gmail.com',
    pass: process.env.GMAIL_PASSWORD || 'qzyl czow daei xabj',
  },
});

const zSmtpMessage = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the request body
    const parseResult = zSmtpMessage.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid email data' },
        { status: 400 }
      );
    }

    const mailOptions = {
      from: process.env.GMAIL_EMAIL || 'invincibleshinmen@gmail.com',
      ...parseResult.data
    };

    const info = await transporter.sendMail(mailOptions);
    
    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      response: info.response
    });
  } catch (error) {
    console.error('Error sending email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send email' },
      { status: 500 }
    );
  }
}