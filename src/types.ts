export enum AIProviderType {
	OpenAI = "openai",
	Anthropic = "anthropic",
	Google = "google",
}

export interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

export interface RecipeData {
	title: string;
	source: string;
	servings: string;
	recPreptime: string;
	recDiet: string;
	recCategory: string;
	recCuisine: string;
	recDifficulty: string;
	recImage?: string;
	dateImported: string;
	recRating: number;
	ingredients: string[];
	steps: string[];
	notes: string;
	imageUrl: string;
	imagePath?: string;
}
