import { requestUrl, RequestUrlParam } from "obsidian";
import { ChatMessage, AIProviderType } from "../types";
import { VaultRecipeSettings } from "../settings";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";

export interface AIProvider {
	readonly supportsEmbeddings: boolean;
	chatCompletion(messages: ChatMessage[], systemPrompt?: string): Promise<string>;
	generateEmbedding(text: string): Promise<number[]>;
}

export async function requestWithRetry(
	url: string,
	options: RequestUrlParam,
	maxRetries = 3
): Promise<ReturnType<typeof requestUrl>> {
	let lastError: Error | null = null;
	for (let attempt = 0; attempt < maxRetries; attempt++) {
		try {
			return await requestUrl({ ...options, url });
		} catch (e: unknown) {
			lastError = e instanceof Error ? e : new Error(String(e));
			const status = (e as { status?: number }).status;
			if (status === 429 && attempt < maxRetries - 1) {
				const delay = Math.pow(2, attempt) * 1000;
				await new Promise((resolve) => setTimeout(resolve, delay));
				continue;
			}
			throw lastError;
		}
	}
	throw lastError;
}

export function createProvider(
	type: AIProviderType,
	settings: VaultRecipeSettings
): AIProvider {
	switch (type) {
		case AIProviderType.OpenAI:
			return new OpenAIProvider(settings);
		case AIProviderType.Anthropic:
			return new AnthropicProvider(settings);
		case AIProviderType.Google:
			return new GoogleProvider(settings);
		default:
			throw new Error(`Unknown provider type: ${type}`);
	}
}
