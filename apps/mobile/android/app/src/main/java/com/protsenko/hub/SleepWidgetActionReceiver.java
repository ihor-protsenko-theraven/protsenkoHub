package com.protsenko.hub;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONException;
import org.json.JSONObject;

public final class SleepWidgetActionReceiver extends BroadcastReceiver {
    static final String ACTION_WIDGET_TOGGLE = "com.protsenko.hub.SLEEP_WIDGET_TOGGLE";
    static final String EXTRA_ACTION = "action";
    static final String EXTRA_SESSION_ID = "sessionId";
    static final String EXTRA_REVISION = "revision";
    static final String EXTRA_STATE = "state";
    private static final String SNAPSHOT_PATH = "/api/v1/children/sleep/widget";
    private static final String ACTION_PATH = "/api/v1/children/sleep/widget/action";
    private static final int NETWORK_TIMEOUT_MS = 4_000;
    private static final int MAX_RESPONSE_BYTES = 64 * 1024;
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean ACTION_IN_PROGRESS = new AtomicBoolean(false);

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_WIDGET_TOGGLE.equals(intent.getAction())) return;
        String action = intent.getStringExtra(EXTRA_ACTION);
        String sessionId = intent.getStringExtra(EXTRA_SESSION_ID);
        String state = intent.getStringExtra(EXTRA_STATE);
        int revision = intent.getIntExtra(EXTRA_REVISION, -1);
        boolean idleStart = "start".equals(action) && "idle".equals(state)
                && "".equals(sessionId) && revision == -1;
        boolean activeAction = sessionId != null && !sessionId.isEmpty() && revision >= 0
                && (("pause".equals(action) && "sleeping".equals(state))
                || ("resume".equals(action) && "paused".equals(state))
                || (("save".equals(action) || "delete".equals(action))
                && ("sleeping".equals(state) || "paused".equals(state))));
        if (!(idleStart || activeAction)
                || !ACTION_IN_PROGRESS.compareAndSet(false, true)) return;

        PendingResult pending = goAsync();
        Context appContext = context.getApplicationContext();
        try {
            EXECUTOR.execute(() -> {
                try {
                    perform(appContext, action, sessionId, revision, state);
                } finally {
                    ACTION_IN_PROGRESS.set(false);
                    pending.finish();
                }
            });
        } catch (RuntimeException error) {
            ACTION_IN_PROGRESS.set(false);
            pending.finish();
        }
    }

    private static void perform(Context context, String action, String sessionId,
            int revision, String state) {
        SleepWidgetCredentialStore.Credential credential;
        try {
            credential = SleepWidgetCredentialStore.read(context);
            if (credential == null) {
                SleepWidgetProvider.refreshAll(context);
                return;
            }
            if (!SleepWidgetPlugin.matchesCurrent(context, credential.token,
                    sessionId, revision, state)) {
                SleepWidgetProvider.refreshAll(context);
                return;
            }
        } catch (GeneralSecurityException | IOException error) {
            return;
        }

        try {
            JSONObject live = fetchSnapshot(credential);
            JSONObject active = live.optJSONObject("active");
            boolean matchesLive = "start".equals(action)
                    ? active == null && "idle".equals(live.optString("state"))
                    : active != null && sessionId.equals(active.optString("sessionId"))
                            && revision == active.optInt("revision", -1)
                            && state.equals(live.optString("state"));
            if (!matchesLive) {
                SleepWidgetPlugin.replaceSnapshotFromServer(context, live, "Стан оновлено",
                        credential.token, sessionId, revision, state);
                return;
            }
            if (!SleepWidgetPlugin.matchesCurrent(context, credential.token,
                    sessionId, revision, state)) return;
            JSONObject result = sendAction(credential, action, sessionId, revision);
            SleepWidgetPlugin.replaceSnapshotFromServer(context, result, null,
                    credential.token, sessionId, revision, state);
        } catch (WidgetHttpException error) {
            if (error.status == 401 || error.status == 403) {
                SleepWidgetPlugin.clearUnauthorized(context, credential.token);
            } else if (error.status == 409) {
                try {
                    JSONObject live = fetchSnapshot(credential);
                    SleepWidgetPlugin.replaceSnapshotFromServer(context, live, "Стан оновлено",
                            credential.token, sessionId, revision, state);
                } catch (WidgetHttpException refreshError) {
                    if (refreshError.status == 401 || refreshError.status == 403) {
                        SleepWidgetPlugin.clearUnauthorized(context, credential.token);
                    } else {
                        SleepWidgetPlugin.setFeedback(context, "Оновіть у застосунку",
                                credential.token, sessionId, revision, state);
                    }
                } catch (IOException | JSONException | GeneralSecurityException refreshError) {
                    SleepWidgetPlugin.setFeedback(context, "Немає зв’язку",
                            credential.token, sessionId, revision, state);
                }
            } else {
                SleepWidgetPlugin.setFeedback(context, "Оновіть у застосунку",
                        credential.token, sessionId, revision, state);
            }
        } catch (IOException error) {
            SleepWidgetPlugin.setFeedback(context, "Немає зв’язку",
                    credential.token, sessionId, revision, state);
        } catch (JSONException | GeneralSecurityException | IllegalArgumentException error) {
            SleepWidgetPlugin.setFeedback(context, "Оновіть у застосунку",
                    credential.token, sessionId, revision, state);
        }
    }

    private static JSONObject fetchSnapshot(SleepWidgetCredentialStore.Credential credential)
            throws IOException, JSONException {
        return request(credential, "GET", SNAPSHOT_PATH, null);
    }

    private static JSONObject sendAction(SleepWidgetCredentialStore.Credential credential,
            String action, String sessionId, int revision) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("action", action);
        if (!"start".equals(action)) {
            body.put("expectedSessionId", sessionId);
            body.put("expectedRevision", revision);
        }
        JSONObject response = request(credential, "POST", ACTION_PATH, body);
        JSONObject snapshot = response.optJSONObject("snapshot");
        if (snapshot == null) throw new JSONException("Missing action snapshot");
        return snapshot;
    }

    private static JSONObject request(SleepWidgetCredentialStore.Credential credential,
            String method, String path, JSONObject body) throws IOException, JSONException {
        HttpURLConnection connection = (HttpURLConnection) new URL(credential.apiOrigin + path)
                .openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(NETWORK_TIMEOUT_MS);
        connection.setReadTimeout(NETWORK_TIMEOUT_MS);
        connection.setRequestMethod(method);
        connection.setRequestProperty("Authorization", "Bearer " + credential.token);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Cache-Control", "no-store");
        if (body != null) {
            connection.setDoOutput(true);
            connection.setRequestProperty("Content-Type", "application/json");
        }
        try {
            if (body != null) {
                byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(bytes);
                }
            }
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) throw new WidgetHttpException(status);
            try (InputStream input = connection.getInputStream()) {
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[4_096];
                int count;
                while ((count = input.read(buffer)) != -1) {
                    if (output.size() + count > MAX_RESPONSE_BYTES) {
                        throw new IOException("Widget response too large");
                    }
                    output.write(buffer, 0, count);
                }
                return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
            }
        } finally {
            connection.disconnect();
        }
    }

    private static final class WidgetHttpException extends IOException {
        final int status;

        WidgetHttpException(int status) {
            super("Widget API returned " + status);
            this.status = status;
        }
    }
}
