"use client";
import React, { useState, useEffect, useRef } from "react";
import NextImage from 'next/image';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, File as FileIcon, Video } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

async function getCroppedCircularImage(image: HTMLImageElement, crop: Crop, fileName: string): Promise<File> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  // Set fixed size for the output avatar
  const size = 400;
  canvas.width = size;
  canvas.height = size;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Convert crop coordinates from pixels to actual image dimensions
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const sourceX = crop.x * scaleX;
  const sourceY = crop.y * scaleY;
  const sourceWidth = crop.width * scaleX;
  const sourceHeight = crop.height * scaleY;

  // Create circular clipping path
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, false);
  ctx.clip();

  // Draw the image
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    size,
    size
  );

  ctx.restore();

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) throw new Error('Canvas is empty');
      resolve(new File([blob], fileName, { type: 'image/png' }));
    }, 'image/png');
  });
}

interface ImagePreviewDialogProps {
  file: File;
  onSend: (file: File, message: string) => Promise<any>;
  onCancel: () => void;
  mode: 'chat' | 'story' | 'avatar';
}

export function ImagePreviewDialog({ file, onSend, onCancel, mode }: ImagePreviewDialogProps) {
  const [message, setMessage] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCropper, setShowCropper] = useState(true);
  const { toast } = useToast();
  const [crop, setCrop] = useState<Crop | undefined>(undefined);
  const percentCropRef = useRef<Crop | undefined>(undefined);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const initialCropSet = useRef(false);

  useEffect(() => {
    if (!file || !file.type) {
      onCancel();
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    initialCropSet.current = false;
    setCrop(undefined);
    return () => URL.revokeObjectURL(url);
  }, [file, onCancel]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    imgRef.current = e.currentTarget;
    if (mode === 'avatar' && !initialCropSet.current) {
      const { width, height } = e.currentTarget;
      
      // Use 80% of the smallest dimension for initial crop
      const cropSize = Math.min(width, height) * 0.8;
      
      // Center the crop
      const x = (width - cropSize) / 2;
      const y = (height - cropSize) / 2;
      
      setCrop({
        unit: 'px',
        x,
        y,
        width: cropSize,
        height: cropSize
      });
      
      initialCropSet.current = true;
    }
  };

  const handleCropChange = (c: Crop) => {
    if (!imgRef.current) return;
    const { width: imgWidth, height: imgHeight } = imgRef.current;
    
    // Set minimum and maximum sizes in pixels
    const minSize = 50;
    const maxSize = Math.min(imgWidth, imgHeight, 300);
    
    const newCrop: Crop = {
      unit: "px" as const,
      width: Math.min(Math.max(c.width || minSize, minSize), maxSize),
      height: Math.min(Math.max(c.height || minSize, minSize), maxSize),
      x: Math.max(0, Math.min(c.x || 0, imgWidth - (c.width || 0))),
      y: Math.max(0, Math.min(c.y || 0, imgHeight - (c.height || 0)))
    };
    
    setCrop(newCrop);
  };

  const handleCropComplete = (c: Crop) => {
    if (!imgRef.current || !c.width || !c.height) return;
    percentCropRef.current = c;
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      let fileToSend = file;
      if (mode === 'avatar' && imgRef.current) {
        setIsProcessing(true);
        setShowCropper(false);
        const percentCrop = percentCropRef.current;
        if (percentCrop && percentCrop.width && percentCrop.height) {
          fileToSend = await getCroppedCircularImage(imgRef.current, percentCrop, 'avatar.png');
        }
      }
      await onSend(fileToSend, message);
    } catch (error) {
      console.error('Image upload/crop failed:', error);
      toast({
        title: "Action Failed",
        description: "Could not process the image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setIsProcessing(false);
      onCancel();
    }
  };

  if (!file || !file.type) return null;

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');

  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>
            {mode === 'story' ? "Post a Story" : mode === 'avatar' ? "Set New Avatar" : "Send File"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center p-4 bg-muted/30 rounded-lg max-h-[50vh] min-h-[200px] overflow-hidden">
          {isImage && previewUrl ? (
            mode === 'avatar' ? (
              <div className="relative w-full h-full flex items-center justify-center">
                {isProcessing ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="ml-2">Processing image...</span>
                  </div>
                ) : showCropper ? (
                  <div style={{ 
                    maxWidth: '500px',
                    width: '100%',
                    maxHeight: '50vh',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <ReactCrop
                      crop={crop}
                      onChange={handleCropChange}
                      onComplete={handleCropComplete}
                      aspect={1}
                      circularCrop
                      minWidth={50}
                      minHeight={50}
                      maxWidth={300}
                      maxHeight={300}
                      keepSelection
                      ruleOfThirds
                      className="max-w-full"
                    >
                      <img
                        ref={imgRef}
                        src={previewUrl}
                        alt="Image preview"
                        style={{ 
                          maxHeight: '50vh',
                          width: '100%',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                        onLoad={onImageLoad}
                        draggable={false}
                      />
                    </ReactCrop>
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <img
                      src={previewUrl}
                      alt="Cropped preview"
                      style={{ 
                        maxHeight: '300px',
                        width: 'auto',
                        borderRadius: '50%'
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <NextImage
                src={previewUrl}
                alt="Image preview"
                width={500}
                height={500}
                style={{ objectFit: 'contain', maxHeight: '50vh', width: 'auto', height: 'auto' }}
              />
            )
          ) : null}
          
          {isVideo && previewUrl && (
            <video src={previewUrl} controls className="max-h-[50vh] rounded-lg" />
          )}
          
          {!isImage && !isVideo && (
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <FileIcon className="w-16 h-16"/>
              <p className="font-semibold">{file.name}</p>
              <p className="text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          )}
        </div>

        {mode !== 'avatar' ? (
          <div className="relative">
            <Textarea
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              placeholder={mode === 'story' ? 'Add a caption...' : 'Add a message...'}
              className="pr-20"
              rows={1}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
          </div>
        ) : null}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onCancel} disabled={isSending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSending ? 'Sending...' : mode === 'story' ? 'Post Story' : mode === 'avatar' ? 'Set as Avatar' : 'Send'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}