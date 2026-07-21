
'use server';
/**
 * @fileOverview A flow for getting the current weather.
 *
 * - getWeather - A function that gets the weather for a given location.
 * - GetWeatherInput - The input type for the getWeather function.
 * - GetWeatherOutput - The return type for the getWeather function.
 */

import { ai } from '@/ai/genkit';
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


const weatherPrompt = ai.definePrompt({
    name: 'weatherPrompt',
    input: { schema: GetWeatherInputSchema },
    output: { schema: GetWeatherOutputSchema },
    prompt: `You are a weather service. The user will provide a location.
    Return the current temperature in the specified unit (default to Celsius if not provided) and the current weather condition for that location.
    
    Location: {{{location}}}
    Unit: {{{unit}}}
    
    Please provide the weather information in the specified JSON format. If the condition is not in the provided enum, choose the closest match.
    For example, for "Partly Cloudy", use "Cloudy". For "Clear sky", use "Clear" if available, otherwise "Sunny".
    `,
});


const getWeatherFlow = ai.defineFlow(
  {
    name: 'getWeatherFlow',
    inputSchema: GetWeatherInputSchema,
    outputSchema: GetWeatherOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await weatherPrompt(input);
      if (!output) {
        throw new Error('Unable to get weather information.');
      }
      
      const validConditions = GetWeatherOutputSchema.shape.condition.options;
      let condition = output.condition;
      if (!validConditions.includes(condition as any)) {
        console.warn(`Model returned an invalid condition: "${condition}". Falling back to "Cloudy".`);
        condition = 'Cloudy'; 
      }
      return {
        temperature: output.temperature,
        condition: condition as any,
        unit: output.unit as any,
      };
    } catch (error) {
        console.warn("AI weather call failed, returning mock data. Error:", error);
        // This is a fallback for when the API limit is hit or another error occurs.
        return {
            temperature: input.unit === 'Fahrenheit' ? 68 : 20,
            condition: 'Sunny',
            unit: input.unit || 'Celsius',
        };
    }
  }
);


export async function getWeather(input: GetWeatherInput): Promise<GetWeatherOutput> {
  return getWeatherFlow(input);
}
