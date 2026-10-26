import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Loader } from '../../shared/loader.component';
import { formatMinutes } from '../sleep/sleep-clock';
import { SleepTimePipe } from '../sleep/sleep-time.pipe';
import { HomeService } from './home.service';

@Component({
  selector: 'app-home-sleep-card',
  imports: [RouterLink, SleepTimePipe, Loader],
  templateUrl: './home-sleep-card.component.html',
  styleUrl: './home-sleep-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeSleepCard {
  readonly snapshot = inject(HomeService).snapshot;
  readonly sleepDuration = formatMinutes;
}
