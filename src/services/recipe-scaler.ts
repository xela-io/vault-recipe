import { App, TFile } from "obsidian";
import { AIProvider } from "../providers/base";
import { VaultRecipeSettings } from "../settings";
import { getLanguageConfig } from "../languages";
import { FM } from "../constants";

export class RecipeScalerService {
	private headingPatternCache: { lang: string; pattern: RegExp } | null = null;

	constructor(
		private app: App,
		private settings: VaultRecipeSettings,
		private getChatProvider: () => AIProvider
	) {}

	private getHeadingPattern(heading: string): RegExp {
		if (this.headingPatternCache?.lang === heading) {
			return this.headingPatternCache.pattern;
		}
		const pattern = new RegExp(
			`(## ${heading}\\s*\\n)([\\s\\S]*?)(?=\\n## |\\n$|$)`
		);
		this.headingPatternCache = { lang: heading, pattern };
		return pattern;
	}

	/**
	 * Read the servings value from frontmatter.
	 */
	getServings(file: TFile): number | null {
		const cache = this.app.metadataCache.getFileCache(file);
		const servings: unknown = cache?.frontmatter?.[FM.SERVINGS];
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
		const headingPattern = this.getHeadingPattern(lang.ingredientsHeading);
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
			lang.scalerSystem,
			1024
		);

		// Replace ingredients section and update servings in one write
		const scaledTrimmed = scaled.trim();
		content = content.replace(
			headingPattern,
			`$1${scaledTrimmed}\n`
		);

		await this.app.vault.modify(file, content);
		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			fm[FM.SERVINGS] = newServings;
		});
	}
}
