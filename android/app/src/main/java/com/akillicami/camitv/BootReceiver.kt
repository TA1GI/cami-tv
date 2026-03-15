package com.akillicami.camitv

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * Cami TV — BootReceiver
 * Cihaz açılınca uygulamayı ve KeepAwake servisini otomatik başlatır.
 *
 * Android 14+ "Background Activity Launch (BAL)" kısıtlamasını aşmak için
 * Full-Screen Intent Notification kullanır. Bu, saat alarmı uygulamalarının
 * kullandığı resmi Android mekanizmasıdır — ek izin gerektirmez.
 *
 * 3 aşamalı deneme stratejisi:
 * 1. Doğrudan startActivity (eski Android veya SYSTEM_ALERT_WINDOW varsa çalışır)
 * 2. Full-Screen Intent Notification (Android 14+ BAL bypass — evrensel)
 * 3. AlarmManager ile uzun vadeli denemeler (sistem düzeyinde güvenilir)
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "CamiTV.Boot"
        const val ACTION_RETRY_LAUNCH = "com.akillicami.camitv.RETRY_LAUNCH"
        private const val CHANNEL_ID = "boot_launch_channel"
        private const val NOTIFICATION_ID = 9999

        // Handler ile kısa denemeler (ms)
        private val SHORT_DELAYS = longArrayOf(5000, 10000, 15000)
        // AlarmManager ile uzun denemeler (ms)
        private val ALARM_DELAYS = longArrayOf(30000, 45000, 60000)
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED -> handleBoot(context)
            ACTION_RETRY_LAUNCH -> launchWithFullScreenIntent(context, "AlarmManager")
        }
    }

    private fun handleBoot(context: Context) {
        Log.i(TAG, "Boot tamamlandı, otomatik başlatma kontrol ediliyor...")

        // Ayarı oku
        val prefs = context.getSharedPreferences("CamiTvPrefs", Context.MODE_PRIVATE)
        val autoBoot = prefs.getBoolean("auto_boot", true)
        if (!autoBoot) {
            Log.i(TAG, "Otomatik başlatma kapalı, çıkılıyor.")
            return
        }

        // Notification kanalını oluştur (Android 8+)
        createNotificationChannel(context)

        // KeepAwake servisini hemen başlat
        try {
            val serviceIntent = Intent(context, KeepAwakeService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            Log.i(TAG, "KeepAwakeService başlatıldı.")
        } catch (e: Exception) {
            Log.e(TAG, "KeepAwakeService başlatılamadı: ${e.message}")
        }

        // ── Kısa denemeler: Handler ──────────────────────
        val handler = Handler(Looper.getMainLooper())
        for ((index, delay) in SHORT_DELAYS.withIndex()) {
            handler.postDelayed({
                launchWithFullScreenIntent(context, "Handler #${index + 1} (${delay}ms)")
            }, delay)
        }

        // ── Uzun denemeler: AlarmManager ─────────────────
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
        if (alarmManager != null) {
            for ((index, delay) in ALARM_DELAYS.withIndex()) {
                val retryIntent = Intent(context, BootReceiver::class.java).apply {
                    action = ACTION_RETRY_LAUNCH
                }
                val pi = PendingIntent.getBroadcast(
                    context,
                    100 + index,
                    retryIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                alarmManager.set(
                    AlarmManager.ELAPSED_REALTIME_WAKEUP,
                    SystemClock.elapsedRealtime() + delay,
                    pi
                )
                Log.i(TAG, "AlarmManager deneme ${index + 1} planlandı: ${delay}ms sonra")
            }
        }
    }

    /**
     * Full-Screen Intent Notification ile Activity başlatma.
     *
     * Android 14+ doğrudan arka plan startActivity'yi engelliyor (BAL).
     * Ama Full-Screen Intent'li notification'lar HER ZAMAN çalışır —
     * bu, saat alarmı uygulamalarının kullandığı resmi mekanizmadır.
     *
     * Akış:
     * 1. Önce doğrudan startActivity dener (eski Android veya izin varsa çalışır)
     * 2. Başarısızsa Full-Screen Intent Notification gösterir (BAL bypass)
     */
    private fun launchWithFullScreenIntent(context: Context, source: String) {
        // ── Yöntem 1: Doğrudan startActivity ────────────
        // Eski Android sürümlerinde veya SYSTEM_ALERT_WINDOW varsa bu yeterli
        try {
            val directIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            }
            context.startActivity(directIntent)
            Log.i(TAG, "Activity doğrudan başlatıldı [$source]")

            // Başarılıysa notification'ı temizle
            cancelNotification(context)
            return
        } catch (e: Exception) {
            Log.w(TAG, "Doğrudan başlatma başarısız [$source]: ${e.message}")
        }

        // ── Yöntem 2: Full-Screen Intent Notification ───
        // Android 14+ BAL kısıtlamasını aşar
        try {
            val activityIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val fullScreenPendingIntent = PendingIntent.getActivity(
                context,
                200,
                activityIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )

            val notification = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Cami TV")
                .setContentText("Uygulama başlatılıyor...")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setFullScreenIntent(fullScreenPendingIntent, true)
                .setAutoCancel(true)
                .build()

            val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE)
                as NotificationManager
            notificationManager.notify(NOTIFICATION_ID, notification)

            Log.i(TAG, "Full-Screen Intent Notification gönderildi [$source]")
        } catch (e: Exception) {
            Log.e(TAG, "Full-Screen Notification başarısız [$source]: ${e.message}")
        }
    }

    private fun createNotificationChannel(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Otomatik Başlatma",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "TV açıldığında uygulamayı otomatik başlatır"
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            }
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE)
                as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun cancelNotification(context: Context) {
        try {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE)
                as NotificationManager
            manager.cancel(NOTIFICATION_ID)
        } catch (_: Exception) {}
    }
}
