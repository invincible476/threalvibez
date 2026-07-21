
'use client';

import React, { createContext, useContext } from 'react';
import type { Story, User } from '@/lib/types';

interface StoriesContextType {
    stories: Story[];
    usersWithStories: User[];
    currentUser?: User;
    onViewStory: (user: User, stories: Story[]) => void;
    onCreateStory: (file: File) => void;
    usersCache: Map<string, User>;
}

export const StoriesContext = createContext<StoriesContextType | undefined>(undefined);

export function useStories() {
    const context = useContext(StoriesContext);
    if (!context) {
        throw new Error('useStories must be used within a StoriesContext.Provider');
    }
    return context;
}
