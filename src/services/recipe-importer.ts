import { App, TFile, requestUrl } from "obsidian";
import { RecipeData } from "../types";
import { AIProvider, isProviderConfigured } from "../providers/base";
import { VaultRecipeSettings } from "../settings";
import { getLanguageConfig } from "../languages";
import { ImageService } from "./image-service";
import { FM, MAX_PLAINTEXT_CONTENT_CHARS } from "../constants";
import { sanitizeFileName, ensureFolder, parseJsonFromResponse, createOrUpdateFile } from "../utils";

/** Maximum HTML size to process (500 KB). */
const MAX_HTML_SIZE = 512_000;

/** Convert a property value to a valid Obsidian tag (lowercase, no spaces). */
function toTag(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\p{L}\p{N}\-_]/gu, "");
}

/** Safely convert a value (possibly an object) to a readable string. */
function stringifyItem(item: unknown): string {
	if (typeof item === "string") return item;
	if (item && typeof item === "object") {
		const obj = item as Record<string, unknown>;
		// AI-returned structured ingredient: {item, amount, unit, notes}
		if (typeof obj["item"] === "string") {
			let s = "";
			if (obj["amount"] != null) s += `${obj["amount"]} `;
			if (obj["unit"]) s += `${obj["unit"]} `;
			s += obj["item"];
			if (obj["notes"]) s += ` (${obj["notes"]})`;
			return s.trim();
		}
		// Schema.org HowToItem / structured ingredient objects
		if (typeof obj["text"] === "string") return obj["text"];
		if (typeof obj["name"] === "string") return obj["name"];
		// Fallback: try JSON representation instead of "[object Object]"
		return JSON.stringify(item);
	}
	return String(item);
}

interface JsonLdRecipe {
	title: string;
	ingredients: string[];
	steps: string[];
	totalTime: string;
	image: string;
	servings: string;
}

export class RecipeImporterService {
	private imageService: ImageService;

	constructor(
		private app: App,
		private settings: VaultRecipeSettings,
		private getChatProvider: () => AIProvider
	) {
		this.imageService = new ImageService(app, settings);
	}

	/** Check whether the currently selected AI provider has an API key configured. */
	isProviderConfigured(): boolean {
		return isProviderConfigured(this.settings.defaultProvider, this.settings);
	}

	/** Check if a recipe file already exists for the given title. */
	getExistingRecipeFile(title: string): TFile | null {
		const folder = this.settings.recipeFolder;
		const filePath = `${folder}/${sanitizeFileName(title)}.md`;
		const existing = this.app.vault.getAbstractFileByPath(filePath);
		return existing instanceof TFile ? existing : null;
	}

	async fetchRecipePage(url: string): Promise<string> {
		const response = await requestUrl({ url });

		// Guard against non-HTML responses (e.g. PDFs, images)
		const contentType = response.headers["content-type"] || "";
		if (contentType && !contentType.includes("text/html") && !contentType.includes("text/plain") && !contentType.includes("application/xhtml")) {
			throw new Error(`Unexpected content type: ${contentType}`);
		}

		const text = response.text;
		if (text.length > MAX_HTML_SIZE) {
			return text.slice(0, MAX_HTML_SIZE);
		}
		return text;
	}

	/**
	 * Stage 1: Extract structured recipe data from JSON-LD markup.
	 */
	private extractJsonLd(html: string): JsonLdRecipe | null {
		const scriptRegex =
			/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
		let match: RegExpExecArray | null;

		while ((match = scriptRegex.exec(html)) !== null) {
			try {
				const data = JSON.parse(match[1]);
				const recipe = this.findRecipeInLd(data);
				if (recipe) return recipe;
			} catch {
				// Invalid JSON, skip
			}
		}
		return null;
	}

	private findRecipeInLd(data: unknown): JsonLdRecipe | null {
		if (!data || typeof data !== "object") return null;

		if (Array.isArray(data)) {
			for (const item of data) {
				const result = this.findRecipeInLd(item);
				if (result) return result;
			}
			return null;
		}

		const obj = data as Record<string, unknown>;

		// Check @graph array
		if (Array.isArray(obj["@graph"])) {
			for (const item of obj["@graph"]) {
				const result = this.findRecipeInLd(item);
				if (result) return result;
			}
		}

		// Check if this object is a Recipe
		const type = obj["@type"];
		const isRecipe =
			type === "Recipe" ||
			(Array.isArray(type) && type.includes("Recipe"));
		if (!isRecipe) return null;

		// Extract instructions
		const steps: string[] = [];
		const instructions = obj["recipeInstructions"];
		if (Array.isArray(instructions)) {
			for (const inst of instructions) {
				if (typeof inst === "string") {
					steps.push(inst);
				} else if (inst && typeof inst === "object") {
					const instObj = inst as Record<string, unknown>;
					if (typeof instObj["text"] === "string") {
						steps.push(instObj["text"]);
					} else if (
						instObj["@type"] === "HowToSection" &&
						Array.isArray(instObj["itemListElement"])
					) {
						for (const sub of instObj["itemListElement"]) {
							if (sub && typeof sub === "object") {
								const subObj = sub as Record<string, unknown>;
								if (typeof subObj["text"] === "string") {
									steps.push(subObj["text"]);
								}
							}
						}
					}
				}
			}
		} else if (typeof instructions === "string") {
			steps.push(instructions);
		}

		// Extract image
		const image = this.extractLdImage(obj["image"]);

		// Calculate total time
		let totalTime = "";
		if (typeof obj["totalTime"] === "string") {
			totalTime = obj["totalTime"];
		} else {
			const prep =
				typeof obj["prepTime"] === "string" ? obj["prepTime"] : "";
			const cook =
				typeof obj["cookTime"] === "string" ? obj["cookTime"] : "";
			if (prep || cook) {
				const prepMin = this.parseIsoDuration(prep);
				const cookMin = this.parseIsoDuration(cook);
				const total = prepMin + cookMin;
				if (total > 0) {
					totalTime = `PT${total}M`;
				}
			}
		}

		// Extract servings
		let servings = "";
		if (typeof obj["recipeYield"] === "string") {
			servings = obj["recipeYield"];
		} else if (Array.isArray(obj["recipeYield"])) {
			servings = String(obj["recipeYield"][0] || "");
		}

		return {
			title: String(obj["name"] || ""),
			ingredients: Array.isArray(obj["recipeIngredient"])
				? obj["recipeIngredient"].map(stringifyItem)
				: [],
			steps,
			totalTime,
			image,
			servings,
		};
	}

	private extractLdImage(imageData: unknown): string {
		if (typeof imageData === "string") {
			return imageData;
		}
		if (Array.isArray(imageData)) {
			const first = imageData[0];
			if (typeof first === "string") return first;
			if (first && typeof first === "object") {
				return String((first as Record<string, unknown>)["url"] || "");
			}
		}
		if (imageData && typeof imageData === "object" && !Array.isArray(imageData)) {
			return String((imageData as Record<string, unknown>)["url"] || "");
		}
		return "";
	}

	/**
	 * Parse an ISO 8601 duration (e.g. "PT1H30M") into total minutes.
	 */
	private parseIsoDuration(iso: string): number {
		if (!iso) return 0;
		const match = iso.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
		if (!match) return 0;
		const days = parseInt(match[1] || "0", 10);
		const hours = parseInt(match[2] || "0", 10);
		const minutes = parseInt(match[3] || "0", 10);
		return days * 1440 + hours * 60 + minutes;
	}

	/**
	 * Format minutes into a human-readable string.
	 */
	private formatMinutes(totalMinutes: number): string {
		if (totalMinutes <= 0) return "";
		const hours = Math.floor(totalMinutes / 60);
		const mins = totalMinutes % 60;
		if (hours > 0 && mins > 0) return `${hours} h ${mins} min`;
		if (hours > 0) return `${hours} h`;
		return `${mins} min`;
	}

	async extractRecipe(html: string, url: string): Promise<RecipeData> {
		const lang = getLanguageConfig(this.settings.recipeLanguage);

		// Stage 1: Try JSON-LD extraction
		const jsonLd = this.extractJsonLd(html);

		// Stage 2: Extract best image
		const imageUrl = this.imageService.extractBestImageUrl(
			html,
			jsonLd?.image || ""
		);

		const provider = this.getChatProvider();
		let parsed: Record<string, unknown>;

		if (jsonLd && jsonLd.title && jsonLd.ingredients.length > 0) {
			// JSON-LD available: send structured data to AI for translation/conversion/classification
			const totalMinutes = this.parseIsoDuration(jsonLd.totalTime);
			const timeStr = this.formatMinutes(totalMinutes);

			const response = await provider.chatCompletion(
				[
					{
						role: "user",
						content: `Structured recipe data:
Title: ${jsonLd.title}
Servings: ${jsonLd.servings}
Ingredients:\n${jsonLd.ingredients.map((i) => `- ${i}`).join("\n")}
Steps:\n${jsonLd.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}
Total time: ${timeStr}

${lang.translateInstruction}. Convert non-metric units to metric. Classify: "recDiet" (${lang.dietLabels}), "recCategory" (${lang.categoryLabels}), "recCuisine" (in ${lang.displayName}), "recDifficulty" (${lang.difficultyLabels}).

Return JSON: {"title","servings","recPreptime","recDiet","recCategory","recCuisine","recDifficulty","ingredients":[],"steps":[],"notes":""}
ONLY valid JSON, no fences.`,
					},
				],
				lang.recipeAssistantSystem
			);

			parsed = parseJsonFromResponse(response);
		} else {
			// No JSON-LD: fallback to plaintext extraction
			// Truncate before regex chain to avoid processing huge HTML
			const truncatedHtml = html.length > MAX_HTML_SIZE ? html.slice(0, MAX_HTML_SIZE) : html;
			const textContent = truncatedHtml
				.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, MAX_PLAINTEXT_CONTENT_CHARS);

			// Collect candidate image URLs for AI to pick from (only in fallback mode)
			let imageSection = "";
			if (!imageUrl) {
				const imgUrls = this.imageService.collectImageUrls(html, url);
				if (imgUrls.length > 0) {
					imageSection = `\n\nHere are image URLs from the page. Pick the one that best matches the recipe (no logos, icons, or ads) and return it as "bestImageUrl". If none fits, return an empty string.\n${imgUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`;
				}
			}

			const response = await provider.chatCompletion(
				[
					{
						role: "user",
						content: `Extract the recipe from this web page content. Return a JSON object with these fields:
- "title": recipe title
- "servings": servings (e.g. "4 servings")
- "recPreptime": total prep time (e.g. "45 min")
- "recDiet": classify: ${lang.dietLabels}
- "recCategory": ${lang.categoryLabels}
- "recCuisine": e.g. Italian, Asian, Mexican, German, French, Indian, etc. (in ${lang.displayName})
- "recDifficulty": ${lang.difficultyLabels}
- "ingredients": array of ingredient strings
- "steps": array of preparation steps
- "notes": optional tips (empty string if none)${!imageUrl ? '\n- "bestImageUrl": best image URL for the recipe (empty string if none fits)' : ""}

Important:
1. ${lang.translateInstruction}
2. Convert all units to metric (cups→ml/g, oz→g, lbs→kg, °F→°C, tbsp→EL, tsp→TL)

Respond ONLY with valid JSON, no markdown fences.
${imageSection}
Web page content:
${textContent}`,
					},
				],
				lang.recipeExtractionSystem
			);

			parsed = parseJsonFromResponse(response);
		}

		// Validate critical fields from AI response
		if (!parsed.title || typeof parsed.title !== "string") {
			throw new Error("AI response missing required 'title' field");
		}
		if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
			throw new Error("AI response missing or empty 'ingredients' array");
		}
		if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
			throw new Error("AI response missing or empty 'steps' array");
		}

		// If AI found a better image in fallback mode, use it
		const finalImageUrl =
			imageUrl ||
			String(parsed.bestImageUrl || "");

		return {
			title: String(parsed.title),
			source: url,
			servings: String(parsed.servings || ""),
			recPreptime: String(parsed.recPreptime || ""),
			recDiet: String(parsed.recDiet || ""),
			recCategory: String(parsed.recCategory || ""),
			recCuisine: String(parsed.recCuisine || ""),
			recDifficulty: String(parsed.recDifficulty || ""),
			dateImported: new Date().toISOString().split("T")[0],
			recRating: 0,
			ingredients: parsed.ingredients.map(stringifyItem),
			steps: parsed.steps.map(stringifyItem),
			notes: String(parsed.notes || ""),
			imageUrl: finalImageUrl,
		};
	}

	async createRecipeNote(recipe: RecipeData): Promise<{ file: TFile; imageFailed: boolean }> {
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const folder = this.settings.recipeFolder;

		await ensureFolder(this.app, folder);

		// Download image (without mutating the recipe argument)
		let imagePath: string | null = null;
		const imageFailed = !!recipe.imageUrl;
		if (recipe.imageUrl) {
			imagePath = await this.imageService.downloadImage(
				recipe.imageUrl,
				recipe.title,
				recipe.source
			);
		}

		const filePath = `${folder}/${sanitizeFileName(recipe.title)}.md`;

		// Build body
		let body = "\n";

		// Embed image: local file if downloaded, otherwise external URL
		if (imagePath) {
			const imageFileName = imagePath.split("/").pop() || "";
			body += `![[${imageFileName}]]\n\n`;
		} else if (recipe.imageUrl) {
			body += `![${recipe.title}](${recipe.imageUrl})\n\n`;
		}

		const ingredientsList = recipe.ingredients
			.map((i) => `- ${i}`)
			.join("\n");

		const stepsList = recipe.steps
			.map((s, idx) => `${idx + 1}. ${s}`)
			.join("\n");

		body += `## ${lang.ingredientsHeading}\n\n${ingredientsList}\n\n## ${lang.stepsHeading}\n\n${stepsList}`;

		if (recipe.notes) {
			body += `\n\n## ${lang.notesHeading}\n\n${recipe.notes}`;
		}

		const content = "---\n---\n" + body + "\n";

		const file = await createOrUpdateFile(this.app, filePath, content);

		// Ensure property types are registered correctly in Obsidian
		try {
			// metadataTypeManager is an internal Obsidian API not exposed in public typings
			const appRecord = this.app as App & { metadataTypeManager?: { setType: (name: string, type: string) => void } };
			const typeManager = appRecord.metadataTypeManager;
			if (typeManager?.setType) {
				typeManager.setType(FM.TITLE, "text");
				typeManager.setType(FM.SOURCE, "text");
				typeManager.setType(FM.SERVINGS, "text");
				typeManager.setType(FM.PREPTIME, "text");
				typeManager.setType(FM.DIET, "text");
				typeManager.setType(FM.CATEGORY, "text");
				typeManager.setType(FM.CUISINE, "text");
				typeManager.setType(FM.DIFFICULTY, "text");
				typeManager.setType(FM.IMAGE, "text");
				typeManager.setType(FM.DATE_IMPORTED, "date");
				typeManager.setType(FM.RATING, "number");
				typeManager.setType(FM.TAGS, "tags");
			}
		} catch {
			// metadataTypeManager is an internal API — ignore if unavailable
		}

		// Use Obsidian's processFrontMatter to set properties with correct types
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			fm[FM.TITLE] = recipe.title;
			fm[FM.SOURCE] = recipe.source;
			fm[FM.SERVINGS] = recipe.servings;
			fm[FM.PREPTIME] = recipe.recPreptime;
			fm[FM.DIET] = recipe.recDiet;
			fm[FM.CATEGORY] = recipe.recCategory;
			fm[FM.CUISINE] = recipe.recCuisine;
			fm[FM.DIFFICULTY] = recipe.recDifficulty;
			fm[FM.IMAGE] = imagePath || "";
			fm[FM.DATE_IMPORTED] = recipe.dateImported;
			fm[FM.RATING] = recipe.recRating;
			const tags = [lang.tag];
			for (const val of [recipe.recDiet, recipe.recCategory, recipe.recDifficulty]) {
				const t = val ? toTag(val) : "";
				if (t && !tags.includes(t)) tags.push(t);
			}
			fm[FM.TAGS] = tags;
		});

		return { file, imageFailed: imageFailed && !imagePath };
	}
}
