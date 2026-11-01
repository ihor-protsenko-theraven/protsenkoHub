import { Module } from '@nestjs/common';
import { ChildrenController } from './children.controller';
import { ChildrenService } from './children.service';
import { HouseholdPushService } from './household-push.service';
import { MeasurementsController } from './measurements/measurements.controller';
import { MeasurementsService } from './measurements/measurements.service';
import { SleepController } from './sleep/sleep.controller';
import { SleepService } from './sleep/sleep.service';
import { SleepReminderController } from './sleep/sleep-reminder.controller';
import { SleepReminderService } from './sleep/sleep-reminder.service';

@Module({
  controllers: [
    ChildrenController,
    MeasurementsController,
    SleepController,
    SleepReminderController,
  ],
  providers: [
    ChildrenService,
    MeasurementsService,
    SleepService,
    SleepReminderService,
    HouseholdPushService,
  ],
  exports: [ChildrenService, MeasurementsService, SleepService],
})
export class ChildrenModule {}
