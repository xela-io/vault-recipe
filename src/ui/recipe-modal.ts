import { App, Modal, Notice } from "obsidian";
import { RecipeData } from "../types";
import { RecipeImporterService } from "../services/recipe-importer";
import { LanguageConfig } from "../languages";
import { formatError } from "../utils";

export class RecipeModal extends Modal {
	private recipeService: RecipeImporterService;
	private lang: LanguageConfig;
	private recipeData: RecipeData | null = null;
	private overwriteConfirmed = false;

	constructor(app: App, recipeService: RecipeImporterService, lang: LanguageConfig) {
		super(app);
		this.recipeService = recipeService;
		this.lang = lang;
	}

	onOpen(): void {
		const { contentEl } = this;
		const lang = this.lang;
		contentEl.addClass("vault-ai-recipe-modal");

		contentEl.createEl("h2", { text: lang.modalImportTitle });

		// URL input
		const inputContainer = contentEl.createDiv({
			cls: "vault-ai-search-container",
		});
		const urlInput = inputContainer.createEl("input", {
			type: "url",
			placeholder: "https://example.com/recipe...",
			cls: "vault-ai-recipe-input",
		});
		urlInput.setAttribute("aria-label", lang.modalImportTitle);

		const importBtn = inputContainer.createEl("button", {
			text: lang.modalImportBtn,
			cls: "vault-ai-search-btn",
		});

		// Loading indicator
		const loadingEl = contentEl.createDiv({
			cls: "vault-ai-loading",
		});
		loadingEl.setAttribute("role", "status");
		loadingEl.setAttribute("aria-live", "polite");
		loadingEl.createDiv({ cls: "vault-ai-spinner" });
		const loadingText = loadingEl.createSpan({ text: lang.modalExtracting });
		loadingEl.hide();

		// Error display
		const errorEl = contentEl.createDiv({ cls: "vault-ai-error" });
		errorEl.setAttribute("role", "alert");
		errorEl.hide();

		// Warning display (for overwrite confirmation)
		const warningEl = contentEl.createDiv({ cls: "vault-ai-overwrite-warning" });
		warningEl.setAttribute("role", "alert");
		warningEl.hide();

		// Preview area
		const previewEl = contentEl.createDiv({
			cls: "vault-ai-recipe-preview",
		});
		previewEl.hide();

		// Button bar
		const buttonBar = contentEl.createDiv({
			cls: "vault-ai-diff-buttons",
		});
		buttonBar.hide();

		const cancelBtn = buttonBar.createEl("button", {
			text: lang.modalCancel,
			cls: "vault-ai-btn-cancel",
		});

		const saveBtn = buttonBar.createEl("button", {
			text: lang.modalSave,
			cls: "vault-ai-btn-apply mod-cta",
		});

		const doImport = async () => {
			const url = urlInput.value.trim();
			if (!url) return;

			// Validate URL format
			let parsedUrl: URL;
			try {
				parsedUrl = new URL(url);
			} catch {
				errorEl.textContent = lang.modalInvalidUrl;
				errorEl.show();
				return;
			}

			// Validate protocol (security: only allow http/https)
			if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
				errorEl.textContent = lang.modalProtocolError;
				errorEl.show();
				return;
			}

			// Validate API key is configured before starting
			if (!this.recipeService.isProviderConfigured()) {
				errorEl.textContent = lang.modalNoApiKey;
				errorEl.show();
				return;
			}

			errorEl.hide();
			warningEl.hide();
			previewEl.hide();
			buttonBar.hide();
			this.overwriteConfirmed = false;

			// Stage 1: Fetching
			loadingText.textContent = lang.modalFetching;
			loadingEl.show();
			importBtn.disabled = true;

			try {
				const html = await this.recipeService.fetchRecipePage(url);

				// Stage 2: AI analysis
				loadingText.textContent = lang.modalAnalyzing;

				const recipe = await this.recipeService.extractRecipe(html, url);
				this.recipeData = recipe;

				this.renderPreview(previewEl, recipe);
				previewEl.show();
				buttonBar.show();
				saveBtn.textContent = lang.modalSave;
				saveBtn.classList.remove("mod-warning");
			} catch (e) {
				errorEl.textContent = `Error: ${formatError(e)}`;
				errorEl.show();
			} finally {
				loadingEl.hide();
				importBtn.disabled = false;
			}
		};

		importBtn.addEventListener("click", doImport);
		urlInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") doImport();
		});

		cancelBtn.addEventListener("click", () => this.close());

		saveBtn.addEventListener("click", async () => {
			if (!this.recipeData) return;

			// Check for existing recipe (first click shows warning, second click confirms)
			if (!this.overwriteConfirmed) {
				const existing = this.recipeService.getExistingRecipeFile(this.recipeData.title);
				if (existing) {
					warningEl.textContent = lang.modalOverwriteWarning;
					warningEl.show();
					saveBtn.textContent = lang.modalOverwrite;
					saveBtn.classList.add("mod-warning");
					this.overwriteConfirmed = true;
					return;
				}
			}

			try {
				saveBtn.disabled = true;
				buttonBar.hide();

				if (this.recipeData.imageUrl) {
					loadingText.textContent = lang.modalDownloadingImage;
					loadingEl.show();
				}

				loadingText.textContent = lang.modalSavingRecipe;
				loadingEl.show();

				const result = await this.recipeService.createRecipeNote(
					this.recipeData
				);
				loadingEl.hide();
				if (result.imageFailed) {
					new Notice(lang.modalImageFailed);
				}
				new Notice(`Recipe saved: ${result.file.path}`);
				await this.app.workspace.openLinkText(result.file.path, "", false);
				this.close();
			} catch (e) {
				loadingEl.hide();
				buttonBar.show();
				new Notice(`Error saving recipe: ${formatError(e)}`);
				saveBtn.disabled = false;
				saveBtn.textContent = lang.modalSave;
			}
		});

		urlInput.focus();
	}

	private renderPreview(container: HTMLElement, recipe: RecipeData): void {
		const lang = this.lang;
		container.empty();

		// Image preview
		if (recipe.imageUrl) {
			const img = container.createEl("img", {
				cls: "vault-ai-recipe-preview-img",
			});
			img.src = recipe.imageUrl;
			img.alt = recipe.title;
		}

		container.createEl("h3", { text: recipe.title });

		// Metadata
		const meta: string[] = [];
		if (recipe.servings) meta.push(recipe.servings);
		if (recipe.recPreptime) meta.push(`${lang.dvTime}: ${recipe.recPreptime}`);
		if (recipe.recDiet) meta.push(`${lang.dvDiet}: ${recipe.recDiet}`);
		if (recipe.recCategory) meta.push(`${lang.dvCategory}: ${recipe.recCategory}`);
		if (recipe.recCuisine) meta.push(`${lang.dvCuisine}: ${recipe.recCuisine}`);
		if (recipe.recDifficulty) meta.push(`${lang.dvDifficulty}: ${recipe.recDifficulty}`);
		if (meta.length > 0) {
			container.createEl("p", {
				text: meta.join(" | "),
				cls: "vault-ai-recipe-meta",
			});
		}

		// Ingredients
		if (recipe.ingredients.length > 0) {
			container.createEl("h4", { text: lang.ingredientsHeading });
			const ul = container.createEl("ul");
			for (const ingredient of recipe.ingredients) {
				ul.createEl("li", { text: ingredient });
			}
		}

		// Steps
		if (recipe.steps.length > 0) {
			container.createEl("h4", { text: lang.stepsHeading });
			const ol = container.createEl("ol");
			for (const step of recipe.steps) {
				ol.createEl("li", { text: step });
			}
		}

		// Notes
		if (recipe.notes) {
			container.createEl("h4", { text: lang.notesHeading });
			container.createEl("p", { text: recipe.notes });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
