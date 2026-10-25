export function nativeDeepLinkRoute(rawUrl: string): '/app/sleep' | null {
  try {
    const url = new URL(rawUrl);
    if (
      url.protocol === 'protsenkohub:' &&
      url.hostname === 'sleep' &&
      (url.pathname === '' || url.pathname === '/') &&
      !url.search && !url.hash && !url.port && !url.username && !url.password
    ) {
      return '/app/sleep';
    }
  } catch {
    // Ignore malformed external links.
  }
  return null;
}
