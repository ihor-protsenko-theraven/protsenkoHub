import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;

  @IsOptional()
  @IsString()
  rrule?: string;

  @IsOptional()
  @IsString()
  memberId?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  rrule?: string | null;

  @IsOptional()
  @IsString()
  memberId?: string | null;
}
