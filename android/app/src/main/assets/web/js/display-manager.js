/**
 * CAMI TV — display-manager.js
 * Landscape / Portrait layout yönetimi.
 * DOM güncellemeleri, carousel slide render, ezan overlay kontrolü.
 */

const DisplayManager = (() => {

    const VAKIT_ICONS = {
        imsak: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.1,22c-5,0-9.1-4.1-9.1-9.1c0-4.3,3-8,7.2-8.9C9.1,6,8,8.4,8,11c0,4.4,3.6,8,8,8c1.6,0,3.1-0.5,4.3-1.3C19,20.2,15.7,22,12.1,22z"/></svg>`,
        sabah: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5,18l2-2h10l2,2H5z M12,4c2.8,0,5.2,1.8,6.1,4.4l-1.9,0.6C15.6,7.2,13.9,6,12,6S8.4,7.2,7.7,9l-1.9-0.6C6.8,5.8,9.2,4,12,4z M12,10c1.1,0,2,0.9,2,2h-4C10,10.9,10.9,10,12,10z"/></svg>`,
        gunes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12,2v3 M12,19v3 M2,12h3 M19,12h3 M4.9,4.9l2.1,2.1 M17,17l2.1,2.1 M4.9,19.1l2.1-2.1 M17,7l2.1-2.1" stroke="currentColor" stroke-width="2"/></svg>`,
        ogle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12,7v5l3,3"/></svg>`,
        ikindi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17,10c1.66,0,3-1.34,3-3s-1.34-3-3-3s-3,1.34-3,3S15.34,10,17,10z M11,12c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5S13.76,12,11,12z"/></svg>`,
        aksam: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,11c1.1,0,2.16,0.13,3.2,0.36L16,10l-4-4l-4,4l0.8,1.36C9.84,11.13,10.9,11,12,11z M5.54,12.43L4,14l7.63,7.63l1.83-4.27C12.98,17.13,12.51,17,12,17C9.36,17,7.18,15.1,6.58,12.64L5.54,12.43z M20,14l-1.54-1.57l-1.04,0.21C16.82,15.1,14.64,17,12,17c-0.51,0-0.98,0.13-1.46,0.36L12.37,21.63L20,14z"/></svg>`,
        yatsi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z M19,3l-0.78,1.72L16.5,5.5l1.72,0.78L19,8l0.78-1.72L21.5,5.5l-1.72-0.78L19,3z M20.5,14l-0.39,0.86L19.25,15.25l0.86,0.39L20.5,16.5l0.39-0.86L21.75,15.25l-0.86-0.39L20.5,14z M8.5,4L7.72,5.72L6,6.5l1.72,0.78L8.5,9l0.78-1.72L11,6.5L9.28,5.72L8.5,4z"/></svg>`,
    };

    // ──────────────────────────────────────────────────────
    // Layout belirleme — ORIENTATION
    // ──────────────────────────────────────────────────────
    let _orientation = 'auto'; // auto | landscape | portrait
    let _currentOrientation = null;
    let _settings = null;

    function setOrientation(mode) {
        _orientation = mode;
        applyOrientation();
    }

    function applyOrientation() {
        const ls = document.getElementById('app-landscape');
        const pt = document.getElementById('app-portrait');
        if (!ls || !pt) return;

        let use;
        if (_orientation === 'landscape') {
            use = 'landscape';
        } else if (_orientation === 'portrait') {
            use = 'portrait';
        } else {
            use = window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait';
        }

        if (use === _currentOrientation) return; // değişmedi
        _currentOrientation = use;

        ls.classList.toggle('active', use === 'landscape');
        pt.classList.toggle('active', use === 'portrait');
    }

    // Ekran dönüşünü dinle
    function listenOrientation() {
        const mq = window.matchMedia('(orientation: landscape)');
        mq.addEventListener('change', applyOrientation);
        window.addEventListener('resize', applyOrientation);
        applyOrientation();
    }

    // ──────────────────────────────────────────────────────
    // ÜST BAR güncelleme
    // ──────────────────────────────────────────────────────
    function updateTopbar(settings, todayPT) {
        const camiAdi = settings.camiAdi || 'Cami TV';
        const miladiDate = todayPT?.miladiTarih || PrayerEngine.formatMiladiDate();
        const hicriDate = todayPT?.hicriTarih || '';

        // Landscape
        const lsName = document.getElementById('ls-mosque-name');
        const lsLoc = document.getElementById('ls-mosque-location');
        const lsClock = document.getElementById('ls-topbar-clock');
        const lsMilladiDate = document.getElementById('ls-miladi-date');
        const lsHicriDate = document.getElementById('ls-hijri-date');

        if (lsName) lsName.textContent = camiAdi;
        if (lsLoc && settings.ilce && settings.il) lsLoc.textContent = `${settings.ilce} / ${settings.il}`;
        if (lsClock) lsClock.textContent = PrayerEngine.formatClockNoSec();
        if (lsMilladiDate) lsMilladiDate.textContent = miladiDate;
        if (lsHicriDate) {
            lsHicriDate.textContent = hicriDate;
            lsHicriDate.classList.toggle('hidden', !settings.gosterHicriTarih);
        }

        // Portrait
        const ptName = document.getElementById('pt-mosque-name');
        const ptLoc = document.getElementById('pt-mosque-location');
        const ptClock = document.getElementById('pt-clock');
        const ptHicri = document.getElementById('pt-hijri-date');
        if (ptName) ptName.textContent = camiAdi;
        if (ptLoc && settings.ilce && settings.il) ptLoc.textContent = `${settings.ilce} / ${settings.il}`;
        if (ptClock) ptClock.textContent = PrayerEngine.formatClockNoSec();
        if (ptHicri) ptHicri.classList.toggle('hidden', !settings.gosterHicriTarih);
    }

    // ──────────────────────────────────────────────────────
    // AYARLAR UYGULA — yazı boyutu, ticker bant
    // ──────────────────────────────────────────────────────
    function applySettings(settings) {
        _settings = settings;
        // Yazı boyutu: --font-scale CSS değişkenini JS ile doğrudan yaz
        const scaleMap = { small: 0.85, normal: 1, large: 1.2, xlarge: 1.45 };
        const scale = scaleMap[settings.yaziBoyu] || 1;
        const root = document.documentElement;
        root.style.setProperty('--font-scale', scale);
        root.setAttribute('data-font-size', settings.yaziBoyu || 'normal');

        // Varsayılan carousel font scale (fallback)
        root.style.setProperty('--carousel-font-scale', 1);

        // Ticker bant göster/gizle
        const tickerEls = document.querySelectorAll('.ticker-wrap, #ls-ticker, #pt-ticker');
        tickerEls.forEach(el => el.classList.toggle('hidden', !settings.gosterTickerBant));
    }

    let _lastPrayerKey = null;
    let _prayerTotalSec = null;

    // ──────────────────────────────────────────────────────
    // GERİ SAYIM güncelleme
    // ──────────────────────────────────────────────────────
    function updateCountdown(nextPrayer, todayPT, tomorrowImsak) {
        if (!nextPrayer) return;

        const formatted = PrayerEngine.formatSeconds(nextPrayer.remainingSec);
        const label = nextPrayer.label;
        const warn = nextPrayer.remainingSec < 600; // 10 dk kala uyarı

        // Vakit değişince toplam aralığı yeniden hesapla
        if (_lastPrayerKey !== nextPrayer.key) {
            _lastPrayerKey = nextPrayer.key;
            _prayerTotalSec = PrayerEngine.getPrayerIntervalSec(nextPrayer.key, todayPT, tomorrowImsak);
        }

        // Circular progress hesabı
        const circle = document.querySelector('.progress-ring__circle');
        if (circle && _prayerTotalSec > 0) {
            const radius = circle.r.baseVal.value;
            const circumference = radius * 2 * Math.PI;
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            const pct = nextPrayer.remainingSec / _prayerTotalSec;
            const offset = circumference - pct * circumference;
            circle.style.strokeDashoffset = offset;
        }

        // Landscape
        const lsName = document.getElementById('ls-prayer-name');
        const lsCount = document.getElementById('ls-countdown');
        if (lsName) lsName.textContent = label;
        if (lsCount) {
            lsCount.textContent = formatted;
            lsCount.classList.toggle('warning', warn);
        }

        // Portrait
        const ptName = document.getElementById('pt-prayer-name');
        const ptCount = document.getElementById('pt-countdown');
        if (ptName) ptName.textContent = label;
        if (ptCount) {
            ptCount.textContent = formatted;
            ptCount.classList.toggle('warning', warn);
        }
    }


    // ──────────────────────────────────────────────────────
    // NAMAZ VAKİTLERİ listesi — Landscape sol sütun
    // ──────────────────────────────────────────────────────
    function updatePrayerList(todayPT, nextPrayerKey, settings) {
        const listEl = document.getElementById('ls-prayer-list');
        if (!listEl || !todayPT) return;

        listEl.innerHTML = '';
        let keys = todayPT.sabah
            ? PrayerEngine.VAKIT_KEYS
            : PrayerEngine.VAKIT_KEYS.filter(k => k !== 'sabah');

        if (settings.gosterSabah === false) {
            keys = keys.filter(k => k !== 'sabah');
        }

        keys.forEach(key => {
            const val = todayPT[key];
            if (!val) return;
            const isNext = key === nextPrayerKey;
            let cemaatHtml = '';
            if (settings.gosterCemaat && settings.cemaatOffsets && settings.cemaatOffsets[key] > 0) {
                const off = settings.cemaatOffsets[key];
                const [h, m] = val.split(':').map(Number);
                const cm = h * 60 + m + off;
                const ch = Math.floor(cm / 60) % 24;
                const cemaatTime = `${String(ch).padStart(2, '0')}:${String(cm % 60).padStart(2, '0')}`;

                cemaatHtml = `<span class="vakit-cemaat">${cemaatTime}</span>`;
            }

            const labelStr = typeof I18n !== 'undefined' ? I18n.get(key) : key;

            listEl.innerHTML += `
        <div class="prayer-row vakit-${key}${isNext ? ' aktif pulse-glow' : ''}">
            <span class="vakit-icon">${PrayerEngine.VAKIT_ICONS[key] || '🕌'}</span>
            <span class="vakit-name">${labelStr}</span>
            <span class="vakit-time">${val}</span>
            ${cemaatHtml}
        </div>
      `;
        });
    }

    // ──────────────────────────────────────────────────────
    // NAMAZ VAKİTLERİ grid — Portrait 3x2
    // ──────────────────────────────────────────────────────
    function updatePortraitPrayerGrid(todayPT, nextPrayerKey, settings) {
        const gridEl = document.getElementById('pt-prayer-grid');
        if (!gridEl) return;

        gridEl.innerHTML = '';
        let keys = todayPT.sabah
            ? PrayerEngine.VAKIT_KEYS.filter(k => k !== 'sabah')
            : PrayerEngine.VAKIT_KEYS.filter(k => k !== 'sabah' && k !== 'gunes');

        // Dikey planda (eğer sabahı tekrar göstermek isterlerse veya kapatırlarsa diye) varsayılan olarak zaten sabah gizli gibi yazılmış, fakat tutarlılık adına ek kontrol
        if (settings.gosterSabah === false) {
            keys = keys.filter(k => k !== 'sabah');
        }

        keys.forEach(key => {
            const val = todayPT[key];
            if (!val) return;
            let cemaatHtml = '';
            if (settings.gosterCemaat && settings.cemaatOffsets && settings.cemaatOffsets[key] > 0) {
                const off = settings.cemaatOffsets[key];
                const [h, m] = val.split(':').map(Number);
                const cm = h * 60 + m + off;
                const ch = Math.floor(cm / 60) % 24;
                const cemaatTime = `${String(ch).padStart(2, '0')}:${String(cm % 60).padStart(2, '0')}`;

                cemaatHtml = `<span class="cell-cemaat">${cemaatTime}</span>`;
            }

            const isNext = key === nextPrayerKey;
            const labelStr = typeof I18n !== 'undefined' ? I18n.get(key) : key;
            gridEl.innerHTML += `
        <div class="pt-prayer-cell${isNext ? ' aktif pulse-glow' : ''}">
           <span class="cell-icon">${PrayerEngine.VAKIT_ICONS[key] || '🕌'}</span>
           <span class="cell-name">${labelStr}</span>
           <span class="cell-time">${val}</span>
           ${cemaatHtml}
        </div>
      `;
        });
    }

    // ──────────────────────────────────────────────────────
    // Carousel SLIDE Render
    // ──────────────────────────────────────────────────────
    function renderSlide(slide, idx, total) {
        // Per-content yazı boyutunu al
        const ia = _settings?.icerikAyarlari || {};
        const cfg = ia[slide.type];
        const fontScale = (cfg?.yaziBoyu || 100) / 100;

        // Landscape carousel
        const lsCarousel = document.getElementById('ls-carousel-content');
        // Portrait carousel
        const ptCarousel = document.getElementById('pt-carousel-content');

        const html = buildSlideHTML(slide, idx, total);

        if (lsCarousel) {
            lsCarousel.innerHTML = html;
            lsCarousel.style.setProperty('--carousel-font-scale', fontScale);
            lsCarousel.className = 'carousel-slide active animate-carousel-in';
        }
        if (ptCarousel) {
            ptCarousel.innerHTML = html;
            ptCarousel.style.setProperty('--carousel-font-scale', fontScale);
            ptCarousel.className = 'carousel-slide active animate-carousel-in';
        }

        // Cenaze duyurusu: tam ekranı devral
        const lsCenaze = document.getElementById('ls-cenaze-overlay');
        if (lsCenaze && slide.type === 'cenaze') {
            lsCenaze.classList.add('active');
            renderCenaze(lsCenaze, slide.data);
        } else if (lsCenaze) {
            lsCenaze.classList.remove('active');
        }

        // Metin taşkınlığı (marquee) kontrolü
        setTimeout(() => {
            document.querySelectorAll('.marquee-content').forEach(el => {
                const parent = el.parentElement;
                if (!parent) return;

                // Varsa önceki animasyonu iptal et
                if (el._marqueeAnim) {
                    el._marqueeAnim.cancel();
                    el._marqueeAnim = null;
                }

                el.style.transform = 'translateY(0)'; // Sıfırla

                // scrollHeight ebeveyn yüksekliğinden büyükse kaydırmayı başlat
                if (el.scrollHeight > parent.clientHeight + 5) {
                    const computedStyle = window.getComputedStyle(el);
                    const fontSize = parseFloat(computedStyle.fontSize) || 24;
                    // Hızı yavaşlatıldı: fontSize * 1.0 (eskiden 1.8'di)
                    const pixelsPerSecond = fontSize * 1.0;

                    // Sadece taşan kısmı (ve biraz boşluk) kaydıracağız.
                    const overflowAmount = el.scrollHeight - parent.clientHeight + 40;

                    // Yalnızca kayma süresi
                    const slideDurationMs = (overflowAmount / pixelsPerSecond) * 1000;

                    // En sonda bekleyeceği süre (örn. 2 saniye)
                    const endDelayMs = 2000;
                    const totalDurationMs = slideDurationMs + endDelayMs;

                    // Keyframe offset hesabı: animasyonun yüzde kaçında en alta ulaşacak
                    const slideEndOffset = slideDurationMs / totalDurationMs;

                    el._marqueeAnim = el.animate([
                        { transform: 'translateY(0)', offset: 0 },
                        { transform: `translateY(-${overflowAmount}px)`, offset: slideEndOffset },
                        // Sona geldiğinde endDelay süresi kadar orada bekle
                        { transform: `translateY(-${overflowAmount}px)`, offset: 1 }
                    ], {
                        duration: totalDurationMs,
                        delay: 3000,
                        iterations: Infinity,
                        direction: 'normal', // Terse dönme kapatıldı (sıfırdan tekrar başlar)
                        easing: 'linear'
                    });
                }
            });
        }, 50);
    }

    function buildSlideHTML(slide, idx, total) {
        const counter = `<span class="slide-counter">${idx + 1} / ${total}</span>`;

        switch (slide.type) {

            case 'ayet':
                return `
          <div class="slide-header">
            <span class="slide-type-badge">📖 Günün Ayeti</span>${counter}
          </div>
          <div class="slide-arabic arabic-text"><div class="marquee-content">${slide.data.arapca}</div></div>
          <div class="slide-translation"><div class="marquee-content">${slide.data.turkce}</div></div>
          <div class="slide-reference text-muted">${slide.data.referans}</div>
        `;

            case 'hadis':
                return `
          <div class="slide-header">
            <span class="slide-type-badge">📜 Günün Hadisi</span>${counter}
          </div>
          <div class="slide-arabic arabic-text"><div class="marquee-content">${slide.data.arapca}</div></div>
          <div class="slide-translation"><div class="marquee-content">${slide.data.turkce}</div></div>
          <div class="slide-reference text-muted">${slide.data.referans}</div>
        `;

            case 'esma':
                return `
          <div class="slide-header">
            <span class="slide-type-badge">✨ Esmaül Hüsna</span>${counter}
          </div>
          <div class="slide-esma-arabic arabic-text" style="font-size:calc(var(--carousel-font-scale) * clamp(3rem,6vw,5rem));">${slide.data.arapca}</div>
          <div class="slide-esma-turkish">${slide.data.turkce}</div>
          <div class="slide-esma-meaning text-muted">${slide.data.anlam}</div>
        `;

            case 'dua':
                return `
          <div class="slide-header">
            <span class="slide-type-badge">🤲 Dua</span>${counter}
          </div>
          <div class="slide-arabic arabic-text" style="font-size:calc(var(--carousel-font-scale) * clamp(1.2rem,4vmin,1.6rem));flex:1;display:flex;align-items:center;justify-content:center;">
            <div class="marquee-content">${slide.data.arapca}</div>
          </div>
          <div class="slide-translation text-muted" style="font-size:calc(var(--carousel-font-scale) * 0.8rem);font-style:italic;">
            <div class="marquee-content">${slide.data.turkce}</div>
          </div>
          <div class="slide-reference text-muted">${slide.data.baslik}</div>
        `;

            case 'imsakiye':
                return buildImsakiyeSlide(slide.data, counter);

            case 'duyuru':
                return `
          <div class="slide-header">
            <span class="slide-type-badge" style="background:rgba(251,191,36,0.1);color:#fbbf24;border-color:rgba(251,191,36,0.3);">📢 Duyuru</span>${counter}
          </div>
          <div style="flex:1;display:flex;align-items:center;justify-content:center;padding:24px;">
            <div style="font-size:clamp(1rem,2.5vmin,1.4rem);color:var(--text-primary);text-align:center;line-height:1.7;">
              ${slide.data.metin}
            </div>
          </div>
        `;

            case 'camibilgi':
                return `
          <div class="slide-header">
            <span class="slide-type-badge" style="background:rgba(52,211,153,0.1);color:#34d399;border-color:rgba(52,211,153,0.3);">🏛️ Cami Bilgileri</span>${counter}
          </div>
          <div class="slide-translation" style="flex:1; display:flex; padding:24px; text-align:center;">
             <div class="marquee-content" style="font-size:calc(var(--carousel-font-scale) * clamp(1.1rem, 2.5vmin, 1.5rem)); line-height:1.6; color:var(--text-secondary); white-space:pre-wrap;">${slide.data.metin.replace(/\\n/g, '<br/>')}</div>
          </div>
        `;

            case 'bos':
                return `
          <div style="flex:1;display:flex;align-items:center;justify-content:center;opacity:0.3;">
            <span style="font-size:3rem;">🕌</span>
          </div>
        `;

            default:
                return '';
        }
    }

    function buildImsakiyeSlide(weekData, counter) {
        if (!weekData || weekData.length === 0) return '';

        const today = new Date().toLocaleDateString('tr-TR');
        let rows = '';
        weekData.slice(0, 30).forEach(day => {
            const isToday = day.miladiTarih?.startsWith(String(new Date().getDate()).padStart(2, '0'));
            rows += `
        <tr style="${isToday ? 'background:var(--vakit-aktif-bg);color:var(--accent);' : 'color:var(--text-secondary);'}">
          <td style="padding:4px 6px;font-size:clamp(0.65rem, 1.8vmin, 1.15rem);font-weight:${isToday ? '700' : '400'}">${day.miladiTarih?.split(' ').slice(0, 2).join(' ')}</td>
          <td style="padding:4px 6px;font-size:clamp(0.65rem, 1.8vmin, 1.15rem);text-align:center">${day.imsak}</td>
          <td style="padding:4px 6px;font-size:clamp(0.65rem, 1.8vmin, 1.15rem);text-align:center">${day.gunes}</td>
          <td style="padding:4px 6px;font-size:clamp(0.65rem, 1.8vmin, 1.15rem);text-align:center">${day.ogle}</td>
          <td style="padding:4px 6px;font-size:clamp(0.65rem, 1.8vmin, 1.15rem);text-align:center">${day.ikindi}</td>
          <td style="padding:4px 6px;font-size:clamp(0.65rem, 1.8vmin, 1.15rem);text-align:center">${day.aksam}</td>
          <td style="padding:4px 6px;font-size:clamp(0.65rem, 1.8vmin, 1.15rem);text-align:center">${day.yatsi}</td>
        </tr>
      `;
        });

        return `
      <div class="slide-header">
        <span class="slide-type-badge">📅 30 Günlük İmsakiye</span>${counter}
      </div>
      <div style="flex:1;overflow:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="color:var(--text-muted);font-size:clamp(0.55rem, 1.4vmin, 0.95rem);letter-spacing:0.02em;text-transform:uppercase;">
              <th style="padding:4px 6px;text-align:left">${typeof I18n !== 'undefined' ? I18n.get('tarih') || 'Tarih' : 'Tarih'}</th>
              <th style="padding:4px 6px">${typeof I18n !== 'undefined' ? I18n.get('imsak') : 'İmsak'}</th>
              <th style="padding:4px 6px">${typeof I18n !== 'undefined' ? I18n.get('gunes') : 'Güneş'}</th>
              <th style="padding:4px 6px">${typeof I18n !== 'undefined' ? I18n.get('ogle') : 'Öğle'}</th>
              <th style="padding:4px 6px">${typeof I18n !== 'undefined' ? I18n.get('ikindi') : 'İkindi'}</th>
              <th style="padding:4px 6px">${typeof I18n !== 'undefined' ? I18n.get('aksam') : 'Akşam'}</th>
              <th style="padding:4px 6px">${typeof I18n !== 'undefined' ? I18n.get('yatsi') : 'Yatsı'}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
    }

    function renderCenaze(container, data) {
        container.innerHTML = `
      <div class="cenaze-header">☪ VEFAT DUYURUSU</div>
      <div class="cenaze-icon">🕌</div>
      <div class="cenaze-name">${data.metin}</div>
      <div class="cenaze-dua">إِنَّا لِلَّهِ وَإِنَّا إِلَيْهِ رَاجِعُونَ</div>
      <div class="cenaze-detail" style="margin-top:8px;font-size:0.85rem;color:rgba(255,255,255,0.5);">İnnâ lillâhi ve innâ ileyhi râci'ûn</div>
    `;
    }

    // ──────────────────────────────────────────────────────
    // EZAN OVERLAY göster / gizle
    // ──────────────────────────────────────────────────────
    function showEzanOverlay(prayerInfo) {
        // Yeni tasarıma göre inline notification gösterilir
        const ezanNotif = document.getElementById('ezan-notification');
        const ptOverlay = document.getElementById('pt-ezan-overlay');

        if (ezanNotif) {
            ezanNotif.classList.remove('hidden');
            const txt = ezanNotif.querySelector('.ezan-text');
            if (txt) {
                if (prayerInfo.isEzanTime) {
                    txt.textContent = `${prayerInfo.label} Ezanı Okunuyor`;
                    ezanNotif.classList.add('is-ezan');
                } else {
                    txt.textContent = `${prayerInfo.label} Vakti Yaklaştı`;
                    ezanNotif.classList.remove('is-ezan');
                }
            }
        }

        // Portrait için eski overlayı koruyabiliriz veya değiştirebiliriz.
        if (ptOverlay && prayerInfo.isEzanTime) {
            ptOverlay.innerHTML = `
                <div class="ezan-wave-ring"></div>
                <div class="ezan-icon">${PrayerEngine.VAKIT_ICONS[prayerInfo.key] || '🕌'}</div>
                <div class="ezan-prayer-name">${prayerInfo.label} Ezanı Okunuyor</div>
                <div class="ezan-arabic">اللَّهُ أَكْبَرُ</div>
            `;
            ptOverlay.classList.add('active');
        } else if (ptOverlay) {
            ptOverlay.innerHTML = `
                <div class="ezan-icon">${PrayerEngine.VAKIT_ICONS[prayerInfo.key] || '🕌'}</div>
                <div class="ezan-prayer-name">${prayerInfo.label} Vakti Yaklaştı</div>
            `;
            ptOverlay.classList.add('active');
        }
    }

    function hideEzanOverlay() {
        const ezanNotif = document.getElementById('ezan-notification');
        const lsCenterWrapper = document.getElementById('circular-progress-wrapper');
        const ptOverlay = document.getElementById('pt-ezan-overlay');

        if (ezanNotif) ezanNotif.classList.add('hidden');
        if (lsCenterWrapper) lsCenterWrapper.style.opacity = '1';
        if (ptOverlay) ptOverlay.classList.remove('active');
    }

    // ──────────────────────────────────────────────────────
    // RAMAZAN banner güncelleme
    // ──────────────────────────────────────────────────────
    function updateRamadanBanner(ramadanCountdown) {
        const lsBanner = document.getElementById('ls-ramadan-info');
        const ptBanner = document.getElementById('pt-ramadan-banner');

        if (!ramadanCountdown) {
            lsBanner?.classList.remove('visible');
            ptBanner?.classList.remove('visible');
            return;
        }

        const formatted = PrayerEngine.formatSeconds(ramadanCountdown.remainingSec);

        if (lsBanner) {
            lsBanner.classList.remove('hidden');
            lsBanner.classList.add('visible');
            const lbl = lsBanner.querySelector('.rm-title');
            const val = lsBanner.querySelector('.rm-value');
            if (lbl) lbl.textContent = ramadanCountdown.label;
            if (val) val.textContent = formatted;
        }

        if (ptBanner) {
            ptBanner.classList.remove('hidden');
            ptBanner.classList.add('visible');
            const lbl = ptBanner.querySelector('.ramadan-label');
            const cnt = ptBanner.querySelector('.ramadan-countdown');
            if (lbl) lbl.textContent = ramadanCountdown.label;
            if (cnt) cnt.textContent = formatted;
        }
    }

    // ──────────────────────────────────────────────────────
    // BAYRAM banner güncelleme
    // ──────────────────────────────────────────────────────
    function updateBayramBanner(bayramInfo) {
        const lsBanner = document.getElementById('ls-bayram-info');
        if (!lsBanner) return;

        if (!bayramInfo) {
            lsBanner.classList.remove('visible');
            lsBanner.classList.add('hidden');
            return;
        }

        lsBanner.classList.remove('hidden');
        lsBanner.classList.add('visible');

        const titleEl = lsBanner.querySelector('.byr-title');
        const saatEl = lsBanner.querySelector('.byr-saat');
        const tarihEl = lsBanner.querySelector('.byr-tarih');

        // Başlık: kaç gün kaldığına göre değişir
        let title = 'Bayram Namazı';
        if (bayramInfo.kalanGun === 0) {
            title = 'Bugün Bayram Namazı';
        } else if (bayramInfo.kalanGun === 1) {
            title = 'Yarın Bayram Namazı';
        } else {
            title = `Bayram Namazı (${bayramInfo.kalanGun} gün)`;
        }

        if (titleEl) titleEl.textContent = title;
        if (saatEl) saatEl.textContent = bayramInfo.saat;
        if (tarihEl) tarihEl.textContent = bayramInfo.tarih;
    }

    // ──────────────────────────────────────────────────────
    // TICKER güncelle
    // ──────────────────────────────────────────────────────
    function updateTicker(items) {
        const tickers = ['ls-ticker-inner', 'pt-ticker-inner'];
        tickers.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            // Kayan yazıda CSS döngüsü için yalnızca öğe sayısı az ise diziyi ikile (ekran boş kalmasın)
            const displayItems = items.length < 5 ? [...items, ...items, ...items] : [...items, ...items];
            el.innerHTML = displayItems.map(t =>
                `<span class="ticker-item"><span class="dot"></span>${t}</span>`
            ).join('');
        });
    }

    // ──────────────────────────────────────────────────────
    // Tema uygula
    // ──────────────────────────────────────────────────────
    function applyTheme(tema) {
        const root = document.documentElement;
        if (tema === 'auto') {
            const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.setAttribute('data-theme', dark ? 'default' : 'light');
        } else {
            root.setAttribute('data-theme', tema === 'default' ? '' : tema);
        }
    }

    // ──────────────────────────────────────────────────────
    // CUMA YARDIMI — Friday donation overlay logic
    // ──────────────────────────────────────────────────────
    let _cumaYardimInterval = null;
    let _cumaLangInterval = null;
    let _cumaLangIndex = 0;

    function updateCumaYardimi(settings, prayerTimes) {
        const overlay = document.getElementById('cuma-yardim-overlay');
        if (!overlay) return;

        // Feature disabled?
        if (!settings.gosterCumaYardimi) {
            _hideCumaYardimi();
            return;
        }

        const now = new Date();
        // Is it Friday? (0=Sun,1=Mon,...,5=Fri,6=Sat)
        if (now.getDay() !== 5) {
            _hideCumaYardimi();
            return;
        }

        // Get Cuma prayer time from prayerTimes (ogle = Friday prayer)
        const cumaStr = prayerTimes && (prayerTimes.cuma || prayerTimes.ogle);
        if (!cumaStr) {
            _hideCumaYardimi();
            return;
        }

        const [cumaSaat, cumaDk] = cumaStr.split(':').map(Number);
        const cumaDate = new Date(now);
        cumaDate.setHours(cumaSaat, cumaDk, 0, 0);

        const diffMs = now - cumaDate;
        const diffMin = diffMs / 60000;
        const onceDk = -(settings.cumaYardimBaslangicDk ?? 15);
        const sonraDk = settings.cumaYardimBitisDk ?? 45;

        if (diffMin >= onceDk && diffMin <= sonraDk) {
            _showCumaYardimi(settings);
        } else {
            _hideCumaYardimi();
        }
    }

    function _showCumaYardimi(settings) {
        const overlay = document.getElementById('cuma-yardim-overlay');
        if (!overlay || !overlay.classList.contains('hidden')) return; // already showing

        const metinler = settings.cumaYardimMetinler || {};
        const langs = [
            { key: 'tr', label: 'TR', text: metinler.tr },
            { key: 'ar', label: 'AR', text: metinler.ar },
            { key: 'en', label: 'EN', text: metinler.en },
        ].filter(l => l.text && l.text.trim() !== '');

        if (langs.length === 0) return; // No text configured

        // Set mode (data attribute controls CSS)
        overlay.setAttribute('data-mode', settings.cumaYardimGorunum || 'tam-ekran');
        overlay.classList.remove('hidden');

        const textEl = document.getElementById('cuma-yardim-text');
        const badgeEl = document.getElementById('cuma-yardim-lang-badge');

        _cumaLangIndex = 0;
        function showLang(idx) {
            const lang = langs[idx % langs.length];
            if (textEl) {
                textEl.textContent = lang.text;
                textEl.style.direction = lang.key === 'ar' ? 'rtl' : 'ltr';
                // Re-trigger animation
                textEl.style.animation = 'none';
                textEl.offsetHeight; // reflow
                textEl.style.animation = '';
            }
            if (badgeEl) badgeEl.textContent = lang.label;
        }

        showLang(0);

        // Rotate through languages every 8 seconds
        if (langs.length > 1) {
            _cumaLangInterval = setInterval(() => {
                _cumaLangIndex++;
                showLang(_cumaLangIndex);
            }, 8000);
        }
    }

    function _hideCumaYardimi() {
        const overlay = document.getElementById('cuma-yardim-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            overlay.classList.add('hidden');
            clearInterval(_cumaLangInterval);
            _cumaLangInterval = null;
            _cumaLangIndex = 0;
        }
    }

    // ──────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────
    return {
        setOrientation,
        listenOrientation,
        updateTopbar,
        updateCountdown,
        updatePrayerList,
        updatePortraitPrayerGrid,
        renderSlide,
        showEzanOverlay,
        hideEzanOverlay,
        updateRamadanBanner,
        updateBayramBanner,
        updateTicker,
        applyTheme,
        applySettings,
        updateCumaYardimi,
        getOrientation: () => _currentOrientation,
    };

})();

window.DisplayManager = DisplayManager;
