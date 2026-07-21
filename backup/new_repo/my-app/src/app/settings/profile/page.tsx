
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UserAvatar } from '@/components/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, Loader2, Shield } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';
import type { User as UserType } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { motion } from 'framer-motion';
import { Switch } from '@/components/ui/switch';
import { useAppearance } from '@/components/providers/appearance-provider';
import { ImagePreviewDialog } from '@/components/image-preview-dialog';
import { Textarea } from '@/components/ui/textarea';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

async function uploadToCloudinaryXHR(
  file: File,
  cloudName: string,
  uploadPreset: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); }
          catch (e) { reject(new Error('Invalid JSON response from Cloudinary')); }
        } else {
          reject(new Error(`Cloudinary upload failed: ${xhr.status} ${xhr.responseText}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during Cloudinary upload'));
    xhr.send(formData);
  });
}

function ProfileSkeleton() {
    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <Skeleton className="h-9 w-40" />
                <Skeleton className="h-5 w-64 mt-2" />
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-7 w-32" />
                    <Skeleton className="h-4 w-72 mt-2" />
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <div className="flex-1 space-y-4 text-center sm:text-left w-full">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-12" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-12" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Skeleton className="h-10 w-28" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}


export default function ProfilePage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [about, setAbout] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const { appBackground, useCustomBackground } = useAppearance();

  
  useEffect(() => {
    if (authLoading) return;
    if (!authUser) {
      setLoading(false);
      return;
    };

    const userDocRef = doc(db, 'users', authUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const userData = { id: doc.id, ...doc.data() } as UserType;
            setUser(userData);
            setName(userData.name || '');
            setAbout(userData.about || '');
            setAvatarUrl(userData.photoURL || '');
            setIsPrivate(userData.isPrivate || false);
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [authUser, authLoading]);


  if (loading || authLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return <div className="text-center text-muted-foreground">User not found. Please log in again.</div>;
  }

  const handleNameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  }
  
 const handleUpdatePhotoUrl = async (newPhotoUrl: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user found.");
    
    // Update Firebase Auth profile
    await updateProfile(currentUser, { photoURL: newPhotoUrl });
    
    // Update Firestore document
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, { photoURL: newPhotoUrl });
    
    setAvatarUrl(newPhotoUrl);
    toast({ title: 'Success', description: 'Your avatar has been updated.' });
  }

  const handleSetAvatarFromUrl = async () => {
    if (!avatarUrl) {
      toast({ title: 'Error', description: 'Please enter a URL.', variant: 'destructive' });
      return;
    }
    
    setIsUploading(true);
    try {
      await handleUpdatePhotoUrl(avatarUrl);
    } catch (error: any) {
      console.error("Error updating avatar from URL:", error);
      toast({ title: 'Error', description: error.message || 'Failed to update avatar.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  }

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        setPreviewFile(file);
        if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        toast({ title: 'Cloudinary config missing', variant: 'destructive' });
        setIsUploading(false);
        return;
    }

    try {
        const result = await uploadToCloudinaryXHR(file, cloudName, uploadPreset);
        await handleUpdatePhotoUrl(result.secure_url);
    } catch (error) {
        console.error("Error uploading avatar to Cloudinary:", error);
        toast({ title: 'Error', description: 'Failed to upload new avatar.', variant: 'destructive' });
    } finally {
        setIsUploading(false);
        setPreviewFile(null);
    }
  }, [toast]);


  const handleSaveChanges = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || !user) return;
    
    setIsSaving(true);
    try {
        const dataToUpdate: any = {};
        if(name !== user.name) {
            await updateProfile(currentUser, { displayName: name });
            dataToUpdate.name = name;
        }

        if(about !== (user.about || '')) {
            dataToUpdate.about = about;
        }

        dataToUpdate.background = appBackground;
        dataToUpdate.useCustomBackground = useCustomBackground;

        if (Object.keys(dataToUpdate).length > 0) {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, dataToUpdate);
        }
        
        toast({
            title: "Saved!",
            description: "Your profile information has been updated."
        });

    } catch(error) {
        console.error("Error saving profile:", error);
        toast({
            title: "Error",
            description: "Failed to save profile changes.",
            variant: "destructive"
        });
    } finally {
        setIsSaving(false);
    }
  }

  const handlePrivacyChange = async (isPrivate: boolean) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    
    setIsPrivate(isPrivate);

    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, { isPrivate: isPrivate });
        toast({
            title: "Privacy settings updated",
            description: isPrivate ? "Your account is now private." : "Your account is now public."
        });
    } catch(error) {
        setIsPrivate(!isPrivate);
        console.error("Error updating privacy:", error);
        toast({
            title: "Error",
            description: "Failed to update privacy settings.",
            variant: "destructive"
        });
    }
  }

  const isSaveDisabled = !user || (name === user.name && about === (user.about || ''));
  

  return (
    <motion.div 
        className="space-y-8"
        initial="initial"
        animate="animate"
        variants={{
            animate: {
            transition: {
                staggerChildren: 0.1,
            },
            },
        }}
    >
       <motion.header variants={cardVariants}>
        <h1 className="text-3xl font-bold font-heading">Profile</h1>
        <p className="text-muted-foreground mt-1">Manage your public profile information.</p>
      </motion.header>

      <motion.div variants={cardVariants}>
        <Card>
            <CardHeader>
            <CardTitle>Your Profile</CardTitle>
            <CardDescription>Update your photo and personal details here.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative">
                    <UserAvatar user={user} className="h-24 w-24 sm:h-28 sm:w-28 text-3xl" />
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onSelectFile}
                        accept="image/*"
                        className="hidden"
                    />
                </div>
                <div className="flex-1 space-y-3 w-full">
                    <Button asChild className="w-full">
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                            {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2"/>}
                            {isUploading ? 'Uploading...' : 'Upload from computer'}
                        </motion.button>
                    </Button>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t"></span>
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                            <span className="bg-card px-2 text-muted-foreground">OR</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Input
                            placeholder="Paste image URL"
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            disabled={isUploading}
                        />
                         <Button asChild variant="secondary" onClick={handleSetAvatarFromUrl} disabled={isUploading || !avatarUrl || avatarUrl === user.photoURL}>
                            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                {isUploading ? <Loader2 className="h-4 w-4 animate-spin"/> : 'Set'}
                            </motion.button>
                        </Button>
                    </div>
                </div>
            </div>
            
            <Separator />

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input 
                        id="name" 
                        value={name} 
                        onChange={handleNameInputChange}
                        disabled={isSaving}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="about">About</Label>
                    <Textarea 
                        id="about" 
                        value={about} 
                        onChange={(e) => setAbout(e.target.value)}
                        placeholder="Tell everyone a little about yourself."
                        disabled={isSaving}
                        rows={3}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={user.email || ''} disabled />
                </div>
            </div>
            <div className="flex justify-end">
                <Button asChild onClick={handleSaveChanges} disabled={isSaveDisabled || isUploading || isSaving}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </motion.button>
                </Button>
            </div>
            </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={cardVariants}>
        <Card>
            <CardHeader>
                <CardTitle>Privacy</CardTitle>
                <CardDescription>Control how others can find your account.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <Label htmlFor="private-account-mode" className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                            <Shield className="h-5 w-5" />
                            <span>Private Account</span>
                        </div>
                        <span className="font-normal leading-snug text-muted-foreground">
                           When enabled, your account can only be found by your exact email address.
                        </span>
                    </Label>
                    <Switch id="private-account-mode" checked={isPrivate} onCheckedChange={handlePrivacyChange} />
                </div>
            </CardContent>
        </Card>
      </motion.div>
      
      {previewFile && (
        <ImagePreviewDialog
          file={previewFile}
          onSend={(file) => handleAvatarUpload(file)}
          onCancel={() => setPreviewFile(null)}
          mode="avatar"
        />
      )}
    </motion.div>
  );
}
