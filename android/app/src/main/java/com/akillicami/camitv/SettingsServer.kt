package com.akillicami.camitv

import android.content.Context
import android.os.Handler
import android.util.Base64
import android.os.Looper
import android.webkit.WebView
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.io.InputStream
import java.net.URLConnection

class SettingsServer(
    private val context: Context,
    private val webView: WebView,
    port: Int = 8080
) : NanoHTTPD(port) {

    private val prefs = context.getSharedPreferences("cami_tv_prefs", Context.MODE_PRIVATE)

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method

        // ─── API: Ayarları Kaydet ve TV'ye Yansıt ──────────────────
        if (method == Method.POST && uri == "/api/save") {
            try {
                val map = HashMap<String, String>()
                session.parseBody(map)
                val postData = map["postData"] ?: return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "No body")

                // Ayarları SharedPreferences içine yedekle
                prefs.edit().putString("settings", postData).apply()

                // autoBoot değerini CamiTvPrefs'e senkronize et (BootReceiver bunu okur)
                try {
                    val json = JSONObject(postData)
                    if (json.has("autoBoot")) {
                        val bootPrefs = context.getSharedPreferences("CamiTvPrefs", Context.MODE_PRIVATE)
                        bootPrefs.edit().putBoolean("auto_boot", json.getBoolean("autoBoot")).apply()
                    }
                } catch (_: Exception) { /* JSON parse hatası — yoksay */ }

                // WebView'a "LocalStorage güncelle ve Verileri İndirmek İçin Yeniden Başlat" komutu yolla
                // WebView file:/// protokolu URL query desteklemeyebileceği için güvenilir olan localStorage flag metodunu kullanıyoruz.
                Handler(Looper.getMainLooper()).post {
                    val b64 = Base64.encodeToString(postData.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
                    val script = "localStorage.setItem('cami_tv_settings', new TextDecoder().decode(Uint8Array.from(atob('$b64'), c=>c.charCodeAt(0)))); localStorage.setItem('force_download_flag', '1'); location.href='index.html';"
                    webView.evaluateJavascript(script, null)
                }

                return newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}")
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Error: ${e.message}")
            }
        }

        // ─── API: Tüm Ayarları ve TV'yi Sıfırla ──────────────────
        if (method == Method.POST && uri == "/api/reset") {
            try {
                // SharedPreferences temizle
                prefs.edit().clear().apply()

                // WebView tarafında local storage sil ve yenile
                Handler(Looper.getMainLooper()).post {
                    val script = "localStorage.clear(); const req = indexedDB.deleteDatabase('cami_tv_db'); req.onsuccess = () => { location.href='index.html'; }; req.onerror = () => { location.href='index.html'; };"
                    webView.evaluateJavascript(script, null)
                }

                return newFixedLengthResponse(Response.Status.OK, "application/json", "{\"status\":\"ok\"}")
            } catch (e: Exception) {
                return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, MIME_PLAINTEXT, "Error: ${e.message}")
            }
        }

        // ─── WEB ASSETS: Statik Dosyaları Sun (settings.html, css, js) ─────────
        try {
            var assetPath = "web$uri"
            
            // Eğer root dizinisten (veya doğrudan settings.html isteniyorsa) HTML'i okuyup içine ayarları basacağız
            if (uri == "/" || uri == "/settings.html") {
                assetPath = "web/settings.html"
                val htmlStream = context.assets.open(assetPath)
                var htmlContent = htmlStream.bufferedReader().readText()

                // Kayıtlı ayarları SharedPreferences'dan çek (yoksa boş JSON)
                val currentSettings = prefs.getString("settings", "{}") ?: "{}"
                val b64Settings = Base64.encodeToString(currentSettings.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

                // HTML'in <head> etiketinin hemen altına telefonun localStorage'ına TV ayarlarını kopyalayan betik enjekte et
                val scriptInject = """
                    <script>
                        localStorage.setItem('cami_tv_settings', new TextDecoder().decode(Uint8Array.from(atob('$b64Settings'), c=>c.charCodeAt(0))));
                    </script>
                """.trimIndent()

                htmlContent = htmlContent.replaceFirst("<head>", "<head>\n$scriptInject")

                return newFixedLengthResponse(Response.Status.OK, "text/html", htmlContent)
            }

            // Diğer dosyalar (.js, .css, .json, .png vb.)
            val stream: InputStream = context.assets.open(assetPath)
            val mimeType = determineMimeType(uri)
            return newChunkedResponse(Response.Status.OK, mimeType, stream)

        } catch (e: Exception) {
            // Dosya bulunamadı
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "404 Not Found")
        }
    }

    private fun determineMimeType(uri: String): String {
        return when {
            uri.endsWith(".js") -> "application/javascript"
            uri.endsWith(".css") -> "text/css"
            uri.endsWith(".json") -> "application/json"
            uri.endsWith(".png") -> "image/png"
            uri.endsWith(".jpg") || uri.endsWith(".jpeg") -> "image/jpeg"
            uri.endsWith(".svg") -> "image/svg+xml"
            uri.endsWith(".woff2") -> "font/woff2"
            uri.endsWith(".html") -> "text/html"
            else -> URLConnection.guessContentTypeFromName(uri) ?: "application/octet-stream"
        }
    }
}
