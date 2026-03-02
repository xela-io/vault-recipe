import { App, TFile, TFolder } from "obsidian";
import { VaultRecipeSettings } from "../settings";

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
		const folder = this.app.vault.getAbstractFileByPath(
			this.settings.recipeFolder
		);
		if (!folder || !(folder instanceof TFolder)) return [];

		const recipes: RecipeMeta[] = [];
		const overviewName = this.settings.overviewFileName || "Rezept-Übersicht";

		for (const child of folder.children) {
			if (!(child instanceof TFile) || child.extension !== "md") continue;
			if (child.basename === overviewName) continue;

			const cache = this.app.metadataCache.getFileCache(child);
			const fm = cache?.frontmatter;
			if (!fm || !fm.tags?.includes("rezept")) {
				// Also check tags array format
				const hasTags =
					fm &&
					(fm.tags === "rezept" ||
						(Array.isArray(fm.tags) && fm.tags.includes("rezept")));
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
		const sections: string[] = [];

		// Header
		sections.push("# Rezept-Übersicht\n");
		sections.push(
			`> Automatisch generiert. ${recipes.length} Rezepte gefunden.\n`
		);

		// Dataview section
		sections.push("## Alle Rezepte (Dataview)\n");
		sections.push(
			"> Benötigt das [Dataview](https://github.com/blacksmithgu/obsidian-dataview)-Plugin.\n"
		);
		sections.push("```dataview");
		sections.push("TABLE");
		sections.push('  rec_category AS "Kategorie",');
		sections.push('  rec_cuisine AS "Küche",');
		sections.push('  rec_difficulty AS "Schwierigkeit",');
		sections.push('  rec_diet AS "Ernährung",');
		sections.push('  servings AS "Portionen",');
		sections.push('  rec_preptime AS "Zeit",');
		sections.push('  rec_rating AS "Bewertung",');
		sections.push('  date_imported AS "Importiert"');
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push("WHERE contains(tags, \"rezept\")");
		sections.push("SORT title ASC");
		sections.push("```\n");

		// Filter examples
		sections.push("## Filterbeispiele\n");

		sections.push("### Hauptgerichte\n");
		sections.push("```dataview");
		sections.push("TABLE rec_cuisine AS \"Küche\", rec_difficulty AS \"Schwierigkeit\", rec_preptime AS \"Zeit\"");
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push("WHERE rec_category = \"Hauptgericht\"");
		sections.push("SORT title ASC");
		sections.push("```\n");

		sections.push("### Vegetarische Rezepte\n");
		sections.push("```dataview");
		sections.push("TABLE rec_category AS \"Kategorie\", rec_cuisine AS \"Küche\", rec_preptime AS \"Zeit\"");
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push("WHERE rec_diet = \"vegetarisch\" OR rec_diet = \"vegan\"");
		sections.push("SORT title ASC");
		sections.push("```\n");

		sections.push("### Einfache Rezepte\n");
		sections.push("```dataview");
		sections.push("TABLE rec_category AS \"Kategorie\", rec_cuisine AS \"Küche\", rec_preptime AS \"Zeit\"");
		sections.push(`FROM "${this.settings.recipeFolder}"`);
		sections.push("WHERE rec_difficulty = \"einfach\"");
		sections.push("SORT title ASC");
		sections.push("```\n");

		// Static table
		sections.push("## Statische Übersicht\n");
		sections.push(
			"> Fallback für Nutzer ohne Dataview-Plugin. Wird bei jeder Generierung aktualisiert.\n"
		);

		sections.push(
			"| Rezept | Kategorie | Küche | Schwierigkeit | Ernährung | Portionen | Zeit | Bewertung | Importiert |"
		);
		sections.push(
			"|--------|-----------|-------|---------------|-----------|-----------|------|-----------|------------|"
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
