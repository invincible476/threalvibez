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

function safeGet(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
  } catch (e) {
    console.warn(`Storage get error for key "${key}":`, e);
  }
  return null;
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`Storage set error for key "${key}":`, e);
  }
}

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
    const savedAccent = safeGet('accentColor') || '283 51% 53%';
    const savedGradientFrom = safeGet('gradientFrom') || '330 85% 60%';
    const savedGradientTo = safeGet('gradientTo') || '210 90% 55%';
    const savedChatBg = safeGet('chatBackground') || 'https://picsum.photos/seed/bg-default/600/1000';
    
    // Default appBackground to 'black' (True Black)
    const savedAppBg = safeGet('appBackground') || 'black';
    const savedUseCustomBg = safeGet('useCustomBackground') !== 'false';
    const savedSound = safeGet('notificationSound') || 'default';
    const savedMuted = safeGet('areNotificationsMuted') === 'true';
    
    const savedWeatherVisible = safeGet('isWeatherVisible') !== 'false';
    const savedWeatherLocation = safeGet('weatherLocation') || '';
    const savedWeatherUnit = (safeGet('weatherUnit') as WeatherUnit) || 'Celsius';
    const savedChatListOpacity = safeGet('chatListOpacity');

    const savedGlassEnabled = safeGet('glass-enabled') !== 'false';
    const savedGlassBlur = safeGet('glass-blur');
    const savedGlassOpacity = safeGet('glass-opacity');

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
    try {
      const root = document.documentElement;
      root.style.setProperty('--primary', savedAccent);
      root.style.setProperty('--gradient-from', savedGradientFrom);
      root.style.setProperty('--gradient-to', savedGradientTo);

      root.style.setProperty('--glass-blur', `${savedGlassEnabled ? (savedGlassBlur ? parseInt(savedGlassBlur, 10) : 12) : 0}px`);
      root.style.setProperty('--glass-opacity', `${(savedGlassOpacity ? parseInt(savedGlassOpacity, 10) : 70) / 100}`);
    } catch (e) {
      console.warn('Error setting root CSS variables:', e);
    }
  }, []);

  // Single pure effect synchronizing body background colors with appBackground
  useEffect(() => {
    try {
      const root = document.documentElement;
      const isLightMode = theme === 'light';

      if (isLightMode) {
        root.style.backgroundColor = 'hsl(280, 60%, 97%)';
        document.body.style.backgroundColor = 'hsl(280, 60%, 97%)';
        document.body.classList.remove('amoled');
      } else if (appBackground === 'black') {
        root.style.backgroundColor = '#000000';
        document.body.style.backgroundColor = '#000000';
        document.body.classList.add('amoled');
      } else if (appBackground === 'galaxy') {
        root.style.backgroundColor = '#0c0a1e';
        document.body.style.backgroundColor = 'transparent';
        document.body.classList.remove('amoled');
      } else {
        root.style.backgroundColor = 'hsl(275, 22%, 11%)';
        document.body.style.backgroundColor = 'hsl(275, 22%, 11%)';
        document.body.classList.remove('amoled');
      }
    } catch (e) {
      console.warn('Error setting background colors:', e);
    }
  }, [theme, appBackground]);

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    safeSet('accentColor', color);
    try {
      document.documentElement.style.setProperty('--primary', color);
    } catch (e) {}
  };
  
  const setGradientFrom = (color: string) => {
    setGradientFromState(color);
    safeSet('gradientFrom', color);
    try {
      document.documentElement.style.setProperty('--gradient-from', color);
    } catch (e) {}
  };

  const setGradientTo = (color: string) => {
    setGradientToState(color);
    safeSet('gradientTo', color);
    try {
      document.documentElement.style.setProperty('--gradient-to', color);
    } catch (e) {}
  };

  const setChatBackground = (background: string) => {
    setChatBackgroundState(background);
    safeSet('chatBackground', background);
  };
  
  const setAppBackground = (background: string) => {
    setAppBackgroundState(background);
    safeSet('appBackground', background);
    safeSet('isAmoled', String(background === 'black'));
  };

  const setUseCustomBackground = (use: boolean) => {
    setUseCustomBackgroundState(use);
    safeSet('useCustomBackground', String(use));
  };

  const setIsAmoled = (enabled: boolean) => {
    const nextBg = enabled ? 'black' : 'galaxy';
    setAppBackgroundState(nextBg);
    safeSet('appBackground', nextBg);
    safeSet('isAmoled', String(enabled));
  };

  const setNotificationSound = (soundUrl: string) => {
    setNotificationSoundState(soundUrl);
    safeSet('notificationSound', soundUrl);
  };

  const setAreNotificationsMuted = (muted: boolean) => {
    setAreNotificationsMutedState(muted);
    safeSet('areNotificationsMuted', String(muted));
  };

  const setIsWeatherVisible = (visible: boolean) => {
    setIsWeatherVisibleState(visible);
    safeSet('isWeatherVisible', String(visible));
  };

  const setWeatherLocation = (location: string) => {
    setWeatherLocationState(location);
    safeSet('weatherLocation', location);
  };

  const setWeatherUnit = (unit: WeatherUnit) => {
    setWeatherUnitState(unit);
    safeSet('weatherUnit', unit);
  };

  const setChatListOpacity = (opacity: number) => {
    setChatListOpacityState(opacity);
    safeSet('chatListOpacity', String(opacity));
  };

  const setIsGlassEnabled = (enabled: boolean) => {
    setIsGlassEnabledState(enabled);
    safeSet('glass-enabled', String(enabled));
    try {
      const root = document.documentElement;
      root.style.setProperty('--glass-blur', `${enabled ? glassBlur : 0}px`);
    } catch (e) {}
  };

  const setGlassBlur = (blur: number) => {
    setGlassBlurState(blur);
    safeSet('glass-blur', String(blur));
    try {
      const root = document.documentElement;
      if (isGlassEnabled) {
        root.style.setProperty('--glass-blur', `${blur}px`);
      }
    } catch (e) {}
  };

  const setGlassOpacity = (opacity: number) => {
    setGlassOpacityState(opacity);
    safeSet('glass-opacity', String(opacity));
    try {
      const root = document.documentElement;
      root.style.setProperty('--glass-opacity', `${opacity / 100}`);
    } catch (e) {}
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
