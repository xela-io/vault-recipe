import { App, TFile, requestUrl } from "obsidian";
import { VaultRecipeSettings } from "../settings";
import { MAX_IMAGE_CANDIDATES, MAX_IMAGE_SIZE } from "../constants";
import { sanitizeFileName, ensureFolder } from "../utils";

const OG_IMAGE_RE = /<meta\s+(?:[^>]*?)property=["']og:image["'][^>]*?content=["']([^"']+)["']/i;
const OG_IMAGE_REVERSED_RE = /<meta\s+(?:[^>]*?)content=["']([^"']+)["'][^>]*?property=["']og:image["']/i;
const IMG_TAG_RE = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
const REJECT_RE = /\.svg(\?|$)|\b(pixel|track|beacon|1x1|spacer|blank|icon|logo|avatar|favicon|badge)\b/i;

export class ImageService {
	constructor(
		private app: App,
		private settings: VaultRecipeSettings
	) {}

	/**
	 * Extract the best image URL from HTML.
	 * Priority: og:image > JSON-LD image > (empty — AI fallback in plaintext mode).
	 */
	extractBestImageUrl(html: string, jsonLdImage: string): string {
		// 1. og:image
		const ogMatch = html.match(OG_IMAGE_RE);
		if (ogMatch && ogMatch[1]) return ogMatch[1];

		// Also check reversed attribute order
		const ogMatchReversed = html.match(OG_IMAGE_REVERSED_RE);
		if (ogMatchReversed && ogMatchReversed[1]) return ogMatchReversed[1];

		// 2. JSON-LD image
		if (jsonLdImage) return jsonLdImage;

		// 3. No automatic <img> scraping — return empty, fallback left to AI in plaintext mode
		return "";
	}

	/**
	 * Collect candidate image URLs from <img> tags, filtering out likely non-recipe images.
	 */
	collectImageUrls(html: string, baseUrl: string): string[] {
		// Reset global regex lastIndex before use
		IMG_TAG_RE.lastIndex = 0;
		const seen = new Set<string>();
		const urls: string[] = [];
		let match: RegExpExecArray | null;

		while ((match = IMG_TAG_RE.exec(html)) !== null) {
			let src = match[1];
			if (REJECT_RE.test(src)) continue;

			// Resolve relative URLs
			try {
				src = new URL(src, baseUrl).href;
			} catch {
				continue;
			}
			if (!seen.has(src)) {
				seen.add(src);
				urls.push(src);
			}
		}

		return urls.slice(0, MAX_IMAGE_CANDIDATES);
	}

	/**
	 * Download an image and save it to the vault.
	 */
	async downloadImage(
		imageUrl: string,
		recipeName: string,
		sourceUrl?: string
	): Promise<string | null> {
		if (!imageUrl) return null;

		try {
			const response = await requestUrl({
				url: imageUrl,
				headers: {
					"Referer": sourceUrl || imageUrl,
					"User-Agent": "Mozilla/5.0 (compatible; Obsidian)",
					"Accept": "image/*,*/*;q=0.8",
				},
			});

			// Validate content type (allow image/*, octet-stream, and missing content-type)
			const contentType = response.headers["content-type"] || "";
			if (contentType && !contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
				console.warn(`[Vault Recipe] Skipping non-image content-type: ${contentType}`);
				return null;
			}

			// Validate file size
			if (response.arrayBuffer.byteLength > MAX_IMAGE_SIZE) {
				console.warn(`[Vault Recipe] Image too large (${(response.arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB), skipping`);
				return null;
			}

			// Determine file extension from URL or content type
			let ext = "jpg";
			const urlPath = new URL(imageUrl).pathname;
			const urlExtMatch = urlPath.match(/\.(\w{3,4})$/);
			if (urlExtMatch) {
				const urlExt = urlExtMatch[1].toLowerCase();
				if (["jpg", "jpeg", "png", "webp", "gif"].includes(urlExt)) {
					ext = urlExt === "jpeg" ? "jpg" : urlExt;
				}
			}

			const folder = this.settings.recipeFolder;
			const imagesFolder = `${folder}/images`;

			await ensureFolder(this.app, folder);
			await ensureFolder(this.app, imagesFolder);

			const imagePath = `${imagesFolder}/${sanitizeFileName(recipeName)}.${ext}`;

			// Check if file already exists
			const existing =
				this.app.vault.getAbstractFileByPath(imagePath);
			if (existing instanceof TFile) {
				await this.app.vault.modifyBinary(
					existing,
					response.arrayBuffer
				);
			} else {
				await this.app.vault.createBinary(
					imagePath,
					response.arrayBuffer
				);
			}

			return imagePath;
		} catch (e) {
			console.warn("Failed to download recipe image:", e);
			return null;
		}
	}
}
