import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormField, form, minLength, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { map, timer } from 'rxjs';
import { FamilyService } from '../family/family.service';
import { buildOutfitAdvice, childAgeMonths, outingInstant, weatherAt } from './outfit-advice';
import { OUTFIT, OUTFIT_COPY } from './outfit.config';
import type { OutfitLocation, OutingMode, OutingTime } from './outfit.model';
import { OutfitService } from './outfit.service';

@Component({
  selector: 'app-outfit-page',
  imports: [DatePipe, DecimalPipe, FormField, RouterLink],
  providers: [OutfitService, FamilyService],
  templateUrl: './outfit.page.html',
  styleUrl: './outfit.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OutfitPage {
  readonly data = inject(OutfitService);
  readonly family = inject(FamilyService);
  private readonly destroyRef = inject(DestroyRef);
  private manualLocationChosen = false;
  private locationRequestId = 0;
  readonly searchModel = signal({ name: '' });
  readonly searchForm = form(this.searchModel, (path) => {
    required(path.name);
    minLength(path.name, OUTFIT.minSearchLength);
  });
  readonly mode = signal<OutingMode>('stroller');
  readonly time = signal<OutingTime>('now');
  readonly locationError = signal('');
  readonly locating = signal(false);
  readonly now = toSignal(timer(0, OUTFIT.clockRefreshMs).pipe(map(() => new Date())), { initialValue: new Date() });
  readonly target = computed(() => outingInstant(this.time(), this.now(),
    this.data.forecast.hasValue() ? this.data.forecast.value().utc_offset_seconds : undefined));
  readonly targetTimeZone = computed(() => {
    if (!this.data.forecast.hasValue()) return undefined;
    const offset = this.data.forecast.value().utc_offset_seconds;
    const sign = offset < 0 ? '-' : '+';
    const hours = String(Math.floor(Math.abs(offset) / 3600)).padStart(2, '0');
    const minutes = String(Math.floor(Math.abs(offset) % 3600 / 60)).padStart(2, '0');
    return `${sign}${hours}${minutes}`;
  });
  readonly child = computed(() => this.family.overview.hasValue() ? this.family.overview.value().child : null);
  readonly ageMonths = computed(() => {
    const date = this.child()?.birthDate;
    return date ? childAgeMonths(date, this.now()) : null;
  });
  readonly weather = computed(() => this.data.forecast.hasValue()
    ? weatherAt(this.data.forecast.value(), this.target()) : null);
  readonly advice = computed(() => {
    const weather = this.weather();
    const age = this.ageMonths();
    return weather && age !== null ? buildOutfitAdvice(weather, this.mode(), age) : null;
  });

  constructor() {
    void this.locateIfPermitted();
  }

  private async locateIfPermitted(): Promise<void> {
    if (!navigator.geolocation || !navigator.permissions) return;
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'granted' && !this.destroyRef.destroyed && !this.manualLocationChosen) {
        this.locate(true);
      }
    } catch { /* The manual GPS button remains available. */ }
  }

  search(event: Event): void {
    event.preventDefault();
    if (!this.searchForm().valid() || this.searchModel().name.trim().length < OUTFIT.minSearchLength) return;
    this.locationError.set('');
    this.data.query.set(this.searchModel().name.trim());
  }

  choose(place: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }): void {
    this.manualLocationChosen = true;
    this.locationRequestId++;
    this.locating.set(false);
    const location: OutfitLocation = {
      name: [place.name, place.admin1 ?? place.country].filter(Boolean).join(', '),
      latitude: place.latitude,
      longitude: place.longitude,
    };
    this.data.select(location);
    this.data.query.set('');
    this.searchModel.set({ name: '' });
    this.locationError.set('');
  }

  locate(automatic = false): void {
    if (!navigator.geolocation) {
      this.locationError.set('Цей пристрій не підтримує визначення місця. Знайдіть місто вручну.');
      return;
    }
    if (!automatic) this.manualLocationChosen = true;
    const requestId = ++this.locationRequestId;
    this.locating.set(true);
    this.locationError.set('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (this.destroyRef.destroyed || requestId !== this.locationRequestId) return;
        this.data.select({ name: OUTFIT_COPY.currentLocation, latitude: position.coords.latitude,
          longitude: position.coords.longitude });
        this.locating.set(false);
      },
      () => {
        if (this.destroyRef.destroyed || requestId !== this.locationRequestId) return;
        this.locating.set(false);
        if (!automatic || !this.data.location()) {
          this.locationError.set('Не вдалося визначити місце. Дозвольте геолокацію або знайдіть місто вручну.');
        }
      },
      { timeout: OUTFIT.geoTimeoutMs, maximumAge: OUTFIT.geoCacheMs },
    );
  }
}
