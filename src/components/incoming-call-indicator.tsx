'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Conversation, User, ActiveCall } from '@/lib/types';
import { acceptVoiceCall, endVoiceCall } from '@/lib/firebase/chat';
import { createRingtonePlayer } from '@/lib/sound';
import { safeShowNotification } from '@/lib/notification-utils';
import { UserAvatar } from '@/components/user-avatar';
import { Phone, PhoneOff, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface IncomingCallIndicatorProps {
  conversations: Conversation[];
  currentUser?: User;
  onAcceptCall: (conversationId: string, roomId: string) => void;
}

export function IncomingCallIndicator({
  conversations,
  currentUser,
  onAcceptCall,
}: IncomingCallIndicatorProps) {
  const [declinedCallIds, setDeclinedCallIds] = useState<string[]>([]);
  const notifiedCallIdsRef = useRef<Set<string>>(new Set());
  const ringtonePlayerRef = useRef<{ stop: () => void } | null>(null);

  // Find incoming active call (where current user is NOT the caller)
  const incomingConvo = conversations.find((c) => {
    const call = c.activeCall;
    if (!call) return false;
    if (!currentUser?.uid) return false;
    if (call.callerId === currentUser.uid) return false;
    if (declinedCallIds.includes(call.callId)) return false;
    // Call is active or calling within the last 2 minutes
    const isRecent = call.startedAt && Date.now() - call.startedAt < 120000;
    return (call.status === 'calling' || call.status === 'active') && isRecent;
  });

  const activeCall: ActiveCall | null = incomingConvo?.activeCall || null;

  // Handle ringtone and system notification
  useEffect(() => {
    if (!activeCall || activeCall.status !== 'calling') {
      if (ringtonePlayerRef.current) {
        ringtonePlayerRef.current.stop();
        ringtonePlayerRef.current = null;
      }
      return;
    }

    // Start ringtone sound
    if (!ringtonePlayerRef.current) {
      ringtonePlayerRef.current = createRingtonePlayer();
    }

    // Trigger browser notification once per callId
    if (!notifiedCallIdsRef.current.has(activeCall.callId)) {
      notifiedCallIdsRef.current.add(activeCall.callId);
      safeShowNotification(`Incoming Voice Call`, {
        body: `${activeCall.callerName || 'Someone'} is calling you on Vibez!`,
        icon: activeCall.callerAvatar || '/icons/icon-192x192.png',
        tag: `voice-call-${activeCall.callId}`,
        renotify: true,
      } as any).catch(() => {});
    }

    return () => {
      if (ringtonePlayerRef.current) {
        ringtonePlayerRef.current.stop();
        ringtonePlayerRef.current = null;
      }
    };
  }, [activeCall?.callId, activeCall?.status]);

  if (!incomingConvo || !activeCall) {
    return null;
  }

  const callerUser: User = {
    id: activeCall.callerId,
    uid: activeCall.callerId,
    name: activeCall.callerName || 'User',
    photoURL: activeCall.callerAvatar || null,
    status: 'online',
  };

  const handleAccept = async () => {
    if (ringtonePlayerRef.current) {
      ringtonePlayerRef.current.stop();
      ringtonePlayerRef.current = null;
    }
    await acceptVoiceCall(incomingConvo.id);
    onAcceptCall(incomingConvo.id, activeCall.roomId);
  };

  const handleDecline = async () => {
    if (ringtonePlayerRef.current) {
      ringtonePlayerRef.current.stop();
      ringtonePlayerRef.current = null;
    }
    setDeclinedCallIds((prev) => [...prev, activeCall.callId]);
    await endVoiceCall(incomingConvo.id);
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-[92%] max-w-md animate-in slide-in-from-top-4 duration-300">
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950/90 border border-emerald-500/40 p-4 shadow-2xl backdrop-blur-xl text-white">
        {/* Glow effect background */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <span className="absolute inset-0 rounded-full bg-emerald-500/40 animate-ping" />
              <UserAvatar user={callerUser} className="h-12 w-12 border-2 border-emerald-500/80 relative z-10" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                <span>Incoming Voice Call</span>
              </div>
              <h4 className="font-semibold text-sm text-zinc-100 truncate">
                {activeCall.callerName || 'User'}
              </h4>
              <p className="text-xs text-zinc-400 truncate">
                {incomingConvo.name || 'Voice Room'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={handleDecline}
              className="h-10 w-10 rounded-full border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
              title="Decline Call"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              onClick={handleAccept}
              className="h-10 w-10 rounded-full bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/30 transition-all scale-105 animate-pulse"
              title="Accept Call"
            >
              <Phone className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
