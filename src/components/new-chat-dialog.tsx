'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
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
import { Search, Loader2, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { useToast } from '@/hooks/use-toast';
import { normalizeUser, matchesUserSearch, searchUsers } from '@/lib/user-service';

interface NewChatDialogProps {
  users: User[];
  onCreateChat: (user: User) => void;
  onCreateGroupChat: (groupName: string, users: User[]) => void;
  children: React.ReactNode;
  currentUser?: User;
}

export function NewChatDialog({ users, onCreateChat, onCreateGroupChat, children, currentUser }: NewChatDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [remoteResults, setRemoteResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  
  const availableUsers = useMemo(() => {
    return (users || [])
      .map(u => normalizeUser(u))
      .filter(u => u.uid !== currentUser?.uid && !(currentUser?.blockedUsers || []).includes(u.uid));
  }, [users, currentUser]);

  // 0ms Instant Live Search Filter for available users
  const displayedUsers = useMemo(() => {
    const clean = searchTerm.trim();
    if (!clean) return availableUsers;

    return availableUsers.filter(u => matchesUserSearch(u, clean, currentUser?.uid));
  }, [searchTerm, availableUsers, currentUser?.uid]);

  const handleCreateChatClick = (user: User) => {
    if (!currentUser) {
        toast({ title: "Error", description: "Cannot create chat. Current user not found.", variant: "destructive" });
        return;
    }
    onCreateChat(user);
    setIsOpen(false);
    resetState();
  };

  const handleCreateGroup = () => {
    if (groupName.trim() && selectedUsers.length > 0) {
        onCreateGroupChat(groupName.trim(), selectedUsers);
        setIsOpen(false);
        resetState();
    }
  };
  
  const handleUserSelection = (user: User, isSelected: boolean) => {
    if (isSelected) {
        setSelectedUsers(prev => [...prev, user]);
    } else {
        setSelectedUsers(prev => prev.filter(u => u.uid !== user.uid && u.id !== user.id));
    }
  };
  
  const resetState = () => {
    setSearchTerm('');
    setRemoteResults([]);
    setGroupName('');
    setSelectedUsers([]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) resetState();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start a new chat</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="private" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="private">Private</TabsTrigger>
                <TabsTrigger value="group">Group</TabsTrigger>
            </TabsList>
            <div className="relative my-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name, username, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                )}
            </div>

            <TabsContent value="private">
                <ScrollArea className="h-72">
                  <div className="p-1 space-y-1">
                    {displayedUsers.length > 0 ? (
                      displayedUsers.map(user => (
                        <div
                          key={user.uid || user.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div 
                            className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleCreateChatClick(user)}
                          >
                            <UserAvatar user={user} className="h-10 w-10" />
                            <div className="truncate">
                              <p className="font-semibold truncate">{user.name}</p>
                              <p className="text-sm text-muted-foreground truncate">
                                {user.username ? `@${user.username}` : (user.email || 'No email')}
                              </p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateChatClick(user);
                            }}
                          >
                            <MessageSquare className="mr-1.5 h-4 w-4" />
                            Message
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground p-4">
                        {isSearching ? 'Searching...' : (searchTerm ? 'No users found.' : 'Type to search for users.')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
            </TabsContent>
            
            <TabsContent value="group">
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="group-name">Group Name</Label>
                        <Input 
                            id="group-name"
                            placeholder="Enter a name for your group"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                        />
                    </div>
                     <p className="text-sm font-medium text-muted-foreground">Select members ({selectedUsers.length})</p>
                    <ScrollArea className="h-56">
                        <div className="p-1 space-y-1">
                            {displayedUsers.length > 0 ? (
                            displayedUsers.map(user => (
                                <div key={user.uid || user.id} className="flex items-center p-2 rounded-lg hover:bg-muted/50">
                                    <Checkbox 
                                        id={`user-${user.uid || user.id}`}
                                        className="mr-3"
                                        onCheckedChange={(checked) => handleUserSelection(user, !!checked)}
                                        checked={selectedUsers.some(u => (u.uid || u.id) === (user.uid || user.id))}
                                    />
                                    <Label htmlFor={`user-${user.uid || user.id}`} className="flex items-center gap-3 cursor-pointer flex-1 min-w-0">
                                        <UserAvatar user={user} className="h-10 w-10" />
                                        <div className="truncate">
                                            <p className="font-semibold truncate">{user.name}</p>
                                            <p className="text-sm text-muted-foreground truncate">{user.username ? `@${user.username}` : (user.email || 'No email')}</p>
                                        </div>
                                    </Label>
                                </div>
                            ))
                            ) : (
                            <p className="text-center text-muted-foreground p-4">
                                {isSearching ? 'Searching...' : (searchTerm ? 'No users found.' : 'Type to search for users.')}
                            </p>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
           <Button onClick={handleCreateGroup} disabled={groupName.trim().length === 0 || selectedUsers.length === 0}>
            Create Group
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
