import { formatAgeMonths, formatAllowedFrom } from './feeding-age.util';

describe('feeding age labels', () => {
  it('pluralizes completed months', () => {
    expect(formatAgeMonths(1)).toBe('1 місяць');
    expect(formatAgeMonths(2)).toBe('2 місяці');
    expect(formatAgeMonths(6)).toBe('6 місяців');
    expect(formatAgeMonths(21)).toBe('21 місяць');
  });

  it('uses the genitive for the allowed-from label', () => {
    expect(formatAllowedFrom(1)).toBe('з 1 місяця');
    expect(formatAllowedFrom(6)).toBe('з 6 місяців');
    expect(formatAllowedFrom(21)).toBe('з 21 місяця');
  });
});
