import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/types';
import { UpsertFeedingRecordDto } from './dto/feeding.dto';
import { FeedingService } from './feeding.service';

@Controller('feeding')
@UseGuards(JwtAuthGuard)
export class FeedingController {
  constructor(private readonly feeding: FeedingService) {}

  @Get('dictionary')
  dictionary() {
    return this.feeding.dictionary();
  }

  @Get('records')
  records(@CurrentUser() user: AuthUser, @Query('childId') childId?: string) {
    return this.feeding.records(user, childId?.trim() || undefined);
  }

  @Put('records/:foodItemId')
  upsert(
    @CurrentUser() user: AuthUser,
    @Param('foodItemId') foodItemId: string,
    @Query('childId') childId: string | undefined,
    @Body() dto: UpsertFeedingRecordDto,
  ) {
    return this.feeding.upsert(
      user,
      foodItemId,
      dto,
      childId?.trim() || undefined,
    );
  }
}
