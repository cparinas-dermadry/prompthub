import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsUUID,
  ArrayMinSize,
  ArrayMaxSize,
  MaxLength,
} from 'class-validator';

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
}
