# Değişiklik Günlüğü

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
