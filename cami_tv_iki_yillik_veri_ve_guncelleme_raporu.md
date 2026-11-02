# Cami TV — İki Yıllık Kesintisiz Veri ve Akıllı Güncelleme Mimari Raporu ve Eylem Planı

Bu belge; sunucu (GitHub Actions & PHP) tarafında hayata geçirilen **"İki Yıllık (730 Günlük) Kesintisiz Namaz Vakitleri"** ve **"Gece Otomasyonlu Bayram Namazı Botu"** sistemine, **Cami TV (Android TV - `cami-tv`)** uygulamasının %100 tam uyumlu, kesintisiz ve akıllı hale getirilmesi için hazırlanmış detaylı teknik analiz ve uygulama rehberidir.

Yeni açılacak sohbette yapay zekaya bu belge referans verilerek doğrudan kodlama aşamasına geçilebilir.

---

## 📌 1. GENEL BAKIŞ VE MEVCUT MİMARİ

### 1.1 Sunucu / GitHub Tarafında Neler Değişti?
1. **2 Yıllık (730 Günlük) Kesintisiz JSON:**
   * URL formatı: `https://ta1gi.github.io/namaz_vakitleri/{ILCE}_{ID}.json`
   * Dosyalar artık tek bir yıla (365 gün) değil, **"Mevcut Yıl + Bir Sonraki Yıl"** olacak şekilde 730 günlük birleşik JSON dizisidir.
   * Güncelleme takvimi: Her yıl **1 - 10 Ekim** tarihleri arasında sunucu yeni yılı Diyanet'ten çeker ve mevcut yılla birleştirir (Örn: Ekim 2026'da dosya 2026+2027 olur; Ekim 2027'de 2027+2028 olur). Böylece 1 Ocak krizleri ve yılbaşı kesintileri tamamen engellenmiştir.
2. **Bayram Namazı Otomasyonu (`bayram_kontrol.py` & `.github/workflows/bayram_kontrol.yml`):**
   * Her gece TSİ **03:00'te** GitHub Actions üzerinde çalışır.
   * Ramazan ve Kurban bayramlarına **15 gün veya daha az kala** Diyanet'in sitesini taramaya başlar.
   * Diyanet vakitleri açıkladığı ilk gece veriyi çeker ve `https://ta1gi.github.io/namaz_vakitleri/bayram_namazi.json` dosyasını günceller.

### 1.2 Cami TV'nin Mevcut Çalışma Mantığı
* Cami TV, Android üzerinde çalışan bir **WebView kiosk** uygulamasıdır (`MainActivity.kt` -> `assets/web/index.html`).
* Veriler yerel olarak **IndexedDB** (`cami_tv_db`, `prayer_times` ve `bayram_times` depoları) üzerinde saklanır.
* JavaScript katmanı (`data-manager.js`, `prayer-engine.js`, `app.js`) tüm hesaplamaları ve ekran güncellemelerini offline-first olarak yürütür.

---

## 🔍 2. MEVCUT DURUM ANALİZİ VE TESPİT EDİLEN SORUNLAR

### ✅ Zaten Sorunsuz Çalışan Kısımlar
* **Hafıza & Performans:** 730 günlük veri yaklaşık ~95 KB'tır. IndexedDB ve WebView bu boyutu mikrosaniyeler içinde okur; performans kaybı yoktur.
* **Günlük Eşleşme:** `_prayerData.find(d => d.miladiTarih === todayStr)` mantığı 730 gün içinde bugünü anında bulur.
* **Yılbaşı Geçişi İyileşti:** 31 Aralık gecesi bir sonraki günün (1 Ocak) imsak vakti artık 2. yıl verisi sayesinde `getTomorrowImsak()` ile eksiksiz bulunur.
* **30 Günlük Takvim:** Aralık ayının sonlarında önümüzdeki 30 gün çekilirken yeni yılın günleri kesintiye uğramadan listelenir.

---

### ⚠️ Kritik Sorunlar ve Eksiklikler

#### 1. Yıl Bazlı Kontrol (`checkYearUpdate`) ve "Ekim Ayı" Açmazı
* `data-manager.js` içindeki `checkYearUpdate` fonksiyonunda şu kontrol vardır:
  ```javascript
  const savedYear = await dbGet('meta', 'prayer_year');
  const curYear = new Date().getFullYear();
  if (savedYear === curYear) return false; // Güncel sayıp çıkıyor!
  ```
* **Sorun:** Sunucu yeni 2 yıllık veriyi her yıl **Ekim ayında** yayınlar. Cihaz ise sadece yıl değiştiğinde (`savedYear !== curYear`) kontrol yaptığı için, Ekim ayında çıkan taze veriyi 3 ay boyunca görmezden gelir ve 1 Ocak'a kadar bekler. Bu durum, 2 yıllık sistemin sunduğu "erken tampon veri" korumasını çöpe atar.

#### 2. Bayram Namazı Dosyasının (`bayram_namazi.json`) Güncellenmemesi
* `downloadAndSetup()` fonksiyonunda (ilk kurulumda) `bayram_namazi.json` indirilir.
* Ancak `checkYearUpdate` içinde **yalnızca ilçe vakit JSON'u** indirilir; `bayram_namazi.json` için hiçbir indirme yapılmaz.
* TV ilk kurulumundan 1 yıl sonraki bayramlara ulaştığında elindeki bayram verisi güncellenmediği için bayram namazı kutusu ekranda çıkmaz veya eski yılı gösterir.

#### 3. Kiosk TV'lerde Güncellemenin Hiç Çalışmaması (Uygulama Yaşam Döngüsü)
* `app.js` içerisinde `checkYearUpdate` sadece sayfa açılışında `setTimeout(..., 5000)` ile BİR KEZ çağrılır.
* Cami TV'leri aylarca kapanmadan (kiosk) çalışır (geceleri sadece ekran kararır). Sayfa yeniden yüklenmediği sürece güncelleme kontrolü bir daha asla tetiklenmez.

#### 4. Güncelleme Sonrası Sayfa Yenileme (`location.reload()`) Kesintisi
* Güncelleme başarılı olduğunda `location.reload()` çağrılmaktadır.
* Eğer bu güncelleme namaz vaktinde, ezan anında veya cemaatin camide olduğu bir saatte gerçekleşirse ekranda ani bir kararma ve yükleniyor ekranı belirir.
* Güncelleme ya bellekteki değişkenler (`_prayerData`, `_bayramData`) tazelenerek reload'suz yapılmalı ya da sadece gece 01:00 - 04:00 saatleri arasında reload edilmelidir.

#### 5. Ayarlar Ekranında (`settings.html`) Durum Bilgisi ve Manuel Buton Yokluğu
* Cami görevlisi ayarlara girdiğinde elindeki verinin hangi yılları kapsadığını (örn: `2026 - 2027`), kaç günlük veri kaldığını görememekte ve internetten zorunlu güncelleme tetikleyememektedir.

#### 6. Çift Klasör Senkronizasyonu (`web/` vs `android/app/src/main/assets/web/`)
* Projede hem ana dizinde `web/` hem de Android altında `android/app/src/main/assets/web/` yer almaktadır. Android WebView doğrudan `assets/web/` dizinini çalıştırdığı için iki klasörün her zaman eşitlenmesi zorunludur.

---

## 🛠️ 3. UYGULANACAK MİMARİ VE EYLEM PLANI

### Adım 1: `data-manager.js` Güncellemeleri

#### A) Hicri Tarihten Bayram Günlerini ve Kalan Günü Tespit Etme
2 yıllık verideki `hicriTarih` alanını tarayarak yaklaşan ilk bayrama kaç gün kaldığını hesaplayan fonksiyon eklenmelidir:
```javascript
function getDaysToUpcomingBayram() {
    if (!_prayerData || _prayerData.length === 0) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const entry of _prayerData) {
        const hicri = entry.hicriTarih || '';
        // 1 Şevval (Ramazan) veya 10 Zilhicce (Kurban)
        if (hicri.includes('1 Şevval') || hicri.includes('10 Zilhicce')) {
            const bayramDate = _parseMiladiDate(entry.miladiTarih);
            if (bayramDate && bayramDate >= today) {
                const diffDays = Math.round((bayramDate - today) / (1000 * 60 * 60 * 24));
                return {
                    tip: hicri.includes('1 Şevval') ? 'ramazan' : 'kurban',
                    tarih: entry.miladiTarih,
                    kalanGun: diffDays
                };
            }
        }
    }
    return null;
}
```

#### B) Kalan Gün Sayısı (Safety Net) Hesaplama
```javascript
function getRemainingDays() {
    if (!_prayerData || _prayerData.length === 0) return 0;
    const lastEntry = _prayerData[_prayerData.length - 1];
    const lastDate = _parseMiladiDate(lastEntry.miladiTarih);
    if (!lastDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((lastDate - today) / (1000 * 60 * 60 * 24)));
}
```

#### C) Akıllı Periyodik Güncelleme (`checkPeriodicUpdate`)
Eski `checkYearUpdate` fonksiyonunun yerine geçecek akıllı motor:
1. **Şart 1 (30 Gün Kuralı):** Son kontrolden bu yana 30 gün geçmişse vakit dosyasını güncelle.
2. **Şart 2 (Güvenlik Ağı):** Eldeki veri **365 günden az kalmışsa** beklemeden güncelle.
3. **Şart 3 (Bayram Yaklaşma Kuralı):** Yaklaşan bayrama **4 gün veya daha az kalmışsa** (Diyanet açıklamış ve gece botu yüklemiş olacağından) `bayram_namazi.json` dosyasını çek.
4. **Şart 4 (Manuel İstek - force):** Ayarlar ekranından butona basıldığında beklemeden her iki dosyayı da güncelle.

```javascript
async function checkPeriodicUpdate(ilce, ilceId, force = false) {
    if (!navigator.onLine) return { updated: false, reason: 'offline' };

    const now = Date.now();
    const lastCheck = (await dbGet('meta', 'last_prayer_update_check')) || 0;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    const remainingDays = getRemainingDays();
    const bayramInfo = getDaysToUpcomingBayram();
    
    // Bayram güncelleme şartı: Bayrama 4 gün veya daha az var ve son 24 saatte bayram verisi çekilmemişse
    const lastBayramCheck = (await dbGet('meta', 'last_bayram_update_check')) || 0;
    const oneDayMs = 24 * 60 * 60 * 1000;
    const shouldUpdateBayram = force || (bayramInfo && bayramInfo.kalanGun <= 4 && (now - lastBayramCheck > oneDayMs));

    // Vakit güncelleme şartı: 30 gün dolmuşsa VEYA veri < 365 gün kalmışsa VEYA force
    const shouldUpdatePrayer = force || (now - lastCheck > thirtyDaysMs) || (remainingDays < 365);

    if (!shouldUpdatePrayer && !shouldUpdateBayram) {
        return { updated: false, reason: 'up-to-date' };
    }

    const filename = convertToFilename(ilce);
    const vakitUrl = `${BASE_URL}${filename}_${ilceId}.json`;
    const bayramUrl = `${BASE_URL}bayram_namazi.json`;

    let prayerUpdated = false;
    let bayramUpdated = false;

    // Vakit Güncellemesi
    if (shouldUpdatePrayer) {
        try {
            const res = await fetch(vakitUrl, { cache: 'no-cache' });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    await dbPut('prayer_times', 'data', data);
                    await dbPut('meta', 'last_prayer_update_check', now);
                    _prayerData = data;
                    prayerUpdated = true;
                }
            }
        } catch (e) {
            console.warn('[DataManager] Vakit güncelleme hatası:', e);
        }
    }

    // Bayram Güncellemesi
    if (shouldUpdateBayram) {
        try {
            const bRes = await fetch(bayramUrl, { cache: 'no-cache' });
            if (bRes.ok) {
                const bData = await bRes.json();
                if (bData && typeof bData === 'object') {
                    await dbPut('bayram_times', 'data', bData);
                    await dbPut('meta', 'last_bayram_update_check', now);
                    _bayramData = bData;
                    bayramUpdated = true;
                }
            }
        } catch (e) {
            console.warn('[DataManager] Bayram güncelleme hatası:', e);
        }
    }

    return {
        updated: prayerUpdated || bayramUpdated,
        prayerUpdated,
        bayramUpdated,
        remainingDays: getRemainingDays()
    };
}
```

---

### Adım 2: `app.js` Yaşam Döngüsü ve Zamanlayıcı

1. **24 Saatte Bir Arka Plan Kontrolü:**
   * Uygulama açılışında ve ardından her 24 saatte bir `checkPeriodicUpdate()` tetiklenmelidir:
   ```javascript
   function schedulePrayerTimesCheck() {
       // Açılıştan 15 saniye sonra ilk kontrol
       setTimeout(async () => {
           await runUpdateCheck();
       }, 15000);

       // Her 24 saatte bir tekrarla
       setInterval(async () => {
           await runUpdateCheck();
       }, 24 * 60 * 60 * 1000);
   }

   async function runUpdateCheck() {
       if (!navigator.onLine || !_settings.ilce || !_settings.ilceId) return;
       try {
           const result = await DataManager.checkPeriodicUpdate(_settings.ilce, _settings.ilceId);
           if (result.updated) {
               console.log('[App] Vakit/Bayram verileri sessizce yenilendi.');
               // Sayfayı reload etmeden UI'ı tazele
               _todayPT = applySabahLogic(DataManager.getTodayPrayerTimes(), _settings);
               _tomorrowImsak = DataManager.getTomorrowImsak();
               _dayType = PrayerEngine.getDayType(_todayPT);
               tick();
           }
       } catch (err) {
           console.warn('[App] Periyodik güncelleme hatası:', err);
       }
   }
   ```
2. **Reload Koruması:** Asla namaz veya ezan esnasında `location.reload()` çağrılmamalıdır. Bellek içi nesneler güncellenerek akış kesintisiz sürdürülmelidir.

---

### Adım 3: Ayarlar Ekranı (`settings.html` & `settings.js`)

1. **Konum / Vakit Bölümüne Bilgi Kartı Eklenmesi:**
   * **Yüklü Yıllar:** `2026 - 2027`
   * **Kalan Veri:** `420 Gün`
   * **Son Güncelleme:** `22 Ekim 2026 14:30`
2. **"Vakitleri Şimdi Güncelle" Butonu:**
   * Butona basıldığında `DataManager.checkPeriodicUpdate(s.ilce, s.ilceId, true)` çağrılır.
   * Buton spinner gösterir, başarı durumunda yeşil `"Vakit ve Bayram Verileri Başarıyla Güncellendi!"` bildirimi verir.

---

### Adım 4: Klasör Senkronizasyonu

Yapılan tüm kodlama işlemlerinden sonra:
* `d:\Esp32_projeler\akilli_cami\cami-tv\web\` dizinindeki güncellenen tüm dosyalar (`data-manager.js`, `app.js`, `settings.js`, `settings.html` vb.)
* `d:\Esp32_projeler\akilli_cami\cami-tv\android\app\src\main\assets\web\` dizinine **birebir kopyalanmalıdır**.

---

## 🎯 4. KONTROL LİSTESİ (YENİ SOHBET İÇİN TALİMAT)

Yeni sohbette yapay zekaya verilecek komut özeti:
> *"Bu rapordaki adımları sırasıyla uygula:*
> 1. `data-manager.js` içine `getDaysToUpcomingBayram`, `getRemainingDays` ve `checkPeriodicUpdate` fonksiyonlarını ekle.
> 2. `app.js` içinde 24 saatlik periyodik kontrolü başlat ve reload'suz sessiz güncelleme sağla.
> 3. `settings.html` ve `settings.js` içine Veri Durumu Kartı ve 'Vakitleri Şimdi Güncelle' butonunu entegre et.
> 4. `web/` klasöründeki güncellemeleri `android/app/src/main/assets/web/` klasörüne kopyalayarak senkronize et."*
