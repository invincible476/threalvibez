import { NextResponse } from 'next/server';
import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { chatId, senderId, text, senderName, senderPhoto } = body;

    if (!chatId || !senderId) {
      return NextResponse.json({ error: 'Missing required parameters: chatId or senderId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    
    // 1. Fetch conversation details to get participants
    const convoDoc = await db.collection('conversations').doc(chatId).get();
    if (!convoDoc.exists) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const convoData = convoDoc.data();
    const participants: string[] = convoData?.participants || [];

    // Filter out the sender
    const recipientIds = participants.filter((id) => id !== senderId);
    if (recipientIds.length === 0) {
      return NextResponse.json({ success: true, message: 'No recipients to notify' });
    }

    // 2. Fetch FCM tokens for each recipient
    const recipientTokens: string[] = [];
    
    for (const recipientId of recipientIds) {
      const userDoc = await db.collection('users').doc(recipientId).get();
      if (!userDoc.exists) continue;

      const userData = userDoc.data();
      
      // Check if recipient muted this conversation or muted all notifications
      const isMutedConvo = Array.isArray(userData?.mutedConversations) && userData.mutedConversations.includes(chatId);
      const isMutedAll = userData?.areNotificationsMuted === true;

      if (isMutedConvo || isMutedAll) continue;

      const tokens = userData?.fcmTokens;
      if (Array.isArray(tokens) && tokens.length > 0) {
        recipientTokens.push(...tokens);
      }
    }

    // Remove duplicates
    const uniqueTokens = Array.from(new Set(recipientTokens)).filter(Boolean);

    if (uniqueTokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No recipient FCM tokens registered' });
    }

    // 3. Send Web Push Notifications via Firebase Admin SDK Messaging
    const title = senderName ? `New message from ${senderName}` : 'New Message';
    const messageBody = text ? (text.length > 100 ? text.substring(0, 97) + '...' : text) : 'Sent a file';
    const icon = senderPhoto || '/icons/icon-192x192.png';

    const messaging = getAdminMessaging();
    const response = await messaging.sendEachForMulticast({
      tokens: uniqueTokens,
      notification: {
        title,
        body: messageBody,
      },
      data: {
        chatId: String(chatId),
        senderId: String(senderId),
        title,
        body: messageBody,
        icon,
      },
      webpush: {
        headers: {
          Urgency: 'high',
          TTL: '86400', // Retain push notification for 24h if browser is closed/offline
        },
        notification: {
          title,
          body: messageBody,
          icon,
          badge: '/icons/icon-192x192.png',
          tag: `vibez-chat-${chatId}`,
          renotify: true,
        },
        fcmOptions: {
          link: `/?chatId=${chatId}`,
        },
      },
    });

    console.log(`[Push Notification API] Sent push notifications to ${response.successCount}/${uniqueTokens.length} devices.`);

    // Cleanup stale/unregistered tokens
    if (response.failureCount > 0) {
      const staleTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errCode = resp.error?.code;
          if (
            errCode === 'messaging/registration-token-not-registered' ||
            errCode === 'messaging/invalid-registration-token'
          ) {
            staleTokens.push(uniqueTokens[idx]);
          }
        }
      });

      if (staleTokens.length > 0) {
        console.log(`[Push Notification API] Cleaning up ${staleTokens.length} stale FCM tokens.`);
        for (const recipientId of recipientIds) {
          await db.collection('users').doc(recipientId).update({
            fcmTokens: (await db.collection('users').doc(recipientId).get()).data()?.fcmTokens?.filter(
              (t: string) => !staleTokens.includes(t)
            ) || []
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({
      success: true,
      sentCount: response.successCount,
      failedCount: response.failureCount,
    });
  } catch (error: any) {
    console.error('[Push Notification API Error]:', error);
    return NextResponse.json({ error: error.message || 'Internal push notification error' }, { status: 500 });
  }
}
