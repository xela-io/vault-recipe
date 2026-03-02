import { App, TFile } from "obsidian";
import { AIProvider } from "../providers/base";
import { VaultRecipeSettings } from "../settings";
import { getLanguageConfig } from "../languages";

export class RecipeScalerService {
	constructor(
		private app: App,
		private settings: VaultRecipeSettings,
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
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const headingPattern = new RegExp(
			`(## ${lang.ingredientsHeading}\\s*\\n)([\\s\\S]*?)(?=\\n## |\\n$|$)`
		);
		const sectionMatch = content.match(headingPattern);
		if (!sectionMatch) {
			throw new Error(
				`No ingredients section found. The note needs a "## ${lang.ingredientsHeading}" heading.`
			);
		}

		const ingredientsText = sectionMatch[2].trim();

		// Ask AI to scale
		const provider = this.getChatProvider();
		const scaled = await provider.chatCompletion(
			[
				{
					role: "user",
					content: lang.scalerUser(currentServings, newServings, ingredientsText),
				},
			],
			lang.scalerSystem
		);

		// Replace ingredients section
		const scaledTrimmed = scaled.trim();
		content = content.replace(
			headingPattern,
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
