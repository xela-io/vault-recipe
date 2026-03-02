import { AIProvider, requestWithRetry } from "./base";
import { ChatMessage } from "../types";
import { VaultRecipeSettings } from "../settings";
import { ANTHROPIC_API_VERSION, ANTHROPIC_MAX_TOKENS } from "../constants";

export class AnthropicProvider implements AIProvider {
	private apiKey: string;
	private chatModel: string;

	constructor(settings: VaultRecipeSettings) {
		this.apiKey = settings.anthropicApiKey;
		this.chatModel = settings.anthropicChatModel;
	}

	async chatCompletion(
		messages: ChatMessage[],
		systemPrompt?: string,
		maxTokens?: number
	): Promise<string> {
		// Anthropic uses a different message format: no system role in messages
		const anthropicMessages = messages
			.filter((m) => m.role !== "system")
			.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			}));

		const body: Record<string, unknown> = {
			model: this.chatModel,
			max_tokens: maxTokens ?? ANTHROPIC_MAX_TOKENS,
			messages: anthropicMessages,
			temperature: 0.1,
		};

		if (systemPrompt) {
			body.system = systemPrompt;
		}

		const response = await requestWithRetry(
			"https://api.anthropic.com/v1/messages",
			{
				method: "POST",
				headers: {
					"x-api-key": this.apiKey,
					"anthropic-version": ANTHROPIC_API_VERSION,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(body),
			}
		);

		const content = response.json.content;
		if (Array.isArray(content) && content.length > 0) {
			return content[0].text;
		}
		throw new Error("Unexpected Anthropic response format");
	}
}
