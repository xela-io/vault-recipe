import { AIProvider, requestWithRetry } from "./base";
import { ChatMessage } from "../types";
import { VaultRecipeSettings } from "../settings";

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

		const choices = response.json.choices;
		if (
			!Array.isArray(choices) ||
			choices.length === 0 ||
			!choices[0].message?.content
		) {
			throw new Error("Unexpected OpenAI response format");
		}
		return choices[0].message.content;
	}

}
