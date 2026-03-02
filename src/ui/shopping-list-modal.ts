import { App, Modal, Notice, TFile } from "obsidian";
import { ShoppingListService } from "../services/shopping-list";

export class ShoppingListModal extends Modal {
	private shoppingListService: ShoppingListService;
	private selected: Set<TFile> = new Set();

	constructor(app: App, shoppingListService: ShoppingListService) {
		super(app);
		this.shoppingListService = shoppingListService;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("vault-recipe-shopping-modal");

		contentEl.createEl("h2", { text: "Shopping list from recipes" });

		const recipes = this.shoppingListService.listRecipeNotes();

		if (recipes.length === 0) {
			contentEl.createEl("p", {
				text: 'No recipe notes found. Recipes need a "## Zutaten" section.',
				cls: "vault-ai-no-results",
			});
			return;
		}

		// Recipe list with checkboxes
		const listEl = contentEl.createDiv({
			cls: "vault-recipe-shopping-list",
		});

		for (const file of recipes) {
			const itemEl = listEl.createDiv({
				cls: "vault-recipe-shopping-item",
			});

			const label = itemEl.createEl("label");
			const checkbox = label.createEl("input", { type: "checkbox" });
			label.createSpan({ text: file.basename });

			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selected.add(file);
				} else {
					this.selected.delete(file);
				}
			});
		}

		// Loading indicator (hidden initially)
		const loadingEl = contentEl.createDiv({ cls: "vault-ai-loading" });
		loadingEl.createDiv({ cls: "vault-ai-spinner" });
		loadingEl.createSpan({ text: "Merging ingredients..." });
		loadingEl.hide();

		// Add button
		const btnContainer = contentEl.createDiv({
			cls: "vault-ai-diff-buttons",
		});
		const addBtn = btnContainer.createEl("button", {
			text: "Add to shopping list",
			cls: "vault-ai-search-btn",
		});

		addBtn.addEventListener("click", async () => {
			if (this.selected.size === 0) {
				new Notice("No recipes selected");
				return;
			}

			addBtn.disabled = true;
			loadingEl.show();

			try {
				const entries = await Promise.all(
					Array.from(this.selected).map((file) =>
						this.shoppingListService.parseIngredientsFromNote(file)
					)
				);

				const nonEmpty = entries.filter(
					(e) => e.ingredients.length > 0
				);
				if (nonEmpty.length === 0) {
					new Notice("Selected recipes have no ingredients");
					return;
				}

				const merged =
					await this.shoppingListService.mergeIngredients(nonEmpty);
				const resultFile =
					await this.shoppingListService.appendToShoppingList(merged);

				new Notice(`Shopping list updated: ${resultFile.path}`);
				this.app.workspace.openLinkText(resultFile.path, "", false);
				this.close();
			} catch (e) {
				new Notice(
					`Error: ${e instanceof Error ? e.message : String(e)}`
				);
			} finally {
				addBtn.disabled = false;
				loadingEl.hide();
			}
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
