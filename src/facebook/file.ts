import { stat } from "node:fs/promises";
import path from "node:path";
import { ensureMp4Format } from "../ffmpeg.js";

export interface ValidatedFacebookVideoFile {
  path: string;
  size: number;
  filename: string;
  defaultTitle: string;
  mimeType: string;
}

export async function validateFacebookVideoFile(inputPath: string): Promise<ValidatedFacebookVideoFile> {
  if (!inputPath?.trim()) throw new Error("--file is required");

  let resolved = path.resolve(inputPath);
  const info = await stat(resolved).catch(() => null);
  if (!info) throw new Error(`Video file does not exist: ${resolved}`);
  if (!info.isFile()) throw new Error(`Video path is not a regular file: ${resolved}`);
  if (info.size <= 0) throw new Error(`Video file is empty: ${resolved}`);

  resolved = await ensureMp4Format(resolved);
  const finalInfo = await stat(resolved);

  return {
    path: resolved,
    size: finalInfo.size,
    filename: path.basename(resolved),
    defaultTitle: path.basename(resolved, path.extname(resolved)),
    mimeType: "video/mp4",
  };
}
