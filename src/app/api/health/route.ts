import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const startTime = Date.now();
  const logsDir = path.join(process.cwd(), 'logs');

  let logStats: Record<string, { sizeBytes: number; exists: boolean }> = {};

  if (fs.existsSync(logsDir)) {
    const files = ['app.log', 'error.log', 'client.log', 'combined.log', 'launch.log', 'access.log'];
    files.forEach((file) => {
      const filePath = path.join(logsDir, file);
      if (fs.existsSync(filePath)) {
        const stat = fs.statSync(filePath);
        logStats[file] = { sizeBytes: stat.size, exists: true };
      } else {
        logStats[file] = { sizeBytes: 0, exists: false };
      }
    });
  }

  const memoryUsage = process.memoryUsage();

  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    memory: {
      rssMB: Math.round(memoryUsage.rss / (1024 * 1024)),
      heapTotalMB: Math.round(memoryUsage.heapTotal / (1024 * 1024)),
      heapUsedMB: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
    },
    logStats,
    responseTimeMs: Date.now() - startTime,
  };

  return NextResponse.json(healthData, { status: 200 });
}
