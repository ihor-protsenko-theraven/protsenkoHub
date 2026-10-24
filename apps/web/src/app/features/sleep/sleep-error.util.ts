export function readSleepError(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'error' in error) {
    const body = (error as { error?: { message?: unknown } }).error;
    if (typeof body?.message === 'string') return body.message;
    if (Array.isArray(body?.message) && body.message.every((item) => typeof item === 'string')) {
      return body.message.join(' ');
    }
  }
  return fallback;
}
