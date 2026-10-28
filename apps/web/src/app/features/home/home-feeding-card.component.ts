import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Loader } from '../../shared/loader.component';
import { formatAllowedFrom } from '../feeding/feeding-age.util';
import { feedingGuideSteps } from '../feeding/feeding-guide.util';
import type { FeedingFocusFood } from '../feeding/feeding.model';
import { HomeService } from './home.service';

@Component({
  selector: 'app-home-feeding-card',
  imports: [RouterLink, Loader],
  templateUrl: './home-feeding-card.component.html',
  styleUrl: './home-feeding-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeFeedingCard {
  readonly snapshot = inject(HomeService).snapshot;
  readonly allowedFrom = formatAllowedFrom;
  readonly guideSteps = feedingGuideSteps;

  laterThanChild(food: FeedingFocusFood, ageMonths: number | null): boolean {
    return ageMonths !== null && food.allowedFromAgeMonths > ageMonths;
  }
}
