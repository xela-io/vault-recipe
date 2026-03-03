import { App, TFile } from "obsidian";

/** Sanitize a string for use as a file name (Obsidian-safe). */
export function sanitizeFileName(name: string): string {
	return name
		.replace(/[\\/:*?"<>|]/g, "-")
		.replace(/\s+/g, " ")
		.trim();
}

/** Ensure a folder exists, creating it and any parent folders if needed. */
export async function ensureFolder(app: App, path: string): Promise<void> {
	if (app.vault.getAbstractFileByPath(path)) return;

	const parts = path.split("/");
	let current = "";
	for (const part of parts) {
		current = current ? `${current}/${part}` : part;
		if (!app.vault.getAbstractFileByPath(current)) {
			try {
				await app.vault.createFolder(current);
			} catch {
				// May have been created concurrently — only rethrow if still missing
				if (!app.vault.getAbstractFileByPath(current)) {
					throw new Error(`Failed to create folder: ${current}`);
				}
			}
		}
	}
}

/** Extract and parse a JSON object from an AI response string. */
export function parseJsonFromResponse(response: string): Record<string, unknown> {
	let cleaned = response.trim();

	// Strip markdown code fences if present
	const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
	if (fenceMatch) {
		cleaned = fenceMatch[1].trim();
	}

	// Try direct parse first (most common: AI returns clean JSON)
	try {
		const direct: unknown = JSON.parse(cleaned);
		if (typeof direct === "object" && direct !== null && !Array.isArray(direct)) {
			return direct as Record<string, unknown>;
		}
	} catch {
		// Fall through to extraction
	}

	// Fallback: extract first JSON object via balanced braces
	const start = cleaned.indexOf("{");
	if (start !== -1) {
		let depth = 0;
		for (let i = start; i < cleaned.length; i++) {
			if (cleaned[i] === "{") depth++;
			else if (cleaned[i] === "}") depth--;

			if (depth === 0) {
				const candidate = cleaned.slice(start, i + 1);
				try {
					const parsed: unknown = JSON.parse(candidate);
					if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
						return parsed as Record<string, unknown>;
					}
				} catch {
					// Not valid JSON at this boundary, continue
				}
				break;
			}
		}
	}

	throw new Error("Failed to extract recipe data from AI response");
}

/** Create or update a text file in the vault. Returns the file. */
export async function createOrUpdateFile(
	app: App,
	filePath: string,
	content: string
): Promise<TFile> {
	const existing = app.vault.getAbstractFileByPath(filePath);
	if (existing instanceof TFile) {
		await app.vault.modify(existing, content);
		return existing;
	}
	return await app.vault.create(filePath, content);
}

/** Format an unknown error value into a user-facing message. */
export function formatError(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
