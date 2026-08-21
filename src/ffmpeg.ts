import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";

export async function ensureMp4Format(inputPath: string): Promise<string> {
  if (!inputPath?.trim()) throw new Error("Video input file path is required");
  const resolved = path.resolve(inputPath);

  const info = await stat(resolved).catch(() => null);
  if (!info || !info.isFile() || info.size <= 0) {
    throw new Error(`Invalid video file at: ${resolved}`);
  }

  const ext = path.extname(resolved).toLowerCase();
  if (ext === ".mp4") {
    return resolved;
  }

  const outputDir = path.dirname(resolved);
  const baseName = path.basename(resolved, ext);
  const outputPath = path.join(outputDir, `${baseName}_converted_${Date.now()}.mp4`);
  const executable = process.env.FFMPEG_EXECUTABLE ?? "ffmpeg";

  console.log(`[FFmpeg] Converting ${ext} video to MP4: ${resolved} -> ${outputPath}`);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [
      "-y",
      "-i", resolved,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "22",
      "-c:a", "aac",
      "-b:a", "192k",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ], { stdio: ["ignore", "inherit", "inherit"] });

    child.once("error", err => {
      reject(new Error(`Could not execute ${executable}: ${err.message}. Make sure ffmpeg is installed.`));
    });

    child.once("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`${executable} process failed with exit code ${code ?? "unknown"}`));
    });
  });

  const convertedInfo = await stat(outputPath).catch(() => null);
  if (!convertedInfo || convertedInfo.size <= 0) {
    throw new Error(`FFmpeg output MP4 file is missing or empty: ${outputPath}`);
  }

  return outputPath;
}
