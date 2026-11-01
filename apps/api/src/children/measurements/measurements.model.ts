export interface MeasurementChildDto {
  readonly id: string;
  readonly name: string;
  readonly birthDate: string | null;
}

export interface MeasurementDto {
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

export interface MeasurementsFeedDto {
  readonly child: MeasurementChildDto | null;
  readonly measurements: readonly MeasurementDto[];
}
