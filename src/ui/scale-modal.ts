import { App, Modal } from "obsidian";

export class ScaleModal extends Modal {
	private currentServings: number;
	private onSubmit: (newServings: number) => void;

	constructor(
		app: App,
		currentServings: number,
		onSubmit: (newServings: number) => void
	) {
		super(app);
		this.currentServings = currentServings;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("vault-ai-scale-modal");

		contentEl.createEl("h2", { text: "Scale recipe" });

		contentEl.createEl("p", {
			text: `Current servings: ${this.currentServings}`,
			cls: "vault-ai-recipe-meta",
		});

		const inputContainer = contentEl.createDiv({
			cls: "vault-ai-search-container",
		});

		const input = inputContainer.createEl("input", {
			type: "number",
			placeholder: "New servings...",
			cls: "vault-ai-recipe-input",
		});
		input.min = "1";
		input.value = String(this.currentServings);

		const submitBtn = inputContainer.createEl("button", {
			text: "Umrechnen",
			cls: "vault-ai-search-btn mod-cta",
		});

		const doSubmit = () => {
			const value = parseInt(input.value, 10);
			if (!value || value < 1) return;
			this.onSubmit(value);
			this.close();
		};

		submitBtn.addEventListener("click", doSubmit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") doSubmit();
		});

		input.focus();
		input.select();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
