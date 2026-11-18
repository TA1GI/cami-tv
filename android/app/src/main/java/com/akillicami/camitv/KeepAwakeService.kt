package com.akillicami.camitv

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.provider.Settings
import android.util.Log

/**
 * KeepAwakeService — Arka Plan Servisi
 *
 * TV'nin otomatik standby/uyku moduna geçmesini engeller.
 * Koruma katmanları:
 *   1) PARTIAL_WAKE_LOCK → CPU uyumasın
 *   2) Periyodik vendor-ayarı sıfırlama → Axen/Hikeen gibi TV'lerin
 *      kendi uyku zamanlayıcılarını devre dışı bırakır
 *   3) START_STICKY → Sistem servisi öldürürse otomatik yeniden başlar
 */
class KeepAwakeService : Service() {

    companion object {
        private const val TAG = "KeepAwakeService"
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
}
