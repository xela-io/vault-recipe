import { App, TFile } from "obsidian";
import { AIProvider } from "../providers/base";

export class RecipeScalerService {
	constructor(
		private app: App,
		private getChatProvider: () => AIProvider
	) {}

	/**
	 * Read the servings value from frontmatter.
	 */
	getServings(file: TFile): number | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const servings = cache?.frontmatter?.servings;
		if (typeof servings === "number") return servings;
		if (typeof servings === "string") {
			const parsed = parseInt(servings, 10);
			return isNaN(parsed) ? null : parsed;
		}
		return null;
	}

	/**
	 * Scale recipe ingredients from current servings to newServings.
	 * Uses AI to handle non-trivial unit conversions.
	 */
	async scaleRecipe(file: TFile, newServings: number): Promise<void> {
		let content = await this.app.vault.read(file);

		// Extract current servings from frontmatter
		const currentServings = this.getServings(file);
		if (!currentServings) {
			throw new Error(
				"No servings found in frontmatter. The note needs a 'servings' field."
			);
		}

		if (currentServings === newServings) return;

		// Extract ingredients section
		const sectionMatch = content.match(
			/(## Zutaten\s*\n)([\s\S]*?)(?=\n## |\n$|$)/
		);
		if (!sectionMatch) {
			throw new Error(
				'No ingredients section found. The note needs a "## Zutaten" heading.'
			);
		}

		const ingredientsText = sectionMatch[2].trim();

		// Ask AI to scale
		const provider = this.getChatProvider();
		const scaled = await provider.chatCompletion(
			[
				{
					role: "user",
					content: `Rechne folgende Zutaten von ${currentServings} auf ${newServings} Portionen um. Behalte das Format bei. Antworte nur mit der neuen Zutatenliste, ohne Erklärungen.\n\n${ingredientsText}`,
				},
			],
			"Du bist ein Koch-Assistent. Rechne Zutatenmengen proportional um. Runde sinnvoll (z.B. 2.5 Eier → 3 Eier, 0.33 TL → 1 Prise). Behalte das exakte Markdown-Format bei (z.B. Aufzählungszeichen, Unterüberschriften)."
		);

		// Replace ingredients section
		const scaledTrimmed = scaled.trim();
		content = content.replace(
			/(## Zutaten\s*\n)([\s\S]*?)(?=\n## |\n$|$)/,
			`$1${scaledTrimmed}\n`
		);

		// Update servings in frontmatter
		content = content.replace(
			/^(servings:\s*).+$/m,
			`$1${newServings}`
		);

		await this.app.vault.modify(file, content);
	}
}
