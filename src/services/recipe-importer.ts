import { App, Notice, TFile, requestUrl } from "obsidian";
import { RecipeData } from "../types";
import { AIProvider } from "../providers/base";
import { VaultRecipeSettings } from "../settings";

interface JsonLdRecipe {
	title: string;
	ingredients: string[];
	steps: string[];
	totalTime: string;
	image: string;
	servings: string;
}

export class RecipeImporterService {
	constructor(
		private app: App,
		private settings: VaultRecipeSettings,
		private getChatProvider: () => AIProvider
	) {}

	async fetchRecipePage(url: string): Promise<string> {
		const response = await requestUrl({ url });
		return response.text;
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
		let image = "";
		if (typeof obj["image"] === "string") {
			image = obj["image"];
		} else if (Array.isArray(obj["image"])) {
			const first = obj["image"][0];
			if (typeof first === "string") {
				image = first;
			} else if (first && typeof first === "object") {
				image = String(
					(first as Record<string, unknown>)["url"] || ""
				);
			}
		} else if (
			obj["image"] &&
			typeof obj["image"] === "object" &&
			!Array.isArray(obj["image"])
		) {
			image = String(
				(obj["image"] as Record<string, unknown>)["url"] || ""
			);
		}

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
				? (obj["recipeIngredient"] as unknown[]).map(String)
				: [],
			steps,
			totalTime,
			image,
			servings,
		};
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

	/**
	 * Stage 2: Extract the best image URL from HTML.
	 * Priority: og:image > JSON-LD image > filtered <img> tags.
	 */
	private extractBestImageUrl(
		html: string,
		jsonLdImage: string
	): string {
		// 1. og:image
		const ogMatch = html.match(
			/<meta\s+(?:[^>]*?)property=["']og:image["'][^>]*?content=["']([^"']+)["']/i
		);
		if (ogMatch && ogMatch[1]) return ogMatch[1];

		// Also check reversed attribute order
		const ogMatchReversed = html.match(
			/<meta\s+(?:[^>]*?)content=["']([^"']+)["'][^>]*?property=["']og:image["']/i
		);
		if (ogMatchReversed && ogMatchReversed[1]) return ogMatchReversed[1];

		// 2. JSON-LD image
		if (jsonLdImage) return jsonLdImage;

		// 3. No automatic <img> scraping — return empty, fallback left to AI in plaintext mode
		return "";
	}

	async extractRecipe(html: string, url: string): Promise<RecipeData> {
		// Stage 1: Try JSON-LD extraction
		const jsonLd = this.extractJsonLd(html);

		// Stage 2: Extract best image
		const imageUrl = this.extractBestImageUrl(
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
						content: `Hier sind die strukturierten Rezeptdaten einer Webseite:
Title: ${jsonLd.title}
Servings: ${jsonLd.servings}
Ingredients:
${jsonLd.ingredients.map((i) => `- ${i}`).join("\n")}
Steps:
${jsonLd.steps.map((s, idx) => `${idx + 1}. ${s}`).join("\n")}
Total time: ${timeStr}

Aufgaben:
1. Übersetze alles ins Deutsche (falls nicht schon deutsch)
2. Konvertiere alle Einheiten ins metrische System (cups→ml/g, oz→g, lbs→kg, °F→°C, tbsp→EL, tsp→TL)
3. Gib die Gesamtzubereitungszeit als "recPreptime" an (z.B. "45 min" oder "1 h 30 min")
4. Klassifiziere "recDiet": vegan/vegetarisch/fleisch/fisch/meeresfrüchte
5. Klassifiziere "recCategory": Vorspeise/Hauptgericht/Dessert/Suppe/Salat/Beilage/Snack/Getränk
6. Klassifiziere "recCuisine": z.B. Italienisch, Asiatisch, Mexikanisch, Deutsch, Französisch, Indisch, etc.
7. Klassifiziere "recDifficulty": einfach/mittel/aufwendig

Return JSON: { "title": "...", "servings": "...", "recPreptime": "...", "recDiet": "...", "recCategory": "...", "recCuisine": "...", "recDifficulty": "...", "ingredients": [...], "steps": [...], "notes": "..." }
Respond ONLY with valid JSON, no markdown fences.`,
					},
				],
				"Du bist ein Rezept-Assistent. Übersetze, konvertiere ins metrische System und klassifiziere Rezepte. Antworte nur mit validem JSON."
			);

			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error(
					"Failed to extract recipe data from AI response"
				);
			}
			parsed = JSON.parse(jsonMatch[0]);
		} else {
			// No JSON-LD: fallback to plaintext extraction
			const textContent = html
				.replace(/<script[\s\S]*?<\/script>/gi, "")
				.replace(/<style[\s\S]*?<\/style>/gi, "")
				.replace(/<[^>]+>/g, " ")
				.replace(/\s+/g, " ")
				.trim()
				.slice(0, 12000);

			// Collect candidate image URLs for AI to pick from (only in fallback mode)
			let imageSection = "";
			if (!imageUrl) {
				const imgUrls = this.collectImageUrls(html, url);
				if (imgUrls.length > 0) {
					imageSection = `\n\nHier sind Bild-URLs von der Seite. Wähle die URL, die am besten zum Rezept passt (kein Logo, Icon oder Werbung), und gib sie als "bestImageUrl" zurück. Falls keine passend ist, gib einen leeren String zurück.\n${imgUrls.map((u, i) => `${i + 1}. ${u}`).join("\n")}`;
				}
			}

			const response = await provider.chatCompletion(
				[
					{
						role: "user",
						content: `Extrahiere das Rezept aus diesem Webseiteninhalt. Gib ein JSON-Objekt mit diesen Feldern zurück:
- "title": Rezepttitel
- "servings": Portionen (z.B. "4 Portionen")
- "recPreptime": Gesamtzubereitungszeit (z.B. "45 min")
- "recDiet": Klassifizierung: vegan/vegetarisch/fleisch/fisch/meeresfrüchte
- "recCategory": Vorspeise/Hauptgericht/Dessert/Suppe/Salat/Beilage/Snack/Getränk
- "recCuisine": z.B. Italienisch, Asiatisch, Mexikanisch, Deutsch, Französisch, Indisch, etc.
- "recDifficulty": einfach/mittel/aufwendig
- "ingredients": Array von Zutaten-Strings
- "steps": Array von Zubereitungsschritten
- "notes": optionale Tipps (leerer String wenn keine)${!imageUrl ? '\n- "bestImageUrl": die beste Bild-URL für das Rezept (leerer String wenn keine passend)' : ""}

Wichtig:
1. Übersetze alles ins Deutsche (falls nicht schon deutsch)
2. Konvertiere alle Einheiten ins metrische System (cups→ml/g, oz→g, lbs→kg, °F→°C, tbsp→EL, tsp→TL)

Antworte NUR mit validem JSON, keine Markdown-Fences.
${imageSection}
Webseiteninhalt:
${textContent}`,
					},
				],
				"Du bist ein Rezept-Extraktions-Assistent. Extrahiere strukturierte Rezeptdaten aus Webseiteninhalt. Übersetze ins Deutsche und konvertiere ins metrische System. Antworte nur mit validem JSON."
			);

			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw new Error(
					"Failed to extract recipe data from AI response"
				);
			}
			parsed = JSON.parse(jsonMatch[0]);
		}

		// If AI found a better image in fallback mode, use it
		const finalImageUrl =
			imageUrl ||
			String(parsed.bestImageUrl || "");

		return {
			title: String(parsed.title || "Untitled Recipe"),
			source: url,
			servings: String(parsed.servings || ""),
			recPreptime: String(parsed.recPreptime || ""),
			recDiet: String(parsed.recDiet || ""),
			recCategory: String(parsed.recCategory || ""),
			recCuisine: String(parsed.recCuisine || ""),
			recDifficulty: String(parsed.recDifficulty || ""),
			dateImported: new Date().toISOString().split("T")[0],
			recRating: 0,
			ingredients: Array.isArray(parsed.ingredients)
				? parsed.ingredients.map(String)
				: [],
			steps: Array.isArray(parsed.steps)
				? parsed.steps.map(String)
				: [],
			notes: String(parsed.notes || ""),
			imageUrl: finalImageUrl,
		};
	}

	/**
	 * Collect candidate image URLs from <img> tags, filtering out likely non-recipe images.
	 */
	private collectImageUrls(html: string, baseUrl: string): string[] {
		const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
		const urls: string[] = [];
		let match: RegExpExecArray | null;

		while ((match = imgRegex.exec(html)) !== null) {
			let src = match[1];
			// Skip SVGs, tracking pixels, icons, tiny images
			if (/\.svg(\?|$)/i.test(src)) continue;
			if (/\b(pixel|track|beacon|1x1|spacer|blank)\b/i.test(src))
				continue;
			if (/\b(icon|logo|avatar|favicon|badge)\b/i.test(src)) continue;

			// Resolve relative URLs
			try {
				src = new URL(src, baseUrl).href;
			} catch {
				continue;
			}
			if (!urls.includes(src)) urls.push(src);
		}

		// Limit to 10 candidates
		return urls.slice(0, 10);
	}

	/**
	 * Download an image and save it to the vault.
	 */
	async downloadImage(
		imageUrl: string,
		recipeName: string
	): Promise<string | null> {
		if (!imageUrl) return null;

		try {
			const response = await requestUrl({
				url: imageUrl,
				headers: {
					Referer: imageUrl,
				},
			});

			// Determine file extension from URL or content type
			let ext = "jpg";
			const urlPath = new URL(imageUrl).pathname;
			const urlExtMatch = urlPath.match(/\.(\w{3,4})$/);
			if (urlExtMatch) {
				const urlExt = urlExtMatch[1].toLowerCase();
				if (["jpg", "jpeg", "png", "webp", "gif"].includes(urlExt)) {
					ext = urlExt === "jpeg" ? "jpg" : urlExt;
				}
			}

			const folder = this.settings.recipeFolder;
			const imagesFolder = `${folder}/images`;

			// Create folders if needed
			if (!this.app.vault.getAbstractFileByPath(folder)) {
				await this.app.vault.createFolder(folder);
			}
			if (!this.app.vault.getAbstractFileByPath(imagesFolder)) {
				await this.app.vault.createFolder(imagesFolder);
			}

			const sanitizedName = recipeName
				.replace(/[\\/:*?"<>|]/g, "-")
				.replace(/\s+/g, " ")
				.trim();
			const imagePath = `${imagesFolder}/${sanitizedName}.${ext}`;

			// Check if file already exists
			const existing =
				this.app.vault.getAbstractFileByPath(imagePath);
			if (existing instanceof TFile) {
				await this.app.vault.modifyBinary(
					existing,
					response.arrayBuffer
				);
			} else {
				await this.app.vault.createBinary(
					imagePath,
					response.arrayBuffer
				);
			}

			return imagePath;
		} catch (e) {
			console.warn("Failed to download recipe image:", e);
			return null;
		}
	}

	async createRecipeNote(recipe: RecipeData): Promise<TFile> {
		const folder = this.settings.recipeFolder;

		// Create folder if it doesn't exist
		if (!this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		// Download image
		let imagePath: string | null = null;
		if (recipe.imageUrl) {
			imagePath = await this.downloadImage(
				recipe.imageUrl,
				recipe.title
			);
			if (imagePath) {
				recipe.imagePath = imagePath;
			}
		}

		const sanitizedTitle = recipe.title
			.replace(/[\\/:*?"<>|]/g, "-")
			.replace(/\s+/g, " ")
			.trim();
		const filePath = `${folder}/${sanitizedTitle}.md`;

		// Build frontmatter
		const frontmatter = [
			"---",
			`title: "${recipe.title.replace(/"/g, '\\"')}"`,
			`source: "${recipe.source}"`,
			`servings: "${recipe.servings}"`,
			`rec_preptime: "${recipe.recPreptime}"`,
			`rec_diet: "${recipe.recDiet}"`,
			`rec_category: "${recipe.recCategory}"`,
			`rec_cuisine: "${recipe.recCuisine}"`,
			`rec_difficulty: "${recipe.recDifficulty}"`,
			`rec_image: "${recipe.imagePath || ""}"`,
			`date_imported: "${recipe.dateImported}"`,
			`rec_rating: ${recipe.recRating}`,
			"tags:",
			"  - rezept",
			"---",
		].join("\n");

		// Build body
		let body = "\n";

		// Embed image if downloaded
		if (imagePath) {
			const imageFileName = imagePath.split("/").pop() || "";
			body += `![[${imageFileName}]]\n\n`;
		}

		const ingredientsList = recipe.ingredients
			.map((i) => `- ${i}`)
			.join("\n");

		const stepsList = recipe.steps
			.map((s, idx) => `${idx + 1}. ${s}`)
			.join("\n");

		body += `## Zutaten\n\n${ingredientsList}\n\n## Zubereitung\n\n${stepsList}`;

		if (recipe.notes) {
			body += `\n\n## Notizen\n\n${recipe.notes}`;
		}

		const content = frontmatter + "\n" + body + "\n";

		// Check if file already exists
		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			return existing;
		}

		return await this.app.vault.create(filePath, content);
	}
}
