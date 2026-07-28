'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useTheme } from 'next-themes';

type WeatherUnit = 'Celsius' | 'Fahrenheit';

interface AppearanceContextType {
  accentColor: string;
  setAccentColor: (color: string) => void;
  gradientFrom: string;
  setGradientFrom: (color: string) => void;
  gradientTo: string;
  setGradientTo: (color: string) => void;
  chatBackground: string;
  setChatBackground: (background: string) => void;
  appBackground: string;
  setAppBackground: (background: string) => void;
  useCustomBackground: boolean;
  setUseCustomBackground: (use: boolean) => void;
  isAmoled: boolean;
  setIsAmoled: (isAmoled: boolean) => void;
  notificationSound: string;
  setNotificationSound: (soundUrl: string) => void;
  areNotificationsMuted: boolean;
  setAreNotificationsMuted: (muted: boolean) => void;
  isWeatherVisible: boolean;
  setIsWeatherVisible: (visible: boolean) => void;
  weatherLocation: string;
  setWeatherLocation: (location: string) => void;
  weatherUnit: WeatherUnit;
  setWeatherUnit: (unit: WeatherUnit) => void;
  chatListOpacity: number;
  setChatListOpacity: (opacity: number) => void;
  isGlassEnabled: boolean;
  setIsGlassEnabled: (enabled: boolean) => void;
  glassBlur: number;
  setGlassBlur: (blur: number) => void;
  glassOpacity: number;
  setGlassOpacity: (opacity: number) => void;
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const [accentColor, setAccentColorState] = useState('');
  const [gradientFrom, setGradientFromState] = useState('');
  const [gradientTo, setGradientToState] = useState('');
  const [chatBackground, setChatBackgroundState] = useState('');
  
  // Single Source of Truth for App Background (Default to 'black' True Black)
  const [appBackground, setAppBackgroundState] = useState('black');
  const [useCustomBackground, setUseCustomBackgroundState] = useState(true);
  const [notificationSound, setNotificationSoundState] = useState('');
  const [areNotificationsMuted, setAreNotificationsMutedState] = useState(false);
  
  const [isWeatherVisible, setIsWeatherVisibleState] = useState(true);
  const [weatherLocation, setWeatherLocationState] = useState('');
  const [weatherUnit, setWeatherUnitState] = useState<WeatherUnit>('Celsius');
  const [chatListOpacity, setChatListOpacityState] = useState(80);

  // Frosted Glass Controls
  const [isGlassEnabled, setIsGlassEnabledState] = useState(true);
  const [glassBlur, setGlassBlurState] = useState(12);
  const [glassOpacity, setGlassOpacityState] = useState(70);

  // Derived AMOLED state (true when appBackground is 'black')
  const isAmoled = appBackground === 'black';

  useEffect(() => {
    const savedAccent = localStorage.getItem('accentColor') || '283 51% 53%';
    const savedGradientFrom = localStorage.getItem('gradientFrom') || '330 85% 60%';
    const savedGradientTo = localStorage.getItem('gradientTo') || '210 90% 55%';
    const savedChatBg = localStorage.getItem('chatBackground') || 'https://picsum.photos/seed/bg-default/600/1000';
    
    // Default appBackground to 'black' (True Black)
    const savedAppBg = localStorage.getItem('appBackground') || 'black';
    const savedUseCustomBg = localStorage.getItem('useCustomBackground') !== 'false';
    const savedSound = localStorage.getItem('notificationSound') || 'default';
    const savedMuted = localStorage.getItem('areNotificationsMuted') === 'true';
    
    const savedWeatherVisible = localStorage.getItem('isWeatherVisible') !== 'false';
    const savedWeatherLocation = localStorage.getItem('weatherLocation') || '';
    const savedWeatherUnit = (localStorage.getItem('weatherUnit') as WeatherUnit) || 'Celsius';
    const savedChatListOpacity = localStorage.getItem('chatListOpacity');

    const savedGlassEnabled = localStorage.getItem('glass-enabled') !== 'false';
    const savedGlassBlur = localStorage.getItem('glass-blur');
    const savedGlassOpacity = localStorage.getItem('glass-opacity');

    setAccentColorState(savedAccent);
    setGradientFromState(savedGradientFrom);
    setGradientToState(savedGradientTo);
    setChatBackgroundState(savedChatBg);
    setAppBackgroundState(savedAppBg);
    setUseCustomBackgroundState(savedUseCustomBg);
    setNotificationSoundState(savedSound);
    setAreNotificationsMutedState(savedMuted);
    
    setIsWeatherVisibleState(savedWeatherVisible);
    setWeatherLocationState(savedWeatherLocation);
    setWeatherUnitState(savedWeatherUnit);
    setChatListOpacityState(savedChatListOpacity ? parseInt(savedChatListOpacity, 10) : 80);

    setIsGlassEnabledState(savedGlassEnabled);
    if (savedGlassBlur) setGlassBlurState(parseInt(savedGlassBlur, 10));
    if (savedGlassOpacity) setGlassOpacityState(parseInt(savedGlassOpacity, 10));

    // Apply CSS variables to root
    const root = document.documentElement;
    root.style.setProperty('--primary', savedAccent);
    root.style.setProperty('--gradient-from', savedGradientFrom);
    root.style.setProperty('--gradient-to', savedGradientTo);

    root.style.setProperty('--glass-blur', `${savedGlassEnabled ? (savedGlassBlur ? parseInt(savedGlassBlur, 10) : 12) : 0}px`);
    root.style.setProperty('--glass-opacity', `${(savedGlassOpacity ? parseInt(savedGlassOpacity, 10) : 70) / 100}`);
  }, []);

  // Single pure effect synchronizing body background colors with appBackground
  useEffect(() => {
    const root = document.documentElement;
    const isLightMode = theme === 'light';

    if (isLightMode) {
      // Light Mode background
      root.style.backgroundColor = 'hsl(280, 60%, 97%)';
      document.body.style.backgroundColor = 'hsl(280, 60%, 97%)';
      document.body.classList.remove('amoled');
    } else if (appBackground === 'black') {
      // Pure True Black Mode
      root.style.backgroundColor = '#000000';
      document.body.style.backgroundColor = '#000000';
      document.body.classList.add('amoled');
    } else if (appBackground === 'galaxy') {
      // Galaxy Stars Mode: Transparent body so canvas is visible
      root.style.backgroundColor = '#0c0a1e';
      document.body.style.backgroundColor = 'transparent';
      document.body.classList.remove('amoled');
    } else {
      root.style.backgroundColor = 'hsl(275, 22%, 11%)';
      document.body.style.backgroundColor = 'hsl(275, 22%, 11%)';
      document.body.classList.remove('amoled');
    }
  }, [theme, appBackground]);

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    localStorage.setItem('accentColor', color);
    document.documentElement.style.setProperty('--primary', color);
  };
  
  const setGradientFrom = (color: string) => {
    setGradientFromState(color);
    localStorage.setItem('gradientFrom', color);
    document.documentElement.style.setProperty('--gradient-from', color);
  };

  const setGradientTo = (color: string) => {
    setGradientToState(color);
    localStorage.setItem('gradientTo', color);
    document.documentElement.style.setProperty('--gradient-to', color);
  };

  const setChatBackground = (background: string) => {
    setChatBackgroundState(background);
    localStorage.setItem('chatBackground', background);
  };
  
  const setAppBackground = (background: string) => {
    setAppBackgroundState(background);
    localStorage.setItem('appBackground', background);
    localStorage.setItem('isAmoled', String(background === 'black'));
  };

  const setUseCustomBackground = (use: boolean) => {
    setUseCustomBackgroundState(use);
    localStorage.setItem('useCustomBackground', String(use));
  };

  const setIsAmoled = (enabled: boolean) => {
    const nextBg = enabled ? 'black' : 'galaxy';
    setAppBackgroundState(nextBg);
    localStorage.setItem('appBackground', nextBg);
    localStorage.setItem('isAmoled', String(enabled));
  };

  const setNotificationSound = (soundUrl: string) => {
    setNotificationSoundState(soundUrl);
    localStorage.setItem('notificationSound', soundUrl);
  };

  const setAreNotificationsMuted = (muted: boolean) => {
    setAreNotificationsMutedState(muted);
    localStorage.setItem('areNotificationsMuted', String(muted));
  };

  const setIsWeatherVisible = (visible: boolean) => {
    setIsWeatherVisibleState(visible);
    localStorage.setItem('isWeatherVisible', String(visible));
  };

  const setWeatherLocation = (location: string) => {
    setWeatherLocationState(location);
    localStorage.setItem('weatherLocation', location);
  };

  const setWeatherUnit = (unit: WeatherUnit) => {
    setWeatherUnitState(unit);
    localStorage.setItem('weatherUnit', unit);
  };

  const setChatListOpacity = (opacity: number) => {
    setChatListOpacityState(opacity);
    localStorage.setItem('chatListOpacity', String(opacity));
  };

  const setIsGlassEnabled = (enabled: boolean) => {
    setIsGlassEnabledState(enabled);
    localStorage.setItem('glass-enabled', String(enabled));
    const root = document.documentElement;
    root.style.setProperty('--glass-blur', `${enabled ? glassBlur : 0}px`);
  };

  const setGlassBlur = (blur: number) => {
    setGlassBlurState(blur);
    localStorage.setItem('glass-blur', String(blur));
    const root = document.documentElement;
    if (isGlassEnabled) {
      root.style.setProperty('--glass-blur', `${blur}px`);
    }
  };

  const setGlassOpacity = (opacity: number) => {
    setGlassOpacityState(opacity);
    localStorage.setItem('glass-opacity', String(opacity));
    const root = document.documentElement;
    root.style.setProperty('--glass-opacity', `${opacity / 100}`);
  };

  return (
    <AppearanceContext.Provider value={{ 
        accentColor, setAccentColor, 
        gradientFrom, setGradientFrom,
        gradientTo, setGradientTo,
        chatBackground, setChatBackground, 
        appBackground, setAppBackground,
        useCustomBackground, setUseCustomBackground,
        isAmoled, setIsAmoled, 
        notificationSound, setNotificationSound, 
        areNotificationsMuted, setAreNotificationsMuted,
        isWeatherVisible, setIsWeatherVisible,
        weatherLocation, setWeatherLocation,
        weatherUnit, setWeatherUnit,
        chatListOpacity, setChatListOpacity,
        isGlassEnabled, setIsGlassEnabled,
        glassBlur, setGlassBlur,
        glassOpacity, setGlassOpacity,
    }}>
      {children}
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  const context = useContext(AppearanceContext);
  if (context === undefined) {
    throw new Error('useAppearance must be used within an AppearanceProvider');
  }
  return context;
}
