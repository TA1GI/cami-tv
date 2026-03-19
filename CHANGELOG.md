# Değişiklik Günlüğü

## v1.0.12 (2026-03-19)
### Dinamik "Akıcı (Fluid)" Arayüz Mimarisi
- **Kusursuz Oransal Ölçeklenme:** Tüm bilgi kutuları (İftar/Sahur, Ezan, Bayram) artık geri sayım dairesiyle aynı matematiksel mantıkta (`aspect-ratio` + `container-type: inline-size`) çalışıyor. 
- **Esnek (Flex) Sıkışma Sistemi:** Ekran yüksekliği azaldığında veya yeni bir bildirim eklendiğinde, hiçbir öğe diğerinin üstüne çıkmıyor. Dev geri sayım dairesi "şok emici" (`flex: 8`) olarak görev yapıyor; diğer kutular (`flex: 2` ve `3`) ile tam bir uyum içinde ekranı paylaşıyorlar.
- **Dinamik Metin Boyutlandırma:** Daralma esnasında kutuların genişlikleri orantılı olarak küçülüyor; içlerindeki metinler (`cqi` birimi sayesinde) otomatik ve milimetrik olarak küçülüyor.
- **Statik Media Sorgularının İptali:** Düşük çözünürlükler için yazılan katı (`@media max-height`) kurallar silindi. Yeni Flexbox sistemi 1080p'den 540p'ye kadar tüm çözünürlüklerde arayüzü organik olarak ölçekliyor.
- **Ezan Bildirimi Çakışması Giderildi:** Axen TV gibi cihazlarda ezan okunduğunda bildirimin geri sayım dairesiyle üst üste binmesi %100 engellendi.
- **Ezan State Geçişi Hatası Düzeltildi:** Vakit "Yaklaştı" durumundan "Okunuyor" durumuna geçerken anahtarın (`key`) aynı kalması nedeniyle ekrandaki yazının güncellenmemesi (`app.js`) sorunu giderildi; artık `_lastEzanKey` kontrolüne `isEzanTime` drumu da dahil edildi.

## v1.0.11 (2026-03-19)
### Bayram Namazı Vakti Özelliği
- **Bayram Namazı Bilgi Kutusu:** Bayrama 2 gün kala ekranda otomatik olarak bayram namazı saati ve tarihi gösteren altın renkli bilgi kutusu eklendi.
- **Dinamik Başlık:** Kalan güne göre "Bayram Namazı (2 gün)", "Yarın Bayram Namazı" veya "Bugün Bayram Namazı" şeklinde otomatik güncellenen başlık.
- **Ramazan ile Uyum:** Ramazan banner'ı (Sahur/İftar geri sayımı) ile aynı anda görüntülenebilir, çakışma yok.
- **Yıl Bağımsız:** Kod tarih tabanlı çalışır; GitHub'daki `bayram_namazi.json` güncellendiği sürece her yıl otomatik çalışır.

### Responsive Tasarım İyileştirmeleri
- **CSS Container Queries:** Geri sayım dairesi içindeki yazı ve rakamlar artık `cqi` birimiyle dairenin boyutuna göre otomatik ölçeklenir. Ekran büyüklüğü fark etmeksizin metin her zaman daireye sığar.
- **Düşük Çözünürlük Desteği:** Mi Box (960×540) ve benzeri düşük çözünürlüklü cihazlar için 2 kademeli `@media (max-height)` responsive kuralları eklendi:
  - **≤700px:** Orta panel sıkıştırılır, bayram kutusu tek satıra geçer.
  - **≤550px:** Tüm kutular (sahur, bayram, ezan) agresif şekilde kompakt hale gelir.
- Büyük ekranlardaki (1080p+) mevcut tasarıma hiç dokunulmadı.

### `getBayramWakti()` Düzeltmesi
- **Veri Yapısı Düzeltmesi:** `data-manager.js`'deki `getBayramWakti()` fonksiyonu, `bayram_namazi.json`'ın gerçek veri yapısına (ilçe ID ile anahtarlı obje) uygun hale getirildi.
- **Tarih Parse:** Türkçe tarih formatı ("20 Mart 2026 Cuma") doğru parse ediliyor.

### Değiştirilen Dosyalar
- `data-manager.js` — `getBayramWakti()` fonksiyonu yeniden yazıldı
- `display-manager.js` — `updateBayramBanner()` fonksiyonu eklendi
- `app.js` — `tick()` içinde bayram banner hook eklendi
- `index.html` — `#ls-bayram-info` HTML elementi eklendi
- `landscape.css` — Bayram kutusu stilleri, Container Queries ve responsive `@media` blokları eklendi

## v1.0.10 (2026-03-16)
- **Kumanda Kısayolu:** Kumandadan '0' tuşuna 3 kez üst üste basıldığında doğrudan Ayarlar sayfasının açılması sağlandı.
- **Geri Tuşu Geliştirmesi:** Uygulamadan çıkarken çıkan "Tekrar basın" uyarısı platform bağımsız (WebView tabanlı) yeni bir Toast mesajı yapısına geçirildi.
- **Açılışta Otomatik Başlatma (Boot) Çözümleri:**
  - Android 14+ cihazlardaki Background Activity Launch (BAL) kısıtlamaları, Full-Screen Intent Notification kullanılarak bypass edildi.
  - Uygulamadan çıkıldığında `stopped=true` durumuna düşmesini önlemek için uygulamayı kapatmak yerine arka plana atan (`moveTaskToBack`) yeni bir mantığa geçildi.
  - Hikeen TV Kurulum Scripti: Hotel modunda uyanamayan sorunlu TV'ler için `tools/hikeen_tv_setup.bat` dosyası eklendi.
- **Çevrimdışı (Offline) Saat:** Cihaz internetsiz açıldığında, donanımsal saati olmasa bile geri sayıma devam edebilmesi için son bilinen tarihe geri dönebilen çok katmanlı (localStorage + `tv_scan_rtc.txt`) fallback yapısı kuruldu.
- **Zaman Dilimi ve Uyku Engelleme:**
  - Akıllı TV'lerin yanlış zaman diliminde uyanması ihtimaline karşı sistem saati `Europe/Istanbul` olarak düzeltildi.
  - Cami TV açıkken TV'nin sistem tarafından zorla uyku moduna geçirilmesini engellemek için arka planda sürekli çalışan `KeepAwakeService` eklendi.

## v1.0.9 (2026-03-07)
### Cuma Yardımı Overlay Sistemi
- **Cuma Vakti Otomatik Overlay:** Cuma namazı öncesi ve sonrası otomatik devreye giren yardım/bağış duyuru ekranı eklendi.
- **4 Görünüm Modu:** Tam ekran, Sadece Sol Panel, Sadece Orta Panel, Sadece Sağ Panel seçenekleriyle esnek gösterim.
- **Çok Dilli Metin Rotasyonu:** Türkçe, Arapça ve İngilizce metinler 8 saniye aralıkla otomatik döndürülüyor.
- **Zamanlama Ayarları:** Başlangıç (varsayılan 15dk önce) ve bitiş (varsayılan 45dk sonra) dakikaları ayarlanabilir.
- **Ayarlar Entegrasyonu:** Toggle ile açılıp kapanan alt panel; tüm ayarlar telefon → TV senkronize.

### İçerik Düzenleyici (Yeni Sayfa)
- **Yeni Sayfa:** `content-editor.html` — Ayet, Hadis, Dua ve Esmâ-ül Hüsnâ içeriklerini yönetmek için 4 sekmeli arayüz.
- **İçerik CRUD:** Yeni içerik ekleme, var olanı düzenleme (modal), silme ve aktif/pasif yapma.
- **Sekmeye Özel Form:** Her içerik türünün JSON yapısına uygun alanlar (Arapça metin RTL, Türkçe meal, referans, başlık, anlam).
- **Arama & Filtreleme:** Metin araması, Tümü / Aktif / Pasif / Kendi Eklediğim / Sunucudan Gelen filtreleri.
- **Toplu Yönetim:** Tümünü Seç, Seçilenleri Pasif Yap, Seçilenleri Sil.
- **Telefon → TV Senkron:** SettingsManager + `/api/save` pipeline üzerinden değişiklikler anında TV'ye gönderiliyor.
- **Carousel Entegrasyonu:** `carousel-manager.js`'e `_mergeContent()` fonksiyonu eklendi; özel içerikler orijinal verilerle birleştiriliyor, pasif yapılanlar otomatik çıkarılıyor.

### Ayarlar Sayfası İyileştirmeleri
- **İçerik Düzenleyici Butonu:** İçerik Gösterimi bölümüne "✏️ İçerik Düzenleyici" bağlantısı eklendi.
- **Yeni Cami Bilgisi Butonu:** Tasarıma uyumlu modern görünüm verildi.
- **Metin Alanı Boyutu:** Cami bilgisi metin alanı genişletildi.

### Değiştirilen Dosyalar
- `settings-manager.js` — `customContent` ve `cumaYardımı` ayar alanları
- `settings.js` — Cuma Yardımı init/save mantığı
- `settings.html` — Cuma Yardımı paneli + İçerik Düzenleyici linki
- `carousel-manager.js` — `_mergeContent()` ile özel içerik birleştirme
- `display-manager.js` — `updateCumaYardimi()` overlay mantığı
- `app.js` — `tick()` içinde Cuma Yardımı hook
- `index.html` — Cuma overlay HTML elementi
- `landscape.css` — Cuma overlay stilleri (4 mod)
- `settings.css` — Buton ve metin alanı iyileştirmeleri
- `i18n.js` — Cuma Yardımı çeviri anahtarları
- **YENİ:** `content-editor.html`, `css/content-editor.css`, `js/content-editor.js`

## v1.0.8 (2026-03-06)
### Ayarlar & Kullanıcı Deneyimi İyileştirmesi
- **Sağ Panel Yazı Boyutu:** Ayet, hadis, esma, dua ve cami bilgileri için bağımsız yazı boyutu ayarı eklendi (%85-%250 arası slider, imsakiye hariç).
- **Ayarlar Sıralaması:** İçerik Gösterimi bölümü mantıksal sıraya göre yeniden düzenlendi.
- **İçerik Geçiş Süresi:** "Carousel Süresi" ifadesi daha anlaşılır hale getirildi.
- **Ezan Okunuyor Süresi:** 10 dakikadan 1 dakikaya indirildi.

## v1.0.7 (2026-03-06)
### Yazı Tipi & İçerik İyileştirmesi
- **Şeyh Hamdullah Mushaf Fontu:** Arapça metinler artık geleneksel hat sanatına uygun, çok daha okunaklı Mushaf fontuyla gösteriliyor.
- **Hadis Veritabanı Düzeltmesi:** Hadis kartlarındaki `undefined` hatası giderildi; Arapça hat, Türkçe çeviri ve kaynak referansları kusursuz çalışıyor.
- **3 Yeni Ramazan Ayeti:** Bakara 185, Bakara 183 ve Kadir Suresi (tam metin) içerik akışına eklendi.
- Gereksiz geliştirme scriptleri (`fix_fonts.js`, `update-i18n.js`) projeden temizlendi.

## v1.0.6 (2026-03-06)
### Yeni İçerikler & Veri İyileştirmeleri
- **Ayet ve Hadis Veritabanı Genişletildi:** Sahadan toplanan PDF dokümanlarından yapay zeka tarafından ayıklanan 13 Hadis ve 3 Kuran-ı Kerim Ayeti; tamamen orijinal Arapça hat metinleri, şematik çevirileri ve kaynak referanslarıyla birlikte Diyanet TV formatında akış sistemine dahil edildi.
- JS arayüzündeki Hadis kartlarının görsel mimarisi, Tıpkı Ayet kartlarında olduğu gibi "Kusursuz Arapça Hat" tipografisini destekleyecek şekilde baştan kodlandı.

## v1.0.5 (2026-03-06)
### İyileştirmeler & Kullanıcı Deneyimi
- **Kişiselleştirilmiş Güncelleme Ekranı:** Arayüz deneyimi geliştirildi. Uygulama bir yeni sürüm algıladığında artık izinsiz indirme başlatıp televizyon ekranını (namaz duyurularını) doğrudan kapatmıyor. Bunun yerine Android TV kumandanızdaki "Yön Tuşları (D-Pad)" ile kolaylıkla ilerleyebileceğiniz ve üzerine gelindiğinde yeşile dönerek tıklandığını hissettiren "Güncelleme Var" sağ üst köşe onayı eklendi.



## v1.0.2 (2026-03-06)
### Kritik OTA Onarımı
- **Android İmza (Keystore) Eşleşme Düzeltmesi:** GitHub Actions sunucularında APK üretilirken her defasında farklı bir geçici şifre ile mühürlenmesi sorunu giderildi. Uygulamanın OTA otomatik kurulumları esnasında "Uygulama Yüklenemedi" (App not installed) hatası almasını engellemek için projeye kalıcı ve sabit bir `cami-tv.keystore` anahtarı dâhil edildi. Bundan sonraki tüm güncellemeler tek bir imza ile çıkarak sorunsuz bir şekilde birbiri üzerine yazılabilecektir.


## v1.0.1 (2026-03-06)
### Yeni Özellikler & Düzeltmeler
- **Çoklu Dil Desteği:** TR, EN, AR dilleri sisteme entegre edildi, çevirileri tamamlandı. (i18n)
- **Yeni Tasarım İkonlar:** Eski imsak ve namaz ikonları uyumlu 2px çizgi tabanlı SVG ikon setiyle değiştirildi.
- **Sabah Vaktini Gizleme:** Ayarlar menüsüne "Sabah" satırını gizleme seçeneği eklendi.
- **Genişletilmiş İmsakiye:** Sağ paneldeki İmsakiye listesi 15 günden tam 30 güne uzatıldı.
- **Cami Bilgileri:** Ana ekrana alt duyuru olarak "Cami Bilgileri" paneli eklendi.
- **TV Ayarları:** Ayarlar ve Kurulum ekranları için TV üzerinden taranabilen, telefondan anında değişen **QR Code** yönetim sistemi kuruldu.
- **Tema Düzeltmeleri:** Çalışmayan "Lacivert" (Navy) ve "Gece Moru" (Purple) temalarındaki CSS eksikleri onarıldı, tasarımlar yenilendi.
- **Görünüm İyileştirmeleri:** Android TV ikon logoları eklendi, scrollbar (kaydırma çubukları) temizlendi ve ekran büyültme işlemleri `container queries` ile dinamik (Auto-Fit) hale getirildi.


## v1.0.0 (2026-03-02)
### İlk Sürüm
- Namaz vakitleri (Diyanet verileri, GitHub üzerinden)
- Ayet, Hadis, Esmaül Hüsna, Dua carousel
- 15 günlük imsakiye
- Ezan ekranı + geri sayım halkası
- Ramazan modu + banner
- Çoklu tema (Yeşil, Altın, Zümrüt, Açık)
- Landscape/Portrait ekran desteği
- TV kumandası D-Pad desteği
- Cemaatle namaz saatleri
- GitHub'dan 24 saatte bir içerik güncelleme
- OTA APK güncelleme
- Güç yönetimi (sabit saat / namaz vakti bazlı)
- ESP32 entegrasyonu (opsiyonel)
