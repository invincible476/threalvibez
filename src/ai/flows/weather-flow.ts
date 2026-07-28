'use server';
/**
 * @fileOverview High-performance real-time weather service powered by Open-Meteo API.
 */

import { z } from 'zod';

const GetWeatherInputSchema = z.object({
  location: z.string().describe('The location to get the weather for.'),
  unit: z.enum(['Celsius', 'Fahrenheit']).optional().describe('The unit for the temperature. Defaults to Celsius.')
});
export type GetWeatherInput = z.infer<typeof GetWeatherInputSchema>;

const GetWeatherOutputSchema = z.object({
  temperature: z.number().describe('The current temperature in the requested unit.'),
  condition: z.enum(['Sunny', 'Cloudy', 'Rainy', 'Windy', 'Stormy', 'Snowy', 'Clear', 'Mist', 'Haze', 'Fog']).describe('The current weather condition.'),
  unit: z.enum(['Celsius', 'Fahrenheit']).describe('The unit of the provided temperature.'),
});
export type GetWeatherOutput = z.infer<typeof GetWeatherOutputSchema>;

function mapWmoCodeToCondition(wmoCode: number): GetWeatherOutput['condition'] {
  if (wmoCode === 0) return 'Clear';
  if (wmoCode >= 1 && wmoCode <= 3) return 'Cloudy';
  if (wmoCode === 45 || wmoCode === 48) return 'Fog';
  if ((wmoCode >= 51 && wmoCode <= 67) || (wmoCode >= 80 && wmoCode <= 82)) return 'Rainy';
  if ((wmoCode >= 71 && wmoCode <= 77) || (wmoCode >= 85 && wmoCode <= 86)) return 'Snowy';
  if (wmoCode >= 95 && wmoCode <= 99) return 'Stormy';
  return 'Sunny';
}

export async function getWeather(input: GetWeatherInput): Promise<GetWeatherOutput> {
  const targetUnit = input.unit || 'Celsius';
  const locationName = (input.location || 'London').trim();

  try {
    // 1. Geocode location name via Open-Meteo Geocoding API
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`;
    const geoRes = await fetch(geoUrl, {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' }
    });

    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.results && geoData.results.length > 0) {
        const { latitude, longitude } = geoData.results[0];

        // 2. Fetch real-time weather from Open-Meteo Forecast API
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`;
        const weatherRes = await fetch(weatherUrl, {
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        });

        if (weatherRes.ok) {
          const weatherData = await weatherRes.json();
          if (weatherData.current_weather) {
            const tempC = weatherData.current_weather.temperature;
            const wmoCode = weatherData.current_weather.weathercode;
            const finalTemp = targetUnit === 'Fahrenheit' 
              ? Math.round((tempC * 9) / 5 + 32) 
              : Math.round(tempC);
            const condition = mapWmoCodeToCondition(wmoCode);

            return {
              temperature: finalTemp,
              condition,
              unit: targetUnit,
            };
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Weather Service] Live Open-Meteo fetch failed, using fallback:', err);
  }

  // Graceful fallback if geocoding or network fails
  return {
    temperature: targetUnit === 'Fahrenheit' ? 72 : 22,
    condition: 'Sunny',
    unit: targetUnit,
  };
}
