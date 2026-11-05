import { httpResource } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { OUTFIT, OUTFIT_COPY } from './outfit.config';
import type { GeocodingResponse, OutfitForecast, OutfitLocation } from './outfit.model';

@Injectable()
export class OutfitService {
  readonly query = signal('');
  readonly location = signal<OutfitLocation | null>(this.restoreLocation());
  readonly places = httpResource<GeocodingResponse>(() => this.query().length >= OUTFIT.minSearchLength
    ? { url: 'https://geocoding-api.open-meteo.com/v1/search', params: {
      name: this.query(), count: '5', language: 'uk', format: 'json',
    } } : undefined);
  readonly forecast = httpResource<OutfitForecast>(() => {
    const place = this.location();
    return place ? { url: 'https://api.open-meteo.com/v1/forecast', params: {
      latitude: String(place.latitude), longitude: String(place.longitude),
      hourly: 'temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,uv_index',
      forecast_days: String(OUTFIT.forecastDays), timeformat: 'unixtime', timezone: 'auto',
    } } : undefined;
  });

  select(location: OutfitLocation): void {
    this.location.set(location);
    try {
      if (location.name === OUTFIT_COPY.currentLocation) localStorage.removeItem(OUTFIT.storageKey);
      else localStorage.setItem(OUTFIT.storageKey, JSON.stringify(location));
    } catch { /* Storage is optional. */ }
  }

  private restoreLocation(): OutfitLocation | null {
    try {
      const raw = localStorage.getItem(OUTFIT.storageKey);
      if (!raw) return null;
      const value: unknown = JSON.parse(raw);
      if (typeof value !== 'object' || value === null) return null;
      const place = value as Record<string, unknown>;
      if (typeof place['name'] !== 'string' || typeof place['latitude'] !== 'number' ||
        typeof place['longitude'] !== 'number' || !Number.isFinite(place['latitude']) ||
        !Number.isFinite(place['longitude'])) return null;
      return { name: place['name'], latitude: place['latitude'], longitude: place['longitude'] };
    } catch { return null; }
  }
}
