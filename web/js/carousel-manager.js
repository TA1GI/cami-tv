/**
 * CAMI TV — carousel-manager.js
 * İçerik döngüsü: Ayet → Hadis → Esmaül Hüsna → Dua → İmsakiye → Duyurular
 * Önce cenaze duyurularını gösterir, sonra sıraya devam eder.
 */

const CarouselManager = (() => {

    let _settings = null;
    let _contents = {};       // { ayetler, hadisler, esmaulhusna, dualar }
    let _weekPrayer = [];       // İmsakiye verisi
    let _duyurular = [];       // Aktif duyurular
    let _queue = [];       // Oynatılacak slide sırası
    let _currentIdx = 0;
    let _timer = null;
    let _progressTimer = null;
    let _onSlide = null;     // callback(slideData)
    let _dayIndex = 0;        // Ayet/hadis/esma sıralayıcı

    // ──────────────────────────────────────────────────────
    // Başlat
    // ──────────────────────────────────────────────────────
    async function init(settings, weekPrayer, onSlide) {
        _settings = settings;
        _weekPrayer = weekPrayer;
        _onSlide = onSlide;
        _dayIndex = Math.floor(Date.now() / 86400000); // güne göre başlangıç

        // İçerikleri yükle
        const [ayetler, hadisler, esmaul, dualar] = await Promise.all([
            DataManager.loadContent('ayetler'),
            DataManager.loadContent('hadisler'),
            DataManager.loadContent('esmaulhusna'),
            DataManager.loadContent('dualar'),
        ]);

        // Özel içerikleri birleştir ve pasif olanları çıkar
        _contents = {
            ayetler: _mergeContent('ayetler', ayetler),
            hadisler: _mergeContent('hadisler', hadisler),
            esmaulhusna: _mergeContent('esmaulhusna', esmaul),
            dualar: _mergeContent('dualar', dualar),
        };

        buildQueue();
        start();
    }

    // Özel içerikleri orijinallerle birleştir, pasif olanları çıkar
    function _mergeContent(type, originalArr) {
        let merged = [...(originalArr || [])];
        try {
            const cc = _settings.customContent;
            if (cc) {
                const custom = cc.custom?.[type] || [];
                const disabled = cc.disabled?.[type] || [];

                // Özel içerikleri ekle
                merged = [...merged, ...custom];

                // Pasif olanları çıkar
                merged = merged.filter((item, idx) => {
                    const isCustom = idx >= (originalArr || []).length;
                    const uid = (isCustom ? 'c_' : 'o_') + item.id;
                    return !disabled.includes(uid);
                });
            }
        } catch (e) {
            // parse hatası — orijinal verileri kullan
        }
        return merged;
    }

    // ──────────────────────────────────────────────────────
    // Sırayı oluştur
    // ──────────────────────────────────────────────────────
    function buildQueue() {
        _queue = [];
        _duyurular = SettingsManager.getAktifDuyurular();
        const tipPriority = { cenaze: 0, acil: 1, normal: 2 };
        const sortByPriority = (list) => [...list].sort((a, b) => {
            const aPr = tipPriority[a.tip] ?? 99;
            const bPr = tipPriority[b.tip] ?? 99;
            if (aPr !== bPr) return aPr - bPr;
            return (a.id || 0) - (b.id || 0);
        });

        // En az bir "tam-ekran + sürekli" varsa ana döngü tamamen bu duyurulara odaklanır.
        const surekliTamEkran = sortByPriority(_duyurular.filter(d => {
            const gorunum = d.gorunum || (d.tip === 'cenaze' ? 'tam-ekran' : 'carousel');
            const mod = d.tamEkranModu || 'surekli';
            return gorunum === 'tam-ekran' && mod === 'surekli';
        }));

        if (surekliTamEkran.length > 0) {
            surekliTamEkran.forEach(d => {
                _queue.push({ type: 'tam-ekran-duyuru', data: d });
            });

            _currentIdx = _currentIdx % _queue.length;
            return;
        }

        // 1) Cenaze duyuruları — önce göster (varsayılan gorunum: tam-ekran)
        const cenaze = _duyurular.filter(d => d.tip === 'cenaze');
        cenaze.forEach(d => {
            const gorunum = d.gorunum || 'tam-ekran'; // cenaze varsayılan tam-ekran
            if (gorunum === 'sadece-ticker') return;
            if (gorunum === 'tam-ekran' && (d.tamEkranModu || 'surekli') === 'sirali') {
                _queue.push({ type: 'tam-ekran-duyuru', data: d });
            } else {
                _queue.push({ type: 'duyuru', data: d });
            }
        });

        // 2) Acil duyurular — gorunum'a göre
        const acil = _duyurular.filter(d => d.tip === 'acil');
        acil.forEach(d => {
            const gorunum = d.gorunum || 'carousel';
            if (gorunum === 'sadece-ticker') return;
            if (gorunum === 'tam-ekran' && (d.tamEkranModu || 'surekli') === 'sirali') {
                _queue.push({ type: 'tam-ekran-duyuru', data: d });
            } else {
                _queue.push({ type: 'duyuru', data: d });
            }
        });

        // 3) İçerik döngüsü (kullanıcı kapatmadıysa)
        if (_settings.gosterAyet && _contents.ayetler?.length) {
            const idx = _dayIndex % _contents.ayetler.length;
            _queue.push({ type: 'ayet', data: _contents.ayetler[idx] });
        }

        if (_settings.gosterCamiBilgi && _settings.camiBilgiMetin) {
            // Artık bir dizi olabilir
            const metinler = Array.isArray(_settings.camiBilgiMetin)
                ? _settings.camiBilgiMetin
                : [_settings.camiBilgiMetin]; // Eski versiyon desteği

            metinler.forEach(m => {
                if (m && m.trim() !== '') {
                    _queue.push({ type: 'camibilgi', data: { metin: m.trim() } });
                }
            });
        }

        if (_settings.gosterHadis && _contents.hadisler?.length) {
            const idx = (_dayIndex + 3) % _contents.hadisler.length;
            _queue.push({ type: 'hadis', data: _contents.hadisler[idx] });
        }

        if (_settings.gosterEsma && _contents.esmaulhusna?.length) {
            const idx = _dayIndex % 99; // 99 isim döngüsü
            _queue.push({ type: 'esma', data: _contents.esmaulhusna[idx] });
        }

        if (_settings.gosterDua && _contents.dualar?.length) {
            const idx = (_dayIndex + 1) % _contents.dualar.length;
            _queue.push({ type: 'dua', data: _contents.dualar[idx] });
        }

        if (_settings.gosterImsakiye && _weekPrayer?.length) {
            _queue.push({ type: 'imsakiye', data: _weekPrayer });
        }

        // 4) Normal duyurular — gorunum'a göre
        const normal = _duyurular.filter(d => d.tip === 'normal');
        normal.forEach(d => {
            const gorunum = d.gorunum || 'carousel';
            if (gorunum === 'sadece-ticker') return;
            if (gorunum === 'tam-ekran' && (d.tamEkranModu || 'surekli') === 'sirali') {
                _queue.push({ type: 'tam-ekran-duyuru', data: d });
            } else {
                _queue.push({ type: 'duyuru', data: d });
            }
        });

        // İçerik yoksa boş slide
        if (_queue.length === 0) {
            _queue.push({ type: 'bos', data: null });
        }
    }

    // ──────────────────────────────────────────────────────
    // Mevcut slide'ın süresini al (per-content)
    // ──────────────────────────────────────────────────────
    function getSlideDuration(slideType) {
        const ia = _settings.icerikAyarlari || {};
        const cfg = ia[slideType];
        return (cfg?.sure || _settings.carouselSure || 15) * 1000;
    }

    // ──────────────────────────────────────────────────────
    // Döngüyü başlat
    // ──────────────────────────────────────────────────────
    function start() {
        if (_timer) clearTimeout(_timer);
        showCurrent();

        const durationMs = getSlideDuration(_queue[_currentIdx]?.type);
        _timer = setTimeout(next, durationMs);
        startProgress(durationMs);
    }

    function stop() {
        if (_timer) clearTimeout(_timer);
        if (_progressTimer) cancelAnimationFrame(_progressTimer);
        _timer = null;
        _progressTimer = null;
    }

    // ──────────────────────────────────────────────────────
    // Sonraki slide
    // ──────────────────────────────────────────────────────
    function next() {
        _currentIdx = (_currentIdx + 1) % _queue.length;

        // Her tur sonunda sırayı yeniden oluştur (yeni duyurular olabilir)
        if (_currentIdx === 0) {
            _dayIndex++;
            buildQueue();
        }

        showCurrent();
        const durationMs = getSlideDuration(_queue[_currentIdx]?.type);
        if (_timer) clearTimeout(_timer);
        _timer = setTimeout(next, durationMs);
        startProgress(durationMs);
    }

    function prev() {
        _currentIdx = (_currentIdx - 1 + _queue.length) % _queue.length;
        showCurrent();
    }

    // ──────────────────────────────────────────────────────
    // Mevcut slide'ı göster
    // ──────────────────────────────────────────────────────
    function showCurrent() {
        if (_queue.length === 0) return;
        const slide = _queue[_currentIdx];
        if (typeof _onSlide === 'function') {
            _onSlide(slide, _currentIdx, _queue.length);
        }
    }

    // ──────────────────────────────────────────────────────
    // İlerleme çubuğu animasyonu
    // ──────────────────────────────────────────────────────
    function startProgress(durationMs) {
        if (_progressTimer) cancelAnimationFrame(_progressTimer);

        const bar = document.getElementById('ls-carousel-progress-bar');
        if (!bar) return;

        const start = performance.now();
        bar.style.transition = 'none';
        bar.style.width = '0%';

        function frame(now) {
            const elapsed = now - start;
            const pct = Math.min((elapsed / durationMs) * 100, 100);
            bar.style.width = pct + '%';
            if (pct < 100) {
                _progressTimer = requestAnimationFrame(frame);
            }
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(frame);
        });
    }

    // ──────────────────────────────────────────────────────
    // Duyurular tickere render et
    // ──────────────────────────────────────────────────────
    function getTickerContent() {
        const active = SettingsManager.getAktifDuyurular();
        if (active.length > 0) {
            return active.map(d => d.metin);
        }
        // Duyuru yoksa anlık bilgi
        return ['Allah\'a emanet olunuz.', 'Namazlarınızı vaktinde kılınız.'];
    }

    // ──────────────────────────────────────────────────────
    // Ayarlar değişince yeniden başlat
    // ──────────────────────────────────────────────────────
    function refresh(newSettings, weekPrayer) {
        stop();
        _settings = newSettings;
        _weekPrayer = weekPrayer || _weekPrayer;
        _currentIdx = 0;
        buildQueue();
        start();
    }

    // ──────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────
    return {
        init,
        next,
        prev,
        stop,
        refresh,
        getTickerContent,
        getCurrentSlide: () => _queue[_currentIdx] || null,
        getQueue: () => _queue,
    };

})();

window.CarouselManager = CarouselManager;
