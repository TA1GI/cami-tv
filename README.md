# 🕌 Cami TV

Türkiye'deki camiler için geliştirilmiş, Android TV / Fire Stick uyumlu, tam ekran namaz vakti ekran uygulaması.

## Özellikler

- 📿 Namaz vakitleri (Diyanet verileri)
- 📖 Ayet, Hadis, Esmaül Hüsna, Dua carousel
- 📅 Haftalık imsakiye (15 güne kadar)
- 🔔 Ezan ekranı + geri sayım
- 🌙 Ramazan modu
- 🎨 Çoklu tema (Yeşil, Altın, Zümrüt, Açık)
- 📺 Landscape / Portrait ekran desteği
- 📡 GitHub'dan otomatik içerik güncelleme
- 📲 OTA APK güncelleme (yakında)

## Kurulum

1. [Releases](https://github.com/TA1GI/cami-tv/releases) sayfasından APK'yı indirin
2. Android TV / Fire Stick'e yükleyin
3. Uygulamayı açın, il/ilçe seçin

## Sorun Giderme: Otomatik Başlamayan TV'ler (Hikeen / Axen / Woon)
Bazı TV'lerde (özellikle Hotel Moduna sahip ucuz TV'ler) TV fişten çekilip takıldığında uygulama otomatik **başlamayabilir**. Bu TV'lerdeki kısıtlamaları kalıcı olarak kaldırmak için bilgisayardan bir seferlik ayar yapılması gerekir:

1. `tools/hikeen_tv_setup.bat` dosyasını (`cami-tv` klasörünüzün içindedir) bilgisayarınızda çalıştırın.
2. Ekranda sizden TV'nin IP adresi ve Eşleştirme Kodu istenecek. Script içindeki adımları (FLauncher kurma, Tvyi eşleştirme) takip edin.
3. Script; otomatik olarak Hotel Modunu kapatacak, gerekli arkaplan izinlerini verecek ve saat dilimini düzeltecektir.
4. İşlem bittikten sonra TV'yi kumandadan yeniden başlatın. Artık TV her açıldığında Cami TV otomatik başlayacaktır.

## Geliştirici Kurulumu

```bash
git clone https://github.com/TA1GI/cami-tv.git
cd cami-tv/android
./gradlew assembleDebug
```

## Lisans

MIT — Kar amacı gütmeksizin, camiler için açık kaynak.
