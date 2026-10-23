import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
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
} from './dto/sleep.dto';
import { SleepService } from './sleep.service';

@Controller('children/sleep')
@UseGuards(JwtAuthGuard)
export class SleepController {
  constructor(private readonly sleepService: SleepService) {}

  @Get()
  overview(@CurrentUser() user: AuthUser) {
    return this.sleepService.overview(user);
  }

  @Post('start')
  start(@CurrentUser() user: AuthUser, @Body() dto: StartSleepDto) {
    return this.sleepService.start(user, dto);
  }

  @Post('stop')
  stop(@CurrentUser() user: AuthUser, @Body() dto: StopSleepDto) {
    return this.sleepService.stop(user, dto);
  }

  @Post('pause')
  pause(@CurrentUser() user: AuthUser, @Body() dto: PauseSleepDto) {
    return this.sleepService.pause(user, dto);
  }

  @Post('resume')
  resume(@CurrentUser() user: AuthUser, @Body() dto: ResumeSleepDto) {
    return this.sleepService.resume(user, dto);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSleepDto) {
    return this.sleepService.create(user, dto);
  }

  @Patch('profile')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSleepProfileDto,
  ) {
    return this.sleepService.updateProfile(user, dto);
  }

  @Patch('pauses/:pauseId')
  updatePause(
    @CurrentUser() user: AuthUser,
    @Param('pauseId') pauseId: string,
    @Body() dto: UpdatePauseDto,
  ) {
    return this.sleepService.updatePause(user, pauseId, dto);
  }

  @Post(':id/pauses')
  createSavedPause(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateSavedPauseDto,
  ) {
    return this.sleepService.createSavedPause(user, id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateSleepDto,
  ) {
    return this.sleepService.update(user, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.sleepService.remove(user, id);
  }
}
