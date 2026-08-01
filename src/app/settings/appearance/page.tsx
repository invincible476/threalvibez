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
            className="space-y-4 max-w-4xl mx-auto px-4 pt-4 pb-20"
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
                <p className="text-xs text-muted-foreground mb-2 max-w-md">Customize your themes, background styles, and frosted glass controls.</p>
            </motion.header>

            {/* Background Style Toggle */}
            <motion.div variants={cardVariants}>
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <Sparkles className="h-4 w-4 text-muted-foreground" />
                            App Background Style
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Switch between True Black (#000000) and Starry Galaxy themes.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {backgroundStyles.map((style) => {
                            const Icon = style.icon;
                            const isSelected = appBackground === style.id;

                            return (
                                <motion.div key={style.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleBackgroundSelect(style.id)}
                                        className={cn(
                                            "w-full h-20 px-4 py-3 flex items-center justify-start gap-3 text-left border transition-all",
                                            isSelected 
                                                ? "ring-1 ring-violet-700 bg-card border-violet-700/50 text-foreground" 
                                                : "border-border/60 bg-card/40 hover:bg-muted/40 hover:border-border"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-2.5 rounded-lg shrink-0",
                                            isSelected ? "bg-violet-950/80 text-violet-200 border border-violet-800/40" : "bg-muted text-muted-foreground"
                                        )}>
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0 overflow-hidden pr-2">
                                            <p className="font-medium text-sm truncate text-foreground">{style.label}</p>
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
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-foreground">App Theme</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Select Light or Dark mode for the application.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {themes.map((t) => (
                            <motion.div key={t.value} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setTheme(t.value)}
                                    className={cn(
                                        "w-full h-20 flex flex-col gap-2 items-center justify-center transition-colors",
                                        theme === t.value 
                                            ? "ring-1 ring-violet-700 bg-card border-violet-700/50 text-foreground" 
                                            : "border-border/60 bg-card/40 hover:bg-muted/40 text-muted-foreground"
                                    )}
                                >
                                    <t.icon className="h-5 w-5"/>
                                    <span className="text-sm font-medium">{t.name}</span>
                                </Button>
                            </motion.div>
                    ))}
                    </CardContent>
                    {theme === 'dark' && (
                        <CardContent className="pt-0">
                            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/40 border border-border/50">
                                <Label htmlFor="amoled-mode" className="flex flex-col space-y-0.5 flex-1 min-w-0 pr-2">
                                    <span className="text-sm font-medium text-foreground">AMOLED True Black</span>
                                    <span className="text-xs text-muted-foreground break-words">
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
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-sm font-medium text-foreground">Frosted Glass Controls</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Adjust backdrop blur strength and card opacity in real time.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center justify-between py-3 px-4 border-b border-border/40">
                            <Label htmlFor="glass-enabled" className="flex flex-col space-y-0.5 flex-1 min-w-0 pr-2">
                                <span className="text-sm font-medium text-foreground">Enable Frosted Glass Effect</span>
                                <span className="text-xs text-muted-foreground break-words">
                                    Applies dynamic backdrop blur and glass translucency to UI cards.
                                </span>
                            </Label>
                            <Switch id="glass-enabled" checked={isGlassEnabled} onCheckedChange={setIsGlassEnabled} />
                        </div>

                        {isGlassEnabled && (
                            <div className="space-y-4 pt-4 px-4 pb-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="blur-strength" className="text-sm font-medium text-foreground">Blur Strength</Label>
                                        <span className="text-xs text-violet-300 font-mono bg-violet-500/10 px-2 py-0.5 rounded">
                                            {glassBlur === 0 ? '0px (off)' : `${glassBlur}px`}
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

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="glass-opacity" className="text-sm font-medium text-foreground">Glass Card Opacity</Label>
                                        <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">{glassOpacity}%</span>
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
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-sm font-medium text-foreground">Chat List Sidebar Transparency</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Adjust the opacity of the left chat navigation panel.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 px-4 pb-4 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-foreground">Sidebar Opacity</span>
                            <span className="text-xs text-primary font-mono bg-primary/10 px-2 py-0.5 rounded">{chatListOpacity}%</span>
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
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-sm font-medium text-foreground">Mobile Layout Optimization</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Enable compact mobile redesign for smartphone viewports.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="flex items-center justify-between py-3 px-4">
                            <Label htmlFor="mobile-redesign-mode" className="flex flex-col space-y-0.5">
                                <span className="text-sm font-medium text-foreground">Enable Compact Mobile Layout</span>
                                <span className="text-xs text-muted-foreground">
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
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-foreground">Accent Color</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Pick an accent color for buttons, highlights, and icons.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-3 px-4 pb-4">
                    {accentColors.map((color) => (
                        <motion.div key={color.name} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                                size="icon"
                                onClick={() => setAccentColor(color.value)}
                                className={cn(
                                    "rounded-full h-9 w-9 transition-shadow",
                                    accentColor === color.value && "ring-2 ring-offset-2 ring-violet-500 ring-offset-background"
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
                <Card className="border border-border/50 bg-card/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-foreground">Chat Wallpapers</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">Choose a custom background wallpaper for conversation threads.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 px-4 pb-4">
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
                                className="w-full aspect-[9/16] rounded-xl border border-dashed border-border/50 flex flex-col items-center justify-center hover:border-violet-500/50 hover:text-violet-400 text-muted-foreground transition-colors"
                            >
                                <Plus className="h-7 w-7"/>
                                <span className="mt-1 text-xs font-medium">Custom</span>
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
                                        chatBackground === bg.url && "ring-2 ring-offset-2 ring-violet-500 ring-offset-background"
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
