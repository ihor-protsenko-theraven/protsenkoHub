import {
  Body,
  Controller,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/types';
import {
  PushEndpointDto,
  PushSubscriptionDto,
} from './dto/push-subscription.dto';
import { SleepReminderService } from './sleep-reminder.service';

@Controller('sleep-reminders')
export class SleepReminderController {
  constructor(private readonly reminders: SleepReminderService) {}

  @Get('config')
  @UseGuards(JwtAuthGuard)
  configuration() {
    return this.reminders.configuration();
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  subscribe(@CurrentUser() user: AuthUser, @Body() dto: PushSubscriptionDto) {
    return this.reminders.subscribe(user, dto);
  }

  @Post('unsubscribe')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  unsubscribe(@CurrentUser() user: AuthUser, @Body() dto: PushEndpointDto) {
    return this.reminders.unsubscribe(user, dto.endpoint);
  }

  @Get('dispatch')
  @Header('Cache-Control', 'no-store')
  dispatch(@Headers('authorization') authorization?: string) {
    const secret = process.env.CRON_SECRET;
    const actual = authorization ?? '';
    const expected = secret ? `Bearer ${secret}` : '';
    if (
      !secret ||
      actual.length !== expected.length ||
      !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
    ) {
      throw new UnauthorizedException();
    }
    return this.reminders.dispatch();
  }
}
