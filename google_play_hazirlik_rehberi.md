# Cami TV — Google Play Console Yükleme ve Mağaza Hazırlık Rehberi

Bu belge, **Cami TV (`com.akillicami.camitv`)** uygulamasının Google Play Console'a yüklenmesi, mağaza listelemesi ve onay süreçlerinin sorunsuz tamamlanması için hazırlanmış eksiksiz başvuru kılavuzudur.

---

## 📌 1. SÜRÜM NUMARASI GEREKLİLİĞİ (NEDEN GÜNCELLENMELİ?)

### Soru: *"Sürüm numarasını güncellemeye gerek var mı gerçekten?"*

### Cevap: **EVET, kesinlikle gereklidir.**

Sebepleri:
1. **Kurulu Olan 2 Caminin Güncellenebilmesi İçin (Hayati Şart):**
   * O iki camide çalışan mevcut sürüm: `versionName: "1.0.15"` ve `versionCode: 16`.
   * O cihazlar GitHub'a her baktığında şu kontrolü yapar:
     ```kotlin
     isNewerVersion(githubdakiSurum, eldekiSurum)
     ```
   * Eğer yeni APK'yı `1.0.15` olarak yüklerseniz, eldeki sürüm ile aynı olacağı için **TV'ler güncellemeyi hiç algılamayacak ve eski kodda kilitli kalacaklardır**.
   * Güncellemeyi tetikleyebilmek için GitHub Releases'a yüklenecek sürümün **`1.0.16`** (ve `versionCode 17`) olması zorunludur.

2. **Google Play Console Şartı:**
   * Google Play Console'a daha önce test veya taslak olarak bile `versionCode 16` yüklenmişse, sistem 16 ve altındaki hiçbir paketi kabul etmez; *"Daha yüksek bir versionCode yüklemelisiniz"* uyarısıyla reddeder.
   * Bu nedenle standart gereği `versionCode: 17` ve `versionName: "1.0.16"` yapılmalıdır.

---

## 🛡️ 2. GİZLİLİK POLİTİKASI (PRIVACY POLICY)

Google Play Store tüm uygulamalar için canlı bir Gizlilik Politikası URL'si zorunlu tutar.

* Hazırlanan dosya: [privacy.html](file:///d:/Esp32_projeler/akilli_cami/cami-tv/privacy.html) (aynı zamanda `web/privacy.html` dizininde mevcuttur).
* **Canlı URL Bağlantısı:**
  Projenin GitHub deposunda (`TA1GI/cami-tv`) **Settings -> Pages** sekmesinden GitHub Pages aktif edildiğinde URL'niz:
  ```
  https://ta1gi.github.io/cami-tv/privacy.html
  ```
  olacaktır. Google Play Console'daki **"Gizlilik Politikası"** alanına bu linki yapıştırabilirsiniz.

---

## 📝 3. MAĞAZA LİSTELEME METİNLERİ (KOPYALAYIP YAPIŞTIRIN)

### A) Uygulama Adı (Maks. 30 Karakter)
```
Cami TV: Namaz Vakti & Pano
```

### B) Kısa Açıklama (Maks. 80 Karakter)
```
Android TV için 2 yıllık kesintisiz namaz vakitleri, imsakiye ve cami panosu.
```

### C) Tam Açıklama (Maks. 4000 Karakter)
```markdown
Cami TV — Camiler ve Mescitler İçin Akıllı Dijital Bilgilendirme Ekranı

Cami TV; camilerde, mescitlerde, Kur'an kurslarında ve evlerde namaz vakitlerini, ezan saatlerini, dini gün ve geceleri büyük ekranda (Android TV / TV Box) estetik ve kesintisiz şekilde göstermek için özel olarak tasarlanmış offline-first (çevrimdışı öncelikli) bir kiosk uygulamasıdır.

ÖNE ÇIKAN ÖZELLİKLER:

🕌 2 YILLIK KESİNTİSİZ DİYANET VAKİTLERİ
Diyanet İşleri Başkanlığı verileriyle birebir uyumlu 2 yıllık (730 günlük) vakit tablosu cihaz hafızasında saklanır. Yılbaşı geçişlerinde veya internet kesintilerinde ekran asla kapanmaz, vakitler kesintisiz gösterilmeye devam eder.

🌙 OTOMATİK RAMAZAN VE KURBAN BAYRAMI VAKTİ
Ramazan ve Kurban bayramı namazı saatleri Diyanet tarafından açıklandığında otomatik olarak güncellenir ve bayramdan önce ekranda bilgi kutusu olarak cemaate duyurulur.

📺 DİNAMİK TV GÖRÜNÜMÜ & ESTETİK TEMALAR
Farklı cami mimarilerine uyumlu yüksek kaliteli renk temaları (Koyu Yeşil, Zümrüt, Altın, Kufi Kahve, Lacivert, Gece Moru vb.), okunabilir modern tipografi ve uzaktan kumanda desteği.

📖 DÖNÜŞÜMLÜ İÇERİK (AYET, HADİS, DUA & ESMA-ÜL HÜSNA)
Namaz vakitlerinin yanında Diyanet kaynaklı günün ayetleri, sahih hadisler, dualar ve Esma-ül Hüsna slayt geçişleriyle cemaatin istifadesine sunulur.

📣 CAMİYE ÖZEL DUYURU VE CUMA YARDIMI PANOSU
Cami görevlileri; dernek duyurularını, vefat/taziye ilanlarını veya Cuma namazı yardım miktarını QR kod ile telefonlarından bağlanarak ekrana kolayca yansıtabilir.

⚡ AKILLI GÜÇ VE EKRAN YÖNETİMİ
Namaz vakitlerine göre ekranı otomatik aydınlatma, yatsıdan sonra gece tasarruf moduna geçme veya sabah namazından önce otomatik uyanma desteği.

📱 TELEFONLA KOLAY KURULUM (QR KOD)
TV kumandasıyla yazı yazma zorluğuna son! Ekrandaki QR kodu telefonunuzla okutarak cami adını, temasını, duyurularını ve il/ilçe seçimini saniyeler içinde yapabilirsiniz.

🔒 GİZLİLİK VE GÜVENLİK
* Kişisel veri toplamaz, işlemez ve harici sunuculara göndermez.
* Reklam, analiz SDK'sı veya ücretli abonelik içermez.
* Tamamen ücretsiz ve açık kaynaklıdır.
```

---

## 🎨 4. MAĞAZA GÖRSEL MATERYALLERİ (GRAFİK KONTROL LİSTESİ)

| Materyal Türü | Boyut / Format | Dosya Yolu / Not |
| :--- | :--- | :--- |
| **Uygulama Simgesi** | 512 x 512 px, PNG (32-bit alpha) | [web/img/cami_tv_logo.png](file:///d:/Esp32_projeler/akilli_cami/cami-tv/web/img/cami_tv_logo.png) *(Birebir hazır)* |
| **Öne Çıkan Görsel (Feature Graphic)** | 1024 x 500 px, JPG/PNG | Mağaza üst başlık banner'ı |
| **Android TV Başlığı (TV Banner)** | 1280 x 720 px (16:9), PNG/JPG | Android TV Launcher için zorunlu banner |
| **TV Ekran Görüntüleri** | 1920 x 1080 px (16:9), PNG/JPG | En az 1 adet (Önerilen: Ana ekran, Ezan ekranı, Ayarlar ekranı) |

---

## 📋 5. GOOGLE PLAY CONSOLE FORM CEVAPLARI

### A) Veri Güvenliği (Data Safety) Formu
* **Soru:** Uygulamanız herhangi bir kullanıcı verisi topluyor veya paylaşıyor mu?
  * **Cevap:** **HAYIR** (No user data collected or shared).
* **Soru:** Uygulamanızda reklam var mı?
  * **Cevap:** **HAYIR** (No ads).

### B) İçerik Derecelendirmesi (Content Rating - IARC)
* Kategori: **Yardımcı Araçlar / Bilgilendirme / Din**
* Şiddet, Cinsellik, Argo, Madde Kullanımı, Konum Paylaşımı, Kullanıcılar Arası Mesajlaşma: **TÜMÜNE HAYIR**
* Sonuç: **PEGI 3 / Her Yaş İçin Uygun (Everyone)**

### C) Hedef Kitle (Target Audience)
* Yaş Grubu: **18 yaş ve üstü** (veya tüm yaşlar)
* Çocuklara özel olarak tasarlanmadı seçeneği işaretlenebilir.

### D) Özel İzin Beyanları (Gerekçe Metinleri)
1. **`RECEIVE_BOOT_COMPLETED`:**
   * *"Uygulama camilerde dijital pano (kiosk) olarak kullanıldığından TV açıldığında ekranın otomatik başlaması için gereklidir."*
2. **`WAKE_LOCK` & `FOREGROUND_SERVICE`:**
   * *"Cami içinde ibadet ve ezan esnasında TV ekranının uyku moduna geçmesini veya kararmasını engellemek için ekranı açık tutar."*
3. **`SYSTEM_ALERT_WINDOW` & `USE_FULL_SCREEN_INTENT`:**
   * *"Android 14+ sürümlerinde cihaz yeniden başlatıldığında kiosk ekranının gecikmesiz olarak doğrudan tam ekranda başlamasını temin etmek için kullanılır."*

---

## 🚀 6. YÜKLEME VE PAKET DOSYASI

Google Play Store'un kabul ettiği imzalı dosya:
* **Dosya:** `android/app/build/outputs/bundle/release/app-release.aab`
* **Boyut:** ~3.18 MB
* **İmza:** `cami-tv.keystore` ile Release imzası atılmış hazır paket.
