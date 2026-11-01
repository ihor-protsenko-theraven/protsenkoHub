import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateMeasurementDto {
  @IsDateString()
  measuredAt!: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(250)
  weightKg?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(250)
  heightCm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(150)
  headCircumferenceCm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateMeasurementDto {
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(250)
  weightKg?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(250)
  heightCm?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(150)
  headCircumferenceCm?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
