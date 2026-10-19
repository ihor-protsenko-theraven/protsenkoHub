import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const KINDS = ['NAP', 'NIGHT'] as const;

export class StartSleepDto {
  @IsOptional()
  @IsIn(KINDS)
  kind?: 'NAP' | 'NIGHT';

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class StopSleepDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateSleepDto {
  @IsIn(KINDS)
  kind!: 'NAP' | 'NIGHT';

  @IsDateString()
  startedAt!: string;

  @IsDateString()
  endedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSleepDto {
  @IsOptional()
  @IsIn(KINDS)
  kind?: 'NAP' | 'NIGHT';

  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdatePauseDto {
  @IsOptional()
  @IsDateString()
  startedAt?: string;

  @IsOptional()
  @IsDateString()
  endedAt?: string | null;
}

export class PauseSleepDto {
  @IsOptional()
  @IsDateString()
  startedAt?: string;
}

export class ResumeSleepDto {
  @IsOptional()
  @IsDateString()
  endedAt?: string;
}

export class UpdateSleepProfileDto {
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(4)
  napTarget?: number | null;
}
