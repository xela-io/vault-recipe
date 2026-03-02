import { App, TFile } from "obsidian";
import { AIProvider } from "../providers/base";
import { VaultRecipeSettings } from "../settings";
import { getLanguageConfig } from "../languages";

export class ShoppingListService {
	constructor(
		private app: App,
		private settings: VaultRecipeSettings,
		private getChatProvider: () => AIProvider
	) {}

	/**
	 * Parse ingredients from a recipe note.
	 * Extracts title from frontmatter and ingredients from ## Zutaten section.
	 */
	async parseIngredientsFromNote(
		file: TFile
	): Promise<{ title: string; ingredients: string[] }> {
		const content = await this.app.vault.cachedRead(file);

		// Extract title from frontmatter
		let title = file.basename;
		const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (fmMatch) {
			const titleMatch = fmMatch[1].match(/^title:\s*(.+)$/m);
			if (titleMatch) {
				title = titleMatch[1].replace(/^["']|["']$/g, "").trim();
			}
		}

		// Extract ingredients section (between ## <heading> and next ##)
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const sectionMatch = content.match(
			new RegExp(`## ${lang.ingredientsHeading}\\s*\\n([\\s\\S]*?)(?=\\n## |\\n$|$)`)
		);
		if (!sectionMatch) {
			return { title, ingredients: [] };
		}

		const ingredients = sectionMatch[1]
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.startsWith("- "))
			.map((line) => line.slice(2).trim())
			.filter((item) => item.length > 0);

		return { title, ingredients };
	}

	/**
	 * List all recipe notes in the recipeFolder that have a ## Zutaten section.
	 */
	listRecipeNotes(): TFile[] {
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const folder = this.settings.recipeFolder;
		return this.app.vault
			.getMarkdownFiles()
			.filter((file) => {
				if (!file.path.startsWith(folder + "/")) return false;
				const cache = this.app.metadataCache.getFileCache(file);
				if (!cache?.headings) return false;
				return cache.headings.some(
					(h) => h.level === 2 && h.heading === lang.ingredientsHeading
				);
			})
			.sort((a, b) => a.basename.localeCompare(b.basename));
	}

	/**
	 * Use AI to merge ingredient lists: combine quantities, deduplicate,
	 * remove staples, and sort by supermarket category.
	 */
	async mergeIngredients(
		entries: { title: string; ingredients: string[] }[]
	): Promise<string> {
		const titles = entries.map((e) => e.title);
		const allIngredients = entries
			.map(
				(e) =>
					`### ${e.title}\n${e.ingredients.map((i) => `- ${i}`).join("\n")}`
			)
			.join("\n\n");

		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const provider = this.getChatProvider();

		const merged = await provider.chatCompletion(
			[
				{
					role: "user",
					content: lang.shoppingListUser(allIngredients),
				},
			],
			lang.shoppingListSystem
		);

		const heading = `### ${titles.join(", ")}`;
		return `${heading}\n${merged.trim()}`;
	}

	/**
	 * Append content to the shopping list note (creates it if missing).
	 */
	async appendToShoppingList(content: string): Promise<TFile> {
		const path = this.settings.shoppingListPath;
		let file = this.app.vault.getAbstractFileByPath(path);

		if (file instanceof TFile) {
			const existing = await this.app.vault.read(file);
			await this.app.vault.modify(file, existing + "\n\n" + content);
			return file;
		}

		// Create the file if it doesn't exist
		return await this.app.vault.create(path, content);
	}
}
