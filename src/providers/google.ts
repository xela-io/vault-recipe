import { AIProvider, requestWithRetry } from "./base";
import { ChatMessage } from "../types";
import { VaultRecipeSettings } from "../settings";

interface GoogleChatResponse {
	candidates: { content: { parts: { text: string }[] } }[];
}

export class GoogleProvider implements AIProvider {
	private apiKey: string;
	private chatModel: string;

	constructor(settings: VaultRecipeSettings) {
		this.apiKey = settings.googleApiKey;
		this.chatModel = settings.googleChatModel;
	}

	async chatCompletion(
		messages: ChatMessage[],
		systemPrompt?: string,
		maxTokens?: number
	): Promise<string> {
		// Google Gemini: map roles. system message gets merged into first user message.
		const geminiContents: { role: string; parts: { text: string }[] }[] =
			[];
		let systemText = systemPrompt || "";

		for (const msg of messages) {
			if (msg.role === "system") {
				systemText += (systemText ? "\n\n" : "") + msg.content;
				continue;
			}

			const role = msg.role === "assistant" ? "model" : "user";
			let content = msg.content;

			// Prepend system text to first user message
			if (
				systemText &&
				role === "user" &&
				geminiContents.length === 0
			) {
				content = systemText + "\n\n" + content;
				systemText = "";
			}

			geminiContents.push({
				role,
				parts: [{ text: content }],
			});
		}

		// If system text wasn't consumed (no user message), add it as user message
		if (systemText) {
			geminiContents.unshift({
				role: "user",
				parts: [{ text: systemText }],
			});
		}

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.chatModel}:generateContent`;

		const generationConfig: Record<string, unknown> = { temperature: 0.1 };
		if (maxTokens) {
			generationConfig.maxOutputTokens = maxTokens;
		}

		const response = await requestWithRetry(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"x-goog-api-key": this.apiKey,
			},
			body: JSON.stringify({
				contents: geminiContents,
				generationConfig,
			}),
		});

		const body = response.json as GoogleChatResponse;
		const candidates = body.candidates;
		if (
			Array.isArray(candidates) &&
			candidates.length > 0 &&
			candidates[0].content?.parts?.length > 0
		) {
			return candidates[0].content.parts[0].text;
		}
		throw new Error("Unexpected Google Gemini response format");
	}
}
