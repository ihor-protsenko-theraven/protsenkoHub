import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SaveFamilyChildDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate!: string;
}
