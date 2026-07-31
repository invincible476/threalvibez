
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion } from 'framer-motion';
import { useAppearance } from '@/components/providers/appearance-provider';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

export default function WeatherSettingsPage() {
    const {
        isWeatherVisible,
        setIsWeatherVisible,
        weatherLocation,
        setWeatherLocation,
        weatherUnit,
        setWeatherUnit,
    } = useAppearance();
    
    const [tempLocation, setTempLocation] = React.useState(weatherLocation);

    const handleLocationBlur = () => {
        if (tempLocation !== weatherLocation) {
            setWeatherLocation(tempLocation);
        }
    };
    
    const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setWeatherLocation(tempLocation);
            e.currentTarget.blur();
        }
    };

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
        <p className="text-xs text-zinc-400 mb-2 max-w-md">Customize the weather widget shown in the sidebar.</p>
      </motion.header>

      <motion.div variants={cardVariants}>
        <Card className="border border-zinc-800/50 bg-zinc-900/60">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-zinc-100">Display</CardTitle>
                <CardDescription className="text-xs text-zinc-400">Control the visibility of the weather widget.</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex items-center justify-between py-3 px-4">
                    <Label htmlFor="show-weather-widget" className="flex flex-col space-y-0.5">
                        <span className="text-sm font-medium text-zinc-100">Show Weather Widget</span>
                        <span className="text-xs text-zinc-400">
                            Display the current weather in the chat list header.
                        </span>
                    </Label>
                    <Switch id="show-weather-widget" checked={isWeatherVisible} onCheckedChange={setIsWeatherVisible} />
                </div>
            </CardContent>
        </Card>
      </motion.div>

      {isWeatherVisible && (
        <>
            <motion.div variants={cardVariants}>
                <Card className="border border-zinc-800/50 bg-zinc-900/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-zinc-100">Location</CardTitle>
                        <CardDescription className="text-xs text-zinc-400">
                            Set the location for the weather forecast. Leave it blank to use your browser's location.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <Input
                            placeholder="e.g., London, UK"
                            value={tempLocation}
                            onChange={(e) => setTempLocation(e.target.value)}
                            onBlur={handleLocationBlur}
                            onKeyDown={handleLocationKeyDown}
                            className="border-zinc-700/50 bg-zinc-800/40"
                        />
                         <p className="text-xs text-zinc-400 mt-2">
                           Changes are saved when you press Enter or click outside the box.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
                <Card className="border border-zinc-800/50 bg-zinc-900/60">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-zinc-100">Units</CardTitle>
                        <CardDescription className="text-xs text-zinc-400">Choose the unit for temperature.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                        <RadioGroup defaultValue={weatherUnit} onValueChange={(v) => setWeatherUnit(v as 'Celsius' | 'Fahrenheit')}>
                            <div className="flex items-center space-x-2 py-2">
                                <RadioGroupItem value="Celsius" id="celsius" />
                                <Label htmlFor="celsius" className="text-sm text-zinc-100 cursor-pointer">Celsius (°C)</Label>
                            </div>
                            <div className="flex items-center space-x-2 py-2">
                                <RadioGroupItem value="Fahrenheit" id="fahrenheit" />
                                <Label htmlFor="fahrenheit" className="text-sm text-zinc-100 cursor-pointer">Fahrenheit (°F)</Label>
                            </div>
                        </RadioGroup>
                    </CardContent>
                </Card>
            </motion.div>
        </>
      )}
    </motion.div>
  );
}
