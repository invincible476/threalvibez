
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
        <h1 className="text-3xl font-bold font-heading">Weather</h1>
        <p className="text-muted-foreground mt-1">Customize the weather widget shown in the sidebar.</p>
      </motion.header>

      <motion.div variants={cardVariants}>
        <Card>
            <CardHeader>
                <CardTitle>Display</CardTitle>
                <CardDescription>Control the visibility of the weather widget.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
                    <Label htmlFor="show-weather-widget" className="flex flex-col space-y-1">
                        <span>Show Weather Widget</span>
                        <span className="font-normal leading-snug text-muted-foreground">
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
                <Card>
                    <CardHeader>
                        <CardTitle>Location</CardTitle>
                        <CardDescription>
                            Set the location for the weather forecast. Leave it blank to use your browser's location.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Input
                            placeholder="e.g., London, UK"
                            value={tempLocation}
                            onChange={(e) => setTempLocation(e.target.value)}
                            onBlur={handleLocationBlur}
                            onKeyDown={handleLocationKeyDown}
                        />
                         <p className="text-xs text-muted-foreground mt-2">
                           Changes are saved when you press Enter or click outside the box.
                        </p>
                    </CardContent>
                </Card>
            </motion.div>

            <motion.div variants={cardVariants}>
                <Card>
                    <CardHeader>
                        <CardTitle>Units</CardTitle>
                        <CardDescription>Choose the unit for temperature.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <RadioGroup defaultValue={weatherUnit} onValueChange={(v) => setWeatherUnit(v as 'Celsius' | 'Fahrenheit')}>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Celsius" id="celsius" />
                                <Label htmlFor="celsius">Celsius (°C)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Fahrenheit" id="fahrenheit" />
                                <Label htmlFor="fahrenheit">Fahrenheit (°F)</Label>
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
