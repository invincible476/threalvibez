
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
  onFriendAction: (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend' | 'cancelRequest') => void;
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

  const handleFriendAction = (action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend' | 'cancelRequest') => {
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
             <Button variant="outline" className="w-full justify-start" onClick={() => handleFriendAction('cancelRequest')}>
                <Ban className="mr-3 h-5 w-5"/> Cancel Request
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
        <SheetContent className="w-full max-w-md bg-zinc-950/95 border-l border-zinc-800/80 backdrop-blur-xl text-white p-0 flex flex-col shadow-2xl">
          <SheetHeader className="p-6 pb-2 text-left border-b border-zinc-800/60">
            <SheetTitle className="text-lg font-bold font-heading text-white">Contact Info</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto space-y-6 p-6">
            {/* User Profile Header Card */}
            <div className="flex flex-col items-center justify-center p-6 bg-zinc-900/80 border border-zinc-800/80 rounded-3xl shadow-xl backdrop-blur-md text-center space-y-4">
              <Dialog>
                <DialogTrigger asChild>
                  <div className="relative group cursor-pointer">
                    <UserAvatar user={user} isFriend={isFriend} className="w-28 h-28 text-4xl shadow-2xl ring-4 ring-zinc-800/80 transition-transform duration-300 group-hover:scale-105" />
                    <span
                      className={`absolute bottom-1 right-1 block h-4 w-4 rounded-full ring-4 ring-zinc-950 shadow-md ${
                        user.status === 'online' ? 'bg-emerald-500' : 'bg-zinc-500'
                      }`}
                    />
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
                      className="rounded-2xl max-h-[80vh] w-auto mx-auto shadow-2xl border border-zinc-800"
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

              <div className="space-y-1.5 text-center">
                <div className="flex items-center gap-2 justify-center">
                  <h2 className="text-2xl font-bold font-heading text-white tracking-tight">{user.name}</h2>
                  {user.isPrivate && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Shield className="h-5 w-5 text-zinc-400" aria-label="Private account" />
                      </TooltipTrigger>
                      <TooltipContent className="bg-zinc-900 border-zinc-800 text-white">This account is private</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <p className="text-xs text-zinc-400 font-mono">
                  {user.username ? `@${user.username}` : user.email}
                </p>
                <div className="pt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                    user.status === 'online'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-zinc-800/60 text-zinc-400 border-zinc-700/50'
                  }`}>
                    {user.status === 'online' ? '● Active now' : '● Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* About / Bio Card */}
            {user.isPrivate && !isFriend && currentUser?.uid !== user.uid ? (
              <div className="p-5 bg-zinc-900/80 border border-zinc-800/80 rounded-3xl shadow-xl backdrop-blur-md flex flex-col items-center text-center space-y-2">
                <Shield className="h-6 w-6 text-zinc-400" />
                <h3 className="text-sm font-semibold text-white">This Account is Private</h3>
                <p className="text-xs text-zinc-400">
                  Connect as friends to view bio and social profile links.
                </p>
              </div>
            ) : (
              <div className="p-5 bg-zinc-900/80 border border-zinc-800/80 rounded-3xl shadow-xl backdrop-blur-md space-y-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">About</h3>
                <p className="text-sm text-zinc-200 leading-relaxed italic bg-zinc-950/40 p-3.5 rounded-2xl border border-zinc-800/50">
                  "{user.about || 'No bio specified.'}"
                </p>

                {(user.instagramUrl || user.instagramHandle || (user as any).instagram) && (
                  <div className="pt-2">
                    <a
                      href={
                        user.instagramUrl && user.instagramUrl.startsWith('http')
                          ? user.instagramUrl
                          : `https://instagram.com/${(user.instagramHandle || user.instagramUrl || (user as any).instagram || '').replace(/^@/, '').trim()}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700/50 text-zinc-200 text-xs font-medium transition-all hover:scale-105 w-fit"
                    >
                      <svg className="h-4 w-4 shrink-0 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                      </svg>
                      <span>
                        {user.instagramHandle ||
                          (user.instagramUrl?.startsWith('http')
                            ? `@${user.instagramUrl.match(/instagram\.com\/([^/?#]+)/i)?.[1] || 'profile'}`
                            : user.instagramUrl
                            ? `@${user.instagramUrl.replace(/^@/, '').trim()}`
                            : 'Instagram Profile')}
                      </span>
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Actions Card */}
            {!isAiUser && (
              <div className="p-5 bg-zinc-900/80 border border-zinc-800/80 rounded-3xl shadow-xl backdrop-blur-md space-y-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Actions</h3>
                <div className="space-y-2">
                  {!isBlocked && renderFriendButton()}
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start text-zinc-300 hover:text-white hover:bg-zinc-800/70 rounded-2xl h-11 text-xs font-medium"
                    onClick={() => onMuteToggle(chatId)}
                  >
                    {isMuted ? <Bell className="mr-3 h-4 w-4 text-violet-400" /> : <BellOff className="mr-3 h-4 w-4 text-zinc-400" />}
                    {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                  </Button>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-2xl h-11 text-xs font-medium">
                        <Ban className="mr-3 h-4 w-4 text-red-400"/> {isBlocked ? 'Unblock' : 'Block'} {user.name}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-zinc-800 text-white rounded-3xl">
                      <DialogHeader>
                        <DialogTitle className="text-white">Are you sure?</DialogTitle>
                        <DialogDescription className="text-zinc-400 text-xs">
                          {isBlocked 
                            ? `If you unblock ${user.name}, they will be able to message you and see your profile.`
                            : `You will no longer see messages or chats from ${user.name}. They will not be notified.`
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" className="border-zinc-800 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs">Cancel</Button>
                        <Button variant="destructive" onClick={handleBlockAction} className="bg-red-600 hover:bg-red-700 rounded-xl text-xs">{isBlocked ? 'Unblock' : 'Block'}</Button>
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
