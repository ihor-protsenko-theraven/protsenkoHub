import { MeasurementFormModel } from './measurements.model';

export const MEASUREMENT_METRICS = [
  { key: 'weight', label: 'Вага', unit: 'кг', step: '0.01' },
  { key: 'height', label: 'Зріст', unit: 'см', step: '0.1' },
  { key: 'head', label: 'Окружність голови', unit: 'см', step: '0.1' },
] as const;

export const MEASUREMENT_FILTERS = [
  { value: 'ALL', label: 'Усі показники' },
  { value: 'weight', label: 'Лише вага' },
  { value: 'height', label: 'Лише зріст' },
  { value: 'head', label: 'Лише голова' },
] as const;

export type MeasurementFilter = (typeof MEASUREMENT_FILTERS)[number]['value'];

export const createEmptyMeasurementForm = (): MeasurementFormModel => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    measuredAt: today,
    weightKg: '',
    heightCm: '',
    headCircumferenceCm: '',
    notes: '',
  };
};
