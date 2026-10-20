import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SLEEP_REMINDER } from '../sleep-reminder.config';

export class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SLEEP_REMINDER.maxKeyLength)
  p256dh!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(SLEEP_REMINDER.maxKeyLength)
  auth!: string;
}

export class PushEndpointDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(SLEEP_REMINDER.maxEndpointLength)
  endpoint!: string;
}

export class PushSubscriptionDto extends PushEndpointDto {
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys!: PushKeysDto;
}
