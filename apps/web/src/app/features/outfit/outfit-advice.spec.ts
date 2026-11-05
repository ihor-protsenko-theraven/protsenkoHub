import { describe, expect, it } from 'vitest';
import { buildOutfitAdvice, childAgeMonths, outingInstant, weatherAt } from './outfit-advice';
import type { OutfitForecast, OutfitWeather } from './outfit.model';

const weather: OutfitWeather = {
  time: new Date('2026-11-05T09:00:00Z'), temperature: 7, feelsLike: 4,
  rainChance: 60, wind: 30, uv: 1,
};

describe('outfit advice', () => {
  it('uses the first forecast hour at or after the outing', () => {
    const forecast: OutfitForecast = { utc_offset_seconds: 7200, hourly: {
      time: [1000, 4600], temperature_2m: [7, 9], apparent_temperature: [4, 6],
      precipitation_probability: [60, 20], wind_speed_10m: [30, 10], uv_index: [1, 2],
    } };
    expect(weatherAt(forecast, new Date(2000 * 1000))?.temperature).toBe(9);
    expect(weatherAt(forecast, new Date(5000 * 1000))).toBeNull();
  });

  it('uses the selected location time zone for tomorrow morning', () => {
    expect(outingInstant('tomorrow', new Date('2026-11-05T22:00:00Z'), 2 * 3600).toISOString())
      .toBe('2026-11-07T07:00:00.000Z');
  });

  it('keeps hot stroller advice light and warns about sun for young babies', () => {
    const advice = buildOutfitAdvice({ ...weather, feelsLike: 30, uv: 6 }, 'stroller', 3);
    expect(advice.layers).toEqual(['Один легкий дихаючий шар', 'Головний убір для затінку']);
    expect(advice.take).not.toContain('Додатковий знімний шар для візочка');
    expect(advice.safety.join(' ')).toContain('Не накривайте візочок');
  });

  it('does not suggest a jacket inside a car seat', () => {
    const advice = buildOutfitAdvice(weather, 'car', 12);
    expect(advice.layers).not.toContain('Легка куртка');
    expect(advice.safety.join(' ')).toContain('під ремені');
  });

  it('uses the birth date for the young-baby boundary', () => {
    expect(childAgeMonths('2026-05-06', new Date(2026, 10, 5))).toBe(5);
    expect(childAgeMonths('2026-05-05', new Date(2026, 10, 5))).toBe(6);
  });
});
