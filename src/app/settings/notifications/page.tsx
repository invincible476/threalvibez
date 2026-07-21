
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppearance } from '@/components/providers/appearance-provider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';
import { Check, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useRef } from 'react';
import { createToneAudio } from '@/lib/sound';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function NotificationsPage() {
    const { notificationSound, setNotificationSound, areNotificationsMuted, setAreNotificationsMuted } = useAppearance();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const playSound = (sound: string) => {
        if (typeof window === 'undefined') return;

        if (sound === 'default') {
            const { audio, source } = createToneAudio();
            audio.start(0);
            setTimeout(() => {
                source.stop();
            }, 200);
        } else if (sound.startsWith('data:audio')) {
            const audio = new Audio(sound);
            audio.play().catch(console.error);
        }
    };
    
    const handleSelectSound = (sound: string) => {
        setNotificationSound(sound);
        playSound(sound);
    }
    
    const handleCustomSoundUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && file.type.startsWith('audio/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                if (dataUrl) {
                    setNotificationSound(dataUrl);
                    playSound(dataUrl);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    const isCustomSound = notificationSound !== 'default';

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
                <h1 className="text-3xl font-bold font-heading">Notifications</h1>
                <p className="text-muted-foreground mt-1">Manage how you get notified about new messages.</p>
            </motion.header>

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Sounds</CardTitle>
                        <CardDescription>Select a sound for new message notifications.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                            <Label htmlFor="mute-notifications" className="flex flex-col space-y-1">
                                <span>Mute all notifications</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    You will not receive any sounds or alerts for new messages.
                                </span>
                            </Label>
                            <Switch id="mute-notifications" checked={areNotificationsMuted} onCheckedChange={setAreNotificationsMuted} />
                        </div>
                        {!areNotificationsMuted && (
                             <div className="pt-4">
                                <button 
                                    key="default"
                                    onClick={() => handleSelectSound('default')}
                                    className="flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 text-left"
                                    disabled={areNotificationsMuted}
                                >
                                    <span>Default</span>
                                    {notificationSound === 'default' && <Check className="h-5 w-5 text-primary" />}
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleCustomSoundUpload}
                                    accept="audio/*"
                                    className="hidden"
                                />
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        "flex items-center justify-between w-full p-3 rounded-lg hover:bg-muted/50 text-left",
                                        isCustomSound && "text-primary"
                                    )}
                                    disabled={areNotificationsMuted}
                                >
                                    <div className="flex items-center gap-2">
                                        <Upload className="h-5 w-5" />
                                        <span>Upload Custom Sound</span>
                                    </div>
                                    {isCustomSound && <Check className="h-5 w-5 text-primary" />}
                                </button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>
        </motion.div>
    );
}
