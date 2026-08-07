
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppearance } from '@/components/providers/appearance-provider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { Check, Upload, Bell, ShieldCheck, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import React, { useRef, useState, useEffect } from 'react';
import { createToneAudio } from '@/lib/sound';
import { requestFCMToken } from '@/lib/fcm-client';
import { firebaseAuth } from '@/lib/firebase-init';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function NotificationsPage() {
    const { notificationSound, setNotificationSound, areNotificationsMuted, setAreNotificationsMuted } = useAppearance();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPushPermission(Notification.permission);
        }
    }, []);

    const handleEnablePush = async () => {
        setIsRegistering(true);
        try {
            const user = firebaseAuth.currentUser;
            if (user?.uid) {
                await requestFCMToken(user.uid);
            } else {
                await Notification.requestPermission();
            }
            if (typeof window !== 'undefined' && 'Notification' in window) {
                setPushPermission(Notification.permission);
            }
        } catch (err) {
            console.error('Push notification enable failed:', err);
        } finally {
            setIsRegistering(false);
        }
    };

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
            className="space-y-4 px-4 pt-4 pb-20"
            initial="initial"
            animate="animate"
            variants={{
                animate: {
                transition: {
                    staggerChildren: 0.07,
                },
                },
            }}
        >
             <motion.header variants={cardVariants}>
                <p className="text-xs text-muted-foreground mb-2 max-w-md">Manage how you get notified about new messages.</p>
            </motion.header>

            {/* Push Notifications Card */}
            <motion.div variants={cardVariants}>
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                            <Bell className="h-4 w-4 text-primary" />
                            <CardTitle className="text-sm font-medium text-foreground">Background Push Notifications</CardTitle>
                        </div>
                        <CardDescription className="text-xs text-muted-foreground">
                            Receive notifications even when the app tab or browser is closed.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                            <div className="flex items-center gap-3">
                                <Smartphone className="h-5 w-5 text-muted-foreground" />
                                <div className="space-y-0.5">
                                    <p className="text-xs font-medium">Push Status</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {pushPermission === 'granted'
                                            ? 'Active — Push notifications enabled for closed tabs.'
                                            : pushPermission === 'denied'
                                            ? 'Blocked in browser settings.'
                                            : 'Not enabled yet.'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={handleEnablePush}
                                    disabled={isRegistering}
                                    className="text-xs h-8 px-3"
                                >
                                    {isRegistering ? 'Registering...' : 'Enable / Register Push'}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                        const user = firebaseAuth.currentUser;
                                        if (!user?.uid) {
                                            alert('Not logged in!');
                                            return;
                                        }
                                        try {
                                            const res = await fetch('/api/notifications/test-push', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ userId: user.uid }),
                                            });
                                            const data = await res.json();
                                            alert(`[Push Test Diagnostic Result]\nStatus: ${data.status}\nTokens Found: ${data.tokensFound || 0}\nSuccess: ${data.successCount || 0}, Fail: ${data.failureCount || 0}\nServiceAccountKey Set: ${data.hasServiceAccountEnv}\n\nDetails: ${JSON.stringify(data, null, 2)}`);
                                        } catch (err: any) {
                                            alert(`Error testing push: ${err?.message || err}`);
                                        }
                                    }}
                                    className="text-xs h-8 px-3"
                                >
                                    Send Test Push
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* Sounds Card */}
            <motion.div variants={cardVariants}>
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-foreground">Sounds</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Select a sound for new message notifications.</CardDescription>
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

