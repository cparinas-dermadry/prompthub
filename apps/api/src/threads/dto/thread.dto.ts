import { IsString, IsNotEmpty, IsOptional, IsObject, IsUUID } from 'class-validator';

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

  @IsObject()
  @IsOptional()
  modelConfig?: Record<string, unknown>;
}

export class UpdateThreadDto {
  @IsString()
  @IsNotEmpty()
  modelId!: string;

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsObject()
  @IsOptional()
  modelConfig?: Record<string, unknown>;
}
