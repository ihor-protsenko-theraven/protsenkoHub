import { describe, expect, it } from 'vitest';
import {
  calculateAgeAtDate,
  enrichMeasurements,
  formatDelta,
  formatHead,
  formatHeight,
  formatWeight,
  formatWeightDelta,
} from './measurements.util';
import type { MeasurementItem } from './measurements.model';

describe('measurements.util', () => {
  describe('formatting functions', () => {
    it('formats weight in kg', () => {
      expect(formatWeight(8.45)).toBe('8,45 кг');
      expect(formatWeight(null)).toBe('—');
      expect(formatWeight(undefined)).toBe('—');
    });

    it('formats height in cm', () => {
      expect(formatHeight(71.5)).toBe('71,5 см');
      expect(formatHeight(null)).toBe('—');
    });

    it('formats head circumference in cm', () => {
      expect(formatHead(44.2)).toBe('44,2 см');
      expect(formatHead(null)).toBe('—');
    });

    it('formats deltas with signs', () => {
      expect(formatDelta(1.5, 'см')).toBe('+1,5 см');
      expect(formatDelta(-0.5, 'см')).toBe('-0,5 см');
      expect(formatDelta(0, 'см')).toBe('0 см');
      expect(formatDelta(null, 'см')).toBeNull();
    });

    it('formats weight delta in grams or kg', () => {
      expect(formatWeightDelta(450)).toBe('+450 г');
      expect(formatWeightDelta(-200)).toBe('-200 г');
      expect(formatWeightDelta(1250)).toBe('+1,25 кг');
      expect(formatWeightDelta(null)).toBeNull();
    });
  });

  describe('calculateAgeAtDate', () => {
    it('calculates days if under a month', () => {
      expect(calculateAgeAtDate('2026-05-15', '2026-05-25')).toBe('10 дн.');
    });

    it('calculates months and days if under a year', () => {
      expect(calculateAgeAtDate('2026-05-15', '2026-08-15')).toBe('3 міс.');
      expect(calculateAgeAtDate('2026-05-15', '2026-08-20')).toBe('3 міс. 5 дн.');
    });

    it('calculates years and months if over a year', () => {
      expect(calculateAgeAtDate('2025-05-15', '2026-08-15')).toBe('1 р. 3 міс.');
      expect(calculateAgeAtDate('2025-05-15', '2026-05-15')).toBe('1 р.');
    });

    it('handles null birthdate gracefully', () => {
      expect(calculateAgeAtDate(null, '2026-08-15')).toBeNull();
    });
  });

  describe('enrichMeasurements', () => {
    it('calculates progressive deltas from previous measurement', () => {
      const items: readonly MeasurementItem[] = [
        {
          id: '2',
          childId: 'c1',
          measuredAt: '2026-07-01',
          weightKg: 8.5,
          heightCm: 71.0,
          headCircumferenceCm: 44.0,
          notes: null,
          createdByName: null,
          createdAt: '2026-07-01',
          updatedAt: '2026-07-01',
        },
        {
          id: '1',
          childId: 'c1',
          measuredAt: '2026-06-01',
          weightKg: 8.0,
          heightCm: 69.5,
          headCircumferenceCm: 43.0,
          notes: null,
          createdByName: null,
          createdAt: '2026-06-01',
          updatedAt: '2026-06-01',
        },
      ];

      const enriched = enrichMeasurements(items, '2026-01-01');

      expect(enriched).toHaveLength(2);
      // Newest measurement (id 2) should have deltas from id 1
      expect(enriched[0].weightDeltaGrams).toBe(500);
      expect(enriched[0].heightDeltaCm).toBe(1.5);
      expect(enriched[0].headDeltaCm).toBe(1);

      // Oldest measurement (id 1) has no previous record
      expect(enriched[1].weightDeltaGrams).toBeNull();
      expect(enriched[1].heightDeltaCm).toBeNull();
      expect(enriched[1].headDeltaCm).toBeNull();
    });
  });
});
