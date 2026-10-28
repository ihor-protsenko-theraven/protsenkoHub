export function feedingGuideSteps(guide: string): string[] {
  return guide
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
