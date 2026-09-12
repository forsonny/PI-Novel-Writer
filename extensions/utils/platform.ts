import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

export const IS_WINDOWS = process.platform === "win32";

// Normalize CRLF -> LF on every file read (critical on Windows)
export function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");
}

// Write LF-only (never CRLF), with EBUSY retry for Windows file locking
export function writeText(filePath: string, content: string, maxRetries = 3): void {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  const data = content.replace(/\r\n/g, "\n");
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      fs.writeFileSync(tmpPath, data, { encoding: "utf-8", flag: attempt === 0 ? "wx" : "w", mode: 0o600 });
      fs.renameSync(tmpPath, filePath); // atomic write
      return;
    } catch (err: any) {
      if (err.code === "EBUSY" && attempt < maxRetries) {
        // Windows file locking -- wait and retry with exponential backoff
        const delay = 100 * Math.pow(2, attempt); // 100, 200, 400ms
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay);
        continue;
      }
      // Retain the temporary file on failure so unsaved work can be recovered.
      throw err;
    }
  }
}

// Resolve stored POSIX paths against project root
export function resolvePath(projectRoot: string, storedPath: string): string {
  return path.resolve(projectRoot, storedPath);
}

// Case-insensitive path comparison (Windows NTFS is case-insensitive)
export function pathsEqual(a: string, b: string): boolean {
  return IS_WINDOWS ? path.normalize(a).toLowerCase() === path.normalize(b).toLowerCase()
    : path.normalize(a) === path.normalize(b);
}

// Normalize entity names for Map keys (always lowercase)
export function normalizeKey(name: string): string {
  return name.toLowerCase().trim();
}

// Safe filename (cross-platform)
const WIN_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
const WIN_ILLEGAL  = /[<>:"/\\|?*\x00-\x1f]/;

export function toSafeFilename(name: string): string {
  let safe = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\-_]/g, "");
  if (WIN_RESERVED.test(safe)) safe = "x-" + safe;
  return safe || "untitled";
}

export function validateFilename(name: string): { valid: boolean; reason?: string } {
  if (!name?.trim()) return { valid: false, reason: "Name cannot be empty" };
  { // Portable names remain valid when a project moves between operating systems.
    if (WIN_RESERVED.test(name)) return { valid: false, reason: `"${name}" is a reserved Windows filename` };
    if (WIN_ILLEGAL.test(name)) return { valid: false, reason: "Name contains characters not allowed on Windows" };
    if (name.endsWith(".") || name.endsWith(" ")) return { valid: false, reason: "Name cannot end with period or space on Windows" };
  }
  return { valid: true };
}

// Editor resolution (cross-platform)
export function getEditor(): string {
  if (process.env.EDITOR) return process.env.EDITOR;
  if (process.env.VISUAL) return process.env.VISUAL;
  return IS_WINDOWS ? "notepad" : "nano";
}

// Ensure directory exists
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}
