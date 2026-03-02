# Vault Recipe

AI-powered recipe management for [Obsidian](https://obsidian.md). Import recipes from any URL, scale servings, generate shopping lists, and create recipe overviews — all inside your vault.

*KI-gestützte Rezeptverwaltung für Obsidian. Importiere Rezepte von beliebigen URLs, skaliere Portionen, erstelle Einkaufslisten und generiere Rezeptübersichten — alles direkt in deinem Vault.*

## Features

- **Recipe Import** — Paste a URL, and the plugin extracts the recipe using AI. Automatically translates to German and converts to metric units.
- **Scale Servings** — Adjust ingredient quantities to any number of servings with a single command.
- **Shopping List** — Select recipes and generate a merged, deduplicated shopping list as a note in your vault.
- **Recipe Overview** — Auto-generate an overview note that lists all recipes in your recipe folder with metadata.

## Screenshots

<!-- TODO: Add screenshots -->

## Installation

### Community Plugin Browser (recommended)

1. Open **Settings → Community plugins → Browse**
2. Search for **Vault Recipe**
3. Click **Install**, then **Enable**

### Manual Installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/xela-io/vault-recipe/releases/latest)
2. Create a folder `vault-recipe` inside your vault's `.obsidian/plugins/` directory
3. Copy the three files into that folder
4. Enable the plugin in **Settings → Community plugins**

## Configuration

Open **Settings → Vault Recipe** to configure the plugin.

### API Keys

This plugin requires an API key from at least one of the following providers:

| Provider | Setting | Models |
|----------|---------|--------|
| OpenAI | `OpenAI API Key` | gpt-4o-mini (default) |
| Anthropic | `Anthropic API Key` | claude-sonnet-4-20250514 (default) |
| Google | `Google API Key` | gemini-2.0-flash (default) |

Select your preferred provider under **Default Chat Provider**. You can also customize which model each provider uses.

### Recipe Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Recipe folder | `Rezepte` | Folder where imported recipes are saved |
| Overview file name | `Rezept-Übersicht` | Name of the generated overview note |
| Shopping list note | `Einkaufsliste.md` | Path to the shopping list note |

## Usage

All commands are available via the Command Palette (`Ctrl/Cmd + P`):

### Import recipe from URL
`Vault Recipe: Import recipe from URL`

Opens a dialog where you paste a recipe URL. The plugin fetches the page, extracts the recipe via AI, translates it to German, converts imperial to metric units, and saves it as a note in your recipe folder.

### Scale recipe servings
`Vault Recipe: Scale recipe servings`

*(Editor command — requires an open recipe note)*

Reads the current servings from frontmatter and lets you choose a new serving count. All ingredient quantities are recalculated by AI.

### Add ingredients to shopping list
`Vault Recipe: Add ingredients to shopping list`

*(Editor command — requires an open recipe note)*

Parses the ingredients from the current note and appends them to your shopping list, merging duplicates intelligently.

### Shopping list from recipes
`Vault Recipe: Shopping list from recipes`

Opens a dialog to select multiple recipes. Their ingredients are merged into a single shopping list with checkboxes.

### Generate recipe overview
`Vault Recipe: Generate recipe overview`

Scans your recipe folder and generates (or updates) an overview note with links and metadata for all recipes.

## Network Disclosure

This plugin makes network requests to external AI APIs to process recipes. Depending on your chosen provider, data is sent to:

- **OpenAI** (`api.openai.com`)
- **Anthropic** (`api.anthropic.com`)
- **Google** (`generativelanguage.googleapis.com`)

Recipe URLs are fetched directly to extract their content. No data is collected or stored by the plugin itself — all processing happens via the configured AI provider.

## License

[MIT](LICENSE)
