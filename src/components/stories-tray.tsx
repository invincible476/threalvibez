
'use client';
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { User, Story } from '@/lib/types';
import { UserAvatar } from './user-avatar';
import { ScrollArea, ScrollBar } from './ui/scroll-area';
import { cn } from '@/lib/utils';
import React from 'react';

interface StoriesTrayProps {
    currentUser?: User;
    stories: Story[];
    usersWithStories: User[];
    onViewStory: (user: User, stories: Story[]) => void;
    onCreateStory: () => void;
}

export function StoriesTray({ 
    currentUser, 
    stories, 
    usersWithStories, 
    onViewStory, 
    onCreateStory,
}: StoriesTrayProps) {
    const getMillis = (t: any) => (t && typeof t.toMillis === 'function' ? t.toMillis() : new Date(t).getTime());

    const storiesByUser = useMemo(() => {
        const userStoryMap = new Map<string, Story[]>();
        stories.forEach(story => {
            if (!userStoryMap.has(story.ownerId)) {
                userStoryMap.set(story.ownerId, []);
            }
            userStoryMap.get(story.ownerId)!.push(story);
        });

        // Sort stories by createdAt date
        userStoryMap.forEach(userStories => {
            userStories.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        });

        return userStoryMap;
    }, [stories]);

    const hasUnreadStory = (userStories: Story[]) => {
        return userStories.some(story => !story.viewedBy.includes(currentUser?.uid || ''));
    };
    
    if (!currentUser) return null;

    const myStories = storiesByUser.get(currentUser.uid) || [];
    const hasMyStory = myStories.length > 0;
    const hasMyUnreadStory = hasMyStory && hasUnreadStory(myStories);

    const friendsWithStories = usersWithStories.filter(u => u.uid !== currentUser.uid);

    return (
        <>
            <div className="p-4 border-b border-border/50 group-[[data-sidebar-state=collapsed]]/sidebar:hidden">
                <ScrollArea className="w-full whitespace-nowrap">
                    <div className="flex gap-4">
                        <div className="flex flex-col items-center gap-2">
                             <button 
                                onClick={hasMyStory ? () => onViewStory(currentUser, myStories) : onCreateStory} 
                                className="relative h-16 w-16"
                            >
                                <div className={cn(
                                    "rounded-full p-0.5 border-2",
                                    hasMyUnreadStory ? "border-primary" : "border-transparent"
                                )}>
                                    <UserAvatar user={currentUser} className="h-[58px] w-[58px]" />
                                </div>
                                {!hasMyStory && (
                                    <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 border-2 border-background">
                                        <Plus className="h-3 w-3" />
                                    </div>
                                )}
                            </button>
                            <p className="text-xs font-medium truncate w-16">Your Story</p>
                        </div>

                        {friendsWithStories.map(user => {
                            const userStories = storiesByUser.get(user.uid) || [];
                            if (userStories.length === 0) return null;

                            const hasUnread = hasUnreadStory(userStories);

                            return (
                                <div key={user.uid} className="flex flex-col items-center gap-2">
                                    <button 
                                        onClick={() => onViewStory(user, userStories)}
                                        className={cn(
                                            "rounded-full p-0.5 border-2",
                                            hasUnread ? "border-primary" : "border-muted"
                                        )}
                                    >
                                        <UserAvatar user={user} className="h-16 w-16" />
                                    </button>
                                    <p className="text-xs font-medium truncate w-16">{user.name}</p>
                                </div>
                            )
                        })}
                    </div>
                    <ScrollBar orientation="horizontal" />
                 </ScrollArea>
                 {!hasMyStory && friendsWithStories.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No stories yet</p>
                )}
            </div>
        </>
    );
}
