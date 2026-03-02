/**
 * CAMI TV — app.js
 * Ana uygulama başlatıcısı.
 * Tüm modülleri koordine eder.
 */

const App = (() => {

    let _settings = null;
    let _todayPT = null;
    let _tomorrowImsak = null;
    let _nextPrayer = null;
    let _dayType = null;
    let _tickInterval = null;
    let _lastEzanKey = null; // ezan ekranını tekrar tetiklemeyi önlemek için

    // ──────────────────────────────────────────────────────
    // BAŞLAT
    // ──────────────────────────────────────────────────────
    async function init() {
        console.log('[App] Başlatılıyor...');

        // 1) Yükleme ekranını göster
        showLoading(true);

        // 2) IndexedDB başlat
        await DataManager.initDB();

        // 3) Ayarları yükle
        _settings = SettingsManager.load();

        // 4) Tema uygula
        DisplayManager.applyTheme(_settings.tema);

        // 5) Kurulum kontrolü
        if (!SettingsManager.isSetupComplete()) {
            showLoading(false);
            showSetup();
            return;
        }

        // 6) Veritabanından vakit verisini yükle
        const hasData = await DataManager.loadFromDB();
        if (!hasData) {
            // Kayıtlı veri yok, kuruluma yönlendir
            showLoading(false);
            showSetupWithError('Namaz vakti verisi bulunamadı. Lütfen tekrar kurulum yapın.');
            return;
        }

        // 7) Ana uygulamayı başlat
        await startMainApp();

        // 8) Arka planda yıl güncelleme kontrolü
        setTimeout(async () => {
            const ilce = _settings.ilce;
            const ilceId = _settings.ilceId;
            const updated = await DataManager.checkYearUpdate(ilce, ilceId);
            if (updated) {
                // Veri güncellendiyse sayfayı yenile
                location.reload();
            }
        }, 5000);
    }

    // ──────────────────────────────────────────────────────
    // ANA UYGULAMA
    // ──────────────────────────────────────────────────────
    async function startMainApp() {
        // Bugünün vakitlerini al
        _todayPT = DataManager.getTodayPrayerTimes();
        _tomorrowImsak = DataManager.getTomorrowImsak();
        _dayType = PrayerEngine.getDayType(_todayPT);

        // Layout yönlendirme
        DisplayManager.setOrientation(_settings.ekranYonu);
        DisplayManager.listenOrientation();
        DisplayManager.applySettings(_settings);

        // Güç yöneticisi
        PowerManager.init(_settings, _todayPT);

        // Carousel başlat
        const weekPrayer = DataManager.getWeekPrayerTimes();
        await CarouselManager.init(_settings, weekPrayer, (slide, idx, total) => {
            DisplayManager.renderSlide(slide, idx, total);
        });

        // İlk render
        tick();

        // Ticker içeriği
        refreshTicker();

        // Saniyede bir güncelle (saat + geri sayım)
        _tickInterval = setInterval(tick, 1000);

        // Yükleme ekranını gizle
        showLoading(false);

        // ESP32 entegrasyonu (opsiyonel)
        if (_settings.esp32Aktif && _settings.esp32Ip) {
            pollESP32();
        }

        // Uzaktan kumanda ve klavye desteği
        initKeyboardNav();

        // İçerik güncelleme (E3) — arka planda 24 saatte bir GitHub'dan güncelle
        DataManager.scheduleContentRefresh();

        console.log('[App] Hazır ✓');
    }

    // ──────────────────────────────────────────────────────
    // TICK — Her saniye çalışır
    // ──────────────────────────────────────────────────────
    function tick() {
        if (!_todayPT) return;

        // Gün geçişi kontrolü
        const todayStr = PrayerEngine.getTodayStr();
        if (_todayPT.miladiTarih !== todayStr) {
            // Yeni gün — verileri yenile
            _todayPT = DataManager.getTodayPrayerTimes();
            _tomorrowImsak = DataManager.getTomorrowImsak();
            _dayType = PrayerEngine.getDayType(_todayPT);
            PowerManager.updatePrayerTimes(_todayPT);
            CarouselManager.refresh(_settings, DataManager.getWeekPrayerTimes());
        }

        // Sonraki vakit hesapla
        _nextPrayer = PrayerEngine.calcNextPrayer(_todayPT, _tomorrowImsak);

        // Topbar
        DisplayManager.updateTopbar(_settings, _todayPT);

        // Geri sayım
        if (_nextPrayer) {
            DisplayManager.updateCountdown(_nextPrayer, _todayPT, _tomorrowImsak);
            DisplayManager.updatePrayerList(_todayPT, _nextPrayer.key, _settings);
            DisplayManager.updatePortraitPrayerGrid(_todayPT, _nextPrayer.key, _settings);
        }

        // Ramazan geri sayımı
        if (_dayType?.ramazan) {
            const rc = PrayerEngine.getRamadanCountdown(_todayPT, _tomorrowImsak);
            DisplayManager.updateRamadanBanner(rc);
        } else {
            DisplayManager.updateRamadanBanner(null);
        }

        // Ezan ekranı
        const ezanInfo = PrayerEngine.shouldShowEzan(_todayPT, _settings.ezanOnceDk);
        if (ezanInfo) {
            if (_lastEzanKey !== ezanInfo.key) {
                _lastEzanKey = ezanInfo.key;
                DisplayManager.showEzanOverlay(ezanInfo);
                PowerManager.turnOn(); // Ezan sırasında ekranı açık tut
            }
        } else {
            if (_lastEzanKey !== null) {
                _lastEzanKey = null;
                DisplayManager.hideEzanOverlay();
            }
        }
    }

    // ──────────────────────────────────────────────────────
    // TİCKER güncelle
    // ──────────────────────────────────────────────────────
    function refreshTicker() {
        if (!_settings.gosterTickerBant) {
            // Ticker kapalıysa gizle
            document.querySelectorAll('.ticker-wrap, #ls-ticker, #pt-ticker')
                .forEach(el => el.classList.add('hidden'));
            return;
        }
        const items = CarouselManager.getTickerContent();
        DisplayManager.updateTicker(items);
        // Her 5 dk'da yenile (yeni duyurular eklenmiş olabilir)
        setInterval(() => {
            if (!_settings.gosterTickerBant) return;
            const updated = CarouselManager.getTickerContent();
            DisplayManager.updateTicker(updated);
        }, 5 * 60 * 1000);
    }

    // ──────────────────────────────────────────────────────
    // ESP32 Poll (opsiyonel)
    // ──────────────────────────────────────────────────────
    async function pollESP32() {
        const poll = async () => {
            const data = await DataManager.fetchFromESP32(_settings.esp32Ip);
            if (!data) return;
            // Sıcaklık/nem gösterme (display-manager ticker veya footer)
            if (_settings.esp32Sicaklik && data.sicaklik !== undefined) {
                const infoEl = document.getElementById('ls-esp32-info');
                if (infoEl) {
                    infoEl.textContent = `🌡 ${data.sicaklik}°C  💧 ${data.nem}%`;
                    infoEl.classList.remove('hidden');
                }
            }
        };

        await poll();
        setInterval(poll, 30 * 1000); // 30 saniyede bir
    }

    // ──────────────────────────────────────────────────────
    // KLAVYE / UZAKTAN KUMANDA NAVİGASYON
    // ──────────────────────────────────────────────────────
    function initKeyboardNav() {
        document.addEventListener('keydown', (e) => {
            // Herhangi bir tuşa basınca ekranı uyandır
            PowerManager.wakeTemporary(10000);

            // Setup veya settings ekranında D-Pad ile form elemanı geçişi
            const setupVisible = document.getElementById('setup-screen')?.classList.contains('visible');
            const isFormScreen = setupVisible || window.location.href.includes('settings.html');

            if (isFormScreen) {
                if (e.key === 'ArrowDown' || e.key === 'Down') {
                    e.preventDefault();
                    moveFocus(1);
                    return;
                }
                if (e.key === 'ArrowUp' || e.key === 'Up') {
                    e.preventDefault();
                    moveFocus(-1);
                    return;
                }
            }

            switch (e.key) {
                case 'ArrowRight':
                case 'Right':
                    if (!isFormScreen) CarouselManager.next();
                    break;
                case 'ArrowLeft':
                case 'Left':
                    if (!isFormScreen) CarouselManager.prev();
                    break;
                case 'Enter':
                case 'Return':
                    // Ayarlar ekranına git (Ctrl/Shift ile)
                    if (e.ctrlKey || e.shiftKey) {
                        window.location.href = 'settings.html';
                    }
                    break;
            }
        });

        // Mouse / dokunma — ekranı uyandır
        document.addEventListener('click', () => PowerManager.wakeTemporary(10000));
        document.addEventListener('touchstart', () => PowerManager.wakeTemporary(10000));
    }

    // Odağı tabindex sırasına göre ileri/geri taşı, elemanı görünür alana kaydır
    function moveFocus(direction) {
        const focusable = Array.from(
            document.querySelectorAll('[tabindex]:not([tabindex="-1"]):not([disabled])')
        ).filter(el => el.offsetParent !== null) // Sadece görünür elemanlar
            .sort((a, b) => (parseInt(a.tabIndex) || 0) - (parseInt(b.tabIndex) || 0));

        if (focusable.length === 0) return;

        const current = document.activeElement;
        const idx = focusable.indexOf(current);
        let next;

        if (idx === -1) {
            next = direction > 0 ? focusable[0] : focusable[focusable.length - 1];
        } else {
            const newIdx = idx + direction;
            if (newIdx < 0) next = focusable[focusable.length - 1];
            else if (newIdx >= focusable.length) next = focusable[0];
            else next = focusable[newIdx];
        }

        if (next) {
            next.focus();
            next.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }


    // ──────────────────────────────────────────────────────
    // KURULUM EKRANI
    // ──────────────────────────────────────────────────────
    function showSetup(errorMsg) {
        const screen = document.getElementById('setup-screen');
        if (!screen) return;
        screen.classList.add('visible');

        if (errorMsg) {
            const errorEl = document.getElementById('setup-error');
            if (errorEl) {
                errorEl.textContent = errorMsg;
                errorEl.classList.add('visible');
            }
        }

        initSetupForm();
    }

    function showSetupWithError(msg) {
        showSetup(msg);
    }

    function initSetupForm() {
        const ilContainer = document.getElementById('setup-il-container');
        const ilceContainer = document.getElementById('setup-ilce-container');
        const camiInput = document.getElementById('setup-cami');
        const btnKaydet = document.getElementById('setup-kaydet');
        const progressEl = document.getElementById('setup-progress');
        const progressTxt = document.getElementById('setup-progress-text');

        if (!ilContainer || !ilceContainer) return;

        let _locations = {};

        // İl SearchableSelect
        const ilSS = new SearchableSelect({
            container: ilContainer,
            placeholder: '— İl seçin —',
            onSelect: (value) => {
                ilceSS.setValue('', '');
                ilceSS.setDisabled(!value);
                if (!value || !_locations[value]) {
                    ilceSS.setOptions([]);
                    return;
                }
                const ilceOpts = Object.entries(_locations[value])
                    .map(([ilce, id]) => ({ value: `${ilce}::${id}`, label: ilce }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
                ilceSS.setOptions(ilceOpts);
            }
        });

        // İlçe SearchableSelect
        const ilceSS = new SearchableSelect({
            container: ilceContainer,
            placeholder: '— Önce il seçin —',
            disabled: true,
            onSelect: () => { }
        });

        // Konum listesini yükle
        DataManager.loadLocations().then(locations => {
            _locations = locations;
            const ilOpts = Object.keys(locations).sort((a, b) => a.localeCompare(b, 'tr'))
                .map(il => ({ value: il, label: il }));
            ilSS.setOptions(ilOpts);
        });

        // Kaydet butonu
        btnKaydet?.addEventListener('click', async () => {
            const il = ilSS.getValue();
            const ilceVal = ilceSS.getValue();
            const ilceParts = ilceVal.split('::');
            const ilce = ilceParts[0];
            const ilceId = parseInt(ilceParts[1]);
            const cami = camiInput?.value?.trim() || 'Cami TV';

            if (!il || !ilce || !ilceId) {
                alert('Lütfen il ve ilçe seçin.');
                return;
            }

            if (!navigator.onLine) {
                alert('İlk kurulum için internet bağlantısı gereklidir.');
                return;
            }

            btnKaydet.disabled = true;
            progressEl?.classList.remove('hidden');

            try {
                await DataManager.downloadAndSetup(il, ilce, ilceId, (msg) => {
                    if (progressTxt) progressTxt.textContent = msg;
                });

                // Ayarları kaydet
                const s = SettingsManager.load();
                s.il = il;
                s.ilce = ilce;
                s.ilceId = ilceId;
                s.camiAdi = cami;
                SettingsManager.save(s);

                // Yenile
                location.reload();

            } catch (e) {
                console.error('[Setup] İndirme hatası:', e);
                if (progressTxt) progressTxt.textContent = 'Hata: ' + e.message;
                btnKaydet.disabled = false;
                alert('Veri indirilemedi. İnternet bağlantınızı kontrol edin ve tekrar deneyin.');
            }
        });
    }

    // ──────────────────────────────────────────────────────
    // YÜKLEME EKRANI
    // ──────────────────────────────────────────────────────
    function showLoading(visible) {
        const el = document.getElementById('loading-screen');
        if (!el) return;
        if (visible) {
            el.classList.remove('fade-out');
        } else {
            el.classList.add('fade-out');
            setTimeout(() => el.remove(), 600);
        }
    }

    // ──────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────
    return { init };

})();

// Sayfa hazır olunca başlat
document.addEventListener('DOMContentLoaded', () => App.init());

