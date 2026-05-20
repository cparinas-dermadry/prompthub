import { IsString, IsNotEmpty, IsArray, IsUUID, ArrayMinSize } from 'class-validator';

export class SendPromptDto {
  @IsUUID()
  sessionId!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(1)
  threadIds!: string[];
}
