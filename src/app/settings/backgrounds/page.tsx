
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';
import { useAppearance } from '@/components/providers/appearance-provider';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const backgrounds = [
    { id: 'galaxy', name: 'Galaxy', description: 'The default animated starfield.' },
    { id: 'glow', name: 'Gradient Glow', description: 'A slow, shifting gradient.' },
    { id: 'aura', name: 'Aura', description: 'Soft, floating orbs of light.' },
    { id: 'grid', name: 'Grid', description: 'A subtle, futuristic grid.' },
    { id: 'black', name: 'Solid Black', description: 'A clean, solid black.' },
];

export default function BackgroundsPage() {
    const { 
        appBackground, 
        setAppBackground,
        useCustomBackground,
        setUseCustomBackground,
    } = useAppearance();
    const { user } = useAuth();
    const { toast } = useToast();

    const handleBackgroundSelect = async (id: string) => {
        setAppBackground(id);
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), { background: id });
            } catch (error) {
                toast({ title: "Error", description: "Could not save background preference.", variant: "destructive" });
            }
        }
    }

    const handleToggleCustomBackground = async (enabled: boolean) => {
        setUseCustomBackground(enabled);
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), { useCustomBackground: enabled });
            } catch (error) {
                toast({ title: "Error", description: "Could not save preference.", variant: "destructive" });
            }
        }
    }

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
        <h1 className="text-3xl font-bold font-heading">Backgrounds</h1>
        <p className="text-muted-foreground mt-1">Customize the app's background to your liking.</p>
      </motion.header>

      <motion.div variants={cardVariants}>
        <Card>
            <CardHeader>
                <CardTitle>Master Switch</CardTitle>
                <CardDescription>Enable or disable all custom backgrounds.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <Label htmlFor="custom-bg-mode" className="flex flex-col space-y-1">
                        <span>Use Custom Backgrounds</span>
                        <span className="font-normal leading-snug text-muted-foreground">
                            When off, the app will use a solid black background.
                        </span>
                    </Label>
                    <Switch id="custom-bg-mode" checked={useCustomBackground} onCheckedChange={handleToggleCustomBackground} />
                </div>
            </CardContent>
        </Card>
      </motion.div>

      {useCustomBackground && (
        <motion.div variants={cardVariants}>
            <Card>
                <CardHeader>
                    <CardTitle>Choose Your Background</CardTitle>
                    <CardDescription>Select a background to apply across the app.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {backgrounds.map(bg => (
                        <div key={bg.id} className="relative" onClick={() => handleBackgroundSelect(bg.id)}>
                            <div className={cn(
                                "w-full aspect-video rounded-lg cursor-pointer transition-all border-2",
                                appBackground === bg.id ? "border-primary ring-2 ring-primary" : "border-border hover:border-primary/50"
                            )}>
                                <div className={`h-full w-full rounded-md bg-preview-${bg.id}`} />
                            </div>
                            <div className="mt-2">
                                <h3 className="font-semibold">{bg.name}</h3>
                                <p className="text-sm text-muted-foreground">{bg.description}</p>
                            </div>
                            {appBackground === bg.id && (
                                <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full h-6 w-6 flex items-center justify-center">
                                    <Check className="h-4 w-4" />
                                </div>
                            )}
                        </div>
                    ))}
                </CardContent>
            </Card>
        </motion.div>
      )}

      <style jsx global>{`
        .bg-preview-galaxy { background-color: #000; background-image: radial-gradient(circle at 20% 20%, hsla(260, 45%, 15%, 0.4) 0%, transparent 50%), radial-gradient(circle at 80% 80%, hsla(220, 50%, 20%, 0.3) 0%, transparent 50%); }
        .bg-preview-glow { background: linear-gradient(270deg, #0f0c29, #302b63, #24243e); background-size: 600% 600%; animation: gradient-pan 10s ease infinite; }
        .bg-preview-aura { background-color: #0d0d0d; background-image: radial-gradient(circle at 15% 50%, hsla(280, 50%, 40%, 0.2) 0%, transparent 40%), radial-gradient(circle at 85% 30%, hsla(210, 60%, 50%, 0.2) 0%, transparent 40%); }
        .bg-preview-grid { background-color: #050505; background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px); background-size: 2rem 2rem; }
        .bg-preview-black { background-color: #000; }
        
        @keyframes gradient-pan {
            0%{background-position:0% 50%}
            50%{background-position:100% 50%}
            100%{background-position:0% 50%}
        }
      `}</style>
    </motion.div>
  );
}
