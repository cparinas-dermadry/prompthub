import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LocationDto } from '../../common/dto/location.dto.js';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsOptional()
  activeProviders?: object[];

  /**
   * Optional initial location for the session. Most sessions are created
   * without one (Sidebar quick-create flow) and the user picks it later
   * in the workspace header.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

export class UpdateSessionDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @IsArray()
  @IsOptional()
  activeProviders?: object[];

  /**
   * Set the session's default location, or pass `null` to clear it.
   * Note: class-validator's @IsOptional() treats `null` as "absent"; we
   * model "clear" by sending `null` and the service explicitly checks
   * `=== null` (not `!== undefined`) on this field — see sessions.service.ts.
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto | null;
}

export class SessionQueryDto {
  @IsString()
  @IsOptional()
  search?: string;
}
