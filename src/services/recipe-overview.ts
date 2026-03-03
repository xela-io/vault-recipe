import { App, TFile, TFolder } from "obsidian";
import { VaultRecipeSettings } from "../settings";
import { getLanguageConfig } from "../languages";
import { FM } from "../constants";
import { ensureFolder, createOrUpdateFile } from "../utils";

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

	async generateOverview(): Promise<{ file: TFile; recipeCount: number }> {
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const recipes = this.collectRecipes();
		const content = this.buildOverviewContent(recipes);

		const folder = this.settings.recipeFolder;
		const fileName = this.settings.overviewFileName || lang.overviewTitle;
		const filePath = `${folder}/${fileName}.md`;

		await ensureFolder(this.app, folder);

		const file = await createOrUpdateFile(this.app, filePath, content);
		return { file, recipeCount: recipes.length };
	}

	private hasRecipeTag(tags: unknown, tag: string): boolean {
		if (Array.isArray(tags)) return tags.includes(tag);
		return tags === tag;
	}

	private collectRecipes(): RecipeMeta[] {
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const folder = this.app.vault.getAbstractFileByPath(
			this.settings.recipeFolder
		);
		if (!folder || !(folder instanceof TFolder)) return [];

		const recipes: RecipeMeta[] = [];
		const overviewName = this.settings.overviewFileName || lang.overviewTitle;

		this.collectRecipesRecursive(folder, recipes, overviewName, lang);

		recipes.sort((a, b) => a.title.localeCompare(b.title, this.settings.recipeLanguage));
		return recipes;
	}

	private collectRecipesRecursive(
		folder: TFolder,
		recipes: RecipeMeta[],
		overviewName: string,
		lang: ReturnType<typeof getLanguageConfig>
	): void {
		for (const child of folder.children) {
			if (child instanceof TFolder) {
				this.collectRecipesRecursive(child, recipes, overviewName, lang);
				continue;
			}

			if (!(child instanceof TFile) || child.extension !== "md") continue;
			if (child.basename === overviewName) continue;

			const cache = this.app.metadataCache.getFileCache(child);
			const fm = cache?.frontmatter;
			if (!fm || !this.hasRecipeTag(fm[FM.TAGS], lang.tag)) continue;

			recipes.push({
				fileName: child.basename,
				title: String(fm[FM.TITLE] || child.basename),
				servings: String(fm[FM.SERVINGS] || ""),
				recPreptime: String(fm[FM.PREPTIME] || ""),
				recDiet: String(fm[FM.DIET] || ""),
				recCategory: String(fm[FM.CATEGORY] || ""),
				recCuisine: String(fm[FM.CUISINE] || ""),
				recDifficulty: String(fm[FM.DIFFICULTY] || ""),
				recRating: Number(fm[FM.RATING] ?? 0),
				dateImported: String(fm[FM.DATE_IMPORTED] || ""),
			});
		}
	}

	private buildOverviewContent(recipes: RecipeMeta[]): string {
		const lang = getLanguageConfig(this.settings.recipeLanguage);
		const sections: string[] = [];
		const folder = this.settings.recipeFolder;

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
		sections.push(`  ${FM.CATEGORY} AS "${lang.dvCategory}",`);
		sections.push(`  ${FM.CUISINE} AS "${lang.dvCuisine}",`);
		sections.push(`  ${FM.DIFFICULTY} AS "${lang.dvDifficulty}",`);
		sections.push(`  ${FM.DIET} AS "${lang.dvDiet}",`);
		sections.push(`  ${FM.SERVINGS} AS "${lang.dvServings}",`);
		sections.push(`  ${FM.PREPTIME} AS "${lang.dvTime}",`);
		sections.push(`  ${FM.RATING} AS "${lang.dvRating}",`);
		sections.push(`  ${FM.DATE_IMPORTED} AS "${lang.dvImported}"`);
		sections.push(`FROM "${folder}"`);
		sections.push(`WHERE contains(tags, "${lang.tag}")`);
		sections.push("SORT title ASC");
		sections.push("```\n");

		// Filter examples
		sections.push(`## ${lang.overviewFilterExamples}\n`);

		const mainCourseLabel = lang.categoryLabels.split("/")[1] || "Main Course";
		this.addFilterQuery(sections, lang.overviewMainCourses, `WHERE ${FM.CATEGORY} = "${mainCourseLabel}"`, folder, lang);

		const dietParts = lang.dietLabels.split("/");
		this.addFilterQuery(sections, lang.overviewVegetarian, `WHERE ${FM.DIET} = "${dietParts[1] || "vegetarian"}" OR ${FM.DIET} = "${dietParts[0] || "vegan"}"`, folder, lang);

		const easyLabel = lang.difficultyLabels.split("/")[0] || "easy";
		this.addFilterQuery(sections, lang.overviewEasy, `WHERE ${FM.DIFFICULTY} = "${easyLabel}"`, folder, lang);

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

	private addFilterQuery(sections: string[], title: string, whereClause: string, folder: string, lang: ReturnType<typeof getLanguageConfig>): void {
		sections.push(`### ${title}\n`);
		sections.push("```dataview");
		sections.push(`TABLE ${FM.CUISINE} AS "${lang.dvCuisine}", ${FM.DIFFICULTY} AS "${lang.dvDifficulty}", ${FM.PREPTIME} AS "${lang.dvTime}"`);
		sections.push(`FROM "${folder}"`);
		sections.push(whereClause);
		sections.push("SORT title ASC");
		sections.push("```\n");
	}
}
