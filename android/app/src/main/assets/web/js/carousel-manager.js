/**
 * CAMI TV — carousel-manager.js
 * İçerik döngüsü: Ayet → Hadis → Esmaül Hüsna → Dua → İmsakiye → Duyurular
 * Önce cenaze duyurularını gösterir, sonra sıraya devam eder.
 */

const CarouselManager = (() => {

    let _settings = null;
    let _contents = {};       // { ayetler, hadisler, esmaulhusna, dualar }
    let _weekPrayer = [];       // Haftalık vakit verisi
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
        _contents = { ayetler, hadisler, esmaulhusna: esmaul, dualar };

        buildQueue();
        start();
    }

    // ──────────────────────────────────────────────────────
    // Sırayı oluştur
    // ──────────────────────────────────────────────────────
    function buildQueue() {
        _queue = [];
        _duyurular = SettingsManager.getAktifDuyurular();

        // 1) Cenaze duyuruları — önce göster
        const cenaze = _duyurular.filter(d => d.tip === 'cenaze');
        cenaze.forEach(d => _queue.push({ type: 'cenaze', data: d }));

        // 2) Acil duyurular
        const acil = _duyurular.filter(d => d.tip === 'acil');
        acil.forEach(d => _queue.push({ type: 'duyuru', data: d }));

        // 3) İçerik döngüsü (kullanıcı kapatmadıysa)
        if (_settings.gosterAyet && _contents.ayetler?.length) {
            const idx = _dayIndex % _contents.ayetler.length;
            _queue.push({ type: 'ayet', data: _contents.ayetler[idx] });
        }

        if (_settings.gosterCamiBilgi && _settings.camiBilgiMetin) {
            _queue.push({ type: 'camibilgi', data: { metin: _settings.camiBilgiMetin } });
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

        // 4) Normal duyurular — sona
        const normal = _duyurular.filter(d => d.tip === 'normal');
        normal.forEach(d => _queue.push({ type: 'duyuru', data: d }));

        // İçerik yoksa boş slide
        if (_queue.length === 0) {
            _queue.push({ type: 'bos', data: null });
        }
    }

    // ──────────────────────────────────────────────────────
    // Döngüyü başlat
    // ──────────────────────────────────────────────────────
    function start() {
        if (_timer) clearInterval(_timer);
        showCurrent();

        const pureDk = (_settings.carouselSure || 15) * 1000;
        _timer = setInterval(next, pureDk);
        startProgress(pureDk);
    }

    function stop() {
        if (_timer) clearInterval(_timer);
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
        const pureDk = (_settings.carouselSure || 15) * 1000;
        startProgress(pureDk);
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
