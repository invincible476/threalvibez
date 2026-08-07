import { getAdminFirestore, getAdminMessaging } from '@/lib/firebase-admin';
import { NextResponse } from 'next/server';

// ─────────────────────────────────────────────────────────────────────────────
// Utility: fetch all valid FCM tokens for a user, respecting mute settings
// ─────────────────────────────────────────────────────────────────────────────
async function getUserTokens(
  db: FirebaseFirestore.Firestore,
  userId: string,
  muteKey?: string
): Promise<string[]> {
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return [];
  const data = userDoc.data()!;

  const mutedAll = data.areNotificationsMuted === true;
  const mutedKey = muteKey && Array.isArray(data.mutedConversations)
    ? data.mutedConversations.includes(muteKey)
    : false;

  if (mutedAll || mutedKey) return [];
  return Array.isArray(data.fcmTokens) ? data.fcmTokens.filter(Boolean) : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: clean stale tokens after sending
// ─────────────────────────────────────────────────────────────────────────────
async function cleanStaleTokens(
  db: FirebaseFirestore.Firestore,
  recipientIds: string[],
  tokens: string[],
  responses: { success: boolean; error?: { code: string } }[]
) {
  const stale = tokens.filter((_, i) => {
    const code = responses[i]?.error?.code ?? '';
    return (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    );
  });
  if (stale.length === 0) return;
  for (const uid of recipientIds) {
    const doc = await db.collection('users').doc(uid).get();
    const existing: string[] = doc.data()?.fcmTokens ?? [];
    await db
      .collection('users')
      .doc(uid)
      .update({ fcmTokens: existing.filter((t) => !stale.includes(t)) })
      .catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/notifications/send
// Body shape:
//   type: 'message' | 'call' | 'story'
//   senderId: string
//   senderName: string
//   senderPhoto?: string
//   recipientIds?: string[]        – for message / call
//   chatId?: string                – for message
//   callId?: string                – for call
//   roomId?: string                – for call (LiveKit room)
//   storyId?: string               – for story
//   storyMedia?: string            – for story
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, senderId, senderName, senderPhoto } = body;

    if (!type || !senderId) {
      return NextResponse.json({ error: 'Missing type or senderId' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const messaging = getAdminMessaging();

    // ── 1. MESSAGE NOTIFICATION ───────────────────────────────────────────────
    if (type === 'message') {
      const { chatId, text, recipientIds } = body;
      if (!chatId || !recipientIds?.length) {
        return NextResponse.json({ error: 'Missing chatId or recipientIds' }, { status: 400 });
      }

      const allTokens: string[] = [];
      for (const uid of recipientIds) {
        const tokens = await getUserTokens(db, uid, chatId);
        allTokens.push(...tokens);
      }
      const unique = [...new Set(allTokens)];
      if (!unique.length) return NextResponse.json({ success: true, message: 'No tokens' });

      const title = senderName ? `${senderName}` : 'New Message';
      const bodyText = text
        ? text.length > 100 ? text.slice(0, 97) + '...' : text
        : '📎 Sent an attachment';

      const res = await messaging.sendEachForMulticast({
        tokens: unique,
        notification: { title, body: bodyText },
        data: {
          type: 'message',
          chatId: String(chatId),
          senderId,
          senderName: senderName ?? '',
          senderPhoto: senderPhoto ?? '',
        },
        android: {
          priority: 'high',
          notification: {
            channelId: 'messages',
            sound: 'default',
            icon: 'ic_launcher',
            color: '#6366F1',
            tag: `msg-${chatId}`,
            clickAction: 'OPEN_CHAT',
          },
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1, 'content-available': 1 },
          },
        },
      });

      await cleanStaleTokens(db, recipientIds, unique, res.responses);
      return NextResponse.json({ success: true, sent: res.successCount, failed: res.failureCount });
    }

    // ── 2. INCOMING CALL NOTIFICATION ────────────────────────────────────────
    if (type === 'call') {
      const { recipientIds, callId, roomId } = body;
      if (!recipientIds?.length || !callId) {
        return NextResponse.json({ error: 'Missing recipientIds or callId' }, { status: 400 });
      }

      const allTokens: string[] = [];
      for (const uid of recipientIds) {
        const tokens = await getUserTokens(db, uid);
        allTokens.push(...tokens);
      }
      const unique = [...new Set(allTokens)];
      if (!unique.length) return NextResponse.json({ success: true, message: 'No tokens' });

      const res = await messaging.sendEachForMulticast({
        tokens: unique,
        notification: {
          title: `📞 ${senderName ?? 'Someone'} is calling`,
          body: 'Tap to answer',
        },
        data: {
          type: 'call',
          callId: String(callId),
          roomId: String(roomId ?? ''),
          senderId,
          senderName: senderName ?? '',
          senderPhoto: senderPhoto ?? '',
        },
        android: {
          priority: 'high',                // Wakes device even in Doze mode
          notification: {
            channelId: 'calls',            // High-importance channel → full-screen
            sound: 'ringtone',
            icon: 'ic_launcher',
            color: '#10B981',
            tag: `call-${callId}`,
            clickAction: 'OPEN_CALL',
          },
        },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: {
            aps: { sound: 'default', badge: 1, 'content-available': 1 },
          },
        },
      });

      await cleanStaleTokens(db, recipientIds, unique, res.responses);
      return NextResponse.json({ success: true, sent: res.successCount, failed: res.failureCount });
    }

    // ── 3. STORY UPLOAD NOTIFICATION ─────────────────────────────────────────
    if (type === 'story') {
      const { storyId, storyMedia, recipientIds } = body;
      if (!recipientIds?.length || !storyId) {
        return NextResponse.json({ error: 'Missing recipientIds or storyId' }, { status: 400 });
      }

      const allTokens: string[] = [];
      for (const uid of recipientIds) {
        const tokens = await getUserTokens(db, uid);
        allTokens.push(...tokens);
      }
      const unique = [...new Set(allTokens)];
      if (!unique.length) return NextResponse.json({ success: true, message: 'No tokens' });

      const res = await messaging.sendEachForMulticast({
        tokens: unique,
        notification: {
          title: `${senderName ?? 'A friend'} added a story`,
          body: 'Tap to view their story ✨',
          imageUrl: storyMedia ?? undefined,
        },
        data: {
          type: 'story',
          storyId: String(storyId),
          senderId,
          senderName: senderName ?? '',
          senderPhoto: senderPhoto ?? '',
        },
        android: {
          priority: 'normal',
          notification: {
            channelId: 'stories',
            sound: 'default',
            icon: 'ic_launcher',
            color: '#EC4899',
            tag: `story-${senderId}`,
            imageUrl: storyMedia ?? undefined,
          },
        },
        apns: {
          payload: {
            aps: { sound: 'default', badge: 1 },
          },
        },
      });

      await cleanStaleTokens(db, recipientIds, unique, res.responses);
      return NextResponse.json({ success: true, sent: res.successCount, failed: res.failureCount });
    }

    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 });
  } catch (err: any) {
    console.error('[Notification API Error]:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
