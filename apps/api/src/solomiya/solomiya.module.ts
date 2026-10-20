import { Module } from '@nestjs/common';
import { SleepController } from './sleep/sleep.controller';
import { SleepService } from './sleep/sleep.service';
import { SleepReminderController } from './sleep/sleep-reminder.controller';
import { SleepReminderService } from './sleep/sleep-reminder.service';
import { SolomiyaController } from './solomiya.controller';
import { SolomiyaService } from './solomiya.service';

@Module({
  controllers: [SolomiyaController, SleepController, SleepReminderController],
  providers: [SolomiyaService, SleepService, SleepReminderService],
})
export class SolomiyaModule {}
