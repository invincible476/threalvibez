'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { User } from '@/lib/types';
import { ScrollArea } from './ui/scroll-area';
import { UserAvatar } from './user-avatar';
import { Search, Loader2, Users, UserPlus } from 'lucide-react';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAppShell } from './app-shell';
import Link from 'next/link';

interface CreateGroupModalProps {
  children: React.ReactNode;
}

export function CreateGroupModal({ children }: CreateGroupModalProps) {
  const { currentUser, usersCache, allUsers, handleCreateGroupChat } = useAppShell();
  const [isOpen, setIsOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Resolve accepted friends list strictly from currentUser.friends
  const acceptedFriends = useMemo(() => {
    if (!currentUser?.friends || currentUser.friends.length === 0) return [];
    
    // Map of all known users
    const usersMap = new Map<string, User>();
    (allUsers || []).forEach(u => {
      if (u.uid) usersMap.set(u.uid, u);
      if (u.id) usersMap.set(u.id, u);
    });
    if (usersCache) {
      usersCache.forEach(u => {
        if (u.uid) usersMap.set(u.uid, u);
        if (u.id) usersMap.set(u.id, u);
      });
    }

    return currentUser.friends.map(friendId => {
      const found = usersMap.get(friendId);
      if (found) return found;
      return {
        id: friendId,
        uid: friendId,
        name: 'Friend',
        email: '',
        status: 'offline' as const,
        friends: [],
        friendRequestsSent: [],
        friendRequestsReceived: [],
        blockedUsers: [],
      } as User;
    });
  }, [currentUser?.friends, allUsers, usersCache]);

  // Filter accepted friends by search term
  const filteredFriends = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return acceptedFriends;
    return acceptedFriends.filter(friend => {
      const name = (friend.name || '').toLowerCase();
      const username = (friend.username || '').toLowerCase();
      const email = (friend.email || '').toLowerCase();
      return name.includes(term) || username.includes(term) || email.includes(term);
    });
  }, [acceptedFriends, searchTerm]);

  const toggleFriendSelection = (friendId: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  const resetForm = () => {
    setGroupName('');
    setSearchTerm('');
    setSelectedFriendIds([]);
    setIsSubmitting(false);
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      toast({
        title: 'Group Name Required',
        description: 'Please enter a name for your group chat.',
        variant: 'destructive',
      });
      return;
    }

    if (selectedFriendIds.length === 0) {
      toast({
        title: 'Members Required',
        description: 'Please select at least 1 friend to add to the group.',
        variant: 'destructive',
      });
      return;
    }

    const selectedFriends = acceptedFriends.filter(f => selectedFriendIds.includes(f.uid || f.id));

    try {
      setIsSubmitting(true);
      await handleCreateGroupChat(groupName.trim(), selectedFriends);
      toast({
        title: 'Group Created',
        description: `Group "${groupName.trim()}" has been created successfully!`,
      });
      setIsOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating group chat:', error);
      toast({
        title: 'Group Creation Failed',
        description: error?.message || 'Could not create group chat. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) resetForm();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md bg-zinc-950 text-zinc-100 border-zinc-800 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold font-heading text-zinc-100">
            <Users className="h-5 w-5 text-purple-400" />
            Create Group Chat
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Group Name Input */}
          <div className="space-y-1.5">
            <Label htmlFor="create-group-name" className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Group Name
            </Label>
            <input
              id="create-group-name"
              type="text"
              placeholder="e.g. Weekend Vibez, Dev Squad"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 placeholder:text-zinc-500 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
              autoComplete="off"
            />
          </div>

          {/* Friends Selection Header */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Select Friends ({selectedFriendIds.length})
              </Label>
              {acceptedFriends.length > 0 && (
                <span className="text-xs text-zinc-400">
                  {acceptedFriends.length} friend{acceptedFriends.length !== 1 ? 's' : ''} available
                </span>
              )}
            </div>

            {/* Friend Search Bar */}
            {acceptedFriends.length > 0 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <Input
                  type="search"
                  placeholder="Filter friends by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-zinc-900/80 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 text-sm h-9"
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          {/* Friends List */}
          <ScrollArea className="h-56 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-1">
            {acceptedFriends.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center p-4 space-y-3">
                <p className="text-sm text-zinc-400">
                  You don't have any accepted friends yet.
                </p>
                <Button asChild size="sm" variant="outline" className="border-zinc-700 text-zinc-200 hover:bg-zinc-800">
                  <Link href="/friends" onClick={() => setIsOpen(false)}>
                    <UserPlus className="mr-2 h-4 w-4 text-purple-400" />
                    Find & Add Friends
                  </Link>
                </Button>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-400">
                No friends match "{searchTerm}"
              </div>
            ) : (
              <div className="space-y-1 p-1">
                {filteredFriends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.uid || friend.id);
                  return (
                    <div
                      key={friend.uid || friend.id}
                      onClick={() => toggleFriendSelection(friend.uid || friend.id)}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-purple-950/40 border border-purple-800/50'
                          : 'hover:bg-zinc-800/50 border border-transparent'
                      }`}
                    >
                      <Checkbox
                        id={`friend-${friend.uid || friend.id}`}
                        checked={isSelected}
                        onCheckedChange={() => toggleFriendSelection(friend.uid || friend.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600 border-zinc-600"
                      />
                      <UserAvatar user={friend} isFriend={true} className="h-9 w-9 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-zinc-100 truncate">{friend.name}</p>
                        <p className="text-xs text-zinc-400 truncate">
                          {friend.username ? `@${friend.username}` : (friend.email || '')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
            className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim() || selectedFriendIds.length === 0 || isSubmitting}
            className="bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-950/50 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Group'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
