

'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { Search, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface NewChatDialogProps {
  users: User[];
  onCreateChat: (user: User) => void;
  onCreateGroupChat: (groupName: string, users: User[]) => void;
  children: React.ReactNode;
  currentUser?: User;
}

const isEmail = (str: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str);
}

export function NewChatDialog({ users, onCreateChat, onCreateGroupChat, children, currentUser }: NewChatDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  
  const availableUsers = useMemo(() => users.filter(u => 
    u.uid !== currentUser?.uid
  ), [users, currentUser]);

  const handleSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const searchLower = term.trim().toLowerCase();
    const tokens = searchLower.split(/\s+/).filter(Boolean);

    const matchesUser = (user: User) => {
      if (user.uid === currentUser?.uid || user.id === currentUser?.uid) return false;
      if (currentUser?.blockedUsers?.includes(user.uid)) return false;

      const nameLower = (user.name || (user as any).displayName || (user as any).fullName || '').toLowerCase();
      const emailLower = (user.email || '').toLowerCase();
      const usernameLower = (user.username || (user as any).handle || '').toLowerCase();

      const fullMatch = nameLower.includes(searchLower) || emailLower.includes(searchLower) || usernameLower.includes(searchLower);
      if (fullMatch) return true;

      return tokens.every(token => nameLower.includes(token) || emailLower.includes(token) || usernameLower.includes(token));
    };

    try {
      const localMatches = availableUsers.filter(matchesUser);

      // Fetch full user collection from Firestore (up to 500) to guarantee no user is missed
      const usersRef = collection(db, 'users');
      const qSnap = await getDocs(query(usersRef, limit(500)));
      const remoteMatches = qSnap.docs
        .map(docSnap => {
          const uData = docSnap.data();
          const targetId = uData.uid || uData.id || docSnap.id;
          return { ...uData, id: targetId, uid: targetId } as User;
        })
        .filter(matchesUser);

      const map = new Map<string, User>();
      localMatches.forEach(u => map.set(u.uid, u));
      remoteMatches.forEach(u => map.set(u.uid, u));

      setSearchResults(Array.from(map.values()));
    } catch (error) {
      console.error("Error searching users:", error);
    } finally {
      setIsSearching(false);
    }
  }, [availableUsers, currentUser]);

  const displayedUsers = searchTerm ? searchResults : availableUsers;

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
  }
  
  const handleUserSelection = (user: User, isSelected: boolean) => {
    if (isSelected) {
        setSelectedUsers(prev => [...prev, user]);
    } else {
        setSelectedUsers(prev => prev.filter(u => u.id !== user.id));
    }
  }
  
  const resetState = () => {
    setSearchTerm('');
    setSearchResults([]);
    setGroupName('');
    setSelectedUsers([]);
  }
  
  const onSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value;
    setSearchTerm(term);
    handleSearch(term);
  }

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
                    placeholder="Search by name or exact email..."
                    value={searchTerm}
                    onChange={onSearchTermChange}
                    className="pl-10"
                />
                 {isSearching && isEmail(searchTerm) && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
            </div>

            <TabsContent value="private">
                <ScrollArea className="h-72">
                  <div className="p-1">
                    {displayedUsers.length > 0 ? (
                      displayedUsers.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50"
                        >
                          <div 
                            className="flex items-center gap-3 flex-1 cursor-pointer"
                            onClick={() => {
                              setIsOpen(false);
                              window.location.href = `/friends/${user.uid}`;
                            }}
                          >
                            <UserAvatar user={user} className="h-10 w-10" />
                            <div>
                              <p className="font-semibold">{user.name}</p>
                              <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateChatClick(user);
                            }}
                          >
                            Message
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted-foreground p-4">
                        {searchTerm && !isSearching ? 'No users found.' : 'Type to search for users.'}
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
                                <div key={user.id} className="flex items-center p-2 rounded-lg hover:bg-muted/50">
                                    <Checkbox 
                                        id={`user-${user.id}`}
                                        className="mr-3"
                                        onCheckedChange={(checked) => handleUserSelection(user, !!checked)}
                                        checked={selectedUsers.some(u => u.id === user.id)}
                                    />
                                    <Label htmlFor={`user-${user.id}`} className="flex items-center gap-3 cursor-pointer flex-1">
                                        <UserAvatar user={user} className="h-10 w-10" />
                                        <div>
                                            <p className="font-semibold">{user.name}</p>
                                            <p className="text-sm text-muted-foreground">{user.email || 'No email'}</p>
                                        </div>
                                    </Label>
                                </div>
                            ))
                            ) : (
                            <p className="text-center text-muted-foreground p-4">
                                {searchTerm && !isSearching ? 'No users found.' : 'Type to search for users.'}
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
