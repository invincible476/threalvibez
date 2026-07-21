
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
}

const AppearanceContext = createContext<AppearanceContextType | undefined>(undefined);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const [accentColor, setAccentColorState] = useState('');
  const [gradientFrom, setGradientFromState] = useState('');
  const [gradientTo, setGradientToState] = useState('');
  const [chatBackground, setChatBackgroundState] = useState('');
  const [appBackground, setAppBackgroundState] = useState('');
  const [useCustomBackground, setUseCustomBackgroundState] = useState(true);
  const [isAmoled, setAmoledState] = useState(false);
  const [notificationSound, setNotificationSoundState] = useState('');
  const [areNotificationsMuted, setAreNotificationsMutedState] = useState(false);
  
  const [isWeatherVisible, setIsWeatherVisibleState] = useState(true);
  const [weatherLocation, setWeatherLocationState] = useState('');
  const [weatherUnit, setWeatherUnitState] = useState<WeatherUnit>('Celsius');
  const [chatListOpacity, setChatListOpacityState] = useState(80);


  useEffect(() => {
    const savedAccent = localStorage.getItem('accentColor') || '283 51% 53%';
    const savedGradientFrom = localStorage.getItem('gradientFrom') || '330 85% 60%';
    const savedGradientTo = localStorage.getItem('gradientTo') || '210 90% 55%';
    const savedChatBg = localStorage.getItem('chatBackground') || 'https://picsum.photos/seed/bg-default/600/1000';
    const savedAppBg = localStorage.getItem('appBackground') || 'galaxy';
    const savedUseCustomBg = localStorage.getItem('useCustomBackground') !== 'false';
    const savedAmoled = localStorage.getItem('isAmoled') === 'true';
    const savedSound = localStorage.getItem('notificationSound') || 'default';
    const savedMuted = localStorage.getItem('areNotificationsMuted') === 'true';
    
    const savedWeatherVisible = localStorage.getItem('isWeatherVisible') !== 'false';
    const savedWeatherLocation = localStorage.getItem('weatherLocation') || '';
    const savedWeatherUnit = (localStorage.getItem('weatherUnit') as WeatherUnit) || 'Celsius';
    const savedChatListOpacity = localStorage.getItem('chatListOpacity');


    setAccentColorState(savedAccent);
    setGradientFromState(savedGradientFrom);
    setGradientToState(savedGradientTo);
    setChatBackgroundState(savedChatBg);
    setAppBackgroundState(savedAppBg);
    setUseCustomBackgroundState(savedUseCustomBg);
    setAmoledState(savedAmoled);
    setNotificationSoundState(savedSound);
    setAreNotificationsMutedState(savedMuted);
    
    setIsWeatherVisibleState(savedWeatherVisible);
    setWeatherLocationState(savedWeatherLocation);
    setWeatherUnitState(savedWeatherUnit);
    setChatListOpacityState(savedChatListOpacity ? parseInt(savedChatListOpacity, 10) : 80);

    document.documentElement.style.setProperty('--primary', savedAccent);
    document.documentElement.style.setProperty('--gradient-from', savedGradientFrom);
    document.documentElement.style.setProperty('--gradient-to', savedGradientTo);

    if (savedAmoled) {
        document.body.classList.add('amoled');
    } else {
        document.body.classList.remove('amoled');
    }

  }, []);

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
  };

  const setUseCustomBackground = (use: boolean) => {
    setUseCustomBackgroundState(use);
    localStorage.setItem('useCustomBackground', String(use));
  };

  const setIsAmoled = (enabled: boolean) => {
    setAmoledState(enabled);
    localStorage.setItem('isAmoled', String(enabled));
    if (enabled) {
        document.body.classList.add('amoled');
    } else {
        document.body.classList.remove('amoled');
    }
  }

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
  }

  const setWeatherLocation = (location: string) => {
    setWeatherLocationState(location);
    localStorage.setItem('weatherLocation', location);
  }

  const setWeatherUnit = (unit: WeatherUnit) => {
    setWeatherUnitState(unit);
    localStorage.setItem('weatherUnit', unit);
  }

  const setChatListOpacity = (opacity: number) => {
    setChatListOpacityState(opacity);
    localStorage.setItem('chatListOpacity', String(opacity));
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
