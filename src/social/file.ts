import { stat } from "node:fs/promises";
import path from "node:path";
import { ensureMp4Format } from "../ffmpeg.js";

export interface ValidatedVideoFile {
  path: string;
  size: number;
  defaultTitle: string;
}

export async function validateVideoFile(inputPath: string): Promise<ValidatedVideoFile> {
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
    defaultTitle: path.basename(resolved, path.extname(resolved)),
  };
}
