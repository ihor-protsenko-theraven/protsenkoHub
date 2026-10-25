package com.protsenko.hub;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;
import android.view.View;
import android.widget.RemoteViews;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONException;
import org.json.JSONObject;

public class SleepWidgetProvider extends AppWidgetProvider {
    private static final String ACTION_EXPIRE = "com.protsenko.hub.SLEEP_WIDGET_EXPIRE";
    static final long STALE_AFTER_MS = 45L * 60L * 1000L;
    static final long CLOCK_TOLERANCE_MS = 5L * 60L * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_EXPIRE.equals(intent.getAction())) {
            refreshAll(context);
            return;
        }
        super.onReceive(context, intent);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        update(context, manager, appWidgetIds);
        scheduleExpiry(context, appWidgetIds.length > 0);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SleepWidgetProvider.class));
        update(context, manager, ids);
        scheduleExpiry(context, ids.length > 0);
    }

    @Override
    public void onDisabled(Context context) {
        scheduleExpiry(context, false);
        super.onDisabled(context);
    }

    private static void update(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) {
            manager.updateAppWidget(id, render(context, id));
        }
    }

    private static void scheduleExpiry(Context context, boolean hasWidgets) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Intent expire = new Intent(context, SleepWidgetProvider.class).setAction(ACTION_EXPIRE);
        PendingIntent pending = PendingIntent.getBroadcast(context, 0, expire,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        JSONObject snapshot = hasWidgets ? readSnapshot(context) : null;
        long receivedAt = snapshot == null ? -1 : parseIso(snapshot.optString("receivedAt", ""));
        long now = System.currentTimeMillis();
        boolean alreadyStale = snapshot != null && "stale".equals(snapshot.optString("state"));
        if (receivedAt <= 0 || receivedAt > now + CLOCK_TOLERANCE_MS
                || receivedAt + STALE_AFTER_MS <= now || alreadyStale) {
            alarms.cancel(pending);
            return;
        }
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, receivedAt + STALE_AFTER_MS, pending);
    }

    private static RemoteViews render(Context context, int widgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.sleep_widget);
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("protsenkohub://sleep"), context, MainActivity.class);
        open.addCategory(Intent.CATEGORY_BROWSABLE);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        views.setViewVisibility(R.id.widget_action, View.GONE);
        views.setViewVisibility(R.id.widget_open, View.VISIBLE);

        JSONObject snapshot = readSnapshot(context);
        views.setViewVisibility(R.id.widget_timer, View.GONE);
        views.setViewVisibility(R.id.widget_value, View.VISIBLE);
        if (snapshot == null) {
            views.setTextViewText(R.id.widget_child, "Сон дитини");
            views.setTextViewText(R.id.widget_state, "Потрібен вхід");
            views.setTextViewText(R.id.widget_value, "Увійдіть");
            views.setTextViewText(R.id.widget_updated, "Дані приховано");
            return views;
        }

        String child = snapshot.optString("childName", "Дитина").trim();
        views.setTextViewText(R.id.widget_child, child.isEmpty() ? "Дитина" : child);
        long receivedAt = parseIso(snapshot.optString("receivedAt", ""));
        long now = System.currentTimeMillis();
        long age = receivedAt > 0 ? Math.max(0, now - receivedAt) : Long.MAX_VALUE;
        boolean stale = age >= STALE_AFTER_MS || receivedAt > now + CLOCK_TOLERANCE_MS;
        String timeZone = snapshot.optString("timeZone", "Europe/Kyiv");
        String updated = receivedAt > 0
                ? "Дані на " + formatTime(receivedAt, timeZone)
                : "Час оновлення невідомий";
        views.setTextViewText(R.id.widget_updated, stale ? "Застаріло · " + updated : updated);

        String state = snapshot.optString("state", "stale");
        if (stale || state.equals("stale")) {
            views.setTextViewText(R.id.widget_state, "Перевірте стан сну");
            views.setTextViewText(R.id.widget_value, "Оновіть дані");
        } else if (state.equals("sleeping")) {
            long duration = Math.max(0, snapshot.optLong("asleepMs", 0) + age);
            views.setTextViewText(R.id.widget_state, "Сон на " + formatTime(receivedAt, timeZone));
            views.setViewVisibility(R.id.widget_value, View.GONE);
            views.setViewVisibility(R.id.widget_timer, View.VISIBLE);
            views.setChronometer(R.id.widget_timer, SystemClock.elapsedRealtime() - duration, null, true);
            configureAction(context, views, widgetId, snapshot, "pause", "Пауза");
        } else if (state.equals("paused")) {
            views.setTextViewText(R.id.widget_state, "Пауза сну");
            views.setTextViewText(R.id.widget_value, formatDuration(snapshot.optLong("asleepMs", 0)));
            configureAction(context, views, widgetId, snapshot, "resume", "Продовжити");
        } else {
            long next = parseIso(snapshot.optString("nextSleepAt", ""));
            views.setTextViewText(R.id.widget_state, "Наступний сон");
            views.setTextViewText(R.id.widget_value, next > 0
                    ? formatTime(next, timeZone)
                    : "Без прогнозу");
        }
        String feedback = snapshot.optString("feedback", "");
        if (!feedback.isEmpty()) {
            views.setTextViewText(R.id.widget_updated, feedback + " · " + updated);
        }
        return views;
    }

    private static void configureAction(Context context, RemoteViews views, int widgetId,
            JSONObject snapshot, String action, String label) {
        String sessionId = snapshot.optString("sessionId", "");
        int revision = snapshot.optInt("revision", -1);
        if (sessionId.isEmpty() || revision < 0
                || !snapshot.optString("feedback", "").isEmpty()
                || !SleepWidgetCredentialStore.isAvailable(context)) return;
        Intent intent = new Intent(context, SleepWidgetActionReceiver.class)
                .setAction(SleepWidgetActionReceiver.ACTION_WIDGET_TOGGLE)
                .putExtra(SleepWidgetActionReceiver.EXTRA_ACTION, action)
                .putExtra(SleepWidgetActionReceiver.EXTRA_SESSION_ID, sessionId)
                .putExtra(SleepWidgetActionReceiver.EXTRA_REVISION, revision)
                .putExtra(SleepWidgetActionReceiver.EXTRA_STATE, snapshot.optString("state", ""));
        PendingIntent pending = PendingIntent.getBroadcast(context, widgetId, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setTextViewText(R.id.widget_action, label);
        views.setOnClickPendingIntent(R.id.widget_action, pending);
        views.setViewVisibility(R.id.widget_action, View.VISIBLE);
        views.setViewVisibility(R.id.widget_open, View.GONE);
        views.setViewVisibility(R.id.widget_updated, View.GONE);
    }

    static JSONObject readSnapshot(Context context) {
        String raw = context.getSharedPreferences(SleepWidgetPlugin.PREFS_NAME, Context.MODE_PRIVATE)
                .getString(SleepWidgetPlugin.SNAPSHOT_KEY, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException error) {
            return null;
        }
    }

    static long parseIso(String value) {
        if (value == null || value.isEmpty()) return -1;
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        format.setLenient(false);
        try {
            Date date = format.parse(value);
            return date == null ? -1 : date.getTime();
        } catch (ParseException error) {
            return -1;
        }
    }

    private static String formatDuration(long millis) {
        long minutes = Math.max(0, millis) / 60_000L;
        return String.format(Locale.getDefault(), "%d:%02d", minutes / 60, minutes % 60);
    }

    private static String formatTime(long millis, String timeZone) {
        SimpleDateFormat format = new SimpleDateFormat("HH:mm", Locale.forLanguageTag("uk-UA"));
        format.setTimeZone(TimeZone.getTimeZone(timeZone));
        return format.format(new Date(millis));
    }
}
