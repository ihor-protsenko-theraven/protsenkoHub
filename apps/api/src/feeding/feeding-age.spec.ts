import { completedAgeMonths } from './feeding-age';

describe('completedAgeMonths', () => {
  const birth = new Date('2026-04-28T00:00:00.000Z');

  it('counts completed calendar months in Europe/Kyiv', () => {
    expect(
      completedAgeMonths(birth, new Date('2026-10-27T22:00:00.000Z')),
    ).toBe(6);
    expect(
      completedAgeMonths(birth, new Date('2026-10-27T21:59:00.000Z')),
    ).toBe(5);
  });

  it('does not return a negative age', () => {
    expect(
      completedAgeMonths(
        new Date('2026-12-01T00:00:00.000Z'),
        new Date('2026-10-28T12:00:00.000Z'),
      ),
    ).toBe(0);
  });
});
