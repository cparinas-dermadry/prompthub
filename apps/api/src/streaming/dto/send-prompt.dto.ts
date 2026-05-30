import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from '../../common/dto/location.dto.js';

export class SendPromptDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  // Cap prompt size so a single request can't ship an unbounded payload to
  // every fanned-out provider. 32k chars ≈ ~8k tokens — well above normal
  // chat input but a hard ceiling.
  @MaxLength(32_000)
  prompt!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  // Hard cap on fan-out: one request can fire at most 10 parallel paid LLM
  // calls. Prevents cost-exfiltration by a single malicious POST.
  @ArrayMaxSize(10)
  threadIds!: string[];

  /**
   * Optional GEO/SEO visibility-testing location. When set:
   *   - prepended as an invisible "you are answering a user located in …"
   *     system message before history (every model),
   *   - and (for search-capable models) attached as `user_location` on the
   *     `openrouter:web_search` server tool with `engine: "native"` so
   *     grounded results are actually localized.
   *
   * Never shown in the visible transcript. Single location for now; the
   * field is shaped so a future multi-region fan-out can be added without
   * breaking single-location callers.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
