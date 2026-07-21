import { Message } from './types';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const AI_USER_ID = 'gemini-ai-chat-bot-7a4b9c1d-f2e3-4d56-a1b2-c3d4e5f6a7b8';

interface GeminiMessage {
    role: string;
    parts: {
        text: string;
    }[];
}

export class GeminiService {
    private static instance: GeminiService;
    private chatHistory: Map<string, GeminiMessage[]>;

    private constructor() {
        this.chatHistory = new Map();
    }

    public static getInstance(): GeminiService {
        if (!GeminiService.instance) {
            GeminiService.instance = new GeminiService();
        }
        return GeminiService.instance;
    }

    private async callGeminiAPI(messages: GeminiMessage[], chatId: string): Promise<string> {
        if (!GEMINI_API_KEY) {
            throw new Error('Gemini API key is not configured');
        }

        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GEMINI_API_KEY}`
                },
                body: JSON.stringify({
                    contents: messages,
                    generationConfig: {
                        temperature: 0.9,
                        topK: 1,
                        topP: 1,
                        maxOutputTokens: 2048,
                    },
                    safetySettings: [
                        {
                            category: "HARM_CATEGORY_HARASSMENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_HATE_SPEECH",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        },
                        {
                            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                            threshold: "BLOCK_MEDIUM_AND_ABOVE"
                        }
                    ]
                })
            });

            if (!response.ok) {
                throw new Error(`API call failed: ${response.statusText}`);
            }

            const data = await response.json();
            return data.candidates[0].content.parts[0].text;
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            throw error;
        }
    }

    private extractMentionedText(message: string): string {
        const mentionRegex = /@gemini\s+(.*?)(?=@gemini|\s*$)/s;
        const match = message.match(mentionRegex);
        return match ? match[1].trim() : message.replace('@gemini', '').trim();
    }

    public async processMessage(message: Message, chatId: string): Promise<string | null> {
        if (!message.text?.includes('@gemini')) {
            return null;
        }

        const questionText = this.extractMentionedText(message.text);
        if (!questionText) {
            return null;
        }

        // Get or initialize chat history
        let chatHistory = this.chatHistory.get(chatId) || [];

        // Add user message to history
        chatHistory.push({
            role: 'user',
            parts: [{ text: questionText }]
        });

        // Keep only last 10 messages for context
        if (chatHistory.length > 10) {
            chatHistory = chatHistory.slice(-10);
        }

        // Get AI response
        const response = await this.callGeminiAPI(chatHistory, chatId);

        // Add AI response to history
        chatHistory.push({
            role: 'model',
            parts: [{ text: response }]
        });

        // Update chat history
        this.chatHistory.set(chatId, chatHistory);

        return response;
    }

    public clearChatHistory(chatId: string): void {
        this.chatHistory.delete(chatId);
    }
}

export const geminiService = GeminiService.getInstance();