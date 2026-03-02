import { App, TFile, TFolder } from "obsidian";
import { VaultRecipeSettings } from "../settings";
import { getLanguageConfig } from "../languages";

interface RecipeMeta {
	fileName: string;
	title: string;
	servings: string;
	recPreptime: string;
	recDiet: string;
	recCategory: string;
	recCuisine: string;
	recDifficulty: string;
	recRating: number;
	dateImported: string;
}

export class RecipeOverviewService {
	constructor(
		private app: App,
		private settings: VaultRecipeSettings
	) {}

	async generateOverview(): Promise<TFile> {
		const recipes = this.collectRecipes();
		const content = this.buildOverviewContent(recipes);

		const folder = this.settings.recipeFolder;
		const fileName = this.settings.overviewFileName || "Rezept-Übersicht";
		const filePath = `${folder}/${fileName}.md`;

		// Ensure folder exists
		if (!this.app.vault.getAbstractFileByPath(folder)) {
			await this.app.vault.createFolder(folder);
		}

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing instanceof TFile) {
			await this.app.vault.modify(existing, content);
			return existing;
		}

		return await this.app.vault.create(filePath, content);
	}

	private collectRecipes(): RecipeMeta[] {
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const folder = this.app.vault.getAbstractFileByPath(
			this.settings.recipeFolder
		);
		if (!folder || !(folder instanceof TFolder)) return [];

		const recipes: RecipeMeta[] = [];
		const overviewName = this.settings.overviewFileName || lang.overviewTitle;

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") continue;
			if (child.basename === overviewName) continue;

			const cache = this.app.metadataCache.getFileCache(child);
			const fm = cache?.frontmatter;
			if (!fm || !fm.tags?.includes(lang.tag)) {
				// Also check tags array format
				const hasTags =
					fm &&
					(fm.tags === lang.tag ||
						(Array.isArray(fm.tags) && fm.tags.includes(lang.tag)));
				if (!hasTags) continue;
			}

			recipes.push({
				fileName: child.basename,
				title: String(fm.title || child.basename),
				servings: String(fm.servings || ""),
				recPreptime: String(fm.rec_preptime || ""),
				recDiet: String(fm.rec_diet || ""),
				recCategory: String(fm.rec_category || ""),
				recCuisine: String(fm.rec_cuisine || ""),
				recDifficulty: String(fm.rec_difficulty || ""),
				recRating: Number(fm.rec_rating ?? 0),
				dateImported: String(fm.date_imported || ""),
			});
		}

		recipes.sort((a, b) => a.title.localeCompare(b.title, "de"));
		return recipes;
	}

	private buildOverviewContent(recipes: RecipeMeta[]): string {
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const sections: string[] = [];

		// Header
		sections.push(`# ${lang.overviewTitle}\n`);
		sections.push(
			`> ${lang.overviewGenerated(recipes.length)}\n`
		);

		// Dataview section
		sections.push(`## ${lang.overviewAllRecipes}\n`);
		sections.push(
			`> ${lang.overviewDataviewNote}\n`
		);
		sections.push("```dataview");
		sections.push("TABLE");
		sections.push(`  rec_category AS "${lang.dvCategory}",`);
		sections.push(`  rec_cuisine AS "${lang.dvCuisine}",`);
		sections.push(`  rec_difficulty AS "${lang.dvDifficulty}",`);
		sections.push(`  rec_diet AS "${lang.dvDiet}",`);
		sections.push(`  servings AS "${lang.dvServings}",`);
		sections.push(`  rec_preptime AS "${lang.dvTime}",`);
		sections.push(`  rec_rating AS "${lang.dvRating}",`);
		sections.push(`  date_imported AS "${lang.dvImported}"`);
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push(`WHERE contains(tags, "${lang.tag}")`);
		sections.push("SORT title ASC");
		sections.push("```\n");

		// Filter examples
		sections.push(`## ${lang.overviewFilterExamples}\n`);

		// Main courses filter — use first "main course" label from categoryLabels
		const mainCourseLabel = lang.categoryLabels.split("/")[1] || "Main Course";
		sections.push(`### ${lang.overviewMainCourses}\n`);
		sections.push("```dataview");
		sections.push(`TABLE rec_cuisine AS "${lang.dvCuisine}", rec_difficulty AS "${lang.dvDifficulty}", rec_preptime AS "${lang.dvTime}"`);
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push(`WHERE rec_category = "${mainCourseLabel}"`);
		sections.push("SORT title ASC");
		sections.push("```\n");

		// Vegetarian filter — use first two diet labels (vegan/vegetarian)
		const dietParts = lang.dietLabels.split("/");
		sections.push(`### ${lang.overviewVegetarian}\n`);
		sections.push("```dataview");
		sections.push(`TABLE rec_category AS "${lang.dvCategory}", rec_cuisine AS "${lang.dvCuisine}", rec_preptime AS "${lang.dvTime}"`);
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push(`WHERE rec_diet = "${dietParts[1] || "vegetarian"}" OR rec_diet = "${dietParts[0] || "vegan"}"`);
		sections.push("SORT title ASC");
		sections.push("```\n");

		// Easy filter — use first difficulty label
		const easyLabel = lang.difficultyLabels.split("/")[0] || "easy";
		sections.push(`### ${lang.overviewEasy}\n`);
		sections.push("```dataview");
		sections.push(`TABLE rec_category AS "${lang.dvCategory}", rec_cuisine AS "${lang.dvCuisine}", rec_preptime AS "${lang.dvTime}"`);
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push(`WHERE rec_difficulty = "${easyLabel}"`);
		sections.push("SORT title ASC");
		sections.push("```\n");

		// Static table
		const headers = lang.overviewTableHeaders;
		sections.push(`## ${lang.overviewStaticTitle}\n`);
		sections.push(
			`> ${lang.overviewStaticNote}\n`
		);

		sections.push(
			`| ${headers.join(" | ")} |`
		);
		sections.push(
			`|${headers.map(() => "--------").join("|")}|`
		);

		for (const r of recipes) {
			const link = `[[${r.fileName}]]`;
			sections.push(
				`| ${link} | ${r.recCategory} | ${r.recCuisine} | ${r.recDifficulty} | ${r.recDiet} | ${r.servings} | ${r.recPreptime} | ${r.recRating} | ${r.dateImported} |`
			);
		}

		sections.push("");
		return sections.join("\n");
	}
}
