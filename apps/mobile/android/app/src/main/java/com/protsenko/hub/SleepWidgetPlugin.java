package com.protsenko.hub;

import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "SleepWidget")
public class SleepWidgetPlugin extends Plugin {
    static final String PREFS_NAME = "sleep_widget";
    static final String SNAPSHOT_KEY = "snapshot";
    static final Object STATE_LOCK = new Object();
    private static final int MAX_SNAPSHOT_BYTES = 16_384;

    @PluginMethod
    public void setSnapshot(PluginCall call) {
        String raw = call.getString("snapshot");
        if (raw == null || raw.length() > MAX_SNAPSHOT_BYTES) {
            call.reject("Invalid sleep widget snapshot");
            return;
        }

        try {
            JSONObject display = projectSnapshot(new JSONObject(raw));
            JSONObject credential = call.getObject("actionCredential");
            SharedPreferences.Editor edit = SleepWidgetCredentialStore.preferences(getContext())
                    .edit().putString(SNAPSHOT_KEY, display.toString());
            if (credential == null) {
                SleepWidgetCredentialStore.removeFromEdit(edit);
            } else {
                SleepWidgetCredentialStore.putInEdit(edit, credential.optString("token", ""),
                        call.getString("apiOrigin"), credential.optString("expiresAt", ""));
            }
            synchronized (STATE_LOCK) {
                if (!edit.commit()) throw new IOException("Could not save sleep widget state");
                SleepWidgetProvider.refreshAll(getContext());
            }
            call.resolve();
        } catch (JSONException | GeneralSecurityException | IOException | IllegalArgumentException error) {
            call.reject("Invalid sleep widget snapshot", error);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        SharedPreferences.Editor edit = SleepWidgetCredentialStore.preferences(getContext())
                .edit().remove(SNAPSHOT_KEY);
        SleepWidgetCredentialStore.removeFromEdit(edit);
        synchronized (STATE_LOCK) {
            if (!edit.commit()) {
                call.reject("Could not clear sleep widget state");
                return;
            }
            SleepWidgetProvider.refreshAll(getContext());
        }
        call.resolve();
    }

    static boolean replaceSnapshotFromServer(Context context, JSONObject source, String feedback,
            String expectedToken, String expectedSessionId, int expectedRevision, String expectedState)
            throws JSONException, IOException, GeneralSecurityException {
        JSONObject display = projectSnapshot(source);
        if (feedback != null) display.put("feedback", feedback);
        synchronized (STATE_LOCK) {
            if (!matchesCurrent(context, expectedToken, expectedSessionId,
                    expectedRevision, expectedState)) return false;
            if (!SleepWidgetCredentialStore.preferences(context).edit()
                    .putString(SNAPSHOT_KEY, display.toString()).commit()) {
                throw new IOException("Could not save sleep widget state");
            }
            SleepWidgetProvider.refreshAll(context);
        }
        return true;
    }

    static void setFeedback(Context context, String feedback, String expectedToken,
            String expectedSessionId, int expectedRevision, String expectedState) {
        synchronized (STATE_LOCK) {
            try {
                if (!matchesCurrent(context, expectedToken, expectedSessionId,
                        expectedRevision, expectedState)) return;
                JSONObject display = SleepWidgetProvider.readSnapshot(context);
                if (display == null) return;
                display.put("feedback", feedback);
                SleepWidgetCredentialStore.preferences(context).edit()
                        .putString(SNAPSHOT_KEY, display.toString()).apply();
                SleepWidgetProvider.refreshAll(context);
            } catch (JSONException | GeneralSecurityException | IOException ignored) {
                // The application will repair the display on its next authenticated refresh.
            }
        }
    }

    static boolean matchesCurrent(Context context, String expectedToken, String sessionId,
            int revision, String state) throws GeneralSecurityException, IOException {
        SleepWidgetCredentialStore.Credential current = SleepWidgetCredentialStore.read(context);
        JSONObject display = SleepWidgetProvider.readSnapshot(context);
        return current != null && current.token.equals(expectedToken) && display != null
                && display.optString("sessionId", "").equals(sessionId)
                && display.optInt("revision", -1) == revision
                && display.optString("state", "").equals(state)
                && display.optString("feedback", "").isEmpty();
    }

    static void clearUnauthorized(Context context, String expectedToken) {
        synchronized (STATE_LOCK) {
            try {
                SleepWidgetCredentialStore.Credential current = SleepWidgetCredentialStore.read(context);
                if (current == null || !current.token.equals(expectedToken)) return;
                SharedPreferences.Editor edit = SleepWidgetCredentialStore.preferences(context)
                        .edit().remove(SNAPSHOT_KEY);
                SleepWidgetCredentialStore.removeFromEdit(edit);
                edit.commit();
                SleepWidgetProvider.refreshAll(context);
            } catch (GeneralSecurityException | IOException ignored) {
                // A broken key is not usable for further actions.
            }
        }
    }

    private static JSONObject projectSnapshot(JSONObject source) throws JSONException {
        if (source.optInt("schemaVersion") != 1) {
            throw new IllegalArgumentException("Unsupported sleep widget snapshot");
        }
        String state = source.optString("state", "");
        if (!state.equals("idle") && !state.equals("sleeping")
                && !state.equals("paused") && !state.equals("stale")) {
            throw new IllegalArgumentException("Invalid sleep widget state");
        }
        String childName = source.optString("childName", "Дитина").trim();
        String timeZone = source.optString("timeZone", "Europe/Kyiv");
        JSONObject active = source.optJSONObject("active");
        if ((state.equals("sleeping") || state.equals("paused")) && active == null) {
            throw new IllegalArgumentException("Missing active sleep session");
        }
        JSONObject display = new JSONObject();
        display.put("childName", childName.substring(0, Math.min(childName.length(), 40)));
        display.put("state", state);
        display.put("nextSleepAt", source.optString("nextSleepAt", ""));
        display.put("receivedAt", nowIso());
        display.put("timeZone", timeZone.substring(0, Math.min(timeZone.length(), 64)));
        display.put("asleepMs", active == null ? 0 : Math.max(0, active.optLong("asleepMs", 0)));
        JSONObject last = source.optJSONObject("lastSleep");
        if (last != null) {
            JSONObject projectedLast = new JSONObject();
            projectedLast.put("kind", last.optString("kind", "NAP"));
            projectedLast.put("startedAt", last.optString("startedAt", ""));
            projectedLast.put("endedAt", last.optString("endedAt", ""));
            projectedLast.put("asleepMs", Math.max(0, last.optLong("asleepMs", 0)));
            display.put("lastSleep", projectedLast);
        }
        if (active != null) {
            String sessionId = active.optString("sessionId", "");
            int revision = active.optInt("revision", -1);
            if (sessionId.length() > 0 && sessionId.length() <= 128 && revision >= 0) {
                display.put("sessionId", sessionId);
                display.put("revision", revision);
                display.put("kind", active.optString("kind", "NAP"));
                display.put("startedAt", active.optString("startedAt", ""));
                display.put("pauseCount", Math.max(0, active.optInt("pauseCount", 0)));
            }
        }
        return display;
    }

    private static String nowIso() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }
}
