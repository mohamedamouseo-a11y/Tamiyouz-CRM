// Local file storage implementation for self-hosted Tamiyouz CRM
// Replaces the Manus Forge proxy with local disk storage served via Express
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

// Base directory for uploaded files
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure the uploads directory exists
function ensureUploadsDir(subDir?: string): string {
  const dir = subDir ? path.join(UPLOADS_DIR, subDir) : UPLOADS_DIR;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

/**
 * Store a file locally on disk.
 * Returns the relative key and a URL path that can be served by Express.
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOADS_DIR, key);
  const dir = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file to disk
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  // Return URL path that will be served by Express static middleware
  const url = `/uploads/${key}`;
  return { key, url };
}

/**
 * Get the URL for a stored file.
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  const url = `/uploads/${key}`;
  return { key, url };
}

/**
 * Delete a stored file from disk.
 */
export async function storageDelete(relKey: string): Promise<{ key: string }> {
  const key = normalizeKey(relKey);
  const filePath = path.join(UPLOADS_DIR, key);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Clean up empty parent directories
  let dir = path.dirname(filePath);
  while (dir !== UPLOADS_DIR && dir.startsWith(UPLOADS_DIR)) {
    try {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  return { key };
}

// Initialize uploads directory on module load
ensureUploadsDir();
