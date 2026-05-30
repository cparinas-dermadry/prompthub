import {
  IsArray,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  IsOptional,
  ValidateNested,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { LocationDto } from '../../common/dto/location.dto.js';

/**
 * Per-thread retry override. Both fields are optional:
 *  - `fromMessageId` — the user message to retry from. If omitted, the
 *     latest user message in the thread is used (default behavior).
 *     When provided, every message timestamped AFTER it (user + assistant
 *     alike) is silently deleted before re-streaming. This is the
 *     "rewind & redo turn N" case.
 *  - `prompt` — new content for the user message at `fromMessageId`
 *     (falling back to the latest user message). If omitted, the existing
 *     content is reused verbatim. This is the "edit & retry" case.
 *
 * A thread can appear here with neither set (no-op, but allowed for shape
 * symmetry with the frontend). Threads not listed at all are retried
 * verbatim from their latest user message.
 */
class RetryOverrideEntry {
  @IsUUID('4')
  threadId!: string;

  @IsOptional()
  @IsUUID('4')
  fromMessageId?: string;

  @IsOptional()
  @IsString()
  // Match SendPromptDto's MaxLength to keep the contract symmetric.
  @MaxLength(32_000)
  prompt?: string;
}

export class RetryPromptDto {
  @IsUUID()
  sessionId!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  // Hard cap matches the fan-out endpoint — one retry call can re-run at
  // most 10 parallel paid LLM requests.
  @ArrayMaxSize(10)
  threadIds!: string[];

  /**
   * Optional per-thread overrides: pick a non-latest message to retry from,
   * supply a new prompt, or both. Threads not listed retry verbatim from
   * their latest user message.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RetryOverrideEntry)
  @Transform(({ value }: { value: unknown }) => value ?? [], { toClassOnly: true })
  edits?: RetryOverrideEntry[];

  /**
   * Optional GEO/SEO location to apply to the retried turn. Mirrors
   * SendPromptDto.location so retries can carry the same geo framing
   * forward. If omitted, retry behaves exactly as before (no location).
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

// Re-export the entry class so the controller can build a typed map from it.
export { RetryOverrideEntry };
