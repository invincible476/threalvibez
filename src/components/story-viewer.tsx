
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { Story, User, StoryReaction } from '@/lib/types';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { UserAvatar } from './user-avatar';
import { X, MoreVertical, Send, Eye, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { formatDistanceToNow } from 'date-fns';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet';
import { ScrollArea } from './ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { EmojiReactionAnimation } from './emoji-reaction-animation';


const DEFAULT_STORY_DURATION = 5000; // 5 seconds for images
const defaultReactions = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

interface StoryViewerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    user: User;
    stories: Story[];
    currentUser?: User;
    onMarkAsViewed: (storyId: string) => void;
    onDeleteStory: (storyId: string) => void;
    onReply: (story: Story, message: string) => void;
    onReact: (storyId: string, emoji: string) => void;
    usersCache: Map<string, User>;
}

const toDate = (timestamp: Timestamp | Date | undefined): Date | null => {
    if (!timestamp) return null;
    if (timestamp instanceof Timestamp) {
        return timestamp.toDate();
    }
    if (timestamp instanceof Date) {
        return timestamp;
    }
    try {
        const date = new Date(timestamp as any);
        if (!isNaN(date.getTime())) {
            return date;
        }
    } catch (e) {
        // ignore
    }
    return null;
};


export function StoryViewer({ 
    isOpen, 
    onOpenChange, 
    user, 
    stories, 
    currentUser,
    onMarkAsViewed,
    onDeleteStory,
    onReply,
    onReact,
    usersCache,
}: StoryViewerProps) {
    const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
    const [replyText, setReplyText] = useState('');
    const [isPaused, setIsPaused] = useState(false);
    
    const [reactionAnimation, setReactionAnimation] = useState<{ emoji: string, key: number } | null>(null);
    const { toast } = useToast();
    
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const progressWrapperRef = useRef<HTMLDivElement>(null);

    const currentStory = stories[currentStoryIndex];
    const isOwner = currentUser?.uid === user.uid;

    const goToNextStory = useCallback(() => {
        if (currentStoryIndex < stories.length - 1) {
            setCurrentStoryIndex(prev => prev + 1);
        } else {
            onOpenChange(false);
        }
    }, [stories.length, onOpenChange, currentStoryIndex]);

    const goToPreviousStory = useCallback(() => {
        setCurrentStoryIndex(prev => Math.max(0, prev - 1));
    }, []);
    
    // Reset state when story data changes
    useEffect(() => {
        setCurrentStoryIndex(0);
    }, [user.id, stories]);


    const playStory = useCallback(() => setIsPaused(false), []);
    const pauseStory = useCallback(() => setIsPaused(true), []);

    // Effect for handling story progression and marking as viewed
    useEffect(() => {
        if (!isOpen || !currentStory) return;

        if (currentUser && !currentStory.viewedBy.includes(currentUser.uid)) {
            onMarkAsViewed(currentStory.id);
        }

        const video = videoRef.current;
        if (currentStory.mediaType === 'video' && video) {
            video.currentTime = 0;
            video.play().catch(console.error);
        }
    }, [isOpen, currentStory, currentUser, onMarkAsViewed]);
    
    // Effect to handle pausing/playing animations and video
    useEffect(() => {
        const video = videoRef.current;
        const progressWrappers = progressWrapperRef.current?.children;
        if (!progressWrappers) return;
        
        const currentProgressBar = progressWrappers[currentStoryIndex]?.firstElementChild as HTMLDivElement | undefined;
        
        if (isPaused) {
            video?.pause();
            if (currentProgressBar) currentProgressBar.style.animationPlayState = 'paused';
        } else {
            video?.play().catch(console.error);
             if (currentProgressBar) currentProgressBar.style.animationPlayState = 'running';
        }
    }, [isPaused, currentStoryIndex]);
    
    useEffect(() => {
        if (!isOpen) {
            setCurrentStoryIndex(0);
            setIsPaused(false);
        }
    }, [isOpen]);

    const handleVideoEnd = () => {
        goToNextStory();
    };
    
    const handleReaction = (emoji: string) => {
        if (!isOwner) {
            onReact(currentStory.id, emoji);
            setReactionAnimation({ emoji, key: Date.now() });
             toast({
                title: `You reacted with ${emoji}`,
                duration: 2000,
             });
        }
    };
    
    const handleReply = () => {
        if (!replyText.trim()) return;
        onReply(currentStory, replyText);
        setReplyText('');
    };

    if (!isOpen || !currentStory) return null;

    const storyMediaSrc = currentStory.mediaUrl;
    const createdAtDate = toDate(currentStory.createdAt);
    const viewers = currentStory.viewedBy.map(uid => usersCache.get(uid)).filter(Boolean).filter(u => u!.uid !== user.uid) as User[];
    
    const getReactionForUser = (userId: string): string | undefined => {
        return currentStory.reactions?.find(r => r.userId === userId)?.emoji;
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent 
                className="bg-black/90 border-0 p-0 m-0 max-w-full w-full h-full sm:max-w-md sm:h-[90vh] sm:rounded-lg"
            >
                <DialogTitle className="sr-only">Story from {user.name}</DialogTitle>

                <div 
                    className="relative h-full w-full flex flex-col items-center justify-center overflow-hidden rounded-lg"
                    onMouseDown={pauseStory}
                    onMouseUp={playStory}
                    onMouseLeave={playStory}
                    onTouchStart={pauseStory}
                    onTouchEnd={playStory}
                >
                    {/* Story Media */}
                    {storyMediaSrc && (
                        currentStory.mediaType === 'video' ? (
                             <video
                                ref={videoRef}
                                key={currentStory.id}
                                src={storyMediaSrc}
                                className="object-contain w-full h-full"
                                playsInline
                                autoPlay
                                onEnded={handleVideoEnd}
                            />
                        ) : (
                             <Image
                                src={storyMediaSrc}
                                alt={currentStory.caption || 'Story'}
                                fill
                                style={{objectFit:"contain"}}
                                unoptimized
                                priority
                            />
                        )
                    )}
                    
                    {/* Navigation zones */}
                    <div className="absolute inset-0 z-10 flex justify-between">
                        <div className="h-full w-1/3" onClick={(e) => { e.stopPropagation(); goToPreviousStory(); }} />
                        <div className="h-full w-1/3" />
                        <div className="h-full w-1/3" onClick={(e) => { e.stopPropagation(); goToNextStory(); }} />
                    </div>
                    
                    {reactionAnimation && (
                        <div className="absolute inset-0 pointer-events-none z-30">
                            <EmojiReactionAnimation
                                key={reactionAnimation.key}
                                emoji={reactionAnimation.emoji}
                            />
                        </div>
                    )}


                    {/* Overlay with Header, Footer */}
                    <div className="absolute inset-0 flex flex-col z-20 pointer-events-none">
                        {/* Progress bars */}
                        <div ref={progressWrapperRef} className="flex gap-1 p-2">
                            {stories.map((s, index) => (
                                <div key={s.id} className="flex-1 bg-white/30 rounded-full h-1 overflow-hidden">
                                     <div 
                                        className={cn(
                                            "bg-white h-full w-full origin-left",
                                            index === currentStoryIndex && 'animate-progress-bar'
                                        )} 
                                        style={{ 
                                            transform: `scaleX(${index < currentStoryIndex ? 1 : 0})`,
                                            animationDuration: index === currentStoryIndex ? (
                                                currentStory.mediaType === 'video' 
                                                ? `${currentStory.duration || 5}s` 
                                                : `${DEFAULT_STORY_DURATION / 1000}s`
                                            ) : '0s',
                                            animationPlayState: isPaused ? 'paused' : 'running'
                                        }}
                                        onAnimationEnd={index === currentStoryIndex ? goToNextStory : undefined}
                                     />
                                </div>
                            ))}
                        </div>

                        {/* Header */}
                        <div className="flex items-center justify-between p-2 pointer-events-auto">
                            <div className="flex items-center gap-2">
                                <UserAvatar user={user} className="h-10 w-10" />
                                <div>
                                    <p className="font-semibold text-white">{user.name}</p>
                                    <p className="text-xs text-neutral-300">
                                        {createdAtDate ? formatDistanceToNow(createdAtDate, { addSuffix: true }) : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                                            <MoreVertical />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="mr-4 bg-background/80 backdrop-blur-lg border-white/20 text-foreground">
                                        {isOwner && (
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => onDeleteStory(currentStory.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                <span>Delete Story</span>
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => onOpenChange(false)}>
                                    <X />
                                </Button>
                            </div>
                        </div>

                        {/* Spacer */}
                        <div className="flex-1" />

                        {/* Footer */}
                         <div className="p-4 w-full bg-gradient-to-t from-black/60 to-transparent pointer-events-auto">
                            {currentStory.caption && <p className="text-white text-center text-sm mb-2 p-2 bg-black/30 rounded-lg">{currentStory.caption}</p>}
                            
                            {isOwner ? (
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <div className="flex justify-center mb-2">
                                            <Button variant="ghost" className="text-white h-auto p-1">
                                                <Eye className="h-4 w-4 mr-1" />
                                                <span className="text-xs">{viewers.length} {viewers.length === 1 ? 'view' : 'views'}</span>
                                            </Button>
                                        </div>
                                    </SheetTrigger>
                                    <SheetContent side="bottom" className="bg-background/80 backdrop-blur-lg text-foreground h-1/2 rounded-t-2xl border-t">
                                        <SheetHeader>
                                            <SheetTitle>Viewed by</SheetTitle>
                                        </SheetHeader>
                                        <ScrollArea className="h-[calc(100%-4rem)]">
                                            <div className="py-4">
                                                {viewers.length > 0 ? viewers.map(viewer => (
                                                    <div key={viewer.uid} className="flex items-center justify-between p-2">
                                                        <div className="flex items-center gap-3">
                                                            <UserAvatar user={viewer} className="h-10 w-10" />
                                                            <p className="font-semibold">{viewer.name}</p>
                                                        </div>
                                                        <span className="text-2xl">{getReactionForUser(viewer.uid)}</span>
                                                    </div>
                                                )) : (
                                                    <p className="text-center text-muted-foreground pt-8">No views yet.</p>
                                                )}
                                            </div>
                                        </ScrollArea>
                                    </SheetContent>
                                </Sheet>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Input
                                        placeholder={`Reply to ${user.name}...`}
                                        className="bg-black/50 border-white/30 text-white placeholder:text-neutral-300"
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onFocus={pauseStory}
                                        onBlur={playStory}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleReply();
                                            }
                                        }}
                                    />
                                    <div className="flex">
                                    {defaultReactions.map(emoji => (
                                        <Button key={emoji} size="icon" variant="ghost" className="text-white text-2xl hover:scale-125 transition-transform" onClick={() => handleReaction(emoji)}>
                                            {emoji}
                                        </Button>
                                    ))}
                                    </div>
                                    <Button size="icon" variant="ghost" className="text-white" onClick={handleReply} disabled={!replyText.trim()}>
                                        <Send />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
