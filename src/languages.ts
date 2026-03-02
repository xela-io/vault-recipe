export type RecipeLanguage = "de" | "en" | "fr" | "es" | "it";

export interface LanguageConfig {
	/** Display name for settings dropdown */
	displayName: string;
	/** Section headings in generated notes */
	ingredientsHeading: string;
	stepsHeading: string;
	notesHeading: string;
	/** Tag added to recipe notes */
	tag: string;
	/** AI prompt fragments */
	translateInstruction: string;
	dietLabels: string;
	categoryLabels: string;
	difficultyLabels: string;
	/** Scaler AI prompt */
	scalerSystem: string;
	scalerUser: (from: number, to: number, ingredients: string) => string;
	/** Recipe extraction system prompts */
	recipeAssistantSystem: string;
	recipeExtractionSystem: string;
	/** Overview strings */
	overviewTitle: string;
	overviewGenerated: (count: number) => string;
	overviewAllRecipes: string;
	overviewDataviewNote: string;
	overviewFilterExamples: string;
	overviewMainCourses: string;
	overviewVegetarian: string;
	overviewEasy: string;
	overviewStaticTitle: string;
	overviewStaticNote: string;
	overviewTableHeaders: string[];
	/** Column aliases for Dataview */
	dvCategory: string;
	dvCuisine: string;
	dvDifficulty: string;
	dvDiet: string;
	dvServings: string;
	dvTime: string;
	dvRating: string;
	dvImported: string;
	/** Modal UI strings */
	modalImportTitle: string;
	modalImportBtn: string;
	modalExtracting: string;
	modalInvalidUrl: string;
	modalCancel: string;
	modalSave: string;
	modalSaving: string;
	modalScaleTitle: string;
	modalCurrentServings: (n: number) => string;
	modalNewServings: string;
	modalScaleBtn: string;
	modalScaling: string;
	modalScaleSuccess: (n: number) => string;
	/** Progress stages */
	modalFetching: string;
	modalAnalyzing: string;
	modalDownloadingImage: string;
	modalSavingRecipe: string;
	/** Validation */
	modalNoApiKey: string;
	modalProtocolError: string;
	/** Warnings */
	modalOverwriteWarning: string;
	modalOverwrite: string;
	modalImageFailed: string;
	/** Overview empty state */
	overviewEmpty: string;
}

const de: LanguageConfig = {
	displayName: "Deutsch",
	ingredientsHeading: "Zutaten",
	stepsHeading: "Zubereitung",
	notesHeading: "Notizen",
	tag: "rezept",
	translateInstruction: "Übersetze alles ins Deutsche (falls nicht schon deutsch)",
	dietLabels: "vegan/vegetarisch/fleisch/fisch/meeresfrüchte",
	categoryLabels: "Vorspeise/Hauptgericht/Dessert/Suppe/Salat/Beilage/Snack/Getränk",
	difficultyLabels: "einfach/mittel/aufwendig",
	scalerSystem: "Du bist ein Koch-Assistent. Rechne Zutatenmengen proportional um. Runde sinnvoll (z.B. 2.5 Eier → 3 Eier, 0.33 TL → 1 Prise). Behalte das exakte Markdown-Format bei (z.B. Aufzählungszeichen, Unterüberschriften).",
	scalerUser: (from, to, ingredients) =>
		`Rechne folgende Zutaten von ${from} auf ${to} Portionen um. Behalte das Format bei. Antworte nur mit der neuen Zutatenliste, ohne Erklärungen.\n\n${ingredients}`,
	recipeAssistantSystem: "Du bist ein Rezept-Assistent. Übersetze, konvertiere ins metrische System und klassifiziere Rezepte. Antworte nur mit validem JSON.",
	recipeExtractionSystem: "Du bist ein Rezept-Extraktions-Assistent. Extrahiere strukturierte Rezeptdaten aus Webseiteninhalt. Übersetze ins Deutsche und konvertiere ins metrische System. Antworte nur mit validem JSON.",
	overviewTitle: "Rezept-Übersicht",
	overviewGenerated: (count) => `Automatisch generiert. ${count} Rezepte gefunden.`,
	overviewAllRecipes: "Alle Rezepte (Dataview)",
	overviewDataviewNote: "Benötigt das [Dataview](https://github.com/blacksmithgu/obsidian-dataview)-Plugin.",
	overviewFilterExamples: "Filterbeispiele",
	overviewMainCourses: "Hauptgerichte",
	overviewVegetarian: "Vegetarische Rezepte",
	overviewEasy: "Einfache Rezepte",
	overviewStaticTitle: "Statische Übersicht",
	overviewStaticNote: "Fallback für Nutzer ohne Dataview-Plugin. Wird bei jeder Generierung aktualisiert.",
	overviewTableHeaders: ["Rezept", "Kategorie", "Küche", "Schwierigkeit", "Ernährung", "Portionen", "Zeit", "Bewertung", "Importiert"],
	dvCategory: "Kategorie",
	dvCuisine: "Küche",
	dvDifficulty: "Schwierigkeit",
	dvDiet: "Ernährung",
	dvServings: "Portionen",
	dvTime: "Zeit",
	dvRating: "Bewertung",
	dvImported: "Importiert",
	modalImportTitle: "Rezept von URL importieren",
	modalImportBtn: "Importieren",
	modalExtracting: "Rezept wird extrahiert...",
	modalInvalidUrl: "Bitte eine gültige URL eingeben.",
	modalCancel: "Abbrechen",
	modalSave: "Speichern",
	modalSaving: "Speichern...",
	modalScaleTitle: "Rezept umrechnen",
	modalCurrentServings: (n) => `Aktuelle Portionen: ${n}`,
	modalNewServings: "Neue Portionen...",
	modalScaleBtn: "Umrechnen",
	modalScaling: "Rezept wird umgerechnet...",
	modalScaleSuccess: (n) => `Rezept auf ${n} Portionen umgerechnet.`,
	modalFetching: "Seite wird abgerufen...",
	modalAnalyzing: "Rezept wird analysiert...",
	modalDownloadingImage: "Bild wird heruntergeladen...",
	modalSavingRecipe: "Rezept wird gespeichert...",
	modalNoApiKey: "Kein API-Key für den gewählten Anbieter konfiguriert. Bitte in den Einstellungen hinterlegen.",
	modalProtocolError: "Nur http:// und https:// URLs werden unterstützt.",
	modalOverwriteWarning: "Ein Rezept mit diesem Namen existiert bereits. Erneut klicken zum Überschreiben.",
	modalOverwrite: "Überschreiben",
	modalImageFailed: "Rezept gespeichert, aber das Bild konnte nicht heruntergeladen werden.",
	overviewEmpty: "Keine Rezepte im Ordner gefunden.",
};

const en: LanguageConfig = {
	displayName: "English",
	ingredientsHeading: "Ingredients",
	stepsHeading: "Instructions",
	notesHeading: "Notes",
	tag: "recipe",
	translateInstruction: "Translate everything to English (if not already in English)",
	dietLabels: "vegan/vegetarian/meat/fish/seafood",
	categoryLabels: "Appetizer/Main Course/Dessert/Soup/Salad/Side Dish/Snack/Beverage",
	difficultyLabels: "easy/medium/advanced",
	scalerSystem: "You are a cooking assistant. Scale ingredient quantities proportionally. Round sensibly (e.g. 2.5 eggs → 3 eggs, 0.33 tsp → 1 pinch). Keep the exact Markdown format (e.g. bullet points, subheadings).",
	scalerUser: (from, to, ingredients) =>
		`Scale the following ingredients from ${from} to ${to} servings. Keep the format. Reply only with the new ingredient list, no explanations.\n\n${ingredients}`,
	recipeAssistantSystem: "You are a recipe assistant. Translate, convert to metric units, and classify recipes. Reply only with valid JSON.",
	recipeExtractionSystem: "You are a recipe extraction assistant. Extract structured recipe data from web page content. Translate to English and convert to metric units. Reply only with valid JSON.",
	overviewTitle: "Recipe Overview",
	overviewGenerated: (count) => `Auto-generated. ${count} recipes found.`,
	overviewAllRecipes: "All Recipes (Dataview)",
	overviewDataviewNote: "Requires the [Dataview](https://github.com/blacksmithgu/obsidian-dataview) plugin.",
	overviewFilterExamples: "Filter Examples",
	overviewMainCourses: "Main Courses",
	overviewVegetarian: "Vegetarian Recipes",
	overviewEasy: "Easy Recipes",
	overviewStaticTitle: "Static Overview",
	overviewStaticNote: "Fallback for users without the Dataview plugin. Updated on each generation.",
	overviewTableHeaders: ["Recipe", "Category", "Cuisine", "Difficulty", "Diet", "Servings", "Time", "Rating", "Imported"],
	dvCategory: "Category",
	dvCuisine: "Cuisine",
	dvDifficulty: "Difficulty",
	dvDiet: "Diet",
	dvServings: "Servings",
	dvTime: "Time",
	dvRating: "Rating",
	dvImported: "Imported",
	modalImportTitle: "Import Recipe from URL",
	modalImportBtn: "Import",
	modalExtracting: "Extracting recipe...",
	modalInvalidUrl: "Please enter a valid URL.",
	modalCancel: "Cancel",
	modalSave: "Save",
	modalSaving: "Saving...",
	modalScaleTitle: "Scale Recipe",
	modalCurrentServings: (n) => `Current servings: ${n}`,
	modalNewServings: "New servings...",
	modalScaleBtn: "Scale",
	modalScaling: "Scaling recipe...",
	modalScaleSuccess: (n) => `Recipe scaled to ${n} servings.`,
	modalFetching: "Fetching page...",
	modalAnalyzing: "Analyzing recipe...",
	modalDownloadingImage: "Downloading image...",
	modalSavingRecipe: "Saving recipe...",
	modalNoApiKey: "No API key configured for the selected provider. Please configure it in settings.",
	modalProtocolError: "Only http:// and https:// URLs are supported.",
	modalOverwriteWarning: "A recipe with this name already exists. Click again to overwrite.",
	modalOverwrite: "Overwrite",
	modalImageFailed: "Recipe saved, but the image could not be downloaded.",
	overviewEmpty: "No recipes found in folder.",
};

const fr: LanguageConfig = {
	displayName: "Français",
	ingredientsHeading: "Ingrédients",
	stepsHeading: "Préparation",
	notesHeading: "Notes",
	tag: "recette",
	translateInstruction: "Traduis tout en français (si ce n'est pas déjà en français)",
	dietLabels: "végan/végétarien/viande/poisson/fruits de mer",
	categoryLabels: "Entrée/Plat principal/Dessert/Soupe/Salade/Accompagnement/Snack/Boisson",
	difficultyLabels: "facile/moyen/avancé",
	scalerSystem: "Tu es un assistant culinaire. Adapte les quantités proportionnellement. Arrondis raisonnablement (ex. 2,5 œufs → 3 œufs). Garde le format Markdown exact.",
	scalerUser: (from, to, ingredients) =>
		`Adapte les ingrédients suivants de ${from} à ${to} portions. Garde le format. Réponds uniquement avec la nouvelle liste, sans explications.\n\n${ingredients}`,
	recipeAssistantSystem: "Tu es un assistant recette. Traduis, convertis en unités métriques et classifie les recettes. Réponds uniquement en JSON valide.",
	recipeExtractionSystem: "Tu es un assistant d'extraction de recettes. Extrais les données structurées de recettes à partir du contenu web. Traduis en français et convertis en unités métriques. Réponds uniquement en JSON valide.",
	overviewTitle: "Aperçu des recettes",
	overviewGenerated: (count) => `Généré automatiquement. ${count} recettes trouvées.`,
	overviewAllRecipes: "Toutes les recettes (Dataview)",
	overviewDataviewNote: "Nécessite le plugin [Dataview](https://github.com/blacksmithgu/obsidian-dataview).",
	overviewFilterExamples: "Exemples de filtres",
	overviewMainCourses: "Plats principaux",
	overviewVegetarian: "Recettes végétariennes",
	overviewEasy: "Recettes faciles",
	overviewStaticTitle: "Aperçu statique",
	overviewStaticNote: "Alternative pour les utilisateurs sans Dataview. Mis à jour à chaque génération.",
	overviewTableHeaders: ["Recette", "Catégorie", "Cuisine", "Difficulté", "Régime", "Portions", "Temps", "Note", "Importé"],
	dvCategory: "Catégorie",
	dvCuisine: "Cuisine",
	dvDifficulty: "Difficulté",
	dvDiet: "Régime",
	dvServings: "Portions",
	dvTime: "Temps",
	dvRating: "Note",
	dvImported: "Importé",
	modalImportTitle: "Importer une recette depuis une URL",
	modalImportBtn: "Importer",
	modalExtracting: "Extraction de la recette...",
	modalInvalidUrl: "Veuillez entrer une URL valide.",
	modalCancel: "Annuler",
	modalSave: "Enregistrer",
	modalSaving: "Enregistrement...",
	modalScaleTitle: "Adapter la recette",
	modalCurrentServings: (n) => `Portions actuelles : ${n}`,
	modalNewServings: "Nouvelles portions...",
	modalScaleBtn: "Adapter",
	modalScaling: "Adaptation de la recette...",
	modalScaleSuccess: (n) => `Recette adaptée à ${n} portions.`,
	modalFetching: "Chargement de la page...",
	modalAnalyzing: "Analyse de la recette...",
	modalDownloadingImage: "Téléchargement de l'image...",
	modalSavingRecipe: "Enregistrement de la recette...",
	modalNoApiKey: "Aucune clé API configurée pour le fournisseur sélectionné. Veuillez la configurer dans les paramètres.",
	modalProtocolError: "Seules les URLs http:// et https:// sont prises en charge.",
	modalOverwriteWarning: "Une recette avec ce nom existe déjà. Cliquez à nouveau pour écraser.",
	modalOverwrite: "Écraser",
	modalImageFailed: "Recette enregistrée, mais l'image n'a pas pu être téléchargée.",
	overviewEmpty: "Aucune recette trouvée dans le dossier.",
};

const es: LanguageConfig = {
	displayName: "Español",
	ingredientsHeading: "Ingredientes",
	stepsHeading: "Preparación",
	notesHeading: "Notas",
	tag: "receta",
	translateInstruction: "Traduce todo al español (si no está ya en español)",
	dietLabels: "vegano/vegetariano/carne/pescado/mariscos",
	categoryLabels: "Entrante/Plato principal/Postre/Sopa/Ensalada/Acompañamiento/Snack/Bebida",
	difficultyLabels: "fácil/medio/avanzado",
	scalerSystem: "Eres un asistente de cocina. Escala las cantidades proporcionalmente. Redondea razonablemente (ej. 2,5 huevos → 3 huevos). Mantén el formato Markdown exacto.",
	scalerUser: (from, to, ingredients) =>
		`Escala los siguientes ingredientes de ${from} a ${to} porciones. Mantén el formato. Responde solo con la nueva lista, sin explicaciones.\n\n${ingredients}`,
	recipeAssistantSystem: "Eres un asistente de recetas. Traduce, convierte a unidades métricas y clasifica recetas. Responde solo con JSON válido.",
	recipeExtractionSystem: "Eres un asistente de extracción de recetas. Extrae datos estructurados de recetas del contenido web. Traduce al español y convierte a unidades métricas. Responde solo con JSON válido.",
	overviewTitle: "Resumen de recetas",
	overviewGenerated: (count) => `Generado automáticamente. ${count} recetas encontradas.`,
	overviewAllRecipes: "Todas las recetas (Dataview)",
	overviewDataviewNote: "Requiere el plugin [Dataview](https://github.com/blacksmithgu/obsidian-dataview).",
	overviewFilterExamples: "Ejemplos de filtros",
	overviewMainCourses: "Platos principales",
	overviewVegetarian: "Recetas vegetarianas",
	overviewEasy: "Recetas fáciles",
	overviewStaticTitle: "Resumen estático",
	overviewStaticNote: "Alternativa para usuarios sin Dataview. Se actualiza en cada generación.",
	overviewTableHeaders: ["Receta", "Categoría", "Cocina", "Dificultad", "Dieta", "Porciones", "Tiempo", "Valoración", "Importado"],
	dvCategory: "Categoría",
	dvCuisine: "Cocina",
	dvDifficulty: "Dificultad",
	dvDiet: "Dieta",
	dvServings: "Porciones",
	dvTime: "Tiempo",
	dvRating: "Valoración",
	dvImported: "Importado",
	modalImportTitle: "Importar receta desde URL",
	modalImportBtn: "Importar",
	modalExtracting: "Extrayendo receta...",
	modalInvalidUrl: "Por favor, introduce una URL válida.",
	modalCancel: "Cancelar",
	modalSave: "Guardar",
	modalSaving: "Guardando...",
	modalScaleTitle: "Escalar receta",
	modalCurrentServings: (n) => `Porciones actuales: ${n}`,
	modalNewServings: "Nuevas porciones...",
	modalScaleBtn: "Escalar",
	modalScaling: "Escalando receta...",
	modalScaleSuccess: (n) => `Receta escalada a ${n} porciones.`,
	modalFetching: "Cargando página...",
	modalAnalyzing: "Analizando receta...",
	modalDownloadingImage: "Descargando imagen...",
	modalSavingRecipe: "Guardando receta...",
	modalNoApiKey: "No hay clave API configurada para el proveedor seleccionado. Configúrela en los ajustes.",
	modalProtocolError: "Solo se admiten URLs http:// y https://.",
	modalOverwriteWarning: "Ya existe una receta con este nombre. Haz clic de nuevo para sobrescribir.",
	modalOverwrite: "Sobrescribir",
	modalImageFailed: "Receta guardada, pero no se pudo descargar la imagen.",
	overviewEmpty: "No se encontraron recetas en la carpeta.",
};

const it: LanguageConfig = {
	displayName: "Italiano",
	ingredientsHeading: "Ingredienti",
	stepsHeading: "Preparazione",
	notesHeading: "Note",
	tag: "ricetta",
	translateInstruction: "Traduci tutto in italiano (se non è già in italiano)",
	dietLabels: "vegano/vegetariano/carne/pesce/frutti di mare",
	categoryLabels: "Antipasto/Primo/Secondo/Dolce/Zuppa/Insalata/Contorno/Snack/Bevanda",
	difficultyLabels: "facile/medio/avanzato",
	scalerSystem: "Sei un assistente di cucina. Scala le quantità proporzionalmente. Arrotonda ragionevolmente (es. 2,5 uova → 3 uova). Mantieni il formato Markdown esatto.",
	scalerUser: (from, to, ingredients) =>
		`Scala i seguenti ingredienti da ${from} a ${to} porzioni. Mantieni il formato. Rispondi solo con la nuova lista, senza spiegazioni.\n\n${ingredients}`,
	recipeAssistantSystem: "Sei un assistente per ricette. Traduci, converti in unità metriche e classifica le ricette. Rispondi solo con JSON valido.",
	recipeExtractionSystem: "Sei un assistente di estrazione ricette. Estrai dati strutturati di ricette dal contenuto web. Traduci in italiano e converti in unità metriche. Rispondi solo con JSON valido.",
	overviewTitle: "Panoramica ricette",
	overviewGenerated: (count) => `Generato automaticamente. ${count} ricette trovate.`,
	overviewAllRecipes: "Tutte le ricette (Dataview)",
	overviewDataviewNote: "Richiede il plugin [Dataview](https://github.com/blacksmithgu/obsidian-dataview).",
	overviewFilterExamples: "Esempi di filtri",
	overviewMainCourses: "Piatti principali",
	overviewVegetarian: "Ricette vegetariane",
	overviewEasy: "Ricette facili",
	overviewStaticTitle: "Panoramica statica",
	overviewStaticNote: "Alternativa per utenti senza Dataview. Aggiornato ad ogni generazione.",
	overviewTableHeaders: ["Ricetta", "Categoria", "Cucina", "Difficoltà", "Dieta", "Porzioni", "Tempo", "Valutazione", "Importato"],
	dvCategory: "Categoria",
	dvCuisine: "Cucina",
	dvDifficulty: "Difficoltà",
	dvDiet: "Dieta",
	dvServings: "Porzioni",
	dvTime: "Tempo",
	dvRating: "Valutazione",
	dvImported: "Importato",
	modalImportTitle: "Importa ricetta da URL",
	modalImportBtn: "Importa",
	modalExtracting: "Estrazione ricetta...",
	modalInvalidUrl: "Inserisci un URL valido.",
	modalCancel: "Annulla",
	modalSave: "Salva",
	modalSaving: "Salvataggio...",
	modalScaleTitle: "Scala ricetta",
	modalCurrentServings: (n) => `Porzioni attuali: ${n}`,
	modalNewServings: "Nuove porzioni...",
	modalScaleBtn: "Scala",
	modalScaling: "Scalatura della ricetta...",
	modalScaleSuccess: (n) => `Ricetta scalata a ${n} porzioni.`,
	modalFetching: "Caricamento della pagina...",
	modalAnalyzing: "Analisi della ricetta...",
	modalDownloadingImage: "Download dell'immagine...",
	modalSavingRecipe: "Salvataggio della ricetta...",
	modalNoApiKey: "Nessuna chiave API configurata per il provider selezionato. Configurala nelle impostazioni.",
	modalProtocolError: "Sono supportati solo URL http:// e https://.",
	modalOverwriteWarning: "Esiste già una ricetta con questo nome. Clicca di nuovo per sovrascrivere.",
	modalOverwrite: "Sovrascrivi",
	modalImageFailed: "Ricetta salvata, ma non è stato possibile scaricare l'immagine.",
	overviewEmpty: "Nessuna ricetta trovata nella cartella.",
};

export const LANGUAGES: Record<RecipeLanguage, LanguageConfig> = { de, en, fr, es, it };

export function getLanguageConfig(lang: RecipeLanguage): LanguageConfig {
	return LANGUAGES[lang] ?? LANGUAGES.de;
}
