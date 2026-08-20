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
}

export class RerunDto {
  @IsOptional()
  @IsBoolean()
  confirmNoDraft = false;
}

function parseJsonArray(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : fallback;
  } catch {
    return value.split(",").map(item => item.trim()).filter(Boolean);
  }
}
