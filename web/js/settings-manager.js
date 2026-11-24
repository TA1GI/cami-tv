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
    tema: 'emerald',   // default | emerald | navy | purple | light | turquoise | ocean | sky | ice | rose | olive | auto
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
    camiBilgiMetin: [], // Artık dizi
    gosterImsakiye: true,
    gosterHavaDurumu: true,  // internet varsa otomatik gösterilir
    gosterKible: true,
    gosterTickerBant: true,
    tickerHiz: 45,            // piksel / saniye kayma hızı (20 - 120, varsayılan: 45 px/sn)
    gosterHicriTarih: true,
    gosterCemaat: false,

    // Cuma Yardımı
    gosterCumaYardimi: false,
    cumaYardimBaslangicDk: 15,
    cumaYardimBitisDk: 45,
    cumaYardimGorunum: 'tam-ekran', // tam-ekran | sol-panel | orta-panel | sag-panel
    cumaYardimMetinler: { tr: '', ar: '', en: '' },

    // İçerik Düzenleyici (telefon → TV senkron)
    customContent: {
      custom: { ayetler: [], hadisler: [], dualar: [], esmaulhusna: [] },
      disabled: { ayetler: [], hadisler: [], dualar: [], esmaulhusna: [] },
    },

    // İçerik bazlı ayarlar (her biri için süre ve yazı boyutu)
    icerikAyarlari: {
      ayet: { sure: 30, yaziBoyu: 100 },
      hadis: { sure: 30, yaziBoyu: 100 },
      esma: { sure: 15, yaziBoyu: 100 },
      dua: { sure: 30, yaziBoyu: 100 },
      camibilgi: { sure: 25, yaziBoyu: 100 },
      imsakiye: { sure: 45, yaziBoyu: 100 },
      duyuru: { sure: 25, yaziBoyu: 100 },
    },

    // Ezan ekranı
    sabahImsagaGore: false, // Sabah ezanını imsaka göre hesaba kat (varsayılan: kapalı)
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
    gucMod: 'prayer',        // always | fixed | prayer | hybrid
    // Sabit saat modu
    gucAcisSaati: '05:30',
    gucKapanisSaati: '23:00',
    // Namaz vakti bazlı mod
    gucPrayerOffsets: {
      imsak: { aktif: false, onceDk: 30, sonraDk: 20 },
      sabah: { aktif: true, onceDk: 30, sonraDk: 60 },
      gunes: { aktif: false, onceDk: 0, sonraDk: 0 },
      ogle: { aktif: true, onceDk: 30, sonraDk: 45 },
      ikindi: { aktif: true, onceDk: 30, sonraDk: 40 },
      aksam: { aktif: true, onceDk: 25, sonraDk: 35 },
      yatsi: { aktif: true, onceDk: 30, sonraDk: 50 },
      cuma: { aktif: true, onceDk: 60, sonraDk: 60 },
      bayram: { aktif: true, onceDk: 60, sonraDk: 90 },
    },
    // Parlaklık
    gucAktifParlaklik: 100,  // %
    gucPasifParlaklik: 0,    // % (CSS tam karartma)

    // ESP32 entegrasyonu — varsayılan: KAPALI
    esp32Aktif: false,
    esp32Ip: '',
    esp32Vakit: false,  // vakitleri ESP32'den al
    esp32Sicaklik: true,   // sıcaklık/nem al (aktifse)
    esp32Cihazlar: false,  // cihaz durumları widget'ı

    // Arkaplan Resim
    arkaplanResim: '',          // base64 data URI
    arkaplanOpaklık: 15,        // 0-50 (yüzde)
    arkaplanBulaniklik: 0,      // 0-20 px

    // Duyurular (gelişmiş)
    duyurular: [
      {
        id: 1,
        tip: 'normal',
        metin: 'Camimizde lütfen cep telefonlarımızı sessize alalım veya kapatalım.',
        metinAr: '',
        metinEn: '',
        gorunum: 'sadece-ticker',
        tamEkranModu: 'surekli',
        zamanBaslangic: '',
        zamanBitis: '',
        gunler: [],
        tekrar: 'kalici',
        tarihBaslangic: '',
        tarihBitis: '',
        tarihEkle: '2026-01-01T00:00:00.000Z',
        sureDk: 0,
        sureSaniye: 0,
        aktif: true,
      },
      {
        id: 2,
        tip: 'normal',
        metin: 'Saflarımızı sık ve düzgün tutalım; zira safların düzgünlüğü namazın kemalindendir.',
        metinAr: '',
        metinEn: '',
        gorunum: 'sadece-ticker',
        tamEkranModu: 'surekli',
        zamanBaslangic: '',
        zamanBitis: '',
        gunler: [],
        tekrar: 'kalici',
        tarihBaslangic: '',
        tarihBitis: '',
        tarihEkle: '2026-01-01T00:00:00.000Z',
        sureDk: 0,
        sureSaniye: 0,
        aktif: true,
      }
    ],
    // Her duyuru: { id, tip, metin, metinAr, metinEn, gorunum, tamEkranModu, zamanBaslangic, zamanBitis, gunler, tekrar, tarihBaslangic, tarihBitis, tarihEkle, sureDk, sureSaniye, aktif }
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

        // Geri uyumluluk: Eski camiBilgiMetin string ise diziye çevir
        if (typeof result.camiBilgiMetin === 'string') {
          result.camiBilgiMetin = result.camiBilgiMetin.trim() ? [result.camiBilgiMetin] : [];
        } else if (!Array.isArray(result.camiBilgiMetin)) {
          result.camiBilgiMetin = [];
        }

        // Geri uyumluluk: Duyurularda tamEkranModu ve sureSaniye alanı yoksa varsayılanı ata
        if (Array.isArray(result.duyurular)) {
          if (result.duyurular.length === 0) {
            result.duyurular = structuredClone(DEFAULTS.duyurular);
          } else {
            result.duyurular = result.duyurular.map(d => ({
              ...d,
              tamEkranModu: d?.tamEkranModu || 'surekli',
              sureSaniye: d?.sureSaniye || 0,
            }));
          }
        } else {
          result.duyurular = structuredClone(DEFAULTS.duyurular);
        }
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
  function addDuyuru(duyuruData) {
    const s = load();
    const yeni = {
      id: Date.now(),
      tip: duyuruData.tip || 'normal',       // normal | acil | cenaze
      metin: duyuruData.metin || '',
      metinAr: duyuruData.metinAr || '',      // Arapça metin
      metinEn: duyuruData.metinEn || '',      // İngilizce metin
      gorunum: duyuruData.gorunum || 'carousel', // tam-ekran | carousel | sadece-ticker
      tamEkranModu: duyuruData.tamEkranModu || 'surekli', // surekli | sirali
      zamanBaslangic: duyuruData.zamanBaslangic || '', // HH:mm
      zamanBitis: duyuruData.zamanBitis || '',     // HH:mm
      gunler: duyuruData.gunler || [],        // [0-6] boş = her gün
      tekrar: duyuruData.tekrar || 'kalici',  // tek-sefer | gunluk | haftalik | kalici
      tarihBaslangic: duyuruData.tarihBaslangic || '', // YYYY-MM-DD
      tarihBitis: duyuruData.tarihBitis || '',     // YYYY-MM-DD
      tarihEkle: new Date().toISOString(),
      sureDk: duyuruData.sureDk || 0,         // 0 = kalıcı
      sureSaniye: parseInt(duyuruData.sureSaniye) || 0, // 0 = varsayılan slayt süresi
      aktif: true,
    };
    s.duyurular.push(yeni);
    save(s);
    return yeni;
  }

  function updateDuyuru(id, duyuruData) {
    const s = load();
    const idx = s.duyurular.findIndex(d => d.id === id);
    if (idx !== -1) {
      s.duyurular[idx] = {
        ...s.duyurular[idx],
        ...duyuruData,
        tamEkranModu: duyuruData.tamEkranModu || s.duyurular[idx].tamEkranModu || 'surekli',
        sureSaniye: duyuruData.sureSaniye !== undefined ? (parseInt(duyuruData.sureSaniye) || 0) : (s.duyurular[idx].sureSaniye || 0),
      };
      save(s);
      return s.duyurular[idx];
    }
    return null;
  }

  function removeDuyuru(id) {
    const s = load();
    s.duyurular = s.duyurular.filter(d => d.id !== id);
    save(s);
  }

  function getAktifDuyurular() {
    const s = load();
    const now = new Date();
    const nowMs = now.getTime();
    const todayDay = now.getDay(); // 0=Pazar, 5=Cuma
    const currentH = now.getHours();
    const currentM = now.getMinutes();
    const currentTimeMin = currentH * 60 + currentM;
    const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

    return s.duyurular.filter(d => {
      if (!d.aktif) return false;

      // Eski format desteği (sureDk bazlı)
      if (d.sureDk && d.sureDk > 0) {
        const eklenme = new Date(d.tarihEkle).getTime();
        if ((nowMs - eklenme) >= (d.sureDk * 60 * 1000)) return false;
      }

      // Tarih aralığı kontrolü
      if (d.tarihBaslangic && todayStr < d.tarihBaslangic) return false;
      if (d.tarihBitis && todayStr > d.tarihBitis) return false;

      // Gün kontrolü (boş = her gün)
      if (d.gunler && d.gunler.length > 0) {
        if (!d.gunler.includes(todayDay)) return false;
      }

      // Zaman aralığı kontrolü (boş = tüm gün)
      if (d.zamanBaslangic) {
        const [bH, bM] = d.zamanBaslangic.split(':').map(Number);
        const baslangicMin = bH * 60 + bM;
        if (currentTimeMin < baslangicMin) return false;
      }
      if (d.zamanBitis) {
        const [sH, sM] = d.zamanBitis.split(':').map(Number);
        const bitisMin = sH * 60 + sM;
        if (currentTimeMin > bitisMin) return false;
      }

      // Tek seferlik kontrol (gösterilmişse pasif yap)
      if (d.tekrar === 'tek-sefer') {
        const eklenme = new Date(d.tarihEkle);
        const eklenmeStr = eklenme.toISOString().split('T')[0];
        if (todayStr > eklenmeStr) return false;
      }

      return true;
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
    updateDuyuru,
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
