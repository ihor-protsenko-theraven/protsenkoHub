export interface MeasurementChild {
  readonly id: string;
  readonly name: string;
  readonly birthDate: string | null;
}

export interface MeasurementItem {
  readonly id: string;
  readonly childId: string;
  readonly measuredAt: string;
  readonly weightKg: number | null;
  readonly heightCm: number | null;
  readonly headCircumferenceCm: number | null;
  readonly notes: string | null;
  readonly createdByName: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MeasurementsFeed {
  readonly child: MeasurementChild | null;
  readonly measurements: readonly MeasurementItem[];
}

export interface MeasurementFormModel {
  readonly measuredAt: string;
  readonly weightKg: string;
  readonly heightCm: string;
  readonly headCircumferenceCm: string;
  readonly notes: string;
}

export interface MeasurementPayload {
  readonly measuredAt: string;
  readonly weightKg?: number | null;
  readonly heightCm?: number | null;
  readonly headCircumferenceCm?: number | null;
  readonly notes?: string | null;
}

export interface EnrichedMeasurement extends MeasurementItem {
  readonly ageLabel: string | null;
  readonly weightDeltaGrams: number | null;
  readonly heightDeltaCm: number | null;
  readonly headDeltaCm: number | null;
}

export interface MetricSummary {
  readonly key: 'weight' | 'height' | 'head';
  readonly label: string;
  readonly valueFormatted: string;
  readonly deltaFormatted: string | null;
  readonly measuredAtFormatted: string;
  readonly unit: string;
}
