package com.akillicami.camitv

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * KeepAwakeService — Foreground Service
 *
 * TV'nin otomatik standby/uyku moduna geçmesini engeller.
 * 3 katmanlı koruma:
 *   1) PARTIAL_WAKE_LOCK → CPU uyumasın
 *   2) Periyodik vendor-ayarı sıfırlama → Axen/Hikeen gibi TV'lerin
 *      kendi uyku zamanlayıcılarını devre dışı bırakır
 *   3) START_STICKY → Sistem servisi öldürürse otomatik yeniden başlar
 */
class KeepAwakeService : Service() {

    companion object {
        private const val TAG = "KeepAwakeService"
        private const val CHANNEL_ID = "camitv_keep_awake"
        private const val NOTIFICATION_ID = 1
        // Her 30 dakikada bir vendor ayarlarını sıfırla
        private const val RESET_INTERVAL_MS = 30L * 60 * 1000
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private val handler = Handler(Looper.getMainLooper())
    private val vendorResetRunnable = object : Runnable {
        override fun run() {
            resetVendorSleepSettings()
            handler.postDelayed(this, RESET_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.i(TAG, "KeepAwakeService başlatıldı")

        // 1) WakeLock al
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "CamiTV::KeepAwakeLock"
        ).apply {
            acquire()
        }
        Log.i(TAG, "WakeLock alındı")

        // 2) Vendor ayarlarını hemen sıfırla ve periyodik döngüyü başlat
        resetVendorSleepSettings()
        handler.postDelayed(vendorResetRunnable, RESET_INTERVAL_MS)

        // 3) Foreground Service olarak başlat
        startForeground(NOTIFICATION_ID, createNotification())
        Log.i(TAG, "Foreground Service aktif")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // Sistem servisi öldürürse otomatik yeniden başlat
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        Log.i(TAG, "KeepAwakeService durduruluyor")
        handler.removeCallbacks(vendorResetRunnable)
        wakeLock?.let {
            if (it.isHeld) {
                it.release()
                Log.i(TAG, "WakeLock serbest bırakıldı")
            }
        }
        wakeLock = null
        super.onDestroy()
    }

    /**
     * Axen/Hikeen (ve benzeri) Android TV'lerin kendi uyku zamanlayıcılarını
     * devre dışı bırakır. Bu ayarlar 'settings put system' namespace'inde olduğu
     * için WRITE_SETTINGS izni ile değiştirilebilir (root gerekmez).
     */
    private fun resetVendorSleepSettings() {
        try {
            val cr = contentResolver

            // Kumandaya basılmadığında kapanma süresi (dakika) → 0 = kapalı
            Settings.System.putInt(cr, "setting_no_op_sleep_time", 0)

            // Otomatik uyku süresi (dakika) → 0 = kapalı
            Settings.System.putInt(cr, "setting_auto_sleep_time", 0)

            // Sinyal yoksa kapanma → 0 = kapalı
            Settings.System.putInt(cr, "setting_nosignal_sleep_status", 0)

            // Uyku modu zamanı → 0 = kapalı
            Settings.System.putInt(cr, "setting_sleep_mode_time", 0)

            // Ekran kapanma süresi → Maksimum değer (yaklaşık 24 gün)
            Settings.System.putInt(cr, "screen_off_timeout", 2147483647)

            Log.i(TAG, "Vendor uyku ayarları sıfırlandı")
        } catch (e: Exception) {
            // Bazı cihazlarda bu ayarlar olmayabilir — sessizce yoksay
            Log.w(TAG, "Vendor ayarları sıfırlanamadı: ${e.message}")
        }
    }

    private fun createNotification(): Notification {
        // Notification Channel oluştur (API 26+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Cami TV Aktif",
                NotificationManager.IMPORTANCE_LOW  // Ses çıkarmaz, minimal görünüm
            ).apply {
                description = "Cami TV ekranın açık kalmasını sağlar"
                setShowBadge(false)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }

        // Bildirime tıklayınca uygulamayı aç
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }

        return builder
            .setContentTitle("Cami TV")
            .setContentText("Ekran açık tutuluyor")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock) // Sistem ikonu kullan
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()
    }
}
