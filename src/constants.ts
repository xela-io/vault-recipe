/** Frontmatter keys used in recipe notes. */
export const FM = {
	TITLE: "title",
	SOURCE: "source",
	SERVINGS: "servings",
	PREPTIME: "preptime",
	DIET: "diet",
	CATEGORY: "category",
	CUISINE: "cuisine",
	DIFFICULTY: "difficulty",
	IMAGE: "image",
	DATE_IMPORTED: "date_imported",
	RATING: "rating",
	TAGS: "tags",
} as const;

/** Anthropic API version header. */
export const ANTHROPIC_API_VERSION = "2023-06-01";

/** Default max_tokens for Anthropic chat completion. */
export const ANTHROPIC_MAX_TOKENS = 4096;

/** Maximum characters of plaintext content sent to AI for extraction. */
export const MAX_PLAINTEXT_CONTENT_CHARS = 12000;

/** Maximum number of candidate image URLs collected from HTML. */
export const MAX_IMAGE_CANDIDATES = 10;

/** Maximum image file size in bytes (5 MB). */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
