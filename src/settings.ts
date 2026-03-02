import { App, PluginSettingTab, Setting } from "obsidian";
import type VaultRecipePlugin from "./main";
import { AIProviderType } from "./types";
import { RecipeLanguage, LANGUAGES } from "./languages";
import {
	fetchOpenAIModels,
	fetchAnthropicModels,
	fetchGoogleModels,
} from "./providers/base";

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

export class VaultRecipeSettingTab extends PluginSettingTab {
	plugin: VaultRecipePlugin;

	constructor(app: App, plugin: VaultRecipePlugin) {
		super(app, plugin);
		this.plugin = plugin;
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

		setting.setDesc("Loading models...");

		setting.addDropdown((dropdown) => {
			dropdown.addOption(currentValue, currentValue);
			dropdown.setValue(currentValue);
			dropdown.onChange(async (value) => {
				this.plugin.settings[settingKey] = value;
				await this.plugin.saveSettings();
			});

			fetchFn(apiKey)
				.then((models) => {
					dropdown.selectEl.empty();
					for (const model of models) {
						dropdown.addOption(model, model);
					}
					if (!models.includes(currentValue)) {
						dropdown.addOption(currentValue, currentValue);
					}
					dropdown.setValue(currentValue);
					setting.setDesc(`${models.length} models available`);
				})
				.catch(() => {
					setting.setDesc("Failed to load models — check API key");
				});
		});
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Vault Recipe Settings" });

		// Security warning
		const warningEl = containerEl.createDiv({ cls: "vault-ai-warning" });
		warningEl.createEl("p", {
			text: "⚠ API keys are stored in your vault folder. Add .obsidian/plugins/vault-recipe/data.json to .gitignore if you sync your vault via Git.",
		});
		warningEl.style.padding = "10px";
		warningEl.style.borderRadius = "5px";
		warningEl.style.marginBottom = "16px";
		warningEl.style.border = "1px solid var(--text-accent)";
		warningEl.style.backgroundColor = "var(--background-secondary)";

		// --- API Keys ---
		containerEl.createEl("h3", { text: "API Keys" });

		new Setting(containerEl)
			.setName("OpenAI API Key")
			.setDesc("Required for OpenAI chat")
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.style.width = "300px";
				text
					.setPlaceholder("sk-...")
					.setValue(this.plugin.settings.openaiApiKey)
					.onChange(async (value) => {
						this.plugin.settings.openaiApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Anthropic API Key")
			.setDesc("Required for Claude chat")
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.style.width = "300px";
				text
					.setPlaceholder("sk-ant-...")
					.setValue(this.plugin.settings.anthropicApiKey)
					.onChange(async (value) => {
						this.plugin.settings.anthropicApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Google API Key")
			.setDesc("Required for Gemini chat")
			.addText((text) => {
				text.inputEl.type = "password";
				text.inputEl.style.width = "300px";
				text
					.setPlaceholder("AI...")
					.setValue(this.plugin.settings.googleApiKey)
					.onChange(async (value) => {
						this.plugin.settings.googleApiKey = value;
						await this.plugin.saveSettings();
					});
			});

		// --- Provider Settings ---
		containerEl.createEl("h3", { text: "Provider Settings" });

		new Setting(containerEl)
			.setName("Default Chat Provider")
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
			.setName("Recipe Language")
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
		containerEl.createEl("h3", { text: "Chat Models" });

		this.addModelDropdown(
			containerEl,
			"OpenAI Chat Model",
			"openaiChatModel",
			this.plugin.settings.openaiApiKey,
			fetchOpenAIModels
		);

		this.addModelDropdown(
			containerEl,
			"Anthropic Chat Model",
			"anthropicChatModel",
			this.plugin.settings.anthropicApiKey,
			fetchAnthropicModels
		);

		this.addModelDropdown(
			containerEl,
			"Google Chat Model",
			"googleChatModel",
			this.plugin.settings.googleApiKey,
			fetchGoogleModels
		);

		// --- Recipe Settings ---
		containerEl.createEl("h3", { text: "Recipe Import" });

		new Setting(containerEl)
			.setName("Recipe folder")
			.setDesc("Folder where imported recipes are saved")
			.addText((text) =>
				text
					.setPlaceholder("Rezepte")
					.setValue(this.plugin.settings.recipeFolder)
					.onChange(async (value) => {
						this.plugin.settings.recipeFolder = value.trim();
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Overview file name")
			.setDesc("Name of the generated recipe overview note (without .md)")
			.addText((text) =>
				text
					.setPlaceholder("Rezept-Übersicht")
					.setValue(this.plugin.settings.overviewFileName)
					.onChange(async (value) => {
						this.plugin.settings.overviewFileName = value.trim();
						await this.plugin.saveSettings();
					})
			);
	}
}
