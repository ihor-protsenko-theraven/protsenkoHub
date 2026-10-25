import { nativeDeepLinkRoute } from './native-deep-link';

describe('sleep widget deep link', () => {
  it('opens only the registered sleep destination', () => {
    expect(nativeDeepLinkRoute('protsenkohub://sleep')).toBe('/app/sleep');
    expect(nativeDeepLinkRoute('protsenkohub://sleep/')).toBe('/app/sleep');
    expect(nativeDeepLinkRoute('protsenkohub://sleep/../family')).toBeNull();
    expect(nativeDeepLinkRoute('https://example.test/app/sleep')).toBeNull();
    expect(nativeDeepLinkRoute('protsenkohub://sleep?redirect=https://example.test')).toBeNull();
    expect(nativeDeepLinkRoute('protsenkohub://sleep:80')).toBeNull();
  });
});
