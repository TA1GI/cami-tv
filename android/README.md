# Cami TV Android Projesi

Bu klasör Android TV için native wrapper içerir.
Tüm uygulama mantığı **web/** klasöründeki HTML/JS dosyalarında çalışır.
Bu proje sadece WebView kaplama (kiosk modu) ve Android donanım köprüsü sağlar.

## Proje Yapısı

```
android/
├── app/
│   ├── build.gradle
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── assets/web/          ← Web uygulaması buraya kopyalanır
│       ├── java/com/akillicami/camitv/
│       │   ├── MainActivity.kt  ← WebView kiosk
│       │   ├── ScreenBridge.kt  ← JS ↔ Android köprüsü
│       │   └── BootReceiver.kt  ← Otomatik başlatma
│       └── res/
│           └── values/styles.xml
├── build.gradle
├── settings.gradle
└── gradle.properties
```

## Build Adımları

### 1. Web Dosyalarını Kopyala

Android'e build öncesi web dosyalarını assets'e kopyalamanız gerekir:

```powershell
# workshop kökündeyken çalıştırın:
$src = "cami-tv\web"
$dst = "cami-tv\android\app\src\main\assets\web"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force
echo "Web dosyaları kopyalandı."
```

### 2. Android Studio'da Aç

1. Android Studio'yu açın
2. **Open** → `cami-tv/android/` klasörünü seçin
3. Gradle sync bekleyin
4. **Run** ▶ (bağlı cihaz veya emülatör seçin)

### 3. TV'ye Yükleme

```
adb connect <TV_IP>:5555
adb install app/build/outputs/apk/debug/app-debug.apk
```

## JavaScript'ten Android'e Erişim

Web tarafında `AndroidBridge` nesnesi mevcutsa native ortamda çalışıyor demektir:

```javascript
if (typeof AndroidBridge !== 'undefined' && AndroidBridge.isAvailable()) {
    // Native modda
    AndroidBridge.turnScreenOff();
    AndroidBridge.setBrightness(80);
    AndroidBridge.turnScreenOn();
} else {
    // Tarayıcı / geliştirme modunda — CSS ile simüle et
    document.body.style.filter = 'brightness(0)';
}
```

## İzinler

| İzin | Amaç |
|---|---|
| `INTERNET` | GitHub'dan vakit indirme |
| `RECEIVE_BOOT_COMPLETED` | TV açılınca otomatik başlatma |
| `WAKE_LOCK` | Ekranı açık tutma |
| `WRITE_SETTINGS` | Parlaklık kontrolü (Android 6+) |
