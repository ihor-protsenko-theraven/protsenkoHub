import { Module } from '@nestjs/common';
import { SleepController } from './sleep/sleep.controller';
import { SleepService } from './sleep/sleep.service';
import { SolomiyaController } from './solomiya.controller';
import { SolomiyaService } from './solomiya.service';

@Module({
  controllers: [SolomiyaController, SleepController],
  providers: [SolomiyaService, SleepService],
})
export class SolomiyaModule {}
