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

## Key Patterns

- All HTTP requests go through Obsidian's `requestUrl` API (not `fetch`), wrapped in `requestWithRetry`
- AI providers are interchangeable via the factory pattern in `base.ts`
- Recipes are stored as markdown notes with YAML frontmatter (title, servings, category, cuisine, difficulty, diet, preptime, rating, source, image)
- The recipe tag used in frontmatter is language-dependent (e.g., `#rezept` for de, `#recipe` for en)
- TypeScript strict mode: `noImplicitAny` and `strictNullChecks` are enabled
