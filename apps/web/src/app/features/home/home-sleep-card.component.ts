import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatMinutes } from '../sleep/sleep-clock';
import { SleepService } from '../sleep/sleep.service';

@Component({
  selector: 'app-home-sleep-card',
  imports: [DatePipe, RouterLink],
  providers: [SleepService],
  templateUrl: './home-sleep-card.component.html',
  styleUrl: './home-sleep-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSleepCard {
  readonly sleep = inject(SleepService);
  readonly sleepDuration = formatMinutes;
}
