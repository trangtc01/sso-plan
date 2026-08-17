import path from "node:path";

const automationRoot = path.resolve(process.cwd(), ".tiktok-automation");

export interface AppConfig {
  profileDir: string;
  artifactDir: string;
  maxFileBytes: number;
  uploadUrl: string;
  chromeExecutablePath?: string;
  chromeProfileDirectory?: string;
}

export function loadConfig(env = process.env): AppConfig {
  const maxFileBytes = Number(env.TIKTOK_MAX_FILE_BYTES ?? 2 * 1024 * 1024 * 1024);
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes <= 0) {
    throw new Error("TIKTOK_MAX_FILE_BYTES must be a positive integer");
  }

  return {
    profileDir: path.resolve(env.TIKTOK_PROFILE_DIR ?? path.join(automationRoot, "profile")),
    artifactDir: path.resolve(env.TIKTOK_ARTIFACT_DIR ?? path.join(automationRoot, "artifacts")),
    maxFileBytes,
    uploadUrl: env.TIKTOK_UPLOAD_URL ?? "https://www.tiktok.com/tiktokstudio/upload",
    chromeExecutablePath: env.TIKTOK_CHROME_EXECUTABLE,
    chromeProfileDirectory: env.TIKTOK_CHROME_PROFILE_DIRECTORY,
  };
}
