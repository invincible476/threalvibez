import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User document not found in Firestore' }, { status: 404 });
    }

    const userData = userDoc.data();
    const fcmTokens: string[] = userData?.fcmTokens || [];

    if (fcmTokens.length === 0) {
      return NextResponse.json({
        status: 'FAIL',
        reason: 'NO_TOKENS_IN_FIRESTORE',
        message: `User ${userId} has 0 tokens in users/${userId}.fcmTokens. The device hasn't registered a push token yet.`,
        userDataKeys: Object.keys(userData || {}),
      });
    }

    // Check if Firebase Service Account key is present
    const hasServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

    const messaging = getAdminMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens: fcmTokens,
      notification: {
        title: '🔔 Test Push Notification',
        body: 'If you see this, Android push notifications are 100% WORKING!',
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'messages',
          sound: 'default',
          icon: 'ic_launcher',
          color: '#6366F1',
        },
      },
    });

    return NextResponse.json({
      status: response.successCount > 0 ? 'SUCCESS' : 'FAIL',
      hasServiceAccountEnv: hasServiceAccount,
      tokensFound: fcmTokens.length,
      successCount: response.successCount,
      failureCount: response.failureCount,
      fcmResponses: response.responses.map(r => ({
        success: r.success,
        errorCode: r.error?.code || null,
        errorMessage: r.error?.message || null,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'CRITICAL_ERROR',
      errorMessage: error?.message || String(error),
      errorStack: error?.stack || null,
    }, { status: 500 });
  }
}
