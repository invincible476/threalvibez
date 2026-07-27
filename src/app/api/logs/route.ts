import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const logsDir = path.join(process.cwd(), 'logs');

    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const clientLogEntry = {
      ...body,
      receivedAt: new Date().toISOString(),
      ip: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'unknown',
    };

    const targetFile = body?.level === 'error' || body?.level === 'fatal'
      ? path.join(logsDir, 'error.log')
      : path.join(logsDir, 'client.log');

    fs.appendFileSync(targetFile, JSON.stringify(clientLogEntry) + '\n', 'utf8');
    fs.appendFileSync(path.join(logsDir, 'combined.log'), JSON.stringify(clientLogEntry) + '\n', 'utf8');

    return NextResponse.json({ success: true, timestamp: clientLogEntry.receivedAt });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to persist log entry' },
      { status: 500 }
    );
  }
}
