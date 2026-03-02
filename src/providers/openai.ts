import { AIProvider, requestWithRetry } from "./base";
import { ChatMessage } from "../types";
import { VaultRecipeSettings } from "../settings";

export class OpenAIProvider implements AIProvider {
	readonly supportsEmbeddings = true;
	private apiKey: string;
	private chatModel: string;

	constructor(settings: VaultRecipeSettings) {
		this.apiKey = settings.openaiApiKey;
		this.chatModel = settings.openaiChatModel;
	}

	async chatCompletion(
		messages: ChatMessage[],
		systemPrompt?: string
	): Promise<string> {
		if (!this.apiKey) throw new Error("OpenAI API key not configured");

		const msgs = systemPrompt
			? [{ role: "system" as const, content: systemPrompt }, ...messages]
			: messages;

		const response = await requestWithRetry(
			"https://api.openai.com/v1/chat/completions",
			{
				url: "https://api.openai.com/v1/chat/completions",
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: this.chatModel,
					messages: msgs,
				}),
			}
		);

		return response.json.choices[0].message.content;
	}

	async generateEmbedding(text: string): Promise<number[]> {
		if (!this.apiKey) throw new Error("OpenAI API key not configured");

		const response = await requestWithRetry(
			"https://api.openai.com/v1/embeddings",
			{
				url: "https://api.openai.com/v1/embeddings",
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "text-embedding-3-small",
					input: text,
				}),
			}
		);

		return response.json.data[0].embedding;
	}
}
