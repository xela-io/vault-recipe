import { App, Modal, Notice } from "obsidian";
import { RecipeData } from "../types";
import { RecipeImporterService } from "../services/recipe-importer";

export class RecipeModal extends Modal {
	private recipeService: RecipeImporterService;
	private recipeData: RecipeData | null = null;

	constructor(app: App, recipeService: RecipeImporterService) {
		super(app);
		this.recipeService = recipeService;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("vault-ai-recipe-modal");

		contentEl.createEl("h2", { text: "Import Recipe from URL" });

		// URL input
		const inputContainer = contentEl.createDiv({
			cls: "vault-ai-search-container",
		});
		const urlInput = inputContainer.createEl("input", {
			type: "url",
			placeholder: "https://example.com/recipe...",
			cls: "vault-ai-recipe-input",
		});
		const importBtn = inputContainer.createEl("button", {
			text: "Import",
			cls: "vault-ai-search-btn",
		});

		// Loading indicator
		const loadingEl = contentEl.createDiv({
			cls: "vault-ai-loading",
		});
		loadingEl.createDiv({ cls: "vault-ai-spinner" });
		loadingEl.createSpan({ text: "Extracting recipe..." });
		loadingEl.hide();

		// Error display
		const errorEl = contentEl.createDiv({ cls: "vault-ai-error" });
		errorEl.hide();

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
			text: "Cancel",
			cls: "vault-ai-btn-cancel",
		});

		const saveBtn = buttonBar.createEl("button", {
			text: "Save",
			cls: "vault-ai-btn-apply mod-cta",
		});

		const doImport = async () => {
			const url = urlInput.value.trim();
			if (!url) return;

			try {
				new URL(url);
			} catch {
				errorEl.textContent = "Please enter a valid URL.";
				errorEl.show();
				return;
			}

			errorEl.hide();
			previewEl.hide();
			buttonBar.hide();
			loadingEl.show();
			importBtn.disabled = true;

			try {
				const html = await this.recipeService.fetchRecipePage(url);
				const recipe = await this.recipeService.extractRecipe(html, url);
				this.recipeData = recipe;

				this.renderPreview(previewEl, recipe);
				previewEl.show();
				buttonBar.show();
			} catch (e) {
				errorEl.textContent = `Error: ${e instanceof Error ? e.message : String(e)}`;
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

			try {
				saveBtn.disabled = true;
				saveBtn.textContent = "Saving...";
				const file = await this.recipeService.createRecipeNote(
					this.recipeData
				);
				new Notice(`Recipe saved: ${file.path}`);
				await this.app.workspace.openLinkText(file.path, "", false);
				this.close();
			} catch (e) {
				new Notice(
					`Error saving recipe: ${e instanceof Error ? e.message : String(e)}`
				);
				saveBtn.disabled = false;
				saveBtn.textContent = "Save";
			}
		});

		urlInput.focus();
	}

	private renderPreview(container: HTMLElement, recipe: RecipeData): void {
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
		if (recipe.recPreptime) meta.push(`Zeit: ${recipe.recPreptime}`);
		if (recipe.recDiet) meta.push(`Ernährung: ${recipe.recDiet}`);
		if (recipe.recCategory) meta.push(`Kategorie: ${recipe.recCategory}`);
		if (recipe.recCuisine) meta.push(`Küche: ${recipe.recCuisine}`);
		if (recipe.recDifficulty) meta.push(`Schwierigkeit: ${recipe.recDifficulty}`);
		if (meta.length > 0) {
			container.createEl("p", {
				text: meta.join(" | "),
				cls: "vault-ai-recipe-meta",
			});
		}

		// Ingredients
		if (recipe.ingredients.length > 0) {
			container.createEl("h4", { text: "Zutaten" });
			const ul = container.createEl("ul");
			for (const ingredient of recipe.ingredients) {
				ul.createEl("li", { text: ingredient });
			}
		}

		// Steps
		if (recipe.steps.length > 0) {
			container.createEl("h4", { text: "Zubereitung" });
			const ol = container.createEl("ol");
			for (const step of recipe.steps) {
				ol.createEl("li", { text: step });
			}
		}

		// Notes
		if (recipe.notes) {
			container.createEl("h4", { text: "Notizen" });
			container.createEl("p", { text: recipe.notes });
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
