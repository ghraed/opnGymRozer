package ch.duartesantos.opengym;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.text.format.DateFormat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.Date;

/** System UI renders the countdown; no WebView ticks or background service are needed. */
final class RestTimerNotifications {
    // Separate from LocalNotifications reminder IDs 100..106 and their channels.
    private static final int ID = 21001;
    private static final String TIMER = "rest-countdown";
    private static final String ALERT = "rest-complete";
    private static final String QUIET_ALERT = "rest-complete-quiet";

    private static SharedPreferences state(Context context) {
        return context.getSharedPreferences("rest-timer", Context.MODE_PRIVATE);
    }

    private static NotificationManager manager(Context context) {
        return (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private static void channels(Context context) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel timer = new NotificationChannel(TIMER, "Rest countdown", NotificationManager.IMPORTANCE_LOW);
        timer.setSound(null, null);
        timer.enableVibration(false);
        manager(context).createNotificationChannel(timer);
        NotificationChannel alert = new NotificationChannel(ALERT, "Rest complete", NotificationManager.IMPORTANCE_HIGH);
        alert.enableVibration(true);
        manager(context).createNotificationChannel(alert);
        NotificationChannel quiet = new NotificationChannel(QUIET_ALERT, "Rest complete (sound off)", NotificationManager.IMPORTANCE_HIGH);
        quiet.setSound(null, null);
        quiet.enableVibration(true);
        manager(context).createNotificationChannel(quiet);
    }

    private static boolean enabled(Context context) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        return Build.VERSION.SDK_INT < 26 || manager(context).getNotificationChannel(TIMER).getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private static PendingIntent alarmIntent(Context context, long endsAt) {
        Intent intent = new Intent(context, RestTimerReceiver.class).putExtra("endsAt", endsAt);
        return PendingIntent.getBroadcast(context, ID, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static NotificationCompat.Builder notification(Context context, String channel) {
        Intent launch = new Intent(context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent open = PendingIntent.getActivity(context, ID, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_rest_timer)
            .setContentIntent(open)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);
    }

    static synchronized boolean start(Context context, long endsAt, String title, String body, boolean sound, int total) {
        cancel(context);
        channels(context);
        if (endsAt <= System.currentTimeMillis() || !enabled(context)) return false;
        state(context).edit().putLong("endsAt", endsAt).putString("title", title)
            .putString("body", body).putBoolean("sound", sound).putInt("total", total).commit();
        try {
            NotificationCompat.Builder builder = notification(context, TIMER)
                .setContentTitle(title).setWhen(endsAt).setShowWhen(true)
                .setOngoing(true).setOnlyAlertOnce(true).setSilent(true)
                // System UI removes the countdown at its deadline even if an inexact
                // completion alarm is delayed. Never show a negative expired timer.
                .setTimeoutAfter(Math.max(1, endsAt - System.currentTimeMillis()))
                .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
                .setPriority(NotificationCompat.PRIORITY_LOW);
            if (Build.VERSION.SDK_INT >= 24) {
                // Android truncates chronometer seconds. Offset presentation by 999 ms
                // to match the app's ceiling; the alarm/timeout still use the real end.
                builder.setWhen(endsAt + 999).setUsesChronometer(true).setChronometerCountDown(true);
            } else {
                // Android 6 has no notification countdown API. Keep the end time useful.
                builder.setContentText(DateFormat.getTimeFormat(context).format(new Date(endsAt)));
            }
            manager(context).notify(ID, builder.build());
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            PendingIntent alarm = alarmIntent(context, endsAt);
            if (Build.VERSION.SDK_INT < 31 || alarms.canScheduleExactAlarms()) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, alarm);
            } else {
                // Normal notification permission and special exact-alarm access differ.
                // Preserve the timer when exact access is denied; OS completion may lag.
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, endsAt, alarm);
            }
            return true;
        } catch (SecurityException error) {
            cancel(context);
            return false;
        }
    }

    static synchronized void cancel(Context context) {
        ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(alarmIntent(context, 0));
        manager(context).cancel(ID);
        state(context).edit().clear().commit();
    }

    static synchronized long endsAt(Context context) {
        return state(context).getLong("endsAt", 0);
    }

    static synchronized int total(Context context) {
        return state(context).getInt("total", 1);
    }

    static synchronized boolean finish(Context context, long endsAt) {
        SharedPreferences preferences = state(context);
        if (endsAt <= 0) return false;
        if (preferences.getLong("completedAt", 0) == endsAt) return preferences.getBoolean("handled", false);
        // Ignore an alarm already dispatched for a cancelled/replaced/adjusted timer.
        if (preferences.getLong("endsAt", 0) != endsAt) return false;
        if (System.currentTimeMillis() < endsAt) return true;
        ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(alarmIntent(context, 0));
        manager(context).cancel(ID);
        boolean handled = false;
        if (NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            boolean sound = preferences.getBoolean("sound", true);
            NotificationCompat.Builder builder = notification(context, sound ? ALERT : QUIET_ALERT)
                .setContentTitle(preferences.getString("title", "Rest"))
                .setContentText(preferences.getString("body", "Rest over — next set!"))
                .setAutoCancel(true).setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(sound ? Notification.DEFAULT_ALL : Notification.DEFAULT_VIBRATE);
            try {
                manager(context).notify(ID, builder.build());
                handled = true;
            } catch (SecurityException error) { /* Permission revoked mid-rest. */ }
        }
        preferences.edit().putLong("endsAt", 0).putLong("completedAt", endsAt).putBoolean("handled", handled).commit();
        return handled;
    }
}
