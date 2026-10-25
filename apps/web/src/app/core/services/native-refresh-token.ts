import { InjectionToken } from '@angular/core';
import { KeychainAccess, SecureStorage } from '@aparajita/capacitor-secure-storage';
import { MOBILE_AUTH } from '../configs/mobile-auth.config';

export interface NativeRefreshTokenStore {
  read(): Promise<string | null>;
  write(token: string): Promise<void>;
  clear(): Promise<void>;
}

let checkedInstall: Promise<void> | null = null;

async function checkInstall(): Promise<void> {
  checkedInstall ??= (async () => {
    // iOS Keychain can survive uninstall while WebView storage does not.
    if (localStorage.getItem(MOBILE_AUTH.installMarkerKey) !== '1') {
      await SecureStorage.remove(MOBILE_AUTH.refreshTokenKey, false);
      localStorage.setItem(MOBILE_AUTH.installMarkerKey, '1');
    }
  })().catch((error: unknown) => {
    checkedInstall = null;
    throw error;
  });
  await checkedInstall;
}

export const NATIVE_REFRESH_TOKEN_STORE = new InjectionToken<NativeRefreshTokenStore>('NATIVE_REFRESH_TOKEN_STORE', {
  providedIn: 'root',
  factory: () => ({
    async read(): Promise<string | null> {
      await checkInstall();
      const token = await SecureStorage.get(MOBILE_AUTH.refreshTokenKey, false, false);
      return typeof token === 'string' ? token : null;
    },
    async write(token: string): Promise<void> {
      await checkInstall();
      await SecureStorage.set(MOBILE_AUTH.refreshTokenKey, token, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
    },
    async clear(): Promise<void> {
      await checkInstall();
      await SecureStorage.remove(MOBILE_AUTH.refreshTokenKey, false);
    },
  }),
});
