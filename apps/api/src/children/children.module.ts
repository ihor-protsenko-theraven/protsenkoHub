import { Module } from '@nestjs/common';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
import { HouseholdPushService } from './household-push.service';
import { SleepController } from './sleep/sleep.controller';
import { SleepService } from './sleep/sleep.service';
import { SleepReminderController } from './sleep/sleep-reminder.controller';
import { SleepReminderService } from './sleep/sleep-reminder.service';

@Module({
  controllers: [ChildrenController, SleepController, SleepReminderController],
  providers: [
    ChildrenService,
    SleepService,
    SleepReminderService,
    HouseholdPushService,
  ],
  exports: [ChildrenService, SleepService],
})
export class ChildrenModule {}
