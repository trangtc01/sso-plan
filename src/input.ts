import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, lstat } from "node:fs/promises";
import path from "node:path";
import { InputError } from "./errors.js";
import type { ValidatedInput } from "./types.js";

export async function validateVideoInput(filePath: string | undefined, maxFileBytes: number): Promise<ValidatedInput> {
  if (!filePath || !path.isAbsolute(filePath)) throw new InputError("--file must be an absolute path");
  if (!new Set([".mp4", ".mov"]).has(path.extname(filePath).toLowerCase())) throw new InputError("only .mp4 and .mov files are supported");

  let stat;
  try {
    stat = await lstat(filePath);
    await access(filePath);
  } catch {
    throw new InputError("file does not exist or is not readable");
  }
  if (!stat.isFile()) throw new InputError("--file must point to a regular file");
  if (stat.size === 0) throw new InputError("video file must not be empty");
  if (stat.size > maxFileBytes) throw new InputError(`video exceeds configured size limit (${maxFileBytes} bytes)`);
  if (!(await hasMp4Signature(filePath))) throw new InputError("file content is not a valid ISO Base Media container");

  return { path: filePath, fileHash: await sha256(filePath), size: stat.size };
}

async function hasMp4Signature(filePath: string): Promise<boolean> {
  const stream = createReadStream(filePath, { start: 0, end: 31 });
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const header = Buffer.concat(chunks);
  return header.length >= 12 && header.subarray(4, 8).toString("ascii") === "ftyp";
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk as Buffer);
  return hash.digest("hex");
}
