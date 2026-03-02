import { Notice, Plugin, TFile } from "obsidian";
import { VaultRecipeSettings, DEFAULT_SETTINGS, VaultRecipeSettingTab } from "./settings";
import { AIProviderType } from "./types";
import { createProvider, AIProvider } from "./providers/base";
import { RecipeImporterService } from "./services/recipe-importer";
import { RecipeOverviewService } from "./services/recipe-overview";
import { RecipeScalerService } from "./services/recipe-scaler";
import { RecipeModal } from "./ui/recipe-modal";
import { ScaleModal } from "./ui/scale-modal";

export default class VaultRecipePlugin extends Plugin {
	settings: VaultRecipeSettings;
	private recipeImporterService: RecipeImporterService;
	private recipeScalerService: RecipeScalerService;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.recipeImporterService = new RecipeImporterService(
			this.app,
			this.settings,
			() => this.getChatProvider()
		);

		this.recipeScalerService = new RecipeScalerService(
			this.app,
			this.settings,
			() => this.getChatProvider()
		);

		this.addSettingTab(new VaultRecipeSettingTab(this.app, this));

		this.addCommand({
			id: "vault-recipe-import",
			name: "Import recipe from URL",
			callback: () => {
				new RecipeModal(
					this.app,
					this.recipeImporterService
				).open();
			},
		});

		this.addCommand({
			id: "vault-recipe-overview",
			name: "Generate recipe overview",
			callback: async () => {
				try {
					new Notice("Generating recipe overview...");
					const overviewService = new RecipeOverviewService(
						this.app,
						this.settings
					);
					const file = await overviewService.generateOverview();
					new Notice(`Recipe overview updated: ${file.path}`);
					await this.app.workspace.openLinkText(file.path, "", false);
				} catch (e) {
					new Notice(
						`Error: ${e instanceof Error ? e.message : String(e)}`
					);
				}
			},
		});

		this.addCommand({
			id: "vault-recipe-scale",
			name: "Scale recipe servings",
			editorCallback: async (_editor, ctx) => {
				const file = ctx.file;
				if (!file) {
					new Notice("No active file");
					return;
				}

				const currentServings =
					this.recipeScalerService.getServings(file);
				if (!currentServings) {
					new Notice(
						'No servings found. The note needs a "servings" field in frontmatter.'
					);
					return;
				}

				new ScaleModal(
					this.app,
					currentServings,
					async (newServings) => {
						try {
							new Notice("Scaling recipe...");
							await this.recipeScalerService.scaleRecipe(
								file,
								newServings
							);
							new Notice(
								`Recipe scaled to ${newServings} servings.`
							);
						} catch (e) {
							new Notice(
								`Error: ${e instanceof Error ? e.message : String(e)}`
							);
						}
					}
				).open();
			},
		});
	}

	private getChatProvider(): AIProvider {
		return createProvider(this.settings.defaultProvider, this.settings);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
