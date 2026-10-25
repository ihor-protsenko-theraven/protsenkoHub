package com.protsenko.hub;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import java.util.Arrays;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

final class SleepWidgetCredentialStore {
    private static final String KEY_ALIAS = "protsenko_hub_sleep_widget_action_v1";
    private static final String TOKEN_KEY = "action_token_encrypted";
    private static final String EXPIRES_KEY = "action_token_expires_at";
    private static final String ORIGIN_KEY = "action_api_origin";
    private static final int GCM_TAG_BITS = 128;
    private static final int GCM_IV_BYTES = 12;

    static final class Credential {
        final String token;
        final String apiOrigin;
        final long expiresAt;

        Credential(String token, String apiOrigin, long expiresAt) {
            this.token = token;
            this.apiOrigin = apiOrigin;
            this.expiresAt = expiresAt;
        }
    }

    private SleepWidgetCredentialStore() {}

    static String validateOrigin(String value) {
        if (value == null) throw new IllegalArgumentException("Missing widget API origin");
        try {
            URI uri = new URI(value);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getHost().isEmpty() || uri.getRawUserInfo() != null
                    || uri.getRawQuery() != null || uri.getRawFragment() != null
                    || (uri.getRawPath() != null && !uri.getRawPath().isEmpty()
                    && !"/".equals(uri.getRawPath()))) {
                throw new IllegalArgumentException("Invalid widget API origin");
            }
            return uri.getScheme().toLowerCase() + "://" + uri.getRawAuthority();
        } catch (URISyntaxException error) {
            throw new IllegalArgumentException("Invalid widget API origin", error);
        }
    }

    static void putInEdit(SharedPreferences.Editor edit, String token, String origin,
            String expiresAt) throws GeneralSecurityException, IOException {
        if (token == null || token.isEmpty() || token.length() > 4096) {
            throw new IllegalArgumentException("Invalid widget action credential");
        }
        long expires = SleepWidgetProvider.parseIso(expiresAt);
        if (expires <= System.currentTimeMillis()) {
            throw new IllegalArgumentException("Expired widget action credential");
        }
        String apiOrigin = validateOrigin(origin);
        edit.putString(TOKEN_KEY, encrypt(token));
        edit.putLong(EXPIRES_KEY, expires);
        edit.putString(ORIGIN_KEY, apiOrigin);
    }

    static void removeFromEdit(SharedPreferences.Editor edit) {
        edit.remove(TOKEN_KEY).remove(EXPIRES_KEY).remove(ORIGIN_KEY);
    }

    static Credential read(Context context) throws GeneralSecurityException, IOException {
        SharedPreferences prefs = preferences(context);
        String ciphertext = prefs.getString(TOKEN_KEY, null);
        if (ciphertext == null) return null;
        String origin = validateOrigin(prefs.getString(ORIGIN_KEY, null));
        long expiresAt = prefs.getLong(EXPIRES_KEY, 0);
        if (expiresAt <= System.currentTimeMillis()) return null;
        return new Credential(decrypt(ciphertext), origin, expiresAt);
    }

    static boolean isAvailable(Context context) {
        SharedPreferences prefs = preferences(context);
        return prefs.contains(TOKEN_KEY) && prefs.getLong(EXPIRES_KEY, 0) > System.currentTimeMillis();
    }

    static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences(SleepWidgetPlugin.PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static String encrypt(String token) throws GeneralSecurityException, IOException {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] iv = cipher.getIV();
        byte[] ciphertext = cipher.doFinal(token.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        byte[] packed = new byte[iv.length + ciphertext.length];
        System.arraycopy(iv, 0, packed, 0, iv.length);
        System.arraycopy(ciphertext, 0, packed, iv.length, ciphertext.length);
        return Base64.encodeToString(packed, Base64.NO_WRAP);
    }

    private static String decrypt(String packedBase64) throws GeneralSecurityException, IOException {
        byte[] packed;
        try {
            packed = Base64.decode(packedBase64, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            throw new GeneralSecurityException("Invalid encrypted widget credential", error);
        }
        if (packed.length < GCM_IV_BYTES + 16) {
            throw new GeneralSecurityException("Invalid encrypted widget credential");
        }
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(),
                new GCMParameterSpec(GCM_TAG_BITS, Arrays.copyOfRange(packed, 0, GCM_IV_BYTES)));
        return new String(cipher.doFinal(Arrays.copyOfRange(packed, GCM_IV_BYTES, packed.length)),
                java.nio.charset.StandardCharsets.UTF_8);
    }

    private static SecretKey key() throws GeneralSecurityException, IOException {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        KeyStore.Entry entry = store.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return generator.generateKey();
    }
}
