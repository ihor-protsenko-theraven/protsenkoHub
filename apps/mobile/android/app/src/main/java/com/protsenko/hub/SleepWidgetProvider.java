package com.protsenko.hub;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.SizeF;
import android.util.TypedValue;
import android.view.View;
import android.widget.RemoteViews;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TimeZone;
import org.json.JSONException;
import org.json.JSONObject;

public class SleepWidgetProvider extends AppWidgetProvider {
    private static final float MIN_WIDTH_DP = 109f;
    private static final float COMPACT_BASE_HEIGHT_DP = 115f;
    private static final float MINI_MAX_HEIGHT_DP = 105f;
    private static final float MAX_SCALE = 2.4f;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] appWidgetIds) {
        update(context, manager, appWidgetIds);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
            int appWidgetId, Bundle newOptions) {
        manager.updateAppWidget(appWidgetId, render(context, appWidgetId));
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, SleepWidgetProvider.class));
        update(context, manager, ids);
    }

    private static void update(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, id));
    }

    private static RemoteViews render(Context context, int widgetId) {
        Bundle options = AppWidgetManager.getInstance(context).getAppWidgetOptions(widgetId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && options != null) {
            ArrayList<SizeF> sizes = widgetSizes(options);
            if (sizes != null && !sizes.isEmpty()) {
                Map<SizeF, RemoteViews> layouts = new LinkedHashMap<>();
                for (SizeF size : sizes) {
                    layouts.put(size, renderForSize(context, widgetId,
                            size.getWidth(), size.getHeight(), true));
                }
                return new RemoteViews(layouts);
            }
        }
        int width = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        int height = options == null ? 0 : options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        return renderForSize(context, widgetId, width, height, false);
    }

    @SuppressWarnings("deprecation")
    private static ArrayList<SizeF> widgetSizes(Bundle options) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, SizeF.class);
        }
        return options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES);
    }

    private static RemoteViews renderForSize(Context context, int widgetId,
            float width, float height, boolean exactSize) {
        boolean mini = height > 0 && height < MINI_MAX_HEIGHT_DP;
        boolean compact = !mini && (exactSize || width < 190 || height < 190);
        RemoteViews views = new RemoteViews(context.getPackageName(), mini
                ? R.layout.sleep_widget_mini : compact
                ? R.layout.sleep_widget_compact : R.layout.sleep_widget);
        if (compact && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            scaleCompactViews(context, views, width, height);
        } else if (mini && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            scaleMiniViews(context, views, width, height);
        }
        Intent open = new Intent(Intent.ACTION_VIEW, Uri.parse("protsenkohub://sleep"), context, MainActivity.class);
        open.addCategory(Intent.CATEGORY_BROWSABLE);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(R.id.widget_root, pending);
        views.setViewVisibility(R.id.widget_active, View.GONE);
        views.setViewVisibility(R.id.widget_idle, View.GONE);
        views.setViewVisibility(R.id.widget_fallback, View.GONE);

        JSONObject snapshot = readSnapshot(context);
        if (snapshot == null) {
            views.setTextViewText(R.id.widget_child, "Сон дитини");
            fallback(views, "Потрібен вхід");
            return views;
        }
        String child = snapshot.optString("childName", "Дитина").trim();
        views.setTextViewText(R.id.widget_child, child.isEmpty() ? "Дитина" : child);
        String feedback = snapshot.optString("feedback", "");
        String state = snapshot.optString("state", "stale");
        if (!feedback.isEmpty() || "stale".equals(state)) {
            fallback(views, feedback.isEmpty() ? "Перевірте стан сну" : feedback);
            return views;
        }

        String timeZone = snapshot.optString("timeZone", "Europe/Kyiv");
        long receivedAt = parseIso(snapshot.optString("receivedAt", ""));
        long now = System.currentTimeMillis();
        long age = receivedAt > 0 ? Math.max(0, now - receivedAt) : 0;
        if ("sleeping".equals(state) || "paused".equals(state)) {
            views.setViewVisibility(R.id.widget_active, View.VISIBLE);
            if (mini) views.setViewVisibility(R.id.widget_active_controls, View.VISIBLE);
            boolean sleeping = "sleeping".equals(state);
            long asleep = Math.max(0, snapshot.optLong("asleepMs", 0) + (sleeping ? age : 0));
            String icon = "NIGHT".equals(snapshot.optString("kind")) ? "☾ " : "☀ ";
            views.setChronometer(R.id.widget_active_duration,
                    SystemClock.elapsedRealtime() - asleep, icon + "%s", sleeping);
            String started = formatTime(parseIso(snapshot.optString("startedAt", "")), timeZone);
            int pauseCount = Math.max(0, snapshot.optInt("pauseCount", 0));
            views.setTextViewText(R.id.widget_active_detail,
                    "✎ " + started + "    Ⅱ " + pauseCount);
            views.setImageViewResource(R.id.widget_toggle, sleeping
                    ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);
            views.setContentDescription(R.id.widget_toggle, sleeping ? "Пауза" : "Продовжити");
            configureAction(context, views, widgetId, snapshot,
                    sleeping ? "pause" : "resume", R.id.widget_toggle, 1);
            configureAction(context, views, widgetId, snapshot, "delete", R.id.widget_delete, 2);
            configureAction(context, views, widgetId, snapshot, "save", R.id.widget_save, 3);
            return views;
        }

        views.setViewVisibility(R.id.widget_idle, View.VISIBLE);
        if (mini) views.setViewVisibility(R.id.widget_start, View.VISIBLE);
        JSONObject last = snapshot.optJSONObject("lastSleep");
        if (last != null) {
            long ended = parseIso(last.optString("endedAt", ""));
            long started = parseIso(last.optString("startedAt", ""));
            views.setTextViewText(R.id.widget_last_ago,
                    ended > 0 ? formatSince(Math.max(0, now - ended)) : "Останній сон");
            String icon = "NIGHT".equals(last.optString("kind")) ? "☾" : "☀";
            String interval = icon + " " + formatTime(started, timeZone) + "–"
                    + formatTime(ended, timeZone);
            String duration = formatDurationHuman(last.optLong("asleepMs", 0));
            views.setTextViewText(R.id.widget_last_detail,
                    compact || mini ? interval : interval + " · " + duration);
            if (compact || mini) views.setTextViewText(R.id.widget_last_duration, duration);
        } else {
            views.setTextViewText(R.id.widget_last_ago, "Ще немає сну");
            views.setTextViewText(R.id.widget_last_detail, "Почніть перший запис");
            if (compact || mini) views.setTextViewText(R.id.widget_last_duration, "");
        }
        configureAction(context, views, widgetId, snapshot, "start", R.id.widget_start, 4);
        return views;
    }

    private static void scaleCompactViews(Context context, RemoteViews views,
            float width, float height) {
        float scale = Math.min(MAX_SCALE, Math.max(1f,
                Math.min(width / MIN_WIDTH_DP, height / COMPACT_BASE_HEIGHT_DP)));
        int dip = TypedValue.COMPLEX_UNIT_DIP;
        int sp = TypedValue.COMPLEX_UNIT_SP;
        views.setViewLayoutHeight(R.id.widget_child, 16f * scale, dip);
        views.setViewLayoutWidth(R.id.widget_toggle, 32f * scale, dip);
        views.setViewLayoutHeight(R.id.widget_toggle, 32f * scale, dip);
        views.setViewLayoutHeight(R.id.widget_actions, 28f * scale, dip);
        for (int id : new int[] { R.id.widget_delete, R.id.widget_save }) {
            views.setViewLayoutWidth(id, 28f * scale, dip);
            views.setViewLayoutHeight(id, 28f * scale, dip);
        }
        views.setViewLayoutMargin(R.id.widget_save, RemoteViews.MARGIN_START, 18f * scale, dip);
        views.setViewLayoutWidth(R.id.widget_start, 42f * scale, dip);
        views.setViewLayoutHeight(R.id.widget_start, 42f * scale, dip);
        views.setTextViewTextSize(R.id.widget_child, sp, 10f * scale);
        views.setTextViewTextSize(R.id.widget_active_duration, sp, 18f * scale);
        views.setTextViewTextSize(R.id.widget_active_detail, sp, 9f * scale);
        views.setTextViewTextSize(R.id.widget_last_ago, sp, 14f * scale);
        views.setTextViewTextSize(R.id.widget_last_detail, sp, 9f * scale);
        views.setTextViewTextSize(R.id.widget_last_duration, sp, 9f * scale);
        views.setTextViewTextSize(R.id.widget_start, sp, 20f * scale);
        views.setTextViewTextSize(R.id.widget_fallback_title, sp, 13f * scale);
        views.setTextViewTextSize(R.id.widget_fallback_detail, sp, 10f * scale);
        int outer = dp(context, 3f * scale);
        views.setViewPadding(R.id.widget_root, outer, outer, outer, outer);
        int childHorizontal = dp(context, 7f * scale);
        views.setViewPadding(R.id.widget_child, childHorizontal, 0, childHorizontal, 0);
        int togglePadding = dp(context, 8f * scale);
        views.setViewPadding(R.id.widget_toggle, togglePadding, togglePadding,
                togglePadding, togglePadding);
        int actionPadding = dp(context, 7f * scale);
        for (int id : new int[] { R.id.widget_delete, R.id.widget_save }) {
            views.setViewPadding(id, actionPadding, actionPadding,
                    actionPadding, actionPadding);
        }
    }

    private static void scaleMiniViews(Context context, RemoteViews views,
            float width, float height) {
        float scale = Math.min(1.25f, Math.max(1f,
                Math.min(width / 140f, height / 80f)));
        int dip = TypedValue.COMPLEX_UNIT_DIP;
        int sp = TypedValue.COMPLEX_UNIT_SP;
        views.setViewLayoutHeight(R.id.widget_child, 16f * scale, dip);
        views.setViewLayoutWidth(R.id.widget_active_controls, 60f * scale, dip);
        views.setViewLayoutWidth(R.id.widget_toggle, 32f * scale, dip);
        views.setViewLayoutHeight(R.id.widget_toggle, 32f * scale, dip);
        views.setViewLayoutHeight(R.id.widget_actions, 26f * scale, dip);
        for (int id : new int[] { R.id.widget_delete, R.id.widget_save }) {
            views.setViewLayoutWidth(id, 26f * scale, dip);
            views.setViewLayoutHeight(id, 26f * scale, dip);
        }
        views.setViewLayoutMargin(R.id.widget_save, RemoteViews.MARGIN_START, 4f * scale, dip);
        views.setViewLayoutWidth(R.id.widget_start, 40f * scale, dip);
        views.setViewLayoutHeight(R.id.widget_start, 40f * scale, dip);
        views.setTextViewTextSize(R.id.widget_child, sp, 10f * scale);
        views.setTextViewTextSize(R.id.widget_active_duration, sp, 18f * scale);
        views.setTextViewTextSize(R.id.widget_active_detail, sp, 9f * scale);
        views.setTextViewTextSize(R.id.widget_last_ago, sp, 12f * scale);
        views.setTextViewTextSize(R.id.widget_last_detail, sp, 9f * scale);
        views.setTextViewTextSize(R.id.widget_last_duration, sp, 9f * scale);
        views.setTextViewTextSize(R.id.widget_start, sp, 18f * scale);
        views.setTextViewTextSize(R.id.widget_fallback_title, sp, 11f * scale);
        views.setTextViewTextSize(R.id.widget_fallback_detail, sp, 9f * scale);
        int outer = dp(context, 3f * scale);
        views.setViewPadding(R.id.widget_root, outer, outer, outer, outer);
        int childHorizontal = dp(context, 7f * scale);
        views.setViewPadding(R.id.widget_child, childHorizontal, 0, childHorizontal, 0);
        int togglePadding = dp(context, 8f * scale);
        views.setViewPadding(R.id.widget_toggle, togglePadding, togglePadding,
                togglePadding, togglePadding);
        int actionPadding = dp(context, 6f * scale);
        for (int id : new int[] { R.id.widget_delete, R.id.widget_save }) {
            views.setViewPadding(id, actionPadding, actionPadding,
                    actionPadding, actionPadding);
        }
    }

    private static int dp(Context context, float value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    private static void fallback(RemoteViews views, String title) {
        views.setViewVisibility(R.id.widget_fallback, View.VISIBLE);
        views.setTextViewText(R.id.widget_fallback_title, title);
    }

    private static void configureAction(Context context, RemoteViews views, int widgetId,
            JSONObject snapshot, String action, int viewId, int requestOffset) {
        if (!SleepWidgetCredentialStore.isAvailable(context)) return;
        String sessionId = snapshot.optString("sessionId", "");
        int revision = snapshot.optInt("revision", -1);
        if (!"start".equals(action) && (sessionId.isEmpty() || revision < 0)) return;
        Intent intent = new Intent(context, SleepWidgetActionReceiver.class)
                .setAction(SleepWidgetActionReceiver.ACTION_WIDGET_TOGGLE)
                .putExtra(SleepWidgetActionReceiver.EXTRA_ACTION, action)
                .putExtra(SleepWidgetActionReceiver.EXTRA_SESSION_ID, sessionId)
                .putExtra(SleepWidgetActionReceiver.EXTRA_REVISION, revision)
                .putExtra(SleepWidgetActionReceiver.EXTRA_STATE, snapshot.optString("state", ""));
        PendingIntent pending = PendingIntent.getBroadcast(context, widgetId * 10 + requestOffset,
                intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        views.setOnClickPendingIntent(viewId, pending);
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

    private static String formatTime(long millis, String timeZone) {
        if (millis < 0) return "—";
        SimpleDateFormat format = new SimpleDateFormat("HH:mm", Locale.forLanguageTag("uk-UA"));
        format.setTimeZone(TimeZone.getTimeZone(timeZone));
        return format.format(new Date(millis));
    }

    private static String formatSince(long millis) {
        long minutes = millis / 60_000L;
        long days = minutes / 1_440L;
        long hours = minutes % 1_440L / 60L;
        long rest = minutes % 60L;
        if (days > 0) return days + " д " + hours + " год тому";
        if (hours > 0) return hours + " год " + rest + " хв тому";
        return Math.max(1, rest) + " хв тому";
    }

    private static String formatDurationHuman(long millis) {
        long minutes = Math.max(0, millis) / 60_000L;
        long days = minutes / 1_440L;
        long hours = minutes / 60L;
        long rest = minutes % 60L;
        if (days > 0) return days + " д " + (hours % 24) + " год " + rest + " хв";
        if (hours > 0) return hours + " год " + rest + " хв";
        return minutes + " хв";
    }
}
