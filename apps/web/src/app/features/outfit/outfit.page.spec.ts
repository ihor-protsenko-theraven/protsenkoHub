import { registerLocaleData } from '@angular/common';
import localeUk from '@angular/common/locales/uk';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FamilyService } from '../family/family.service';
import type { OutfitForecast, OutfitLocation } from './outfit.model';
import { OutfitPage } from './outfit.page';
import { OutfitService } from './outfit.service';

registerLocaleData(localeUk);

describe('OutfitPage', () => {
  it('uses GPS on opening only when permission was already granted', async () => {
    const permissions = Object.getOwnPropertyDescriptor(navigator, 'permissions');
    const geolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    const getCurrentPosition = vi.fn((success: PositionCallback) => success({
      coords: { latitude: 50.45, longitude: 30.52 },
    } as GeolocationPosition));
    Object.defineProperty(navigator, 'permissions', { configurable: true, value: {
      query: vi.fn().mockResolvedValue({ state: 'granted' }),
    } });
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition } });
    try {
      const location = signal<OutfitLocation | null>(null);
      const select = vi.fn((place: OutfitLocation) => location.set(place));
      TestBed.configureTestingModule({ imports: [OutfitPage], providers: [provideRouter([])] });
      TestBed.overrideComponent(OutfitPage, { set: { providers: [
        { provide: OutfitService, useValue: {
          location, query: signal(''), select,
          places: { isLoading: () => false, error: () => undefined, hasValue: () => false },
          forecast: { isLoading: () => true, error: () => undefined, hasValue: () => false },
        } },
        { provide: FamilyService, useValue: { overview: { isLoading: () => true, hasValue: () => false } } },
      ] } });
      const fixture = TestBed.createComponent(OutfitPage);
      await fixture.whenStable();
      expect(getCurrentPosition).toHaveBeenCalledTimes(1);
      expect(select).toHaveBeenCalledWith({ name: 'Поточне місце', latitude: 50.45, longitude: 30.52 });
    } finally {
      if (permissions) Object.defineProperty(navigator, 'permissions', permissions);
      else Reflect.deleteProperty(navigator, 'permissions');
      if (geolocation) Object.defineProperty(navigator, 'geolocation', geolocation);
      else Reflect.deleteProperty(navigator, 'geolocation');
    }
  });

  it('shows empty, error and outfit states with manual location selection', async () => {
    const location = signal<OutfitLocation | null>(null);
    const forecastError = signal<Error | undefined>(undefined);
    const hour = Math.ceil(Date.now() / 3_600_000) * 3600;
    const forecast: OutfitForecast = { utc_offset_seconds: 7200, hourly: {
      time: [hour], temperature_2m: [8], apparent_temperature: [5],
      precipitation_probability: [60], wind_speed_10m: [12], uv_index: [1],
    } };
    const select = vi.fn((place: OutfitLocation) => location.set(place));
    const outfit = {
      location, query: signal(''), select,
      places: { isLoading: () => false, error: () => undefined, hasValue: () => false,
        value: () => ({ results: [] }), reload: vi.fn() },
      forecast: { isLoading: () => false, error: forecastError,
        hasValue: () => location() !== null, value: () => forecast, reload: vi.fn() },
    };
    const family = { overview: { isLoading: () => false, error: () => undefined,
      hasValue: () => true, value: () => ({ child: { birthDate: '2025-08-01', name: 'Дитина' } }),
      reload: vi.fn() } };
    TestBed.configureTestingModule({ imports: [OutfitPage], providers: [provideRouter([])] });
    TestBed.overrideComponent(OutfitPage, { set: { providers: [
      { provide: OutfitService, useValue: outfit }, { provide: FamilyService, useValue: family },
    ] } });
    const fixture = TestBed.createComponent(OutfitPage);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Почніть із місця');

    fixture.componentInstance.choose({ name: 'Київ', latitude: 50.45, longitude: 30.52 });
    fixture.detectChanges();
    expect(select).toHaveBeenCalledWith({ name: 'Київ', latitude: 50.45, longitude: 30.52 });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Додайте теплий шар');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Захист від дощу');

    forecastError.set(new Error('network'));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Прогноз недоступний');
  });
});
