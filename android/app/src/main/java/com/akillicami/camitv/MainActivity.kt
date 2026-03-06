package com.akillicami.camitv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.widget.FrameLayout
import android.widget.Button
import android.widget.TextView
import android.graphics.Color
import android.view.Gravity
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Cami TV — Ana Activity
 * WebView'ı tam ekran, kiosk modunda başlatır.
 * Tüm uygulama mantığı web tarafında (index.html) çalışır.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private var settingsServer: SettingsServer? = null
    
    // OTA Update için Onay Değişkenleri
    private lateinit var updateButton: Button
    private var pendingApkUrl: String? = null
    private var pendingVersion: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // ─── Tam ekran + ekranı açık tut ───────────────────
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
            WindowManager.LayoutParams.FLAG_FULLSCREEN or
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
        )

        // System UI'ı gizle (navigation bar, status bar)
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        )

        // ─── WebView Kurulum ───────────────────────────────
        webView = WebView(this)

        val rootLayout = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(webView)

        // Güncelleme Butonu Oluştur (Başlangıçta Gizli, Sağ Üst Köşe)
        updateButton = Button(this).apply {
            text = "YENİ SÜRÜM VAR\nYüklemek için tıklayın"
            visibility = View.GONE
            
            // TV Kumandası Uyumlu Odaklanma (Focusable) Ayarları
            isFocusable = true
            isFocusableInTouchMode = true
            
            setBackgroundColor(Color.parseColor("#1976D2")) // Mavi arka plan
            setTextColor(Color.WHITE)
            textSize = 18f
            setPadding(60, 30, 60, 30)
            elevation = 15f
            
            // Kumanda ile butona gelindiğinde renk/boyut değiştirsin
            setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    setBackgroundColor(Color.parseColor("#4CAF50")) // Odaklanınca Yeşil
                    scaleX = 1.05f
                    scaleY = 1.05f
                } else {
                    setBackgroundColor(Color.parseColor("#1976D2")) // Normal Mavi
                    scaleX = 1.0f
                    scaleY = 1.0f
                }
            }
            
            val params = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP or Gravity.END
                topMargin = 60
                rightMargin = 60
            }
            layoutParams = params
            
            setOnClickListener {
                visibility = View.GONE
                pendingApkUrl?.let { url -> 
                    pendingVersion?.let { ver ->
                        downloadAndInstall(url, ver)
                    }
                }
            }
        }
        rootLayout.addView(updateButton)

        setContentView(rootLayout)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true          // localStorage
        settings.databaseEnabled = true            // IndexedDB için
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.allowFileAccess = true
        @Suppress("DEPRECATION")
        settings.allowUniversalAccessFromFileURLs = true   // fetch('data/...') için
        @Suppress("DEPRECATION")
        settings.allowFileAccessFromFileURLs = true         // file:// → file:// fetch
        settings.mediaPlaybackRequiresUserGesture = false  // Ezan sesi için
        settings.setSupportMultipleWindows(false)
        settings.javaScriptCanOpenWindowsAutomatically = false

        // ─── Android ↔ Web Köprüsü ────────────────────────
        val bridge = ScreenBridge(this)
        webView.addJavascriptInterface(bridge, "AndroidBridge")

        // ─── WebViewClient (Dahili gezinti) ───────────────
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                // settings:// şeması → settings.html'e yönlendir
                val url = request?.url?.toString() ?: return false
                if (url.startsWith("settings://")) {
                    view?.loadUrl("file:///android_asset/web/settings.html")
                    return true
                }
                // index.html'e dönüş
                if (url.contains("index.html")) {
                    view?.loadUrl("file:///android_asset/web/index.html")
                    return true
                }
                // Dış bağlantılara izin ver (GitHub'dan vakitler indirilmesi)
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Sayfa yüklenince System UI'ı tekrar gizle
                hideSystemUI()
            }
        }

        // ─── Ana sayfayı yükle ─────────────────────────────
        // Web dosyaları assets/web/ klasöründe
        webView.loadUrl("file:///android_asset/web/index.html")

        // ─── Yerel Web Sunucuyu Başlat (Telefonla Ayar) ────
        try {
            settingsServer = SettingsServer(this, webView, 8080)
            settingsServer?.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private var backPressedTime: Long = 0

    // ─── Çıkış ve Navigasyon İçin Geri Tuşu ────────────────
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
            return
        }

        val url = webView.url ?: ""
        
        // Eğer ayarlar sayfasındaysa index.html (Ana ekran) sayfasına dön
        if (url.contains("settings.html")) {
            webView.loadUrl("file:///android_asset/web/index.html")
            return
        }

        // Ana ekrandaysa çift basım ile çıkış yap
        if (backPressedTime + 2000 > System.currentTimeMillis()) {
            super.onBackPressed()
            finishAffinity()
        } else {
            android.widget.Toast.makeText(this, "Uygulamadan çıkmak için tekrar basın", android.widget.Toast.LENGTH_SHORT).show()
        }
        backPressedTime = System.currentTimeMillis()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            onBackPressed()
            return true  // Geri tuşunu yut, onBackPressed içinde hallet
        }
        return super.onKeyDown(keyCode, event)
    }

    // ─── Ekran döndüğünde System UI'ı gizle ──────────────
    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    private fun hideSystemUI() {
        window.decorView.systemUiVisibility = (
            View.SYSTEM_UI_FLAG_FULLSCREEN or
            View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        )
    }

    // ─── OTA Güncelleme Kontrolü ───────────────────────

    private val RELEASES_API = "https://api.github.com/repos/TA1GI/cami-tv/releases/latest"
    private val CURRENT_VERSION = "1.0.7"
    private val updateHandler = Handler(Looper.getMainLooper())
    private val updateRunnable = object : Runnable {
        override fun run() {
            checkForUpdate()
            // 12 saatte bir (12 * 60 * 60 * 1000 ms) tekrar kontrol et
            updateHandler.postDelayed(this, 12L * 60 * 60 * 1000)
        }
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
        // Uygulama arkaplanındayken periyodik kontrolü durdur
        updateHandler.removeCallbacks(updateRunnable)
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        hideSystemUI()
        // Döngüyü başlat (öncekini temizleyerek çiftlenmesini önle)
        updateHandler.removeCallbacks(updateRunnable)
        updateHandler.post(updateRunnable)
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
        updateHandler.removeCallbacks(updateRunnable)
        settingsServer?.stop()
    }

    fun checkForUpdate() {
        Thread {
            try {
                val url = URL(RELEASES_API)
                val conn = url.openConnection() as HttpURLConnection
                conn.setRequestProperty("Accept", "application/vnd.github+json")
                conn.connectTimeout = 5000
                conn.readTimeout = 5000

                if (conn.responseCode != 200) return@Thread

                val json = conn.inputStream.bufferedReader().readText()
                val obj = JSONObject(json)
                val latestTag = obj.getString("tag_name").trimStart('v')

                if (isNewerVersion(latestTag, CURRENT_VERSION)) {
                    // APK URL'ini bul
                    val assets = obj.getJSONArray("assets")
                    var apkUrl: String? = null
                    for (i in 0 until assets.length()) {
                        val asset = assets.getJSONObject(i)
                        if (asset.getString("name").endsWith(".apk")) {
                            apkUrl = asset.getString("browser_download_url")
                            break
                        }
                    }
                    apkUrl?.let { url -> 
                        // Güncelleme dosyasını indirip zorla kurmak yerine
                        // ekrana manuel "Yükle" butonu getir
                        pendingApkUrl = url
                        pendingVersion = latestTag
                        Handler(Looper.getMainLooper()).post {
                            updateButton.text = "GÜNCELLEME (v$latestTag)\nİndir ve Kur"
                            updateButton.visibility = View.VISIBLE
                            updateButton.requestFocus() // Doğrudan odaklansın ki kumanda ile tıklanabilsin
                        }
                    }
                }
            } catch (e: Exception) {
                // Sessizce yoksay — internet yoksa veya API erişilemez
            }
        }.start()
    }

    private fun isNewerVersion(latest: String, current: String): Boolean {
        val l = latest.split(".").map { it.toIntOrNull() ?: 0 }
        val c = current.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(l.size, c.size)) {
            val lv = l.getOrElse(i) { 0 }
            val cv = c.getOrElse(i) { 0 }
            if (lv > cv) return true
            if (lv < cv) return false
        }
        return false
    }

    private fun downloadAndInstall(apkUrl: String, version: String) {
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(this, "Yeni sürüm (v$version) indiriliyor...", Toast.LENGTH_LONG).show()
        }
        Thread {
            try {
                val apkFile = File(getExternalFilesDir(null), "cami-tv-update.apk")
                val conn = URL(apkUrl).openConnection() as HttpURLConnection
                conn.inputStream.use { input ->
                    apkFile.outputStream().use { output -> input.copyTo(output) }
                }
                val uri: Uri = FileProvider.getUriForFile(
                    this,
                    "${packageName}.fileprovider",
                    apkFile
                )
                val intent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(uri, "application/vnd.android.package-archive")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                startActivity(intent)
            } catch (e: Exception) {
                Handler(Looper.getMainLooper()).post {
                    Toast.makeText(this, "Güncelleme indirilemedi.", Toast.LENGTH_SHORT).show()
                }
            }
        }.start()
    }
}
