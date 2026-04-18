package com.akillicami.camitv

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.WindowManager
import android.webkit.JavascriptInterface

/**
 * Cami TV — ScreenBridge
 * JavaScript ↔ Android köprüsü.
 * Web tarafından çağrılır: AndroidBridge.<fonksiyon>()
 */
class ScreenBridge(private val activity: Activity) {

    private val handler = Handler(Looper.getMainLooper())

    // ─── Temel kontrol ─────────────────────────────────────

    @JavascriptInterface
    fun isAvailable(): Boolean = true

    @JavascriptInterface
    fun getVersion(): String = "1.0.13"

    // ─── Otomatik Başlatma (Boot) ──────────────────────────

    @JavascriptInterface
    fun setAutoBoot(enabled: Boolean) {
        val prefs = activity.getSharedPreferences("CamiTvPrefs", Context.MODE_PRIVATE)
        prefs.edit().putBoolean("auto_boot", enabled).apply()
    }

    @JavascriptInterface
    fun getAutoBoot(): Boolean {
        val prefs = activity.getSharedPreferences("CamiTvPrefs", Context.MODE_PRIVATE)
        return prefs.getBoolean("auto_boot", true)
    }

    // ─── Ayarlar Senkronizasyonu ───────────────────────────

    @JavascriptInterface
    fun syncSettings(json: String) {
        val prefs = activity.getSharedPreferences("cami_tv_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("settings", json).apply()
    }

    // ─── Ekran aç/kapat ────────────────────────────────────

    @JavascriptInterface
    fun turnScreenOn() {
        handler.post {
            activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    @JavascriptInterface
    fun turnScreenOff() {
        handler.post {
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    /**
     * Belirli ms sonra ekranı kapat
     */
    @JavascriptInterface
    fun turnScreenOffDelayed(delayMs: Long) {
        handler.postDelayed({
            activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }, delayMs)
    }

    // ─── Parlaklık kontrolü ────────────────────────────────

    /**
     * Ekran parlaklığını ayarlar.
     * @param level 0-100 arası (0=karanlık, 100=maksimum)
     */
    @JavascriptInterface
    fun setBrightness(level: Int) {
        val clamped = level.coerceIn(0, 100)
        val brightness = clamped / 100f

        handler.post {
            try {
                val lp = activity.window.attributes
                lp.screenBrightness = when {
                    brightness <= 0f -> WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_OFF
                    else -> brightness.coerceIn(0.01f, 1.0f)
                }
                activity.window.attributes = lp
            } catch (e: Exception) {
                // Parlaklık ayarlanamadı — sistem izni gerekebilir
                e.printStackTrace()
            }
        }
    }

    /**
     * Sistem parlaklığını sıfıra çeker (ekran karartma)
     */
    @JavascriptInterface
    fun dimScreen() = setBrightness(1)

    /**
     * Sistem parlaklığını maksimuma çıkarır
     */
    @JavascriptInterface
    fun brightenScreen() = setBrightness(100)

    // ─── Cihaz bilgisi ──────────────────────────────────────

    @JavascriptInterface
    fun getDeviceModel(): String = android.os.Build.MODEL

    @JavascriptInterface
    fun getAndroidVersion(): String = android.os.Build.VERSION.RELEASE

    // ─── Sistem izni kontrolü ───────────────────────────────

    /**
     * Ekran parlaklığı yazma izninin var mı?
     * Android 6.0+ için WRITE_SETTINGS izni gerekir.
     */
    @JavascriptInterface
    fun canWriteSettings(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            Settings.System.canWrite(activity)
        } else {
            true
        }
    }

    /**
     * Eksik ise WRITE_SETTINGS iznini iste
     */
    @JavascriptInterface
    fun requestWriteSettings() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (!Settings.System.canWrite(activity)) {
                handler.post {
                    val intent = android.content.Intent(
                        Settings.ACTION_MANAGE_WRITE_SETTINGS,
                        android.net.Uri.parse("package:${activity.packageName}")
                    )
                    activity.startActivity(intent)
                }
            }
        }
    }

    // ─── IP Adres Bilgisi ───────────────────────────────────

    @JavascriptInterface
    fun getLocalIPAddress(): String {
        try {
            val interfaces = java.net.NetworkInterface.getNetworkInterfaces()
            while (interfaces.hasMoreElements()) {
                val intf = interfaces.nextElement()
                val addrs = intf.inetAddresses
                while (addrs.hasMoreElements()) {
                    val addr = addrs.nextElement()
                    if (!addr.isLoopbackAddress && addr is java.net.Inet4Address) {
                        return addr.hostAddress ?: ""
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return ""
    }

    // ─── Tepkisel metodlar ──────────────────────────────────

    @JavascriptInterface
    fun showToast(message: String) {
        handler.post {
            android.widget.Toast.makeText(activity, message, android.widget.Toast.LENGTH_SHORT).show()
        }
    }
}
