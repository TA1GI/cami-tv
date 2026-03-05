package com.akillicami.camitv

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.WebView
import fi.iki.elonen.NanoHTTPD
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

                // WebView'a "LocalStorage güncelle ve Verileri İndirmek İçin Yeniden Başlat" komutu yolla
                // WebView file:/// protokolu URL query desteklemeyebileceği için güvenilir olan localStorage flag metodunu kullanıyoruz.
                Handler(Looper.getMainLooper()).post {
                    val script = "localStorage.setItem('cami_tv_settings', '$postData'); localStorage.setItem('force_download_flag', '1'); location.href='index.html';"
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
                val currentSettings = prefs.getString("settings", "{}")

                // HTML'in <head> etiketinin hemen altına telefonun localStorage'ına TV ayarlarını kopyalayan betik enjekte et
                val scriptInject = """
                    <script>
                        localStorage.setItem('cami_tv_settings', '$currentSettings');
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
