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
        try {
            await DataManager.initDB();
        } catch (dbErr) {
            console.error('[App] IndexedDB başlatılamadı:', dbErr);
            // DB başarısız olsa bile kurulum ekranına gidebilsin
        }

        // 3) Ayarları yükle
        _settings = SettingsManager.load();

        // 4) Dil ayarını uygula
        if (typeof I18n !== 'undefined') {
            I18n.setLanguage(_settings.dil || 'tr');
        }

        // 5) Tema uygula
        DisplayManager.applyTheme(_settings.tema);

        // EXTRA: Telefondan gelen "kaydet ve indir" (SettingsServer) uyarısı
        // NOT: WebView file:/// protokolü URL query desteklemeyebileceği için localStorage flag kullanıyoruz.
        if (localStorage.getItem('force_download_flag') === '1' && _settings.ilce && _settings.ilceId) {
            localStorage.removeItem('force_download_flag');
            console.log('[App] Telefon üzerinden eşleştirme tamamlandı, vakitler indiriliyor...');
            showLoading(true);
            try {
                await DataManager.downloadAndSetup(_settings.il, _settings.ilce, _settings.ilceId);
                console.log('[App] İndirme başarılı.');
            } catch (e) {
                console.error('[App] force_download başarısız:', e);
            }
        }

        // 6) Kurulum kontrolü
        if (!SettingsManager.isSetupComplete()) {
            showLoading(false);
            showSetup();
            return;
        }

        // 7) Veritabanından vakit verisini yükle
        const hasData = await DataManager.loadFromDB();
        if (!hasData) {
            // Kayıtlı veri yok, kuruluma yönlendir
            showLoading(false);
            showSetupWithError('Namaz vakti verisi bulunamadı. Lütfen tekrar kurulum yapın.');
            return;
        }

        // 8) Ana uygulamayı başlat
        await startMainApp();

        // 9) Arka planda yıl güncelleme kontrolü (sadece online iken)
        if (navigator.onLine) {
            setTimeout(async () => {
                try {
                    const ilce = _settings.ilce;
                    const ilceId = _settings.ilceId;
                    const updated = await DataManager.checkYearUpdate(ilce, ilceId);
                    if (updated) {
                        location.reload();
                    }
                } catch (e) {
                    console.warn('[App] Yıl güncelleme hatası (önemsiz):', e);
                }
            }, 5000);
        }
    }

    // ──────────────────────────────────────────────────────
    // SABAH NAMAZI İMSAK/GÜNEŞ KURALI (Yardımcı)
    // ──────────────────────────────────────────────────────
    function applySabahLogic(pt, settings) {
        if (!pt) return pt;
        const dayType = PrayerEngine.getDayType(pt);
        const adjusted = { ...pt };

        if (settings.sabahImsagaGore || dayType?.ramazan) {
            adjusted.sabah = adjusted.imsak;
        } else if (adjusted.gunes) {
            // Normal günlerde sabah ezanı güneşten 1 saat önce okunur
            const [h, m] = adjusted.gunes.split(':').map(Number);
            let totalMin = h * 60 + m - 60;
            if (totalMin < 0) totalMin += 24 * 60;
            const sh = Math.floor(totalMin / 60);
            const sm = totalMin % 60;
            adjusted.sabah = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
        }
        return adjusted;
    }

    function applySabahLogicList(list, settings) {
        if (!list) return list;
        return list.map(pt => applySabahLogic(pt, settings));
    }

    // ──────────────────────────────────────────────────────
    // ANA UYGULAMA
    // ──────────────────────────────────────────────────────
    async function startMainApp() {
        // Bugünün vakitlerini al
        _todayPT = applySabahLogic(DataManager.getTodayPrayerTimes(), _settings);
        _tomorrowImsak = DataManager.getTomorrowImsak();
        _dayType = PrayerEngine.getDayType(_todayPT);

        // Layout yönlendirme
        DisplayManager.setOrientation(_settings.ekranYonu);
        DisplayManager.listenOrientation();
        DisplayManager.applySettings(_settings);

        // Güç yöneticisi
        PowerManager.init(_settings, _todayPT);

        // Carousel başlat
        try {
            let weekPrayer = applySabahLogicList(DataManager.getWeekPrayerTimes(), _settings);
            await CarouselManager.init(_settings, weekPrayer, (slide, idx, total) => {
                DisplayManager.renderSlide(slide, idx, total);
            });
        } catch (carouselErr) {
            console.warn('[App] Carousel başlatma hatası (devam ediyor):', carouselErr);
        }

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
            _todayPT = applySabahLogic(DataManager.getTodayPrayerTimes(), _settings);
            _tomorrowImsak = DataManager.getTomorrowImsak();
            _dayType = PrayerEngine.getDayType(_todayPT);
            PowerManager.updatePrayerTimes(_todayPT);

            const newWeekPrayer = applySabahLogicList(DataManager.getWeekPrayerTimes(), _settings);
            CarouselManager.refresh(_settings, newWeekPrayer);
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

        // Bayram namazı bilgi kutusu (bayrama 2 gün kala görünür)
        const bayramInfo = DataManager.getBayramWakti(_settings.ilceId);
        DisplayManager.updateBayramBanner(bayramInfo);

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

        // Cuma Yardımı overlay
        if (DisplayManager.updateCumaYardimi) {
            DisplayManager.updateCumaYardimi(_settings, _todayPT);
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
    let _settingsKeyCount = 0;
    let _settingsKeyTimer = null;

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
                    // Ayarlar ekranına git (Ctrl/Shift ile — PC kısayolu)
                    if (e.ctrlKey || e.shiftKey) {
                        window.location.href = 'settings.html';
                    }
                    break;
            }

            // ── "0" tuşuna 3 kez hızlıca basarak ayarlara git ──
            // Tüm TV kumandalarında 0-9 sayı tuşları var
            if (e.key === '0' && !isFormScreen) {
                _settingsKeyCount++;
                if (_settingsKeyTimer) clearTimeout(_settingsKeyTimer);

                if (_settingsKeyCount >= 3) {
                    _settingsKeyCount = 0;
                    window.location.href = 'settings.html';
                    return;
                }

                // 1.5 saniye içinde 3 kez basılmazsa sıfırla
                _settingsKeyTimer = setTimeout(() => {
                    _settingsKeyCount = 0;
                }, 1500);
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
        const qrView = document.getElementById('setup-qr-view');
        const formView = document.getElementById('setup-form-view');
        if (!screen) return;
        screen.classList.add('visible');

        if (errorMsg) {
            const errorEl = document.getElementById('setup-error');
            if (errorEl) {
                errorEl.textContent = errorMsg;
                errorEl.classList.add('visible');
            }
            if (qrView) qrView.style.display = 'none';
            if (formView) formView.style.display = 'block';
        } else {
            // Android platformu kontrolü (Yerel ağ IP'si varsa TV uygulamasındayız demektir)
            if (window.AndroidBridge && typeof AndroidBridge.getLocalIPAddress === 'function' && qrView && formView) {
                const bridgeIp = AndroidBridge.getLocalIPAddress();
                if (bridgeIp && bridgeIp !== "0.0.0.0") {
                    qrView.style.display = 'flex';
                    formView.style.display = 'none';

                    const qrUrl = `http://${bridgeIp}:8080/settings.html`;
                    document.getElementById('setup-qr-url-text').textContent = qrUrl;

                    const qrContainer = document.getElementById('setup-qr-container');
                    if (qrContainer) {
                        qrContainer.innerHTML = '';
                        try {
                            new QRCode(qrContainer, {
                                text: qrUrl,
                                width: 220,
                                height: 220,
                                colorDark: "#000000",
                                colorLight: "#ffffff",
                                correctLevel: QRCode.CorrectLevel.H
                            });
                        } catch (e) {
                            console.error("QR Code Error:", e);
                            qrView.style.display = 'none';
                            formView.style.display = 'block';
                        }
                    }

                    // Kumandayla devam et butonu eylemi
                    const btnContinue = document.getElementById('btn-setup-continue-tv');
                    if (btnContinue) {
                        btnContinue.onclick = () => {
                            qrView.style.display = 'none';
                            formView.style.display = 'block';
                            // Form yüklendiğinde içerisindeki elemanlara focus olabilmesi için
                            const firstInput = document.getElementById('setup-cami');
                            if (firstInput) firstInput.focus();
                        };
                    }
                } else {
                    // IP Yoksa doğrudan formu göster
                    if (qrView) qrView.style.display = 'none';
                    if (formView) formView.style.display = 'block';
                }
            } else {
                // TV dışındaki bir cihazdan (PC, Telefon tarayıcısı vb.) giriliyorsa form göster
                if (qrView) qrView.style.display = 'none';
                if (formView) formView.style.display = 'block';
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

