
'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import Image from 'next/image';
import { Loader2, PlusCircle, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import imageCompression from 'browser-image-compression';

interface StoryUploaderProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    onCreateStory: (mediaFile: File, caption?: string) => Promise<void>;
}

export function StoryUploader({ isOpen, onOpenChange, onCreateStory }: StoryUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [caption, setCaption] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (!isOpen) {
            // Reset state when dialog closes
            setFile(null);
            setPreviewUrl(null);
            setCaption('');
            setIsUploading(false);
            setError(null);
        }
    }, [isOpen]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (!selectedFile.type.startsWith('image/')) {
                toast({
                    title: "Invalid File Type",
                    description: "Currently, only images are supported for stories.",
                    variant: "destructive"
                });
                return;
            }
            setFile(selectedFile);
            setPreviewUrl(URL.createObjectURL(selectedFile));
            setError(null);
        }
    };

    const handlePostStory = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            const options = {
                maxSizeMB: 1.5,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
            };
            const compressedFile = await imageCompression(file, options);
            
            await onCreateStory(compressedFile, caption);

            toast({
                title: "Success!",
                description: "Your story has been posted.",
            });
            onOpenChange(false);

        } catch (err) {
            console.error('Story upload failed:', err);
            setError('Upload failed. Please try again.');
            toast({
                title: 'Upload Failed',
                description: 'There was a problem posting your story.',
                variant: 'destructive',
            });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a new story</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {!previewUrl ? (
                        <div
                            className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <PlusCircle className="h-12 w-12 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground">Click to select an image</p>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                className="hidden"
                                accept="image/*"
                            />
                        </div>
                    ) : (
                        <div className="relative">
                            <Image
                                src={previewUrl}
                                alt="Story preview"
                                width={500}
                                height={500}
                                className="rounded-lg object-contain max-h-[50vh]"
                            />
                            <Button
                                variant="destructive"
                                size="icon"
                                className="absolute top-2 right-2 rounded-full h-7 w-7"
                                onClick={() => {
                                    setFile(null);
                                    setPreviewUrl(null);
                                }}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                    <Textarea
                        placeholder="Add a caption... (optional)"
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        disabled={isUploading || !file}
                    />
                     {error && (
                        <div className="text-destructive text-sm flex items-center justify-between">
                            <span>{error}</span>
                            <Button variant="link" onClick={handlePostStory}>Retry</Button>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                        Cancel
                    </Button>
                    <Button onClick={handlePostStory} disabled={!file || isUploading}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isUploading ? 'Posting...' : 'Post Story'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
