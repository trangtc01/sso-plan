import { stat } from "node:fs/promises";
import path from "node:path";

export interface ValidatedFacebookVideoFile {
  path: string;
  size: number;
  filename: string;
  defaultTitle: string;
  mimeType: string;
}

export async function validateFacebookVideoFile(inputPath: string): Promise<ValidatedFacebookVideoFile> {
  if (!inputPath?.trim()) throw new Error("--file is required");

  const resolved = path.resolve(inputPath);
  const info = await stat(resolved).catch(() => null);
  if (!info) throw new Error(`Video file does not exist: ${resolved}`);
  if (!info.isFile()) throw new Error(`Video path is not a regular file: ${resolved}`);
  if (info.size <= 0) throw new Error(`Video file is empty: ${resolved}`);

  const ext = path.extname(resolved).toLowerCase();
  const mimeType = ext === ".mov"
    ? "video/quicktime"
    : ext === ".mp4"
      ? "video/mp4"
      : "application/octet-stream";

  return {
    path: resolved,
    size: info.size,
    filename: path.basename(resolved),
    defaultTitle: path.basename(resolved, path.extname(resolved)),
    mimeType,
  };
}
