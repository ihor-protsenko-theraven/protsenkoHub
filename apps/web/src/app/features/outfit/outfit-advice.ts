import { OUTFIT, OUTFIT_COPY } from './outfit.config';
import type { OutfitAdvice, OutfitForecast, OutfitWeather, OutingMode, OutingTime } from './outfit.model';

export function outingInstant(choice: OutingTime, now: Date, offsetSeconds = -now.getTimezoneOffset() * 60): Date {
  if (choice === 'now') return now;
  if (choice === 'later') return new Date(now.getTime() + OUTFIT.laterHours * 60 * 60_000);
  const local = new Date(now.getTime() + offsetSeconds * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1, OUTFIT.tomorrowHour) - offsetSeconds * 1000);
}

export function weatherAt(forecast: OutfitForecast, target: Date): OutfitWeather | null {
  const times = forecast.hourly?.time;
  if (!times?.length) return null;
  const targetSeconds = target.getTime() / 1000;
  const index = times.findIndex((time) => time >= targetSeconds);
  if (index < 0) return null;
  const hourly = forecast.hourly;
  const values = [hourly.temperature_2m[index], hourly.apparent_temperature[index],
    hourly.precipitation_probability[index], hourly.wind_speed_10m[index], hourly.uv_index[index]];
  if (values.some((value) => !Number.isFinite(value))) return null;
  return { time: new Date(times[index]! * 1000), temperature: values[0]!, feelsLike: values[1]!,
    rainChance: values[2]!, wind: values[3]!, uv: values[4]! };
}

export function childAgeMonths(birthDate: string, now: Date): number | null {
  const [year, month, day] = birthDate.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  if (!Number.isFinite(birth.getTime()) || birth > now) return null;
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months--;
  return Math.max(0, months);
}

export function buildOutfitAdvice(weather: OutfitWeather, mode: OutingMode, ageMonths: number): OutfitAdvice {
  const feels = weather.feelsLike;
  let choice: { title: string; layers: readonly string[] };
  if (feels <= OUTFIT.coldC) {
    choice = OUTFIT_COPY.cold;
  } else if (feels <= OUTFIT.coolC) {
    choice = OUTFIT_COPY.cool;
  } else if (feels <= OUTFIT.mildC) {
    choice = OUTFIT_COPY.mild;
  } else if (feels < OUTFIT.hotC) {
    choice = OUTFIT_COPY.warm;
  } else {
    choice = OUTFIT_COPY.hot;
  }
  let layers = [...choice.layers];
  const take: string[] = [];
  const safety: string[] = [];
  if (weather.rainChance >= OUTFIT.rainyPercent) take.push(OUTFIT_COPY.take.rain);
  if (weather.wind >= OUTFIT.windyKmh) take.push(OUTFIT_COPY.take.wind);
  if (weather.uv >= OUTFIT.highUv) take.push(OUTFIT_COPY.take.sun);
  if (mode === 'stroller' && feels <= OUTFIT.mildC) take.push(OUTFIT_COPY.take.stroller);
  if (mode === 'carrier') safety.push(OUTFIT_COPY.safety.carrier);
  if (mode === 'car') {
    layers = layers.filter((layer) => layer !== OUTFIT_COPY.cool.layers[3]);
    safety.push(OUTFIT_COPY.safety.car);
  }
  if (ageMonths < OUTFIT.youngBabyMonths && weather.uv >= OUTFIT.highUv) {
    safety.push(OUTFIT_COPY.safety.youngSun);
  }
  if (feels >= OUTFIT.hotC) safety.push(OUTFIT_COPY.safety.heat);
  return {
    title: choice.title, layers, take,
    reason: `${OUTFIT_COPY.feelsLike} ${Math.round(feels)}°C; ${OUTFIT_COPY.rain} ${Math.round(weather.rainChance)}%, ${OUTFIT_COPY.wind} ${Math.round(weather.wind)} км/год.`,
    safety,
  };
}
