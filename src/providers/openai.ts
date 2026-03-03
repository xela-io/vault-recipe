import { AIProvider, requestWithRetry } from "./base";
import { ChatMessage } from "../types";
import { VaultRecipeSettings } from "../settings";

interface OpenAIChatResponse {
	choices: { message: { content: string } }[];
}

export class OpenAIProvider implements AIProvider {
	private apiKey: string;
	private chatModel: string;

	constructor(settings: VaultRecipeSettings) {
		this.apiKey = settings.openaiApiKey;
		this.chatModel = settings.openaiChatModel;
	}

	async chatCompletion(
		messages: ChatMessage[],
		systemPrompt?: string,
		maxTokens?: number
	): Promise<string> {
		const msgs = systemPrompt
			? [{ role: "system" as const, content: systemPrompt }, ...messages]
			: messages;

		const body: Record<string, unknown> = {
			model: this.chatModel,
			messages: msgs,
			temperature: 0.1,
		};
		if (maxTokens) {
			body.max_tokens = maxTokens;
		}

		const response = await requestWithRetry(
			"https://api.openai.com/v1/chat/completions",
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.apiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			}
		);

		const result = response.json as OpenAIChatResponse;
		if (
			!Array.isArray(result.choices) ||
			result.choices.length === 0 ||
			!result.choices[0].message?.content
		) {
			throw new Error("Unexpected OpenAI response format");
		}
		return result.choices[0].message.content;
	}

}
