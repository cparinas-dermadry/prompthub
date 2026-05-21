import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsBoolean,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Typed shape for the JSONB `model_config` column on `threads`. Previously
 * accepted as `Record<string, unknown>` — meaning a string `temperature`
 * (or a 999 hex value, etc.) would propagate all the way to the OpenRouter
 * request body and either fail oddly or, worse, get charged at an unusual
 * sampling temperature. ValidationPipe with `whitelist + forbidNonWhitelisted`
 * now strips unknown keys and rejects out-of-range values.
 *
 * The client UI controls these directly, so we additionally:
 *   - clamp temperature to [0, 2] (OpenRouter's accepted range);
 *   - cap system_prompt length so users can't blow out cost via a 1MB
 *     system prompt that gets sent on every turn.
 *
 * `logoColor` is included because the frontend writes it through this same
 * field for tile rendering — see use-add-threads.ts.
 */
export class ModelConfigDto {
  @IsOptional()
  @IsString()
  @MaxLength(8_000)
  system_prompt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsBoolean()
  use_direct_api?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  logoColor?: string;
}

export class CreateThreadDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  modelId!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsString()
  @IsNotEmpty()
  provider!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelConfigDto)
  modelConfig?: ModelConfigDto;
}

export class UpdateThreadDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  modelId?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  displayName?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelConfigDto)
  modelConfig?: ModelConfigDto;
}
