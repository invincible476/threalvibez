
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sun, Moon, Plus } from 'lucide-react';
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
import useGlassTheme from '@/components/settings/hooks/useGlassTheme';

const themes = [
    { name: 'Light', value: 'light', icon: Sun },
    { name: 'Dark', value: 'dark', icon: Moon },
]

const accentColors = [
    { name: 'Default', value: '283 51% 53%' },
    { name: 'Teal', value: '175 70% 40%' },
    { name: 'Blue', value: '210 90% 55%' },
    { name: 'Green', value: '145 65% 45%' },
    { name: 'Orange', value: '25 95% 55%' },
    { name: 'Pink', value: '330 85% 60%' },
]

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
        isAmoled, setIsAmoled,
        chatListOpacity, setChatListOpacity
    } = useAppearance();
    const { blurStrength, setBlurStrength, isGlassEnabled, setIsGlassEnabled, isMounted } = useGlassTheme();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { isMobileDesign, setIsMobileDesign } = useMobileDesign();

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
                <h1 className="text-3xl font-bold font-heading">Appearance</h1>
                <p className="text-muted-foreground mt-1">Customize the look and feel of your app.</p>
            </motion.header>

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>App Theme</CardTitle>
                        <CardDescription>Select a theme for the entire application.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {themes.map((t) => (
                            <motion.div key={t.value} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setTheme(t.value)}
                                    className={cn(
                                        "w-full h-28 flex flex-col gap-2 items-center justify-center text-lg transition-colors",
                                        theme === t.value && "border-primary ring-2 ring-primary bg-primary/10"
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
                            <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                                <Label htmlFor="amoled-mode" className="flex flex-col space-y-1">
                                    <span>AMOLED Black</span>
                                    <span className="font-normal leading-snug text-muted-foreground">
                                    Use a true black background for OLED screens.
                                    </span>
                                </Label>
                                <Switch id="amoled-mode" checked={isAmoled} onCheckedChange={setIsAmoled} />
                            </div>
                        </CardContent>
                    )}
                </Card>
            </motion.div>

            {isMounted && (
              <motion.div variants={cardVariants}>
                  <Card>
                      <CardHeader>
                          <CardTitle>Glass UI</CardTitle>
                          <CardDescription>Configure the frosted glass effect for UI cards.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6">
                          <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                              <Label htmlFor="glass-enabled" className="flex flex-col space-y-1">
                                  <span>Enable Glass Effect</span>
                                  <span className="font-normal leading-snug text-muted-foreground">
                                      Toggles the frosted glass background on cards.
                                  </span>
                              </Label>
                              <Switch id="glass-enabled" checked={isGlassEnabled} onCheckedChange={setIsGlassEnabled} />
                          </div>
                          {isGlassEnabled && (
                              <div className="space-y-2">
                                  <Label htmlFor="blur-strength">Blur Strength ({blurStrength}px)</Label>
                                  <Slider
                                      id="blur-strength"
                                      value={[blurStrength]}
                                      onValueChange={(value) => setBlurStrength(value[0])}
                                      max={20}
                                      step={1}
                                  />
                              </div>
                          )}
                      </CardContent>
                  </Card>
              </motion.div>
            )}

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Mobile Redesign (Beta)</CardTitle>
                        <CardDescription>
                            Enable the new experimental mobile-optimized layout.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                            <Label htmlFor="mobile-redesign-mode" className="flex flex-col space-y-1">
                                <span>Enable Mobile Redesign</span>
                                <span className="font-normal leading-snug text-muted-foreground">
                                    Experience the new compact layout on mobile devices.
                                </span>
                            </Label>
                            <Switch id="mobile-redesign-mode" checked={isMobileDesign} onCheckedChange={setIsMobileDesign} />
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
            
            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Accent Color</CardTitle>
                        <CardDescription>Pick an accent color for buttons, highlights, and more.</CardDescription>
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

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Gradient Colors</CardTitle>
                        <CardDescription>Customize the gradient for your chat bubbles.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label>From</Label>
                            <div className="flex flex-wrap gap-4 mt-2">
                                {accentColors.map((color) => (
                                    <motion.div key={color.name} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                        <Button
                                            size="icon"
                                            onClick={() => setGradientFrom(color.value)}
                                            className={cn(
                                                "rounded-full h-8 w-8 transition-shadow",
                                                gradientFrom === color.value && "ring-2 ring-offset-2 ring-primary ring-offset-background"
                                            )}
                                            style={{ backgroundColor: `hsl(${color.value})` }}
                                        >
                                            <span className="sr-only">{color.name}</span>
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                         <div>
                            <Label>To</Label>
                             <div className="flex flex-wrap gap-4 mt-2">
                                {accentColors.map((color) => (
                                    <motion.div key={color.name} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                                        <Button
                                            size="icon"
                                            onClick={() => setGradientTo(color.value)}
                                            className={cn(
                                                "rounded-full h-8 w-8 transition-shadow",
                                                gradientTo === color.value && "ring-2 ring-offset-2 ring-primary ring-offset-background"
                                            )}
                                            style={{ backgroundColor: `hsl(${color.value})` }}
                                        >
                                            <span className="sr-only">{color.name}</span>
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Chat List Transparency</CardTitle>
                        <CardDescription>Adjust the transparency of the chat list sidebar.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4">
                           <span className="text-sm font-medium">Opaque</span>
                            <Slider
                                value={[100 - chatListOpacity]}
                                onValueChange={(value) => setChatListOpacity(100 - value[0])}
                                max={100}
                                step={1}
                            />
                           <span className="text-sm font-medium">Transparent</span>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Chat Background</CardTitle>
                        <CardDescription>Choose a wallpaper for your conversations.</CardDescription>
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
                                className="w-full aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center hover:border-primary hover:text-primary transition-colors"
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
                                        "rounded-lg object-cover aspect-[9/16] cursor-pointer transition-transform",
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
