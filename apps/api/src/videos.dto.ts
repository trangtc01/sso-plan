import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, MaxLength } from "class-validator";
import { FacebookContentType, Platform, PublishMode } from "@prisma/client";

export class CreateVideoDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description = "";

  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value, []))
  @IsArray()
  @IsString({ each: true })
  hashtags: string[] = [];

  @IsOptional()
  @Transform(({ value }) => parseJsonArray(value, [Platform.TIKTOK]))
  @IsArray()
  @IsEnum(Platform, { each: true })
  platforms: Platform[] = [Platform.TIKTOK];

  @IsOptional()
  @IsISO8601()
  publishAt?: string;

  @IsOptional()
  @IsEnum(PublishMode)
  facebookPublishMode: PublishMode = PublishMode.PUBLIC;

  @IsOptional()
  @IsEnum(FacebookContentType)
  facebookContentType: FacebookContentType = FacebookContentType.REEL;

  @IsOptional()
  @IsEnum(PublishMode)
  youtubePublishMode: PublishMode = PublishMode.PUBLIC;

  @IsOptional()
  @IsEnum(PublishMode)
  tiktokPublishMode: PublishMode = PublishMode.DRAFT;

  @IsOptional()
  @Transform(({ value }) => parseBoolean(value, true))
  @IsBoolean()
  tiktokUseSound = true;
}

export class RerunDto {
  @IsOptional()
  @IsBoolean()
  confirmNoDraft = false;
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["true", "1", "yes", "on", "co", "có"].includes(normalized)) return true;
  if (["false", "0", "no", "off", "khong", "không"].includes(normalized)) return false;
  return fallback;
}

function parseJsonArray(value: unknown, fallback: string[]): string[] {
  if (value === undefined || value === null || value === "") return fallback;
  if (Array.isArray(value)) {
    const flattened = value.flatMap(item => parseJsonArray(item, []));
    return flattened.length ? flattened : fallback;
  }
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
    if (parsed !== null && parsed !== undefined && parsed !== "") return [String(parsed)];
    return fallback;
  } catch {
    const split = value.split(",").map(item => item.trim()).filter(Boolean);
    return split.length ? split : fallback;
  }
}
