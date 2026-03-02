import { AIProvider, requestWithRetry } from "./base";
import { ChatMessage } from "../types";
import { VaultRecipeSettings } from "../settings";

export class AnthropicProvider implements AIProvider {
	readonly supportsEmbeddings = false;
	private apiKey: string;
	private chatModel: string;

	constructor(settings: VaultRecipeSettings) {
		this.apiKey = settings.anthropicApiKey;
		this.chatModel = settings.anthropicChatModel;
	}

	async chatCompletion(
		messages: ChatMessage[],
		systemPrompt?: string
	): Promise<string> {
		if (!this.apiKey) throw new Error("Anthropic API key not configured");

		// Anthropic uses a different message format: no system role in messages
		const anthropicMessages = messages
			.filter((m) => m.role !== "system")
			.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			}));

		const body: Record<string, unknown> = {
			model: this.chatModel,
			max_tokens: 4096,
			messages: anthropicMessages,
		};

		if (systemPrompt) {
			body.system = systemPrompt;
		}

		const response = await requestWithRetry(
			"https://api.anthropic.com/v1/messages",
			{
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: {
					"x-api-key": this.apiKey,
					"anthropic-version": "2023-06-01",
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

	async generateEmbedding(_text: string): Promise<number[]> {
		throw new Error(
			"Anthropic does not support embeddings. Please use OpenAI or Google as your embedding provider."
		);
	}
}
