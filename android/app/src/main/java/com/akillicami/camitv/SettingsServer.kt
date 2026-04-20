package com.akillicami.camitv

import android.content.Context
import android.os.Handler
import android.util.Base64
import android.os.Looper
import android.webkit.WebView
import fi.iki.elonen.NanoHTTPD
import org.json.JSONObject
import java.io.File
import java.io.InputStream
import java.net.URLConnection

class SettingsServer(
    private val context: Context,
    private val webView: WebView,
    port: Int = 8080
) : NanoHTTPD(port) {

    private val prefs = context.getSharedPreferences("cami_tv_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val BG_IMAGE_FILE = "bg_image.jpg"
    }

    override fun serve(session: IHTTPSession): Response {
        val uri = session.uri
        val method = session.method

        // ─── API: Arkaplan resmini sun (telefon önizleme için) ──────
        if (method == Method.GET && uri == "/api/bg-image") {
            val bgFile = File(context.filesDir, BG_IMAGE_FILE)
            if (bgFile.exists()) {
                val stream = bgFile.inputStream()
                val response = newChunkedResponse(Response.Status.OK, "image/jpeg", stream)
                response.addHeader("Cache-Control", "no-cache")
                return response
            }
            return newFixedLengthResponse(Response.Status.NOT_FOUND, MIME_PLAINTEXT, "No image")
        }

        // ─── API: Ayarları Kaydet ve TV'ye Yansıt ──────────────────
        if (method == Method.POST && uri == "/api/save") {
            try {
                val map = HashMap<String, String>()
                session.parseBody(map)
                val postData = map["postData"] ?: return newFixedLengthResponse(Response.Status.BAD_REQUEST, MIME_PLAINTEXT, "No body")

                // Arkaplan resmini JSON'dan çıkar ve dosyaya kaydet
                val cleanedSettings = extractAndSaveBackgroundImage(postData)

                // Ayarları SharedPreferences içine yedekle (resim olmadan, küçük boyut)
                prefs.edit().putString("settings", cleanedSettings).apply()

                // autoBoot değerini CamiTvPrefs'e senkronize et (BootReceiver bunu okur)
                try {
                    val json = JSONObject(cleanedSettings)
                    if (json.has("autoBoot")) {
                        val bootPrefs = context.getSharedPreferences("CamiTvPrefs", Context.MODE_PRIVATE)
                        bootPrefs.edit().putBoolean("auto_boot", json.getBoolean("autoBoot")).apply()
                    }
                } catch (_: Exception) { /* JSON parse hatası — yoksay */ }

                // WebView'a "LocalStorage güncelle ve Verileri İndirmek İçin Yeniden Başlat" komutu yolla
                // Artık resim dosyada olduğu için JSON küçük, evaluateJavascript sorunsuz çalışır
                Handler(Looper.getMainLooper()).post {
                    val b64 = Base64.encodeToString(cleanedSettings.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)
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

                // Arkaplan resim dosyasını sil
                val bgFile = File(context.filesDir, BG_IMAGE_FILE)
                if (bgFile.exists()) bgFile.delete()

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

                // Telefon için: dosya yollarını HTTP URL'ye çevir (telefon file:// erişemez)
                val phoneSettings = prepareSettingsForPhone(currentSettings)

                val b64Settings = Base64.encodeToString(phoneSettings.toByteArray(Charsets.UTF_8), Base64.NO_WRAP)

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

    /**
     * Telefondan gelen ayarlar JSON'ından arkaplan resmini çıkarır ve dosyaya kaydeder.
     * JSON'daki base64 veriyi dosya yoluyla değiştirir (böylece JSON küçük kalır).
     */
    private fun extractAndSaveBackgroundImage(settingsJson: String): String {
        try {
            val json = JSONObject(settingsJson)
            val bgFile = File(context.filesDir, BG_IMAGE_FILE)

            if (json.has("arkaplanResim")) {
                val bgData = json.getString("arkaplanResim")

                when {
                    // Yeni base64 resim → dosyaya kaydet
                    bgData.startsWith("data:image") && bgData.length > 500 -> {
                        val base64Part = bgData.substringAfter(",")
                        val bytes = Base64.decode(base64Part, Base64.DEFAULT)
                        bgFile.writeBytes(bytes)
                        // JSON'da dosya yolunu saklat (base64 yerine)
                        json.put("arkaplanResim", bgFile.absolutePath)
                    }
                    // Mevcut HTTP referansı (telefon daha önce görmüş) → dosya yoluna çevir
                    bgData.contains("/api/bg-image") -> {
                        if (bgFile.exists()) {
                            json.put("arkaplanResim", bgFile.absolutePath)
                        } else {
                            json.put("arkaplanResim", "")
                        }
                    }
                    // Boş → resmi sil
                    bgData.isEmpty() -> {
                        if (bgFile.exists()) bgFile.delete()
                    }
                    // Zaten dosya yolu → olduğu gibi bırak
                }
            }

            return json.toString()
        } catch (e: Exception) {
            // JSON parse hatası — orijinal veriyi döndür
            return settingsJson
        }
    }

    /**
     * Telefon tarayıcısı için ayarları hazırlar.
     * Dosya yollarını HTTP URL'lere çevirir (telefon file:// erişemez).
     */
    private fun prepareSettingsForPhone(settingsJson: String): String {
        try {
            val json = JSONObject(settingsJson)
            val bgFile = File(context.filesDir, BG_IMAGE_FILE)

            if (json.has("arkaplanResim")) {
                val bgData = json.getString("arkaplanResim")
                // Dosya yolunu HTTP URL'ye çevir
                if (bgData == bgFile.absolutePath && bgFile.exists()) {
                    json.put("arkaplanResim", "/api/bg-image?t=${bgFile.lastModified()}")
                }
            }

            return json.toString()
        } catch (e: Exception) {
            return settingsJson
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
