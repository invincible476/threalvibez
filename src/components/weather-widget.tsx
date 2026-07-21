
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Sun, Cloud, CloudRain, Wind, Zap, Snowflake, Loader2, MapPin, CloudFog, CloudSun } from 'lucide-react';
import { getWeather, GetWeatherOutput } from '@/ai/flows/weather-flow';
import { useToast } from '@/hooks/use-toast';
import { useAppearance } from './providers/appearance-provider';
import { useRouter } from 'next/navigation';
import { getCityFromCoords } from '@/lib/geocoding';

const weatherIcons: Record<GetWeatherOutput['condition'], React.ReactNode> = {
    Sunny: <Sun className="w-5 h-5 text-yellow-400" />,
    Clear: <Sun className="w-5 h-5 text-yellow-400" />,
    Cloudy: <Cloud className="w-5 h-5 text-gray-400" />,
    Rainy: <CloudRain className="w-5 h-5 text-blue-400" />,
    Windy: <Wind className="w-5 h-5 text-gray-300" />,
    Stormy: <Zap className="w-5 h-5 text-yellow-500" />,
    Snowy: <Snowflake className="w-5 h-5 text-white" />,
    Mist: <CloudFog className="w-5 h-5 text-gray-400" />,
    Haze: <CloudSun className="w-5 h-5 text-gray-400" />,
    Fog: <CloudFog className="w-5 h-5 text-gray-400" />,
};

// 15-minute refresh interval for weather data
const WEATHER_REFRESH_INTERVAL = 15 * 60 * 1000;


export function WeatherWidget() {
    const [weather, setWeather] = useState<GetWeatherOutput | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();
    const { weatherLocation, setWeatherLocation, weatherUnit } = useAppearance();
    const lastUpdateRef = useRef<number>(0);
    const updateIntervalRef = useRef<NodeJS.Timeout>();
    
    const fetchWeather = useCallback(async (loc: string, unit: 'Celsius' | 'Fahrenheit') => {
        if (!loc) {
            setIsLoading(false);
            setWeather(null);
            return;
        };

        // Check if we should refresh based on time elapsed
        const now = Date.now();
        if (weather && now - lastUpdateRef.current < WEATHER_REFRESH_INTERVAL) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const result = await getWeather({ location: loc, unit });
            setWeather(result);
            lastUpdateRef.current = now;
        } catch (error) {
            console.error("Error fetching weather:", error);
            // Keep the old weather data if it exists
            if (!weather) {
                setWeather(null);
                toast({
                    title: 'Could not fetch weather',
                    description: 'The location might not be recognized. Please try a different city in settings.',
                    variant: 'destructive',
                });
            }
        } finally {
            setIsLoading(false);
        }
    }, [toast, weather]);
    
    useEffect(() => {
        // Clear any existing interval
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
        }

        const updateWeather = async () => {
            if (weatherLocation) {
                fetchWeather(weatherLocation, weatherUnit);
            } else {
                // Only try to geolocate if location is not set
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });

                    const city = await getCityFromCoords(position.coords.latitude, position.coords.longitude);
                    if (city) {
                        setWeatherLocation(city); // This will trigger another effect
                    } else {
                        setIsLoading(false);
                    }
                } catch (error) {
                    console.warn("Geolocation error:", error);
                    setIsLoading(false);
                }
            }
        };

        // Initial update
        updateWeather();

        // Set up periodic updates
        updateIntervalRef.current = setInterval(updateWeather, WEATHER_REFRESH_INTERVAL);

        // Cleanup
        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
            }
        };
    }, [weatherLocation, weatherUnit, fetchWeather, setWeatherLocation]);


    if (isLoading) {
        return (
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Loading Weather...</span>
            </Button>
        );
    }
    
    if (!weather || !weatherLocation) {
        return (
             <Button variant="ghost" size="sm" onClick={() => router.push('/settings/weather')} className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Set Weather Location</span>
            </Button>
        );
    }

    return (
        <Button variant="ghost" size="sm" onClick={() => router.push('/settings/weather')} className="flex items-center gap-2">
            {weatherIcons[weather.condition] || <Cloud className="w-5 h-5 text-gray-400" />}
            <span className="font-medium">{Math.round(weather.temperature)}°{weather.unit === 'Celsius' ? 'C' : 'F'}</span>
            <span className="text-muted-foreground hidden sm:inline">{weatherLocation}</span>
        </Button>
    );
}
