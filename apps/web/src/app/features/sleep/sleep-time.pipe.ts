import {Pipe, PipeTransform} from '@angular/core';
import {formatSleepTime, SleepTimeFormat} from './sleep-time';

@Pipe({name: 'sleepTime'})
export class SleepTimePipe implements PipeTransform {
  transform(
    value: string | Date | null | undefined,
    timeZone: string,
    format: SleepTimeFormat = 'clock',
  ): string {
    return formatSleepTime(value, timeZone, format);
  }
}
