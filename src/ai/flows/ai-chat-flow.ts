"use server";
/**
 * @fileOverview A flow for having a conversation with an AI.
 *
 * - continueConversation - A function that continues a conversation with an AI.
 * - AiChatInput - The input type for the continueConversation function.
 * - AiChatOutput - The return type for the continueConversation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiChatInputSchema = z.object({
  message: z.string().describe('The user\'s message.'),
  history: z.array(z.object({
    user: z.string().optional(),
    model: z.string().optional(),
  })).describe('The history of the conversation.'),
});
export type AiChatInput = z.infer<typeof AiChatInputSchema>;

const AiChatOutputSchema = z.object({
  reply: z.string().describe('The AI\'s reply.'),
});
export type AiChatOutput = z.infer<typeof AiChatOutputSchema>;

export async function continueConversation(input: AiChatInput): Promise<AiChatOutput> {
  return continueConversationFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiChatPrompt',
  input: {schema: AiChatInputSchema},
  output: {schema: AiChatOutputSchema},
  prompt: `You are a helpful AI assistant. Continue the conversation with the user.

  Conversation History:
  {{#each history}}
    {{#if this.user}}User: {{{this.user}}}{{/if}}
    {{#if this.model}}AI: {{{this.model}}}{{/if}}
  {{/each}}

  User: {{{message}}}
  AI:`,
});

const continueConversationFlow = ai.defineFlow(
  {
    name: 'continueConversationFlow',
    inputSchema: AiChatInputSchema,
    outputSchema: AiChatOutputSchema,
  },
  async input => {
    try {
        if (!process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
            throw new Error("Gemini API key not configured");
        }

        const {output} = await prompt(input);
        if (!output) {
            throw new Error("No output from AI prompt.");
        }
        return output;
    } catch (error: any) {
        console.error("Error in continueConversationFlow:", error);
        // Check for specific error types
        if (error.message?.includes('429')) {
            return { reply: "I've been talking a lot today and need a little break. Please try again later. You may need to check your API plan and billing details." };
        }
        if (error.message?.includes('API key')) {
            return { reply: "I'm not properly configured right now. Please check the Gemini API key configuration." };
        }
        if (error.message?.includes('unauthorized') || error.message?.includes('403')) {
            return { reply: "I don't have proper authorization. Please verify the Gemini API key is valid." };
        }
        return { reply: "Sorry, I'm having trouble connecting right now. Please try again in a moment." };
    }
  }
);
