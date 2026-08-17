import { Transform } from "class-transformer";
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateVideoDto {
  @IsString() @MaxLength(200) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) description = "";
  @IsOptional() @Transform(({ value }) => Array.isArray(value) ? value : JSON.parse(value || "[]")) @IsArray() @IsString({ each: true }) hashtags: string[] = [];
}

export class RerunDto { @IsOptional() @IsBoolean() confirmNoDraft = false; }
