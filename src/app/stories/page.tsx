
'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useStories } from '@/components/providers/stories-provider';
import { UserAvatar } from '@/components/user-avatar';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Story } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { Timestamp } from 'firebase/firestore';

function StoryGridSkeleton() {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-4 sm:p-6 lg:p-8">
            {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-[9/16] bg-muted rounded-lg animate-pulse" />
            ))}
        </div>
    )
}

const getMillis = (timestamp: Timestamp | Date): number => {
    if (timestamp instanceof Timestamp) {
        return timestamp.toMillis();
    }
    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    // Fallback for potentially malformed data, though it should be one of the above.
    // Try to parse if it's a string representation of a date.
    if(typeof timestamp === 'string') {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            return date.getTime();
        }
    }
    return 0;
}


export default function StoriesPage() {
    const { stories, usersWithStories, currentUser, onViewStory, onCreateStory, usersCache } = useStories();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        // Assume loading is finished when currentUser and usersWithStories are populated
        if (currentUser && usersWithStories) {
            setLoading(false);
        }
    }, [currentUser, usersWithStories]);


    const storiesByUser = useMemo(() => {
        const userStoryMap = new Map<string, Story[]>();
        stories.forEach(story => {
            if (!userStoryMap.has(story.ownerId)) {
                userStoryMap.set(story.ownerId, []);
            }
            userStoryMap.get(story.ownerId)!.push(story);
        });
        userStoryMap.forEach(userStories => {
            userStories.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        });
        return userStoryMap;
    }, [stories]);

    if (loading) {
        return <StoryGridSkeleton />;
    }
    
    if (!currentUser) {
        // This case should ideally not be hit if auth provider redirects correctly
        // but it's a good fallback.
        return <StoryGridSkeleton />;
    }
    
    const myStories = storiesByUser.get(currentUser.uid) || [];
    const hasMyStories = myStories.length > 0;

    const handleCreateStoryClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            onCreateStory(file);
        }
    };

    const hasUnreadStory = (userStories: Story[]) => {
        return userStories.some(story => !story.viewedBy.includes(currentUser?.uid || ''));
    };
    
    const friendsWithStories = usersWithStories.filter(u => u.uid !== currentUser.uid);

    return (
        <motion.div
            className="p-4 sm:p-6 lg:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {/* Current User's Story */}
                 <motion.div 
                    className="aspect-[9/16] rounded-lg overflow-hidden relative group"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                >
                    <button 
                        onClick={hasMyStories ? () => onViewStory(currentUser, myStories) : undefined}
                        disabled={!hasMyStories}
                        className="w-full h-full bg-card flex flex-col items-center justify-center text-center disabled:cursor-default"
                    >
                        <div className={cn(
                            "rounded-full p-1 border-2",
                            hasMyStories && hasUnreadStory(myStories) ? "border-primary" : "border-transparent"
                        )}>
                            <UserAvatar user={currentUser} className="h-20 w-20 text-2xl" />
                        </div>
                        <p className="font-semibold mt-2">Your Story</p>
                        <p className="text-xs text-muted-foreground">{hasMyStories ? 'View your story' : 'No stories yet'}</p>
                    </button>
                    
                    <button 
                        onClick={handleCreateStoryClick}
                        className="absolute bottom-4 right-4 bg-primary text-primary-foreground rounded-full p-2 border-2 border-background hover:scale-110 transition-transform"
                        aria-label="Add to your story"
                    >
                        <Plus className="h-5 w-5" />
                    </button>
                </motion.div>

                {/* Friends' Stories */}
                {friendsWithStories.map(user => {
                    const userStories = storiesByUser.get(user.uid) || [];
                    if (userStories.length === 0) return null;
                    const hasUnread = hasUnreadStory(userStories);
                    const latestStory = userStories[0];

                    return (
                        <motion.div 
                            key={user.uid}
                            className="aspect-[9/16] rounded-lg overflow-hidden relative group cursor-pointer"
                            whileHover={{ scale: 1.05 }}
                            transition={{ duration: 0.2 }}
                            onClick={() => onViewStory(user, userStories)}
                        >
                            {latestStory.mediaType === 'video' ? (
                                <video src={latestStory.mediaUrl} className="w-full h-full object-cover blur-md scale-110" muted loop/>
                            ) : (
                                <img src={latestStory.mediaUrl} className="w-full h-full object-cover blur-md scale-110" alt={`${user.name}'s story`}/>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                            <div className="absolute top-2 left-2">
                                 <div className={cn(
                                    "rounded-full p-0.5 border-2",
                                    hasUnread ? "border-primary" : "border-transparent"
                                )}>
                                    <UserAvatar user={user} className="h-10 w-10" />
                                </div>
                            </div>
                            <p className="absolute bottom-2 left-2 right-2 text-white font-semibold text-sm truncate">{user.name}</p>
                        </motion.div>
                    )
                })}
            </div>

            {friendsWithStories.length === 0 && myStories.length === 0 && (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-bold">No Stories Yet</h2>
                    <p className="text-muted-foreground mt-2">Be the first to share a moment!</p>
                    <Button className="mt-4" onClick={handleCreateStoryClick}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Story
                    </Button>
                </div>
            )}
        </motion.div>
    );
}
