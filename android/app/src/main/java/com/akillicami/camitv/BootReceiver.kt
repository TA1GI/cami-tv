package com.akillicami.camitv

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Cami TV — BootReceiver
 * Cihaz açılınca (veya güç gelince) uygulamayı otomatik başlatır.
 * AndroidManifest'te RECEIVE_BOOT_COMPLETED izni gerekir.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == Intent.ACTION_LOCKED_BOOT_COMPLETED) {

            // Ayarı oku: Kullanıcı ayarlardan kapattıysa başlatma
            val prefs = context.getSharedPreferences("CamiTvPrefs", Context.MODE_PRIVATE)
            val autoBoot = prefs.getBoolean("auto_boot", true)
            if (!autoBoot) return

            // 3 saniye bekleyerek başlat (sistem tam yüklendi mi diye)
            val startIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }

            // Kısa gecikmeyle başlat
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                context.startActivity(startIntent)
            }, 3000)
        }
    }
}
