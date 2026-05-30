import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Wire-level validator for the PromptLocation type defined in
 * `packages/types`. Used as a nested @ValidateNested target on:
 *  - SendPromptDto       (per-prompt location)
 *  - RetryPromptDto      (carries the location forward on retry)
 *  - UpdateSessionDto    (the session's default location)
 *
 * All fields are optional except `country`, which is ISO-3166 alpha-2 when
 * present. The plan deliberately keeps country as the only ~hard-required
 * piece — it's the lever that actually changes grounded search behaviour
 * via OpenRouter's `user_location.country`.
 *
 * MaxLength caps are defense against absurd payloads; the real values are
 * short (country = 2 chars, timezone ~ 40 chars, city ~ 80 chars).
 */
export class LocationDto {
  /** ISO-3166 alpha-2, e.g. "SG", "PH", "CA". */
  @IsString()
  @Length(2, 2)
  country!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  /** IANA timezone string, e.g. "America/Toronto". */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  /** Display label, e.g. "Toronto, ON, Canada". */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  label?: string;
}
