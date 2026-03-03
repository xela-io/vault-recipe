import { Notice, Plugin } from "obsidian";
import { VaultRecipeSettings, DEFAULT_SETTINGS, VaultRecipeSettingTab } from "./settings";
import { createProvider, AIProvider } from "./providers/base";
import { RecipeImporterService } from "./services/recipe-importer";
import { RecipeOverviewService } from "./services/recipe-overview";
import { RecipeScalerService } from "./services/recipe-scaler";
import { RecipeModal } from "./ui/recipe-modal";
import { ScaleModal } from "./ui/scale-modal";
import { getLanguageConfig } from "./languages";
import { formatError } from "./utils";

export default class VaultRecipePlugin extends Plugin {
	settings!: VaultRecipeSettings;
	private recipeImporterService!: RecipeImporterService;
	private recipeScalerService!: RecipeScalerService;
	private recipeOverviewService!: RecipeOverviewService;
	private cachedProvider: AIProvider | null = null;

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

		this.recipeOverviewService = new RecipeOverviewService(
			this.app,
			this.settings
		);

		this.addSettingTab(new VaultRecipeSettingTab(this.app, this));

		this.addCommand({
			id: "import",
			name: "Import recipe from URL",
			callback: () => {
				const lang = getLanguageConfig(this.settings.recipeLanguage);
				new RecipeModal(
					this.app,
					this.recipeImporterService,
					lang
				).open();
			},
		});

		this.addCommand({
			id: "overview",
			name: "Generate recipe overview",
			callback: async () => {
				try {
					const lang = getLanguageConfig(this.settings.recipeLanguage);
					new Notice("Generating recipe overview...");
					const { file, recipeCount } = await this.recipeOverviewService.generateOverview();
					if (recipeCount === 0) {
						new Notice(lang.overviewEmpty);
					} else {
						new Notice(`Recipe overview updated: ${file.path}`);
					}
					await this.app.workspace.openLinkText(file.path, "", false);
				} catch (e) {
					new Notice(`Error: ${formatError(e)}`);
				}
			},
		});

		this.addCommand({
			id: "scale",
			name: "Scale recipe servings",
			editorCallback: (_editor, ctx) => {
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

				const lang = getLanguageConfig(this.settings.recipeLanguage);
				new ScaleModal(
					this.app,
					currentServings,
					async (newServings) => {
						await this.recipeScalerService.scaleRecipe(
							file,
							newServings
						);
					},
					lang
				).open();
			},
		});
	}

	private getChatProvider(): AIProvider {
		if (!this.cachedProvider) {
			this.cachedProvider = createProvider(this.settings.defaultProvider, this.settings);
		}
		return this.cachedProvider;
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<VaultRecipeSettings> | undefined
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		this.cachedProvider = null;
	}
}
