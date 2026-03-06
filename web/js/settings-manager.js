/**
 * CAMI TV — settings-manager.js
 * Tüm ayarlar localStorage üzerinde saklanır.
 * İnternet bağlantısı gerektirmez.
 */

const SettingsManager = (() => {

  const STORAGE_KEY = 'cami_tv_settings';

  // Varsayılan ayarlar
  const DEFAULTS = {
    // Cami bilgileri
    camiAdi: 'Cami TV',
    camiLogo: '',          // base64 veya boş

    // Konum (ilk kurulumda doldurulur)
    il: '',
    ilce: '',
    ilceId: 0,

    // Görünüm
    tema: 'default',   // default | navy | purple | light | auto
    dil: 'tr',        // tr | ar | en
    yaziBoyu: 'normal',    // small | normal | large | xlarge
    ekranYonu: 'auto',      // auto | landscape | portrait

    // İçerik toggle'ları
    gosterAyet: true,
    gosterHadis: true,
    gosterSabah: true,
    gosterEsma: true,
    gosterDua: true,
    gosterCamiBilgi: false,
    camiBilgiMetin: '',
    gosterImsakiye: true,
    gosterHavaDurumu: false,  // internet gerektirir
    gosterKible: true,
    gosterTickerBant: true,
    gosterHicriTarih: true,
    gosterCemaat: false,

    // Carousel süresi (saniye)
    carouselSure: 15,
    carouselYaziBoyu: 100,  // yüzde: 85-250 arası

    // Ezan ekranı
    sabahImsagaGore: false, // Sabah ezanını imsaka göre hesaba kat
    ezanOnceDk: 15,       // kaç dakika önce açılsın
    cemaatOffsets: {         // her vakit için cemaat dakikası (dk sonra)
      imsak: 0,
      sabah: 0,
      gunes: 0,
      ogle: 15,
      ikindi: 15,
      aksam: 15,
      yatsi: 30,
    },
    ezanSesi: false,         // ezan sesi oynatılsın mı

    // Güç yönetimi
    gucMod: 'always',        // always | fixed | prayer | hybrid
    // Sabit saat modu
    gucAcisSaati: '05:30',
    gucKapanisSaati: '23:00',
    // Namaz vakti bazlı mod
    gucPrayerOffsets: {
      imsak: { aktif: true, onceDk: 30, sonraDk: 20 },
      sabah: { aktif: true, onceDk: 0, sonraDk: 20 },
      gunes: { aktif: false, onceDk: 0, sonraDk: 0 },
      ogle: { aktif: true, onceDk: 15, sonraDk: 45 },
      ikindi: { aktif: true, onceDk: 15, sonraDk: 30 },
      aksam: { aktif: true, onceDk: 30, sonraDk: 30 },
      yatsi: { aktif: true, onceDk: 20, sonraDk: 30 },
      cuma: { aktif: true, onceDk: 60, sonraDk: 90 },
      bayram: { aktif: true, onceDk: 60, sonraDk: 90 },
    },
    // Parlaklık
    gucAktifParlaklik: 100,  // %
    gucPasifParlaklik: 10,   // % (CSS karartma)

    // ESP32 entegrasyonu — varsayılan: KAPALI
    esp32Aktif: false,
    esp32Ip: '',
    esp32Vakit: false,  // vakitleri ESP32'den al
    esp32Sicaklik: true,   // sıcaklık/nem al (aktifse)
    esp32Cihazlar: false,  // cihaz durumları widget'ı

    // Duyurular
    duyurular: [],   // [{ id, tip, metin, tarihEkle, sureDk, aktif }]
  };

  // ──────────────────────────────────────────────────────
  // Yükle / Kaydet
  // ──────────────────────────────────────────────────────

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let result = structuredClone(DEFAULTS);
      if (raw) {
        result = deepMerge(result, JSON.parse(raw));
      }

      // Ayarları Android SharedPreferences katmanına yedekle (Telefondan ilk girişte görünebilmesi için)
      if (window.AndroidBridge && typeof AndroidBridge.syncSettings === 'function') {
        AndroidBridge.syncSettings(JSON.stringify(result));
      }
      return result;
    } catch (e) {
      console.warn('[Settings] Yükleme hatası, varsayılanlar kullanılıyor:', e);
      return structuredClone(DEFAULTS);
    }
  }

  function save(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));

      // Ayarları Android SharedPreferences katmanına senkronize et
      if (window.AndroidBridge && typeof AndroidBridge.syncSettings === 'function') {
        AndroidBridge.syncSettings(JSON.stringify(settings));
      }

      return true;
    } catch (e) {
      console.error('[Settings] Kaydetme hatası:', e);
      return false;
    }
  }

  // ──────────────────────────────────────────────────────
  // Derin birleştirme yardımcısı
  // ──────────────────────────────────────────────────────
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // ──────────────────────────────────────────────────────
  // Konum kurulu mu?
  // ──────────────────────────────────────────────────────
  function isSetupComplete() {
    const s = load();
    return s.il !== '' && s.ilce !== '' && s.ilceId !== 0;
  }

  // ──────────────────────────────────────────────────────
  // Duyuru yönetimi
  // ──────────────────────────────────────────────────────
  function addDuyuru(metin, tip = 'normal', sureDk = 0) {
    const s = load();
    const yeni = {
      id: Date.now(),
      tip,       // normal | acil | cenaze
      metin,
      tarihEkle: new Date().toISOString(),
      sureDk,    // 0 = kalıcı
      aktif: true,
    };
    s.duyurular.push(yeni);
    save(s);
    return yeni;
  }

  function removeDuyuru(id) {
    const s = load();
    s.duyurular = s.duyurular.filter(d => d.id !== id);
    save(s);
  }

  function getAktifDuyurular() {
    const s = load();
    const now = Date.now();
    return s.duyurular.filter(d => {
      if (!d.aktif) return false;
      if (d.sureDk === 0) return true; // kalıcı
      const eklenme = new Date(d.tarihEkle).getTime();
      return (now - eklenme) < (d.sureDk * 60 * 1000);
    });
  }

  // ──────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────
  return {
    load,
    save,
    isSetupComplete,
    defaults: DEFAULTS,
    addDuyuru,
    removeDuyuru,
    getAktifDuyurular,
    // Tek bir ayarı hızlıca güncelle
    set(key, value) {
      const s = load();
      s[key] = value;
      save(s);
    },
    get(key) {
      return load()[key];
    },
  };

})();

// Global erişim
window.SettingsManager = SettingsManager;
