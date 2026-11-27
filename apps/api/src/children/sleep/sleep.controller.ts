import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/types';
import {
  CreateSleepDto,
  CreateSavedPauseDto,
  PauseSleepDto,
  ResumeSleepDto,
  StartSleepDto,
  StopSleepDto,
  UpdatePauseDto,
  UpdateSleepDto,
  UpdateSleepProfileDto,
  WidgetSleepActionDto,
} from './dto/sleep.dto';
import { SleepService } from './sleep.service';
import { notifySleepReminderScheduler } from './sleep-reminder-time';

@Controller('children/sleep')
@UseGuards(JwtAuthGuard)
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser, @Query('widget') widget?: string) {
    return this.sleepService.overview(user, widget === '1');
  }

  @Get('status')
  @Header('Cache-Control', 'private, no-store')
  status(@CurrentUser() user: AuthUser) {
    return this.sleepService.status(user);
  }

  @Get('widget')
  @Header('Cache-Control', 'private, no-store')
  widgetSnapshot(@CurrentUser() user: AuthUser) {
    return this.sleepService.widgetSnapshot(user);
  }

  @Post('widget/action')
  @Header('Cache-Control', 'private, no-store')
  widgetAction(
    @CurrentUser() user: AuthUser,
    @Body() dto: WidgetSleepActionDto,
  ) {
    return this.updateSchedule(this.sleepService.widgetAction(user, dto));
  }

  @Post('start')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartSleepDto) {
    return this.updateSchedule(this.sleepService.start(user, dto));
  }

  @Post('stop')
  stop(@CurrentUser() user: AuthUser, @Body() dto: StopSleepDto) {
    return this.updateSchedule(this.sleepService.stop(user, dto));
  }

  @Post('pause')
  pause(@CurrentUser() user: AuthUser, @Body() dto: PauseSleepDto) {
    return this.updateSchedule(this.sleepService.pause(user, dto));
  }

  @Post('resume')
  resume(@CurrentUser() user: AuthUser, @Body() dto: ResumeSleepDto) {
    return this.updateSchedule(this.sleepService.resume(user, dto));
  }

  @Post(':id/continue')
  continueSaved(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.updateSchedule(this.sleepService.continueSaved(user, id));
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSleepDto) {
    return this.updateSchedule(this.sleepService.create(user, dto));
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSleepProfileDto,
  ) {
    return this.updateSchedule(this.sleepService.updateProfile(user, dto));
  }

  @Patch('pauses/:pauseId')
  updatePause(
    @CurrentUser() user: AuthUser,
    @Param('pauseId') pauseId: string,
    @Body() dto: UpdatePauseDto,
  ) {
    return this.updateSchedule(this.sleepService.updatePause(user, pauseId, dto));
  }

  @Post(':id/pauses')
  createSavedPause(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSavedPauseDto,
  ) {
    return this.updateSchedule(this.sleepService.createSavedPause(user, id, dto));
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSleepDto,
  ) {
    return this.updateSchedule(this.sleepService.update(user, id, dto));
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.updateSchedule(this.sleepService.remove(user, id));
  }

  private async updateSchedule<T>(mutation: Promise<T>): Promise<T> {
    const result = await mutation;
    await notifySleepReminderScheduler();
    return result;
  }
}
