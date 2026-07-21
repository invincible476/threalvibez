
'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { User } from '@/lib/types';
import { UserAvatar } from './user-avatar';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { BellOff, Ban, Bell, MessageSquareText, Shield, UserPlus, Check, UserCheck, X, UserX } from 'lucide-react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import React from 'react';

interface UserProfileSheetProps {
  user: User;
  currentUser: User;
  chatId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onFriendAction: (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend') => void;
  onBlockUser: (targetUserId: string, isBlocked: boolean) => void;
  onMuteToggle: (conversationId: string) => void;
}

const AI_USER_ID = 'gemini-ai-chat-bot-7a4b9c1d-f2e3-4d56-a1b2-c3d4e5f6a7b8';

export function UserProfileSheet({
  user,
  currentUser,
  chatId,
  isOpen,
  onOpenChange,
  onFriendAction,
  onBlockUser,
  onMuteToggle,
}: UserProfileSheetProps) {
  const isBlockConfirmOpen = false;
  const isAiUser = user.id === AI_USER_ID;
  
  const isFriend = currentUser?.friends?.includes(user.uid);
  const hasSentRequest = currentUser?.friendRequestsSent?.includes(user.uid);
  const hasReceivedRequest = currentUser?.friendRequestsReceived?.includes(user.uid);
  const isBlocked = currentUser?.blockedUsers?.includes(user.uid);
  const isMuted = currentUser?.mutedConversations?.includes(chatId);

  const handleFriendAction = (action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend') => {
    onFriendAction(user.uid, action);
  }
  
  const handleBlockAction = () => {
    onBlockUser(user.uid, !!isBlocked);
    onOpenChange(false);
  }

  const renderFriendButton = () => {
    if (isFriend) {
        return (
            <div className="space-y-2">
                 <Button variant="secondary" className="w-full justify-start">
                    <UserCheck className="mr-3 h-5 w-5"/> Friends
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleFriendAction('removeFriend')}>
                    <UserX className="mr-3 h-5 w-5"/> Remove Friend
                </Button>
            </div>
        )
    }
    if (hasSentRequest) {
        return (
             <Button variant="outline" disabled className="w-full justify-start">
                <UserPlus className="mr-3 h-5 w-5"/> Request Sent
            </Button>
        )
    }
    if (hasReceivedRequest) {
        return (
            <div className="space-y-2">
                 <Button variant="default" className="w-full justify-start" onClick={() => handleFriendAction('acceptRequest')}>
                    <Check className="mr-3 h-5 w-5"/> Accept Request
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleFriendAction('declineRequest')}>
                    <X className="mr-3 h-5 w-5"/> Decline Request
                </Button>
            </div>
        )
    }
    return (
         <Button variant="outline" className="w-full justify-start" onClick={() => handleFriendAction('sendRequest')}>
            <UserPlus className="mr-3 h-5 w-5"/> Add Friend
        </Button>
    )
  }

  // Main render
  return (
    <TooltipProvider>
      <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-background/90 backdrop-blur-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0 text-left">
          <SheetTitle>Contact Info</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center p-6 space-y-4 border-b">
            <Dialog>
              <DialogTrigger asChild>
                <div className="relative cursor-pointer">
                    <UserAvatar user={user} isFriend={isFriend} className="w-32 h-32 text-4xl" />
                </div>
              </DialogTrigger>
              {user.photoURL && (
                <DialogContent className="p-0 bg-transparent border-0 max-w-screen-md w-auto h-auto">
                    <DialogTitle className="sr-only">Full-size avatar for {user.name}</DialogTitle>
                    <Image
                    src={user.photoURL}
                    alt={user.name}
                    width={800}
                    height={800}
                    className="rounded-lg max-h-[80vh] w-auto mx-auto"
                    style={{
                      objectFit: "contain",
                      maxWidth: "90vw"
                    }}
                    priority
                    quality={95}
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.style.display = 'none';
                    }}
                    />
                </DialogContent>
              )}
            </Dialog>
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <h2 className="text-2xl font-bold">{user.name}</h2>
                {user.isPrivate && (
                  <Tooltip>
                    <TooltipTrigger>
                      <Shield className="h-5 w-5 text-muted-foreground" aria-label="Private account" />
                    </TooltipTrigger>
                    <TooltipContent>This account is private</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            {!isAiUser && (
                 <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="icon"><MessageSquareText className="h-5 w-5" /></Button>
                </div>
            )}
          </div>
          
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-card-foreground">About</h3>
            <p className="text-sm text-muted-foreground">
                {user.about || 'No bio yet.'}
            </p>

            {user.instagramUrl && (
              <div className="pt-4">
                <a
                  href={user.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                  </svg>
                  <span>Instagram</span>
                  <span className="text-sm">
                    @{user.instagramUrl.match(/instagram\.com\/([^/]+)\/?$/)?.[1] || ''}
                  </span>
                </a>
              </div>
            )}
          </div>

          {!isAiUser && (
              <div className="p-6 space-y-6">
                <Separator />
                <div className="space-y-2">
                    {!isBlocked && renderFriendButton()}
                    <Button 
                        variant="ghost" 
                        className="w-full justify-start text-muted-foreground hover:text-foreground"
                        onClick={() => onMuteToggle(chatId)}
                    >
                        {isMuted ? <Bell className="mr-3 h-5 w-5 text-primary" /> : <BellOff className="mr-3 h-5 w-5" />}
                        {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive">
                                <Ban className="mr-3 h-5 w-5"/> {isBlocked ? 'Unblock' : 'Block'} {user.name}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Are you sure?</DialogTitle>
                                <DialogDescription>
                                    {isBlocked 
                                        ? `If you unblock ${user.name}, they will be able to message you and see your profile.`
                                        : `You will no longer see messages or chats from ${user.name}. They will not be notified.`
                                    }
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline">Cancel</Button>
                                <Button variant="destructive" onClick={handleBlockAction}>{isBlocked ? 'Unblock' : 'Block'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
              </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
    </TooltipProvider>
  );
}
