
'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Conversation, User } from '@/lib/types';
import { UserAvatar } from './user-avatar';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Camera, Loader2 } from 'lucide-react';
import { ImagePreviewDialog } from './image-preview-dialog';

interface GroupProfileSheetProps {
  chat: Conversation;
  currentUser: User;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  usersCache: Map<string, User>;
}

export function GroupProfileSheet({
  chat,
  currentUser,
  isOpen,
  onOpenChange,
  usersCache,
}: GroupProfileSheetProps) {
  const [name, setName] = useState(chat.name || '');
  const [description, setDescription] = useState(chat.description || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [avatarUrl, setAvatarUrl] = useState(chat.avatar || '');
  const [newAvatarDataUrl, setNewAvatarDataUrl] = useState<string | null>(null);


  const allParticipants = chat.participants.map(p => usersCache.get(p)).filter(Boolean) as User[];
  const uniqueParticipantIds = new Set<string>();
  const participants = allParticipants.filter(p => {
    if (uniqueParticipantIds.has(p.uid)) {
      return false;
    }
    uniqueParticipantIds.add(p.uid);
    return true;
  });
  
  const adminId = chat.createdBy;
  const isAdmin = currentUser.uid === adminId;

  const resetLocalState = () => {
    setName(chat.name || '');
    setDescription(chat.description || '');
    setAvatarUrl(chat.avatar || '');
    setNewAvatarDataUrl(null);
    setIsEditing(false);
  };
  
  useEffect(() => {
    if (isOpen) {
      resetLocalState();
    }
  }, [chat, isOpen]);
  
  
  const handleAvatarUpload = async (file: File) => {
    setIsUploading(true);
    try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                if (!event.target?.result) {
                    return reject(new Error("Failed to read file."));
                }
                resolve(event.target.result as string);
            };
            reader.onerror = (error) => reject(new Error("Failed to read file for resizing."));
        });
        
        setNewAvatarDataUrl(dataUrl);
        setAvatarUrl(dataUrl); // also update for preview
        toast({ title: 'Success', description: 'Avatar ready to be saved.', variant: 'default' });

    } catch (error: any) {
        console.error("Error preparing avatar:", error);
        toast({ title: 'Error', description: error.message || 'Failed to prepare avatar. Please try again.', variant: 'destructive' });
    } finally {
        setIsUploading(false);
        setPreviewFile(null);
    }
  };

  const handleSaveChanges = async () => {
    if (!isAdmin) return;
    setIsSaving(true);
    try {
        const chatRef = doc(db, 'conversations', chat.id);
        const dataToUpdate: any = {};

        if (name !== (chat.name || '')) dataToUpdate.name = name;
        if (description !== (chat.description || '')) dataToUpdate.description = description;

        // Prioritize newly uploaded avatar
        if (newAvatarDataUrl) {
            dataToUpdate.avatar = newAvatarDataUrl;
        } else if (avatarUrl !== (chat.avatar || '')) {
            // Fallback to URL input if no new file was uploaded
            dataToUpdate.avatar = avatarUrl;
        }
        
        if (Object.keys(dataToUpdate).length > 0) {
            await updateDoc(chatRef, dataToUpdate);
        }

        toast({ title: "Success", description: "Group info updated successfully." });
        setIsEditing(false);
        setNewAvatarDataUrl(null); // Clear new avatar data after saving
    } catch (error) {
        console.error("Error updating group info:", error);
        toast({ title: "Error", description: "Failed to update group info.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  }
  
  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        setPreviewFile(file);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isChanged = (chat.name || '') !== name || (chat.avatar || '') !== avatarUrl || (chat.description || '') !== description || newAvatarDataUrl;
  const currentAvatar = isEditing ? avatarUrl : chat.avatar;

  return (
    <>
    <Sheet open={isOpen} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) setIsEditing(false);
    }}>
      <SheetContent className="w-full max-w-md bg-background/90 backdrop-blur-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4 text-left">
          <SheetTitle>Group Info</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col items-center justify-center p-6 pt-0 space-y-4 border-b">
            <div className="relative">
                <UserAvatar user={{ name: isEditing ? name : chat.name, photoURL: currentAvatar }} className="w-32 h-32 text-4xl" />
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={onSelectFile}
                    accept="image/*"
                    className="hidden"
                />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold">{isEditing ? name : chat.name}</h2>
              <p className="text-sm text-muted-foreground">{isEditing ? description : (chat.description || "No description.")}</p>
              <p className="text-xs text-muted-foreground pt-2">{participants.length} members</p>
            </div>
             {isAdmin && !isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>Edit Info</Button>
            )}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-4">
             {isAdmin && isEditing && (
                <div className="space-y-6">
                    <div className="space-y-3">
                        <Button asChild className="w-full">
                            <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2"/>}
                                {isUploading ? 'Uploading...' : 'Upload from computer'}
                            </button>
                        </Button>
                    </div>
                    <div>
                        <label htmlFor="group-name" className="text-sm font-medium">Group Name</label>
                        <Input id="group-name" value={name} onChange={e => setName(e.target.value)} placeholder="Group name" disabled={isSaving}/>
                    </div>
                     <div>
                        <label htmlFor="group-description" className="text-sm font-medium">Description</label>
                        <Textarea id="group-description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Group description..." disabled={isSaving}/>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSaveChanges} disabled={isSaving || !isChanged}>
                            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save
                        </Button>
                    </div>
                </div>
             )}

              {!isEditing && (
                <>
                    <h3 className="font-semibold text-card-foreground">{participants.length} Members</h3>
                    <div className="space-y-3">
                        {participants.map(participant => (
                            <div key={participant.uid} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <UserAvatar user={participant} className="h-10 w-10"/>
                                <div>
                                    <p className="font-semibold">{participant.name}</p>
                                    <p className="text-sm text-muted-foreground">{participant.email}</p>
                                </div>
                            </div>
                            {participant.uid === adminId && (
                                <Badge variant="outline">Admin</Badge>
                            )}
                            </div>
                        ))}
                    </div>
                </>
              )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
    {previewFile && (
        <ImagePreviewDialog
          file={previewFile}
          onSend={handleAvatarUpload}
          onCancel={() => setPreviewFile(null)}
          mode="avatar"
        />
    )}
    </>
  );
}
