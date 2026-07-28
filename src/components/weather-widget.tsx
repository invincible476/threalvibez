'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Sun, Cloud, CloudRain, Wind, Zap, Snowflake, Loader2, MapPin, CloudFog, CloudSun } from 'lucide-react';
import { getWeather, GetWeatherOutput } from '@/ai/flows/weather-flow';
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
    const router = useRouter();
    const { weatherLocation, setWeatherLocation, weatherUnit } = useAppearance();
    const lastUpdateRef = useRef<number>(0);
    const updateIntervalRef = useRef<NodeJS.Timeout>();
    
    const fetchWeather = useCallback(async (loc: string, unit: 'Celsius' | 'Fahrenheit') => {
        const targetLocation = loc || 'London';
        const now = Date.now();

        // Avoid unnecessary refetches if updated recently
        if (weather && now - lastUpdateRef.current < WEATHER_REFRESH_INTERVAL) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        try {
            const result = await getWeather({ location: targetLocation, unit });
            setWeather(result);
            lastUpdateRef.current = now;
        } catch (error) {
            console.warn("Weather fetch fallback active:", error);
            setWeather({
                temperature: unit === 'Fahrenheit' ? 68 : 20,
                condition: 'Sunny',
                unit: unit || 'Celsius',
            });
        } finally {
            setIsLoading(false);
        }
    }, [weather]);
    
    useEffect(() => {
        if (updateIntervalRef.current) {
            clearInterval(updateIntervalRef.current);
        }

        const updateWeather = async () => {
            if (weatherLocation) {
                fetchWeather(weatherLocation, weatherUnit);
            } else {
                try {
                    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
                        if (!navigator.geolocation) {
                            reject(new Error("Geolocation not supported"));
                            return;
                        }
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 });
                    });

                    const city = await getCityFromCoords(position.coords.latitude, position.coords.longitude);
                    if (city) {
                        setWeatherLocation(city);
                    } else {
                        setWeatherLocation('London');
                    }
                } catch (error) {
                    console.warn("Geolocation fallback to default city (London):", error);
                    setWeatherLocation('London');
                }
            }
        };

        updateWeather();
        updateIntervalRef.current = setInterval(updateWeather, WEATHER_REFRESH_INTERVAL);

        return () => {
            if (updateIntervalRef.current) {
                clearInterval(updateIntervalRef.current);
            }
        };
    }, [weatherLocation, weatherUnit, fetchWeather, setWeatherLocation]);

    if (isLoading && !weather) {
        return (
            <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground" disabled>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Loading Weather...</span>
            </Button>
        );
    }
    
    if (!weather) {
        return (
             <Button variant="ghost" size="sm" onClick={() => router.push('/settings/weather')} className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="hidden sm:inline">Set Weather Location</span>
            </Button>
        );
    }

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/settings/weather')} 
            className="flex items-center gap-2 hover:bg-muted/50 transition-colors"
            title="Click to manage weather settings"
        >
            {weatherIcons[weather.condition] || <Cloud className="w-5 h-5 text-gray-400" />}
            <span className="font-medium">{Math.round(weather.temperature)}°{weather.unit === 'Celsius' ? 'C' : 'F'}</span>
            <span className="text-muted-foreground hidden sm:inline">{weatherLocation || 'London'}</span>
        </Button>
    );
}
