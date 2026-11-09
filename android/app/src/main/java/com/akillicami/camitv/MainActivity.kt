package com.akillicami.camitv

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.WindowManager
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout

/**
 * Cami TV — Ana Activity
 * WebView'ı tam ekran, kiosk modunda başlatır.
 * Tüm uygulama mantığı web tarafında (index.html) çalışır.
 */
class MainActivity : Activity() {

    companion object {
        private const val FILE_CHOOSER_REQUEST_CODE = 1001
    }

    private lateinit var webView: WebView
    private var settingsServer: SettingsServer? = null
    private var fileUploadCallback: ValueCallback<Array<Uri>>? = null

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

        // ─── Overlay izni kontrolü (Android 14+ boot auto-start için) ───
        // Android 14+ arka plandan Activity başlatmayı (BAL) engelliyor.
        // SYSTEM_ALERT_WINDOW izni bu kısıtlamayı aşar.
        // Normal TV'lerde zaten verilmiş olabilir, olmasa bile bir kez istemek yeterli.
        checkOverlayPermission()

        // ─── WebView Kurulum ───────────────────────────────
        webView = WebView(this)

        val rootLayout = FrameLayout(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        rootLayout.addView(webView)

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

        // ─── WebChromeClient (Dosya Seçici / input[type=file]) ───
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileUploadCallback?.onReceiveValue(null)
                fileUploadCallback = filePathCallback

                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                return try {
                    startActivityForResult(
                        Intent.createChooser(intent, "Arkaplan Resmi Seç"),
                        FILE_CHOOSER_REQUEST_CODE
                    )
                    true
                } catch (e: Exception) {
                    fileUploadCallback?.onReceiveValue(null)
                    fileUploadCallback = null
                    false
                }
            }
        }

        // ─── Ana sayfayı yükle ─────────────────────────────
        // Web dosyaları assets/web/ klasöründe
        webView.loadUrl("file:///android_asset/web/index.html")

        // ─── Yerel Web Sunucuyu Başlat (Telefonla Ayar) ────
        try {
            settingsServer = SettingsServer(this, webView, 8090)
            settingsServer?.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }

        // ─── KeepAwake Servisini Başlat ─────────────────────
        startKeepAwakeService()
    }

    private var backPressedTime: Long = 0

    // ─── Overlay izni kontrolü (evrensel) ─────────────────────
    // Android 14+ arka plandan Activity başlatmayı (BAL) engelliyor.
    // SYSTEM_ALERT_WINDOW izni bunu aşar. İlk kurulumda bir kez istemek yeterli.
    private fun checkOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!android.provider.Settings.canDrawOverlays(this)) {
                // Kullanıcıyı sistem izin ekranına yönlendir
                try {
                    val intent = Intent(
                        android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:$packageName")
                    )
                    startActivity(intent)
                } catch (e: Exception) {
                    // Bazı TV'lerde bu ekran olmayabilir — sessizce devam et
                    e.printStackTrace()
                }
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_CHOOSER_REQUEST_CODE) {
            if (resultCode == RESULT_OK) {
                val uris: Array<Uri>? = when {
                    data?.clipData != null -> {
                        val count = data.clipData!!.itemCount
                        Array(count) { i -> data.clipData!!.getItemAt(i).uri }
                    }
                    data?.data != null -> arrayOf(data.data!!)
                    else -> null
                }
                fileUploadCallback?.onReceiveValue(uris)
            } else {
                fileUploadCallback?.onReceiveValue(null)
            }
            fileUploadCallback = null
        }
    }

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

        // Ana ekrandaysa çift basım ile arka plana at
        // moveTaskToBack: uygulamayı arka plana atar, normal TV'lerde stopped olmaz.
        // Hikeen TV'lerde force-stop olabilir — bunun için ADB kurulum scripti gerekir.
        if (backPressedTime + 2000 > System.currentTimeMillis()) {
            moveTaskToBack(true)
        } else {
            showWebViewToast("Uygulamadan çıkmak için tekrar basın")
        }
        backPressedTime = System.currentTimeMillis()
    }

    /**
     * WebView içinde platform-bağımsız toast mesajı gösterir.
     * Native Android Toast, Hikeen gibi özel TV firmware'larda çalışmayabiliyor.
     */
    private fun showWebViewToast(message: String) {
        val js = """
        (function() {
            var existing = document.getElementById('android-toast');
            if (existing) existing.remove();
            var toast = document.createElement('div');
            toast.id = 'android-toast';
            toast.textContent = '${message.replace("'", "\\'")}';
            toast.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);' +
                'background:rgba(0,0,0,0.85);color:#fff;padding:12px 28px;border-radius:8px;' +
                'font-size:1rem;z-index:99999;pointer-events:none;opacity:0;' +
                'transition:opacity 0.3s ease;font-family:sans-serif;text-align:center;' +
                'max-width:80%;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
            document.body.appendChild(toast);
            requestAnimationFrame(function() { toast.style.opacity = '1'; });
            setTimeout(function() {
                toast.style.opacity = '0';
                setTimeout(function() { toast.remove(); }, 300);
            }, 2000);
        })();
        """.trimIndent()
        webView.evaluateJavascript(js, null)
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
        settingsServer?.stop()
        // KeepAwake servisini durdur
        stopService(Intent(this, KeepAwakeService::class.java))
    }

    private fun startKeepAwakeService() {
        val serviceIntent = Intent(this, KeepAwakeService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }
}
