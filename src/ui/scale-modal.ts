import { App, Modal, Notice } from "obsidian";
import { LanguageConfig } from "../languages";
import { formatError } from "../utils";

export class ScaleModal extends Modal {
	private currentServings: number;
	private onSubmit: (newServings: number) => Promise<void>;
	private lang: LanguageConfig;

	constructor(
		app: App,
		currentServings: number,
		onSubmit: (newServings: number) => Promise<void>,
		lang: LanguageConfig
	) {
		super(app);
		this.currentServings = currentServings;
		this.onSubmit = onSubmit;
		this.lang = lang;
	}

	onOpen(): void {
		const { contentEl } = this;
		const lang = this.lang;
		contentEl.addClass("vault-ai-scale-modal");

		contentEl.createEl("h2", { text: lang.modalScaleTitle });

		contentEl.createEl("p", {
			text: lang.modalCurrentServings(this.currentServings),
			cls: "vault-ai-recipe-meta",
		});

		const inputContainer = contentEl.createDiv({
			cls: "vault-ai-search-container",
		});

		const input = inputContainer.createEl("input", {
			type: "number",
			placeholder: lang.modalNewServings,
			cls: "vault-ai-recipe-input",
		});
		input.min = "1";
		input.step = "1";
		input.value = String(this.currentServings);
		input.setAttribute("aria-label", lang.modalNewServings);

		const submitBtn = inputContainer.createEl("button", {
			text: lang.modalScaleBtn,
			cls: "vault-ai-search-btn mod-cta",
		});

		const doSubmit = async () => {
			const value = parseInt(input.value, 10);
			if (!value || value < 1) return;

			submitBtn.disabled = true;
			input.disabled = true;
			submitBtn.textContent = lang.modalScaling;

			try {
				await this.onSubmit(value);
				new Notice(lang.modalScaleSuccess(value));
				this.close();
			} catch (e) {
				new Notice(`Error: ${formatError(e)}`);
				submitBtn.disabled = false;
				input.disabled = false;
				submitBtn.textContent = lang.modalScaleBtn;
			}
		};

		submitBtn.addEventListener("click", () => void doSubmit());
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") void doSubmit();
		});

		input.focus();
		input.select();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
