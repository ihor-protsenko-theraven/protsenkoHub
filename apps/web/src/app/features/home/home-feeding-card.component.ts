import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
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
  private readonly home = inject(HomeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly snapshot = this.home.snapshot;
  readonly savingFoodId = signal<string | null>(null);
  readonly allowedFrom = formatAllowedFrom;
  readonly guideSteps = feedingGuideSteps;

  laterThanChild(food: FeedingFocusFood, ageMonths: number | null): boolean {
    return ageMonths !== null && food.allowedFromAgeMonths > ageMonths;
  }

  markIntroduced(food: FeedingFocusFood): void {
    if (this.savingFoodId()) return;
    this.savingFoodId.set(food.id);
    this.home
      .markFoodIntroduced(food.id)
      .pipe(
        finalize(() => this.savingFoodId.set(null)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({ error: () => undefined });
  }
}
