package com.akillicami.camitv

import android.annotation.SuppressLint
import android.app.Activity
import android.os.Bundle
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

/**
 * Cami TV — Ana Activity
 * WebView'ı tam ekran, kiosk modunda başlatır.
 * Tüm uygulama mantığı web tarafında (index.html) çalışır.
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView

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
        setContentView(webView)

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
    }

    private var backPressedTime: Long = 0

    // ─── Çıkış için çift dokunma uyarısı ──────────────────
    override fun onBackPressed() {
        if (backPressedTime + 2000 > System.currentTimeMillis()) {
            super.onBackPressed()
            // finish() veya exitProcess(0) gerekebilir, ama super yeterli
        } else {
            android.widget.Toast.makeText(this, "Çıkmak için tekrar basın", android.widget.Toast.LENGTH_SHORT).show()
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

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        hideSystemUI()
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
}
