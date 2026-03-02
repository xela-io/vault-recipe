import { AIProvider, requestWithRetry } from "./base";
import { ChatMessage } from "../types";
import { VaultRecipeSettings } from "../settings";

export class GoogleProvider implements AIProvider {
	readonly supportsEmbeddings = true;
	private apiKey: string;
	private chatModel: string;

	constructor(settings: VaultRecipeSettings) {
		this.apiKey = settings.googleApiKey;
		this.chatModel = settings.googleChatModel;
	}

	async chatCompletion(
		messages: ChatMessage[],
		systemPrompt?: string
	): Promise<string> {
		if (!this.apiKey) throw new Error("Google API key not configured");

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

		const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.chatModel}:generateContent?key=${this.apiKey}`;

		const response = await requestWithRetry(url, {
			url,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ contents: geminiContents }),
		});

		const candidates = response.json.candidates;
		if (
			Array.isArray(candidates) &&
			candidates.length > 0 &&
			candidates[0].content?.parts?.length > 0
		) {
			return candidates[0].content.parts[0].text;
		}
		throw new Error("Unexpected Google Gemini response format");
	}

	async generateEmbedding(text: string): Promise<number[]> {
		if (!this.apiKey) throw new Error("Google API key not configured");

		const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.apiKey}`;

		const response = await requestWithRetry(url, {
			url,
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: { parts: [{ text }] },
			}),
		});

		return response.json.embedding.values;
	}
}
