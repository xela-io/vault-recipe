# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vault Recipe is an Obsidian community plugin that uses AI to import, manage, and organize recipes. It supports three AI providers (OpenAI, Anthropic, Google) and five languages (de, en, fr, es, it).

## Build Commands

```bash
npm run dev      # Development build (with sourcemaps)
npm run build    # Production build (minified, no sourcemaps)
```

Output: `main.js` (CJS bundle built by esbuild from `src/main.ts`). No test or lint tooling is configured.

## Architecture

**Plugin entry point:** `src/main.ts` — `VaultRecipePlugin` extends Obsidian's `Plugin` class, registers four commands (import recipe, scale servings, shopping list, recipe overview).

**Provider layer** (`src/providers/`):
- `base.ts` — `AIProvider` interface (`chatCompletion`, `generateEmbedding`), `createProvider` factory, `requestWithRetry` with exponential backoff for 429s
- `openai.ts` / `anthropic.ts` / `google.ts` — concrete implementations using `requestUrl` from Obsidian (not native fetch)

**Service layer** (`src/services/`):
- `recipe-importer.ts` — Three-stage pipeline: (1) JSON-LD extraction from HTML, (2) AI fallback extraction, (3) AI enhancement (translation, unit conversion, classification). Downloads images.
- `recipe-scaler.ts` — AI-powered ingredient quantity recalculation
- `shopping-list.ts` — Merges ingredients across recipes, AI-powered deduplication, removes staples
- `recipe-overview.ts` — Scans recipe folder, generates Dataview query + static fallback table

**UI layer** (`src/ui/`): Modal classes extending Obsidian's `Modal` and `SuggestModal`.

**Settings:** `src/settings.ts` — `VaultRecipeSettings` interface and settings tab. API keys stored in plugin `data.json`.

**Localization:** `src/languages.ts` — `LanguageConfig` objects keyed by language code. Contains all UI strings and AI prompt templates. Default language is German (de).

**Types:** `src/types.ts` — `AIProviderType` enum, `ChatMessage` and `RecipeData` interfaces.

**Styles:** `styles.css` — All CSS classes prefixed with `.vault-ai-` for namespace isolation. Uses Obsidian CSS variables for theming.

## Key Patterns

- All HTTP requests go through Obsidian's `requestUrl` API (not `fetch`), wrapped in `requestWithRetry`
- AI providers are interchangeable via the factory pattern in `base.ts`
- Services receive a `getChatProvider()` callback (not a singleton) so the provider can be switched dynamically
- Recipes are stored as markdown notes with YAML frontmatter using `rcp_` prefix for fields (e.g., `rcp_servings`, `rcp_category`, `rcp_cuisine`)
- The recipe tag used in frontmatter is language-dependent (e.g., `#rezept` for de, `#recipe` for en)
- TypeScript strict mode: `noImplicitAny` and `strictNullChecks` are enabled
- Localization is deep: `languages.ts` contains not just UI strings but also AI prompt templates and Dataview column aliases. Prompt functions take parameters (e.g., `scalerUser(from, to, ingredients)`)
- Each AI provider has distinct message format adaptations: OpenAI uses standard messages, Anthropic moves system to a separate `system` field, Google maps "assistant" to "model" role and prepends system text to the first user message
- File operations use Obsidian APIs (`getAbstractFileByPath`, `vault.create`, type guards like `child instanceof TFile`)
- User feedback uses Obsidian's `Notice` component; error extraction pattern: `e instanceof Error ? e.message : String(e)`
