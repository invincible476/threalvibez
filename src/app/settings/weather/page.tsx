'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppearance } from '@/components/providers/appearance-provider';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Navigation, 
  Search, 
  Sun, 
  Cloud, 
  CloudRain, 
  Wind, 
  Zap, 
  Snowflake, 
  CloudFog, 
  CloudSun,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { getWeather, validateLocation, GetWeatherOutput } from '@/ai/flows/weather-flow';
import { getCityFromCoords } from '@/lib/geocoding';

const cardVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const weatherIcons: Record<GetWeatherOutput['condition'], React.ReactNode> = {
  Sunny: <Sun className="w-6 h-6 text-amber-400" />,
  Clear: <Sun className="w-6 h-6 text-amber-400" />,
  Cloudy: <Cloud className="w-6 h-6 text-zinc-400" />,
  Rainy: <CloudRain className="w-6 h-6 text-sky-400" />,
  Windy: <Wind className="w-6 h-6 text-teal-300" />,
  Stormy: <Zap className="w-6 h-6 text-yellow-400" />,
  Snowy: <Snowflake className="w-6 h-6 text-blue-200" />,
  Mist: <CloudFog className="w-6 h-6 text-zinc-400" />,
  Haze: <CloudSun className="w-6 h-6 text-amber-300" />,
  Fog: <CloudFog className="w-6 h-6 text-zinc-400" />,
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
  
  const { toast } = useToast();

  const [tempLocation, setTempLocation] = useState(weatherLocation || '');
  const [isValidating, setIsValidating] = useState(false);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  
  const [status, setStatus] = useState<{
    type: 'idle' | 'success' | 'error';
    message: string;
    resolvedName?: string;
  }>({
    type: 'idle',
    message: '',
  });

  const [previewWeather, setPreviewWeather] = useState<GetWeatherOutput | null>(null);

  // Sync initial input with stored weatherLocation
  useEffect(() => {
    setTempLocation(weatherLocation || '');
  }, [weatherLocation]);

  // Load preview data whenever location or unit changes
  const refreshPreview = useCallback(async (loc: string, unit: 'Celsius' | 'Fahrenheit') => {
    const queryLoc = loc.trim() || 'London';
    try {
      const data = await getWeather({ location: queryLoc, unit });
      setPreviewWeather(data);
    } catch (e) {
      console.warn('Preview weather error:', e);
    }
  }, []);

  useEffect(() => {
    if (isWeatherVisible) {
      refreshPreview(weatherLocation, weatherUnit);
    }
  }, [isWeatherVisible, weatherLocation, weatherUnit, refreshPreview]);

  // Validate and Save Location
  const handleSaveLocation = async (targetLoc?: string) => {
    const locToSave = (targetLoc ?? tempLocation).trim();

    if (!locToSave) {
      // Revert to browser GPS / London default
      setWeatherLocation('');
      setStatus({
        type: 'success',
        message: 'Location cleared. Weather will use automatic GPS / fallback location.',
      });
      toast({
        title: 'Location Reset',
        description: 'Using browser automatic location.',
      });
      refreshPreview('London', weatherUnit);
      return;
    }

    setIsValidating(true);
    setStatus({ type: 'idle', message: '' });

    try {
      const validation = await validateLocation(locToSave);

      if (validation.isValid && validation.resolvedName) {
        setWeatherLocation(locToSave);
        setStatus({
          type: 'success',
          message: `Registered & Verified: ${validation.resolvedName}`,
          resolvedName: validation.resolvedName,
        });

        // Update preview weather immediately
        await refreshPreview(locToSave, weatherUnit);

        toast({
          title: 'Location Verified & Saved! ✓',
          description: `Weather widget updated to ${validation.resolvedName}`,
        });
      } else {
        setStatus({
          type: 'error',
          message: `Could not find city "${locToSave}". Please check spelling or try adding country name (e.g. "Paris, France").`,
        });

        toast({
          title: 'Registration Failed ✕',
          description: `Could not locate "${locToSave}". Please check spelling.`,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Location registration error:', err);
      setStatus({
        type: 'error',
        message: 'Network error while verifying location. Please try again.',
      });
    } finally {
      setIsValidating(false);
    }
  };

  // GPS Location Detector
  const handleUseGps = async () => {
    if (!navigator.geolocation) {
      toast({
        title: 'GPS Unavailable',
        description: 'Geolocation is not supported by your browser.',
        variant: 'destructive',
      });
      return;
    }

    setIsLocatingGps(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 });
      });

      const city = await getCityFromCoords(position.coords.latitude, position.coords.longitude);
      if (city) {
        setTempLocation(city);
        await handleSaveLocation(city);
      } else {
        toast({
          title: 'City Lookup Notice',
          description: 'Could not determine city name from GPS coordinates.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      console.warn('GPS location detection failed:', err);
      toast({
        title: 'Location Permission Required',
        description: 'Could not access GPS location. Please check browser permissions.',
        variant: 'destructive',
      });
    } finally {
      setIsLocatingGps(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveLocation();
    }
  };

  return (
    <motion.div
      className="space-y-4 px-4 pt-4 pb-20 max-w-2xl mx-auto"
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
      <motion.header variants={cardVariants} className="space-y-1">
        <h2 className="text-xl font-bold font-heading text-foreground tracking-tight">Weather Settings</h2>
        <p className="text-xs text-muted-foreground">
          Customize the location, units, and display options for your sidebar weather widget.
        </p>
      </motion.header>

      {/* Weather Visibility Card */}
      <motion.div variants={cardVariants}>
        <Card className="border border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-foreground">Widget Display</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Toggle visibility of the weather indicator in the app navigation.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-muted/30 border border-border/40">
              <Label htmlFor="show-weather-widget" className="flex flex-col space-y-0.5 cursor-pointer">
                <span className="text-sm font-medium text-foreground">Show Weather Widget</span>
                <span className="text-xs text-muted-foreground">
                  Displays live weather condition & temperature in the chat sidebar header.
                </span>
              </Label>
              <Switch 
                id="show-weather-widget" 
                checked={isWeatherVisible} 
                onCheckedChange={(val) => {
                  setIsWeatherVisible(val);
                  toast({
                    title: val ? "Weather Widget Enabled" : "Weather Widget Hidden",
                    description: val ? "Live weather will appear in sidebar header." : "Weather widget hidden.",
                  });
                }} 
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {isWeatherVisible && (
        <>
          {/* Location Configuration & Validation Card */}
          <motion.div variants={cardVariants}>
            <Card className="border border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-violet-400" />
                      <span>Weather Location</span>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      Enter your city name (e.g., "Tokyo", "London, UK") to verify and register your location.
                    </CardDescription>
                  </div>
                  {weatherLocation && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px] gap-1 px-2.5 py-0.5">
                      <CheckCircle2 className="h-3 w-3" /> Registered
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4 px-4 pb-5">
                {/* Input & Action Bar */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. London, Tokyo, New York..."
                      value={tempLocation}
                      onChange={(e) => {
                        setTempLocation(e.target.value);
                        if (status.type !== 'idle') {
                          setStatus({ type: 'idle', message: '' });
                        }
                      }}
                      onKeyDown={handleKeyDown}
                      className="pl-9 border-border/60 bg-muted/40 text-sm focus-visible:ring-violet-500"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleSaveLocation()} 
                      disabled={isValidating || isLocatingGps}
                      className="gap-2 shrink-0 bg-violet-600 hover:bg-violet-700 text-white font-medium"
                    >
                      {isValidating ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Register City</span>
                        </>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={handleUseGps}
                      disabled={isLocatingGps || isValidating}
                      title="Auto-detect current city via GPS"
                      className="shrink-0 border-border/60 hover:bg-muted"
                    >
                      {isLocatingGps ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Navigation className="h-4 w-4 text-violet-400" />
                      )}
                      <span className="hidden sm:inline ml-1.5 text-xs">Use GPS</span>
                    </Button>
                  </div>
                </div>

                {/* Explicit Verification & Status Feedback Banner */}
                <AnimatePresence mode="wait">
                  {status.type === 'success' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-emerald-300 text-xs shadow-sm"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-emerald-200">Registration Successful</p>
                        <p className="text-emerald-300/90">{status.message}</p>
                      </div>
                    </motion.div>
                  )}

                  {status.type === 'error' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2.5 text-destructive text-xs shadow-sm"
                    >
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-semibold text-rose-200">Registration Failed</p>
                        <p className="text-rose-300/90">{status.message}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Helper hint */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span>Press <kbd className="px-1.5 py-0.5 text-[10px] bg-muted border border-border/80 rounded font-mono text-foreground">Enter</kbd> or click <strong>Register City</strong> to verify.</span>
                  {weatherLocation && (
                    <button 
                      onClick={() => {
                        setTempLocation('');
                        handleSaveLocation('');
                      }} 
                      className="text-violet-400 hover:underline text-[11px]"
                    >
                      Clear & Use Auto GPS
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Live Preview Card */}
          <motion.div variants={cardVariants}>
            <Card className="border border-border/50 bg-card/60 shadow-sm backdrop-blur-md overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                <Sparkles className="w-24 h-24 text-violet-400" />
              </div>

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    <span>Live Widget Preview</span>
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => refreshPreview(weatherLocation, weatherUnit)}
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>Refresh</span>
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="pb-4">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/40 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-card border border-border/50 shadow-sm">
                      {previewWeather ? (
                        weatherIcons[previewWeather.condition] || <Cloud className="w-6 h-6 text-zinc-400" />
                      ) : (
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-foreground font-heading">
                          {previewWeather ? `${Math.round(previewWeather.temperature)}°${weatherUnit === 'Fahrenheit' ? 'F' : 'C'}` : '--'}
                        </span>
                        <span className="text-xs font-semibold text-violet-400">
                          {previewWeather?.condition || 'Loading'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>{previewWeather?.resolvedName || weatherLocation || 'London (Default)'}</span>
                      </p>
                    </div>
                  </div>

                  <Badge variant="secondary" className="bg-muted text-muted-foreground text-[10px] px-2.5 py-1">
                    Live Widget View
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Unit Selection Card */}
          <motion.div variants={cardVariants}>
            <Card className="border border-border/50 bg-card/60 shadow-sm backdrop-blur-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground">Temperature Unit</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Choose between Celsius (°C) and Fahrenheit (°F).
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <RadioGroup 
                  value={weatherUnit} 
                  onValueChange={(v) => {
                    const newUnit = v as 'Celsius' | 'Fahrenheit';
                    setWeatherUnit(newUnit);
                    refreshPreview(weatherLocation, newUnit);
                    toast({
                      title: "Temperature Unit Updated",
                      description: `Switched to ${newUnit} (°${newUnit === 'Celsius' ? 'C' : 'F'})`,
                    });
                  }}
                >
                  <div className="flex items-center space-x-3 py-2 px-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer">
                    <RadioGroupItem value="Celsius" id="celsius" />
                    <Label htmlFor="celsius" className="text-sm text-foreground cursor-pointer flex-1 font-medium">
                      Celsius (°C)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 py-2 px-3 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer">
                    <RadioGroupItem value="Fahrenheit" id="fahrenheit" />
                    <Label htmlFor="fahrenheit" className="text-sm text-foreground cursor-pointer flex-1 font-medium">
                      Fahrenheit (°F)
                    </Label>
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
