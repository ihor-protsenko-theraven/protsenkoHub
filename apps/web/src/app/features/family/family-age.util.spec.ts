import { formatAgeFromBirthDate } from './family-age.util';

describe('formatAgeFromBirthDate', () => {
  const now = new Date('2026-10-23T10:00:00.000Z');

  it('rejects impossible and future dates before submitting a child profile', () => {
    expect(formatAgeFromBirthDate('2026-02-30', now)).toBeNull();
    expect(formatAgeFromBirthDate('2026-10-24', now)).toBeNull();
  });

  it('uses calendar days in the family time zone', () => {
    expect(formatAgeFromBirthDate('2026-10-20', now)).toBe('3 дн.');
  });
});
