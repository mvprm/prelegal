import { readFileSync } from "node:fs";
import path from "node:path";
import type { DocumentSpec } from "./documents/catalog";

const REPO_DIR = path.join(process.cwd(), "..");

/** The repository's templates/ directory, the single source of truth for agreement text. */
const TEMPLATES_DIR = path.join(REPO_DIR, "templates");

/**
 * Reads a template from templates/ with normalized line endings. Synchronous so pages
 * that use it are prerendered with the template text at build time.
 */
export function readTemplate(filename: string): string {
  return readFileSync(path.join(TEMPLATES_DIR, filename), "utf-8").replace(/\r\n/g, "\n");
}

/** The supported documents and their fields, from documents.json in the repository root. */
export function readCatalog(): DocumentSpec[] {
  return JSON.parse(readFileSync(path.join(REPO_DIR, "documents.json"), "utf-8"));
}
