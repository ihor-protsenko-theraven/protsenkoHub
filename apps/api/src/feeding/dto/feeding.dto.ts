import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { FeedingStatus } from '@prisma/client';
import { FEEDING } from '../feeding.config';

export class UpsertFeedingRecordDto {
  @IsEnum(FeedingStatus)
  status!: FeedingStatus;

  @IsOptional()
  @IsString()
  @MaxLength(FEEDING.notesMaxLength)
  notes?: string | null;
}
