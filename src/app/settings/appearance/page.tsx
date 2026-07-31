'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Plus, Sparkles, CircleDot, Layers, Grid as GridIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useTheme } from 'next-themes';
import React, { useRef } from 'react';
import { useAppearance } from '@/components/providers/appearance-provider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMobileDesign } from '@/components/providers/mobile-provider';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/hooks/use-auth';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const themes = [
    { name: 'Light', value: 'light', icon: Sun },
    { name: 'Dark', value: 'dark', icon: Moon },
];

const backgroundStyles = [
    { id: 'black', label: 'True Black', description: 'Pure #000000 OLED background (Default)', icon: CircleDot },
    { id: 'galaxy', label: 'Galaxy Stars', description: 'Animated space star canvas background', icon: Sparkles },
    { id: 'glow', label: 'Gradient Glow', description: 'Soft ambient color glows', icon: Layers },
    { id: 'grid', label: 'Tech Grid', description: 'Subtle cyberpunk grid pattern', icon: GridIcon },
];

const accentColors = [
    { name: 'Default', value: '283 51% 53%' },
    { name: 'Teal', value: '175 70% 40%' },
    { name: 'Blue', value: '210 90% 55%' },
    { name: 'Green', value: '145 65% 45%' },
    { name: 'Orange', value: '25 95% 55%' },
    { name: 'Pink', value: '330 85% 60%' },
];

const defaultChatBackgrounds = [
  { id: 'default', url: 'https://picsum.photos/seed/bg-default/600/1000', hint: 'abstract pattern' },
  { id: 'bg1', url: 'https://picsum.photos/seed/bg1/600/1000', hint: 'abstract pattern' },
  { id: 'bg2', url: 'https://picsum.photos/seed/bg2/600/1000', hint: 'mountain landscape' },
  { id: 'bg3', url: 'https://picsum.photos/seed/bg3/600/1000', hint: 'minimalist texture' },
  { id: 'bg4', url: 'https://picsum.photos/seed/bg4/600/1000', hint: 'forest path' },
];

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function AppearancePage() {
    const { theme, setTheme } = useTheme();
    const { 
        accentColor, setAccentColor,
        gradientFrom, setGradientFrom,
        gradientTo, setGradientTo, 
        chatBackground, setChatBackground,
        appBackground, setAppBackground,
        isAmoled, setIsAmoled,
        chatListOpacity, setChatListOpacity,
        isGlassEnabled, setIsGlassEnabled,
        glassBlur, setGlassBlur,
        glassOpacity, setGlassOpacity,
    } = useAppearance();

    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { isMobileDesign, setIsMobileDesign } = useMobileDesign();

    const handleBackgroundSelect = async (id: string) => {
        setAppBackground(id);
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), { background: id });
            } catch (e) {
                console.warn("Could not sync background to Firestore:", e);
            }
        }
    };

    const handleCustomBgUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setChatBackground(e.target.result as string);
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <motion.div 
            className="space-y-8 max-w-4xl mx-auto pb-12"
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
                <p className="text-xs text-zinc-400 mb-4 max-w-md">Customize your themes, background styles, and frosted glass controls.</p>
            </motion.header>

            {/* Background Style Toggle */}
            <motion.div variants={cardVariants}>
                <Card className="border border-border/60 backdrop-blur-xl bg-card/75">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" />
                            App Background Style
                        </CardTitle>
                        <CardDescription>
                            Switch between True Black (#000000) and Starry Galaxy themes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {backgroundStyles.map((style) => {
                            const Icon = style.icon;
                            const isSelected = appBackground === style.id;

                            return (
                                <motion.div key={style.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleBackgroundSelect(style.id)}
                                        className={cn(
                                            "w-full h-24 px-4 py-3.5 flex items-center justify-start gap-3.5 text-left border rounded-xl transition-all",
                                            isSelected 
                                                ? "bg-purple-500/15 border-purple-500/30 text-purple-300 font-semibold shadow-lg shadow-purple-500/10" 
                                                : "hover:border-border hover:bg-muted/30"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-3 rounded-lg shrink-0",
                                            isSelected ? "bg-purple-500/20 text-purple-300" : "bg-muted text-muted-foreground"
                                        )}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden pr-2">
                                            <p className="font-semibold text-base truncate">{style.label}</p>
                                            <p className="text-xs text-muted-foreground break-words">{style.description}</p>
                                        </div>
                                    </Button>
                                </motion.div>
                            );
                        })}
                    </CardContent>
                </Card>
            </motion.div>

            {/* App Theme */}
            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>App Theme</CardTitle>
                        <CardDescription>Select Light or Dark mode for the application.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {themes.map((t) => (
                            <motion.div key={t.value} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setTheme(t.value)}
                                    className={cn(
                                        "w-full h-24 flex flex-col gap-2 items-center justify-center text-lg transition-colors rounded-xl",
                                        theme === t.value && "bg-purple-500/15 border-purple-500/30 text-purple-300 font-semibold"
                                    )}
                                >
                                    <t.icon className="h-6 w-6"/>
                                    <span>{t.name}</span>
                                </Button>
                            </motion.div>
                    ))}
                    </CardContent>
                    {theme === 'dark' && (
                        <CardContent>
                            <div className="flex items-center justify-between space-x-2 rounded-xl border px-4 py-3.5">
                                <Label htmlFor="amoled-mode" className="flex flex-col space-y-1">
                                    <span className="font-semibold">AMOLED True Black</span>
                                    <span className="font-normal leading-snug text-muted-foreground text-xs">
                                        Uses pure #000000 background for maximum OLED battery savings.
                                    </span>
                                </Label>
                                <Switch id="amoled-mode" checked={isAmoled} onCheckedChange={setIsAmoled} />
                            </div>
                        </CardContent>
                    )}
                </Card>
            </motion.div>

            {/* Frosted Glass & Sliders */}
            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Frosted Glass Controls</CardTitle>
                        <CardDescription>Adjust backdrop blur strength and card opacity in real time.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center justify-between space-x-2 rounded-xl border px-4 py-3.5">
                            <Label htmlFor="glass-enabled" className="flex flex-col space-y-1">
                                <span className="font-semibold">Enable Frosted Glass Effect</span>
                                <span className="font-normal leading-snug text-muted-foreground text-xs">
                                    Applies dynamic backdrop blur and glass translucency to UI cards.
                                </span>
                            </Label>
                            <Switch id="glass-enabled" checked={isGlassEnabled} onCheckedChange={setIsGlassEnabled} />
                        </div>

                        {isGlassEnabled && (
                            <div className="space-y-6 pt-2">
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm font-medium">
                                        <Label htmlFor="blur-strength">Blur Strength</Label>
                                        <span className="text-purple-300 font-mono">
                                            {glassBlur === 0 ? '0px (Solid Crisp)' : `${glassBlur}px`}
                                        </span>
                                    </div>
                                    <Slider
                                        id="blur-strength"
                                        value={[glassBlur]}
                                        onValueChange={(value) => setGlassBlur(value[0])}
                                        min={0}
                                        max={30}
                                        step={1}
                                    />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm font-medium">
                                        <Label htmlFor="glass-opacity">Glass Card Opacity</Label>
                                        <span className="text-primary font-mono">{glassOpacity}%</span>
                                    </div>
                                    <Slider
                                        id="glass-opacity"
                                        value={[glassOpacity]}
                                        onValueChange={(value) => setGlassOpacity(value[0])}
                                        min={10}
                                        max={100}
                                        step={1}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Chat List Transparency */}
            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Chat List Sidebar Transparency</CardTitle>
                        <CardDescription>Adjust the opacity of the left chat navigation panel.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex justify-between items-center text-sm font-medium">
                            <span>Sidebar Opacity</span>
                            <span className="text-primary font-mono">{chatListOpacity}%</span>
                        </div>
                        <Slider
                            value={[chatListOpacity]}
                            onValueChange={(value) => setChatListOpacity(value[0])}
                            min={20}
                            max={100}
                            step={1}
                        />
                    </CardContent>
                </Card>
            </motion.div>

            {/* Mobile Redesign Toggle */}
            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Mobile Layout Optimization</CardTitle>
                        <CardDescription>
                            Enable compact mobile redesign for smartphone viewports.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between space-x-2 rounded-xl border p-4">
                            <Label htmlFor="mobile-redesign-mode" className="flex flex-col space-y-1">
                                <span className="font-semibold">Enable Compact Mobile Layout</span>
                                <span className="font-normal leading-snug text-muted-foreground text-xs">
                                    Optimizes navigation and spacing for mobile screens.
                                </span>
                            </Label>
                            <Switch id="mobile-redesign-mode" checked={isMobileDesign} onCheckedChange={setIsMobileDesign} />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
            
            {/* Accent Color Selection */}
            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Accent Color</CardTitle>
                        <CardDescription>Pick an accent color for buttons, highlights, and icons.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-4">
                    {accentColors.map((color) => (
                        <motion.div key={color.name} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                                size="icon"
                                onClick={() => setAccentColor(color.value)}
                                className={cn(
                                    "rounded-full h-10 w-10 transition-shadow",
                                    accentColor === color.value && "ring-2 ring-offset-2 ring-primary ring-offset-background"
                                )}
                                style={{ backgroundColor: `hsl(${color.value})` }}
                            >
                                <span className="sr-only">{color.name}</span>
                            </Button>
                        </motion.div>
                    ))}
                    </CardContent>
                </Card>
            </motion.div>

            {/* Chat Wallpapers */}
            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Chat Wallpapers</CardTitle>
                        <CardDescription>Choose a custom background wallpaper for conversation threads.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleCustomBgUpload}
                            accept="image/*"
                            className="hidden"
                        />
                        <motion.div className="relative group" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full aspect-[9/16] rounded-xl border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:border-primary hover:text-primary transition-colors"
                            >
                                <Plus className="h-8 w-8"/>
                                <span className="mt-2 text-sm font-medium">Custom</span>
                            </button>
                        </motion.div>

                        {defaultChatBackgrounds.map((bg) => (
                            <motion.div key={bg.id} className="relative group" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                                <Image 
                                    src={bg.url} 
                                    alt="Chat background option" 
                                    width={200}
                                    height={300}
                                    onClick={() => setChatBackground(bg.url)}
                                    className={cn(
                                        "rounded-xl object-cover aspect-[9/16] cursor-pointer transition-transform",
                                        chatBackground === bg.url && "ring-2 ring-offset-2 ring-primary ring-offset-background"
                                    )}
                                    data-ai-hint={bg.hint}
                                />
                            </motion.div>
                        ))}
                    </CardContent>
                </Card>
            </motion.div>

        </motion.div>
    );
}
