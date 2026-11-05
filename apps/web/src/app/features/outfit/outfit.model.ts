export type OutingMode = 'stroller' | 'carrier' | 'walking' | 'car';
export type OutingTime = 'now' | 'later' | 'tomorrow';

export interface OutfitLocation {
  name: string;
  latitude: number;
  longitude: number;
}

export interface GeocodingResponse {
  results?: Array<{
    id: number;
    name: string;
    admin1?: string;
    country?: string;
    latitude: number;
    longitude: number;
  }>;
}

export interface OutfitForecast {
  utc_offset_seconds: number;
  hourly: {
    time: number[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: number[];
    wind_speed_10m: number[];
    uv_index: number[];
  };
}

export interface OutfitWeather {
  time: Date;
  temperature: number;
  feelsLike: number;
  rainChance: number;
  wind: number;
  uv: number;
}

export interface OutfitAdvice {
  title: string;
  layers: string[];
  take: string[];
  reason: string;
  safety: string[];
}
