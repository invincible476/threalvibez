
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
  const url = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('timestamp', String(Date.now())); // Prevent caching

  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cloudinary upload failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        url,
        fileType: file.type,
        fileSize: file.size
      });

      if (response.status === 413) {
        throw new Error('File size exceeds server limits');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Upload not authorized. Please check your Cloudinary configuration.');
      }

      throw new Error(`Cloudinary upload failed: ${response.status} - ${response.statusText}. ${errorText}`);
    }

    const data = await response.json();
    if (!data.secure_url) {
      console.error('Invalid Cloudinary response:', data);
      throw new Error('Invalid response: missing secure_url');
    }

    console.log('Upload successful:', {
      publicId: data.public_id,
      url: data.secure_url,
      format: data.format
    });

    return data;
  } catch (error: any) {
    console.error('Upload error:', error, {
      url,
      fileType: file.type,
      fileSize: file.size
    });
    
    if (error.name === 'TimeoutError') {
      throw new Error('Upload timed out. Please try again with a smaller file.');
    }
    
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error('Network error: Could not connect to Cloudinary. Please check your internet connection.');
    }
    
    if (error.message.includes('Failed to execute') && error.message.includes('fetch')) {
      throw new Error('Browser error: The request was blocked. Please check your browser settings and extensions.');
    }
    
    throw error;
  }
}

function ProfileSkeleton() {
    return (
        <div className="space-y-8 animate-fade-in p-4 sm:p-6 lg:p-8">
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
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const { appBackground, useCustomBackground } = useAppearance();

  const handleUpdatePhotoUrl = useCallback(async (newPhotoUrl: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user found.");
    
    await updateProfile(currentUser, { photoURL: newPhotoUrl });
    
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, { photoURL: newPhotoUrl });
    
    setAvatarUrl(newPhotoUrl);
    toast({ title: 'Success', description: 'Your avatar has been updated.' });
  }, [toast]);

  const handleAvatarUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        console.error('Cloudinary configuration missing:', { cloudName: !!cloudName, uploadPreset: !!uploadPreset });
        toast({ 
          title: 'Configuration Error', 
          description: 'Avatar upload is not properly configured. Please contact support.', 
          variant: 'destructive' 
        });
        setIsUploading(false);
        return;
    }

    // Validate file type and size
    if (!file.type.startsWith('image/')) {
      toast({ 
        title: 'Invalid File', 
        description: 'Please select an image file (PNG, JPEG, etc).', 
        variant: 'destructive' 
      });
      setIsUploading(false);
      return;
    }

    // 5MB limit for avatar images
    if (file.size > 5 * 1024 * 1024) {
      toast({ 
        title: 'File Too Large', 
        description: 'Please select an image smaller than 5MB.', 
        variant: 'destructive' 
      });
      setIsUploading(false);
      return;
    }

    try {
        console.log('Starting avatar upload:', { 
          fileName: file.name, 
          fileType: file.type, 
          fileSize: Math.round(file.size / 1024) + 'KB'
        });

        const result = await uploadToCloudinaryXHR(file, cloudName, uploadPreset);
        
        if (!result.secure_url) {
          throw new Error('Cloudinary response missing secure_url');
        }
        
        await handleUpdatePhotoUrl(result.secure_url);
        console.log('Avatar upload successful:', { url: result.secure_url });
    } catch (error: any) {
        console.error("Error uploading avatar to Cloudinary:", error);
        toast({ 
          title: 'Upload Failed', 
          description: error.message || 'Could not upload avatar. Please try again.', 
          variant: 'destructive' 
        });
    } finally {
        setIsUploading(false);
        setPreviewFile(null);
    }
  }, [toast, handleUpdatePhotoUrl]);

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
            setInstagramUrl(userData.instagramUrl || '');
        }
        setLoading(false);
    });

    return () => unsubscribe();
  }, [authUser, authLoading]);

  // Conditional returns must come AFTER all hooks have been called.
  if (loading || authLoading) {
    return <ProfileSkeleton />;
  }

  if (!user) {
    return <div className="text-center text-muted-foreground p-8">User not found. Please log in again.</div>;
  }

  const handleNameInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
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

        if(instagramUrl !== (user.instagramUrl || '')) {
            // Validate Instagram URL format
            if (instagramUrl && !instagramUrl.match(/^https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+\/?$/)) {
                throw new Error('Please enter a valid Instagram profile URL');
            }
            dataToUpdate.instagramUrl = instagramUrl;
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

  const isSaveDisabled = !user || (name === user.name && about === (user.about || '') && instagramUrl === (user.instagramUrl || ''));

  return (
    <motion.div 
        className="space-y-8 p-4 sm:p-6 lg:p-8"
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
                <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram Profile</Label>
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                            <Input
                                id="instagram"
                                type="url"
                                placeholder="https://instagram.com/username"
                                value={instagramUrl || ''}
                                onChange={(e) => setInstagramUrl(e.target.value)}
                                disabled={isSaving}
                                className="pl-9"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.897 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.897-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                    <p className="text-[0.8rem] text-muted-foreground">
                        Your Instagram profile will be visible to other users
                    </p>
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
