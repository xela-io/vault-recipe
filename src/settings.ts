import { App, PluginSettingTab, Setting, TFolder, debounce } from "obsidian";
import type VaultRecipePlugin from "./main";
import { AIProviderType } from "./types";
import { RecipeLanguage, LANGUAGES } from "./languages";
import {
	fetchOpenAIModels,
	fetchAnthropicModels,
	fetchGoogleModels,
} from "./providers/base";
import { formatError } from "./utils";

export interface VaultRecipeSettings {
	openaiApiKey: string;
	anthropicApiKey: string;
	googleApiKey: string;
	defaultProvider: AIProviderType;
	openaiChatModel: string;
	anthropicChatModel: string;
	googleChatModel: string;
	recipeLanguage: RecipeLanguage;
	recipeFolder: string;
	overviewFileName: string;
}

export const DEFAULT_SETTINGS: VaultRecipeSettings = {
	openaiApiKey: "",
	anthropicApiKey: "",
	googleApiKey: "",
	defaultProvider: AIProviderType.OpenAI,
	openaiChatModel: "gpt-4o-mini",
	anthropicChatModel: "claude-sonnet-4-20250514",
	googleChatModel: "gemini-2.0-flash",
	recipeLanguage: "de",
	recipeFolder: "Rezepte",
	overviewFileName: "Rezept-Übersicht",
};

/** Cache for fetched model lists, keyed by API key. */
const modelCache = new Map<string, string[]>();

export class VaultRecipeSettingTab extends PluginSettingTab {
	plugin: VaultRecipePlugin;
	private debouncedSave: () => void;

	constructor(app: App, plugin: VaultRecipePlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.debouncedSave = debounce(
			() => { void this.plugin.saveSettings(); },
			500,
			true
		);
	}

	private addModelDropdown(
		containerEl: HTMLElement,
		name: string,
		settingKey:
			| "openaiChatModel"
			| "anthropicChatModel"
			| "googleChatModel",
		apiKey: string,
		fetchFn: (apiKey: string) => Promise<string[]>
	): void {
		const setting = new Setting(containerEl).setName(name);
		const currentValue = this.plugin.settings[settingKey];

		if (!apiKey) {
			setting.setDesc("Enter API key to load available models");
			setting.addDropdown((dropdown) => {
				dropdown.addOption(currentValue, currentValue);
				dropdown.setValue(currentValue);
				dropdown.setDisabled(true);
			});
			return;
		}

		setting.addDropdown((dropdown) => {
			dropdown.addOption(currentValue, currentValue);
			dropdown.setValue(currentValue);
			dropdown.onChange(async (value) => {
				this.plugin.settings[settingKey] = value;
				await this.plugin.saveSettings();
			});

			const cached = modelCache.get(apiKey);
			if (cached) {
				this.populateModelDropdown(dropdown, cached, currentValue, setting);
			} else {
				setting.setDesc("Loading models...");
				fetchFn(apiKey)
					.then((models) => {
						modelCache.set(apiKey, models);
						this.populateModelDropdown(dropdown, models, currentValue, setting);
					})
					.catch((e: unknown) => {
						console.error(
							`[Vault Recipe] Failed to fetch models for ${settingKey}:`,
							e
						);
						setting.setDesc(`Failed to load models: ${formatError(e)}`);
					});
			}
		});
	}

	private populateModelDropdown(
		dropdown: { selectEl: HTMLSelectElement; addOption: (value: string, display: string) => unknown; setValue: (value: string) => unknown },
		models: string[],
		currentValue: string,
		setting: Setting
	): void {
		dropdown.selectEl.empty();
		for (const model of models) {
			dropdown.addOption(model, model);
		}
		if (!models.includes(currentValue)) {
			dropdown.addOption(currentValue, currentValue);
		}
		dropdown.setValue(currentValue);
		setting.setDesc(`${models.length} models available`);
	}

	private addApiKeyField(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		key: "openaiApiKey" | "anthropicApiKey" | "googleApiKey",
		placeholder: string
	): void {
		new Setting(containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.addClass("vault-ai-apikey-input");
				text
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings[key])
					.onChange((value) => {
						this.plugin.settings[key] = value;
						this.debouncedSave();
					});
			});
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Vault Recipe settings").setHeading();

		// Security warning
		const configDir = this.app.vault.configDir;
		const warningEl = containerEl.createDiv({ cls: "vault-ai-warning" });
		warningEl.createEl("p", {
			text: `⚠ API keys are stored in your vault folder. Add ${configDir}/plugins/vault-recipe/data.json to .gitignore if you sync your vault via Git.`,
		});
		// --- API Keys ---
		new Setting(containerEl).setName("API keys").setHeading();

		this.addApiKeyField(containerEl, "OpenAI API key", "Required for OpenAI chat", "openaiApiKey", "sk-...");
		this.addApiKeyField(containerEl, "Anthropic API key", "Required for Claude chat", "anthropicApiKey", "sk-ant-...");
		this.addApiKeyField(containerEl, "Google API key", "Required for Gemini chat", "googleApiKey", "AI...");

		// --- Provider Settings ---
		new Setting(containerEl).setName("Provider settings").setHeading();

		new Setting(containerEl)
			.setName("Default chat provider")
			.setDesc("Which AI provider to use for recipe extraction")
			.addDropdown((dropdown) =>
				dropdown
					.addOption(AIProviderType.OpenAI, "OpenAI")
					.addOption(AIProviderType.Anthropic, "Anthropic (Claude)")
					.addOption(AIProviderType.Google, "Google (Gemini)")
					.setValue(this.plugin.settings.defaultProvider)
					.onChange(async (value) => {
						this.plugin.settings.defaultProvider =
							value as AIProviderType;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Recipe language")
			.setDesc("Language for recipes and AI prompts")
			.addDropdown((dropdown) => {
				for (const [key, lang] of Object.entries(LANGUAGES)) {
					dropdown.addOption(key, lang.displayName);
				}
				dropdown
					.setValue(this.plugin.settings.recipeLanguage)
					.onChange(async (value) => {
						this.plugin.settings.recipeLanguage =
							value as RecipeLanguage;
						await this.plugin.saveSettings();
					});
			});

		// --- Model Settings ---
		new Setting(containerEl).setName("Models").setHeading();

		this.addModelDropdown(
			containerEl,
			"OpenAI model",
			"openaiChatModel",
			this.plugin.settings.openaiApiKey,
			fetchOpenAIModels
		);

		this.addModelDropdown(
			containerEl,
			"Anthropic model",
			"anthropicChatModel",
			this.plugin.settings.anthropicApiKey,
			fetchAnthropicModels
		);

		this.addModelDropdown(
			containerEl,
			"Google model",
			"googleChatModel",
			this.plugin.settings.googleApiKey,
			fetchGoogleModels
		);

		// --- Recipe Settings ---
		new Setting(containerEl).setName("Recipe import").setHeading();

		new Setting(containerEl)
			.setName("Recipe folder")
			.setDesc("Folder where imported recipes are saved")
			.addDropdown((dropdown) => {
				const folders = this.app.vault
					.getAllLoadedFiles()
					.filter((f): f is TFolder => f instanceof TFolder)
					.map((f) => f.path)
					.sort((a, b) => a.localeCompare(b));

				for (const folder of folders) {
					dropdown.addOption(folder, folder);
				}

				const current = this.plugin.settings.recipeFolder;
				if (!folders.includes(current)) {
					dropdown.addOption(current, `${current} (new)`);
				}

				dropdown.setValue(current);
				dropdown.onChange(async (value) => {
					this.plugin.settings.recipeFolder = value;
					await this.plugin.saveSettings();
				});
			});

		new Setting(containerEl)
			.setName("Overview file name")
			.setDesc("Name of the generated recipe overview note (without .md)")
			.addText((text) =>
				text
					.setPlaceholder("Rezept-Übersicht")
					.setValue(this.plugin.settings.overviewFileName)
					.onChange((value) => {
						this.plugin.settings.overviewFileName = value.trim();
						this.debouncedSave();
					})
			);
	}
}
