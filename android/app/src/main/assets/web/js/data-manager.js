/**
 * CAMI TV — data-manager.js
 * Offline-first veri katmanı.
 * Öncelik: IndexedDB (indirilen vakit dosyası) → ESP32 API (opsiyonel)
 *
 * İlk kurulum: il/ilçe seçilince GitHub'dan 2 dosya paralel indirilir:
 *   1) Vakit JSON  → ta1gi.github.io/namaz_vakitleri/{DOSYAADI}_{ID}.json
 *   2) Bayram JSON → ta1gi.github.io/namaz_vakitleri/bayram_namazi.json
 */

const DataManager = (() => {

    const DB_NAME = 'cami_tv_db';
    const DB_VERSION = 1;
    const BASE_URL = 'https://ta1gi.github.io/namaz_vakitleri/';

    let _db = null;
    let _prayerData = null;  // Yıllık vakit dizisi (cache)
    let _bayramData = null;  // Bayram vakitleri (cache)

    // ──────────────────────────────────────────────────────
    // IndexedDB Başlatma
    // ──────────────────────────────────────────────────────
    function initDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Vakit verisi deposu
                if (!db.objectStoreNames.contains('prayer_times')) {
                    db.createObjectStore('prayer_times');
                }
                // Bayram namazı deposu
                if (!db.objectStoreNames.contains('bayram_times')) {
                    db.createObjectStore('bayram_times');
                }
                // Genel key-value deposu (meta vb.)
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta');
                }
            };

            req.onsuccess = (e) => {
                _db = e.target.result;
                resolve(_db);
            };

            req.onerror = (e) => {
                console.error('[DataManager] IndexedDB açılamadı:', e.target.error);
                reject(e.target.error);
            };
        });
    }

    // ──────────────────────────────────────────────────────
    // IndexedDB Okuma / Yazma Yardımcıları
    // ──────────────────────────────────────────────────────
    function dbGet(store, key) {
        return new Promise((resolve, reject) => {
            const tx = _db.transaction(store, 'readonly');
            const req = tx.objectStore(store).get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function dbPut(store, key, value) {
        return new Promise((resolve, reject) => {
            const tx = _db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).put(value, key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }

    // ──────────────────────────────────────────────────────
    // Veritabanı ve Önbellekleri Temizle
    // ──────────────────────────────────────────────────────
    async function clearAllData() {
        try {
            if (!_db) await initDB();

            // Veritabanı temizliği (Transaction içinde await yasaktır, deadlock engellendi)
            await new Promise((resolve, reject) => {
                const tx = _db.transaction(['prayer_times', 'bayram_times', 'meta'], 'readwrite');
                tx.objectStore('prayer_times').clear();
                tx.objectStore('bayram_times').clear();
                tx.objectStore('meta').clear();

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });

            // Tarayıcı önbelleği (Caches) temizliği veritabanından bağımsız yapılıyor
            if ('caches' in window) {
                const keys = await caches.keys();
                for (let k of keys) {
                    await caches.delete(k);
                }
            }
            return true;
        } catch (e) {
            console.warn('[DataManager] Temizleme hatası:', e);
            return false;
        }
    }


    // ──────────────────────────────────────────────────────
    // İlçe adından dosya adı üretimi
    // Ana projedeki convertToFilename() mantığının aynısı
    // ──────────────────────────────────────────────────────
    function convertToFilename(ilce) {
        return ilce
            .replace(/Ç/g, 'C').replace(/ç/g, 'C')
            .replace(/Ğ/g, 'G').replace(/ğ/g, 'G')
            .replace(/İ/g, 'I').replace(/ı/g, 'I')
            .replace(/Ö/g, 'O').replace(/ö/g, 'O')
            .replace(/Ş/g, 'S').replace(/ş/g, 'S')
            .replace(/Ü/g, 'U').replace(/ü/g, 'U')
            .toUpperCase();
    }

    // ──────────────────────────────────────────────────────
    // İlk Kurulum: Vakit + Bayram Dosyalarını İndir
    // Geri çağrı: onProgress(mesaj) — ilerleme mesajları
    // ──────────────────────────────────────────────────────
    async function downloadAndSetup(il, ilce, ilceId, onProgress) {
        const filename = convertToFilename(ilce);
        const vakitUrl = `${BASE_URL}${filename}_${ilceId}.json`;
        const bayramUrl = `${BASE_URL}bayram_namazi.json`;

        onProgress?.('Namaz vakitleri indiriliyor...');

        // Paralel indirme
        const [vakitRes, bayramRes] = await Promise.allSettled([
            fetch(vakitUrl),
            fetch(bayramUrl),
        ]);

        // Vakit dosyası — zorunlu
        if (vakitRes.status !== 'fulfilled' || !vakitRes.value.ok) {
            throw new Error(`Vakit dosyası indirilemedi: ${vakitUrl}`);
        }
        onProgress?.('Vakit verisi alındı, kaydediliyor...');
        const vakitJson = await vakitRes.value.json();
        await dbPut('prayer_times', 'data', vakitJson);
        await dbPut('meta', 'prayer_year', new Date().getFullYear());
        await dbPut('meta', 'prayer_ilce_id', ilceId);
        await dbPut('meta', 'prayer_ilce', ilce);
        await dbPut('meta', 'prayer_il', il);

        // Bayram dosyası — opsiyonel (başarısız olsa devam et)
        if (bayramRes.status === 'fulfilled' && bayramRes.value.ok) {
            onProgress?.('Bayram namazı verisi kaydediliyor...');
            const bayramJson = await bayramRes.value.json();
            await dbPut('bayram_times', 'data', bayramJson);
        } else {
            console.warn('[DataManager] Bayram namazı verisi indirilemedi (opsiyonel).');
        }

        _prayerData = vakitJson;
        _bayramData = null; // reloaddan okunacak

        onProgress?.('Kurulum tamamlandı!');
        return true;
    }

    // ──────────────────────────────────────────────────────
    // Uygulama Başlatma — Mevcut veriyi yükle
    // ──────────────────────────────────────────────────────
    async function loadFromDB() {
        _prayerData = await dbGet('prayer_times', 'data');
        _bayramData = await dbGet('bayram_times', 'data');
        return !!_prayerData;
    }

    // ──────────────────────────────────────────────────────
    // Bugünün vakitlerini bul
    // Veri yapısı: [{miladiTarih, imsak, gunes, ogle, ikindi, aksam, yatsi, ...}]
    // ──────────────────────────────────────────────────────
    function getTodayPrayerTimes() {
        if (!_prayerData) return null;

        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        // Türkçe ay adları (ana projeyle uyumlu format)
        const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

        const todayStr = `${day} ${aylar[month - 1]} ${year} ${gunler[now.getDay()]}`;

        return _prayerData.find(d => d.miladiTarih === todayStr) || null;
    }

    // ──────────────────────────────────────────────────────
    // Yarının imsak vaktini bul
    // ──────────────────────────────────────────────────────
    function getTomorrowImsak() {
        if (!_prayerData) return null;

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const day = String(tomorrow.getDate()).padStart(2, '0');
        const month = tomorrow.getMonth() + 1;
        const year = tomorrow.getFullYear();
        const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

        const str = `${day} ${aylar[month - 1]} ${year} ${gunler[tomorrow.getDay()]}`;
        const entry = _prayerData.find(d => d.miladiTarih === str);
        return entry ? entry.imsak : null;
    }

    // ──────────────────────────────────────────────────────
    // Bu haftanın 7 günlük verisini al
    // ──────────────────────────────────────────────────────
    function getWeekPrayerTimes() {
        if (!_prayerData) return [];
        const aylar = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
            'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
        const gunler = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
        const result = [];

        for (let i = 0; i < 15; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const str = `${String(d.getDate()).padStart(2, '0')} ${aylar[d.getMonth()]} ${d.getFullYear()} ${gunler[d.getDay()]}`;
            const entry = _prayerData.find(x => x.miladiTarih === str);
            if (entry) result.push(entry);
        }
        return result;
    }


    // ──────────────────────────────────────────────────────
    // Bayram namazı vakti — günün il/ilçesine göre
    // ──────────────────────────────────────────────────────
    function getBayramWakti(ilceId) {
        if (!_bayramData) return null;
        const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        // Bayram JSON yapısı: [{ilce_id, tarih, saat}]  (ta1gi.github.io formatı)
        if (Array.isArray(_bayramData)) {
            return _bayramData.find(b => b.ilce_id === ilceId && b.tarih === today) || null;
        }
        return null;
    }

    // ──────────────────────────────────────────────────────
    // Yıl güncelleme kontrolü (arka planda, sessiz)
    // ──────────────────────────────────────────────────────
    async function checkYearUpdate(ilce, ilceId) {
        try {
            const savedYear = await dbGet('meta', 'prayer_year');
            const curYear = new Date().getFullYear();
            if (savedYear === curYear) return false; // güncel

            console.log('[DataManager] Yeni yıl tespit edildi, vakit verisi güncelleniyor...');
            const filename = convertToFilename(ilce);
            const url = `${BASE_URL}${filename}_${ilceId}.json`;
            const res = await fetch(url, { cache: 'no-cache' });
            if (!res.ok) return false;

            const data = await res.json();
            await dbPut('prayer_times', 'data', data);
            await dbPut('meta', 'prayer_year', curYear);
            _prayerData = data;
            console.log('[DataManager] Vakit verisi güncellendi.');
            return true;
        } catch (e) {
            console.warn('[DataManager] Yıl güncelleme başarısız (internet yok?):', e);
            return false;
        }
    }

    // ──────────────────────────────────────────────────────
    // ESP32'den veri al (opsiyonel — SettingsManager'dan kontrol edilir)
    // ──────────────────────────────────────────────────────
    async function fetchFromESP32(ip, timeout = 3000) {
        if (!ip) return null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(`http://${ip}/api/tv/data`, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            clearTimeout(timer);
            return null; // Sessizce başarısız
        }
    }

    // ──────────────────────────────────────────────────────
    // İçerik dosyalarını yükle (ayet, hadis vb.)
    // Bu dosyalar uygulamayla birlikte gelir — her zaman mevcut
    // ──────────────────────────────────────────────────────
    const _contentCache = {};

    async function loadContent(type) {
        // type: ayetler | hadisler | esmaulhusna | dualar
        if (_contentCache[type]) return _contentCache[type];

        // Önce gömülü veriyi dene (WebView / offline Android için CORS hatasını aşar)
        const globalVar = type.toUpperCase() + '_DATA';
        if (window[globalVar] && Array.isArray(window[globalVar])) {
            _contentCache[type] = window[globalVar];
            return window[globalVar];
        }

        try {
            const res = await fetch(`data/${type}.json`);
            if (!res.ok) throw new Error(`${type}.json yüklenemedi`);
            const data = await res.json();
            _contentCache[type] = data;
            return data;
        } catch (e) {
            console.error('[DataManager] İçerik yüklenemedi:', type, e);
            return [];
        }
    }

    // Konum listesini yükle
    async function loadLocations() {
        // Önce gömülü veriyi dene (WebView / offline için)
        if (window.LOCATIONS_DATA && typeof window.LOCATIONS_DATA === 'object') {
            return window.LOCATIONS_DATA;
        }
        // Geri dönüş: fetch ile yükle (tarayıcı ortamı)
        return loadContent('locations');
    }


    // ──────────────────────────────────────────────────────
    // GitHub'dan İçerik Güncelle (E3)
    // 24 saatte bir çalışır — internet yoksa sessizce atlar
    // ──────────────────────────────────────────────────────
    const CONTENT_TYPES = ['ayetler', 'hadisler', 'esmaulhusna', 'dualar'];
    const CONTENT_GH_BASE = 'https://ta1gi.github.io/namaz_vakitleri/data/';
    const CONTENT_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 saat

    async function refreshContentFromGitHub() {
        if (!navigator.onLine) {
            console.log('[DataManager] Çevrimdışı — içerik güncellemesi atlandı.');
            return;
        }

        console.log('[DataManager] GitHub içerik güncellemesi başlıyor...');
        let updatedCount = 0;

        for (const type of CONTENT_TYPES) {
            try {
                const res = await fetch(`${CONTENT_GH_BASE}${type}.json`, {
                    cache: 'no-store'
                });
                if (!res.ok) continue;
                const data = await res.json();
                if (!Array.isArray(data) || data.length === 0) continue;

                // IndexedDB meta store'a kaydet
                await dbPut('meta', `content_${type}`, data);
                // Bellek önbelleğini güncelle
                _contentCache[type] = data;
                // Global değişkeni de güncelle (carousel-manager hemen kullanır)
                window[type.toUpperCase() + '_DATA'] = data;
                updatedCount++;
            } catch (e) {
                console.warn(`[DataManager] ${type} güncellenemedi:`, e.message);
            }
        }

        if (updatedCount > 0) {
            await dbPut('meta', 'content_last_refresh', Date.now());
            console.log(`[DataManager] ${updatedCount} içerik güncellendi.`);
        }
    }

    async function scheduleContentRefresh() {
        // Son güncellemeden bu yana 24 saat geçtiyse hemen güncelle
        if (!_db) return;
        const lastRefresh = await dbGet('meta', 'content_last_refresh') || 0;
        const elapsed = Date.now() - lastRefresh;
        if (elapsed >= CONTENT_REFRESH_INTERVAL_MS) {
            refreshContentFromGitHub(); // await yok — arka planda çalışsın
        }
        // Her 24 saatte bir tekrarla
        setInterval(refreshContentFromGitHub, CONTENT_REFRESH_INTERVAL_MS);
    }

    // loadContent'i IndexedDB content önbelleğini de kontrol edecek şekilde güncelle
    async function loadContentEnhanced(type) {
        if (_contentCache[type]) return _contentCache[type];

        // 1) IndexedDB'den dene (GitHub'dan daha önce indirilmişse)
        if (_db) {
            try {
                const cached = await dbGet('meta', `content_${type}`);
                if (cached && Array.isArray(cached) && cached.length > 0) {
                    _contentCache[type] = cached;
                    return cached;
                }
            } catch (_) { }
        }

        // 2) Gömülü window.* değişkeni
        const globalVar = type.toUpperCase() + '_DATA';
        if (window[globalVar] && Array.isArray(window[globalVar])) {
            _contentCache[type] = window[globalVar];
            return window[globalVar];
        }

        // 3) Yerel dosyadan (tarayıcı ortamı)
        try {
            const res = await fetch(`data/${type}.json`);
            if (!res.ok) throw new Error(`${type}.json yüklenemedi`);
            const data = await res.json();
            _contentCache[type] = data;
            return data;
        } catch (e) {
            console.error('[DataManager] İçerik yüklenemedi:', type, e);
            return [];
        }
    }

    // ──────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────
    return {
        initDB,
        loadFromDB,
        downloadAndSetup,
        getTodayPrayerTimes,
        getTomorrowImsak,
        getWeekPrayerTimes,
        getBayramWakti,
        checkYearUpdate,
        fetchFromESP32,
        loadContent: loadContentEnhanced,
        loadLocations,
        convertToFilename,
        clearAllData,
        refreshContentFromGitHub,
        scheduleContentRefresh,
    };

})();

window.DataManager = DataManager;
