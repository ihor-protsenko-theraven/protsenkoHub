import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  email!: string;
}

export class RegisterInvitedDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
