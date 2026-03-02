/**
 * CAMI TV — prayer-engine.js
 * Namaz vakti hesaplama motoru.
 * Gün türü (Cuma, Ramazan, Kandil, Bayram), geri sayım, sonraki vakit.
 */

const PrayerEngine = (() => {

    // Türkçe ay ve gün adları (ana projeyle uyumlu)
    const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
    const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    // Vakit listesi (sırasıyla)
    const VAKIT_KEYS = ['imsak', 'sabah', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];
    // Vakit ikonları
    const VAKIT_ICONS = {
        imsak: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.1,22c-5,0-9.1-4.1-9.1-9.1c0-4.3,3-8,7.2-8.9C9.1,6,8,8.4,8,11c0,4.4,3.6,8,8,8c1.6,0,3.1-0.5,4.3-1.3C19,20.2,15.7,22,12.1,22z"/></svg>`,
        sabah: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5,18l2-2h10l2,2H5z M12,4c2.8,0,5.2,1.8,6.1,4.4l-1.9,0.6C15.6,7.2,13.9,6,12,6S8.4,7.2,7.7,9l-1.9-0.6C6.8,5.8,9.2,4,12,4z M12,10c1.1,0,2,0.9,2,2h-4C10,10.9,10.9,10,12,10z"/></svg>`,
        gunes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12,2v3 M12,19v3 M2,12h3 M19,12h3 M4.9,4.9l2.1,2.1 M17,17l2.1,2.1 M4.9,19.1l2.1-2.1 M17,7l2.1-2.1" stroke="currentColor" stroke-width="2"/></svg>`,
        ogle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12,7v5l3,3"/></svg>`,
        ikindi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17,10c1.66,0,3-1.34,3-3s-1.34-3-3-3s-3,1.34-3,3S15.34,10,17,10z M11,12c-2.76,0-5,2.24-5,5s2.24,5,5,5s5-2.24,5-5S13.76,12,11,12z"/></svg>`,
        aksam: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,11c1.1,0,2.16,0.13,3.2,0.36L16,10l-4-4l-4,4l0.8,1.36C9.84,11.13,10.9,11,12,11z M5.54,12.43L4,14l7.63,7.63l1.83-4.27C12.98,17.13,12.51,17,12,17C9.36,17,7.18,15.1,6.58,12.64L5.54,12.43z M20,14l-1.54-1.57l-1.04,0.21C16.82,15.1,14.64,17,12,17c-0.51,0-0.98,0.13-1.46,0.36L12.37,21.63L20,14z"/></svg>`,
        yatsi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12,3c-4.97,0-9,4.03-9,9s4.03,9,9,9s9-4.03,9-9c0-0.46-0.04-0.92-0.1-1.36c-0.98,1.37-2.58,2.26-4.4,2.26c-2.98,0-5.4-2.42-5.4-5.4c0-1.81,0.89-3.42,2.26-4.4C12.92,3.04,12.46,3,12,3L12,3z M19,3l-0.78,1.72L16.5,5.5l1.72,0.78L19,8l0.78-1.72L21.5,5.5l-1.72-0.78L19,3z M20.5,14l-0.39,0.86L19.25,15.25l0.86,0.39L20.5,16.5l0.39-0.86L21.75,15.25l-0.86-0.39L20.5,14z M8.5,4L7.72,5.72L6,6.5l1.72,0.78L8.5,9l0.78-1.72L11,6.5L9.28,5.72L8.5,4z"/></svg>`,
        kible: '🧭'
    };
    const VAKIT_LABELS = {
        imsak: 'İmsak',
        sabah: 'Sabah',
        gunes: 'Güneş',
        ogle: 'Öğle',
        ikindi: 'İkindi',
        aksam: 'Akşam',
        yatsi: 'Yatsı',
    };

    // ──────────────────────────────────────────────────────
    // Vakit string'ini dakikaya çevir (HH:MM → dk)
    // ──────────────────────────────────────────────────────
    function timeToDk(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    // Anlık zamanı dakikaya çevir
    function nowToDk() {
        const n = new Date();
        return n.getHours() * 60 + n.getMinutes();
    }

    // ──────────────────────────────────────────────────────
    // Sonraki vakti ve kalan saniyeyi hesapla
    // todayPT: bugünün vakit objesi
    // tomorrowImsak: yarının imsak string'i
    // ──────────────────────────────────────────────────────
    function calcNextPrayer(todayPT, tomorrowImsak) {
        if (!todayPT) return null;

        const now = new Date();
        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

        // sabah yoksa vakitler listesinden çıkar
        const keys = todayPT.sabah
            ? VAKIT_KEYS
            : VAKIT_KEYS.filter(k => k !== 'sabah');

        for (const key of keys) {
            const val = todayPT[key];
            if (!val) continue;
            const [h, m] = val.split(':').map(Number);
            const vakitSec = h * 3600 + m * 60;
            if (vakitSec > nowSec) {
                let label = VAKIT_LABELS[key];
                if (key === 'imsak') label = 'İmsaka Kalan Süre';
                else if (key === 'sabah') label = 'Sabaha Kalan Süre';
                else if (key === 'gunes') label = 'Güneşe Kalan Süre';
                else if (key === 'ogle') label = 'Öğleye Kalan Süre';
                else if (key === 'ikindi') label = 'İkindiye Kalan Süre';
                else if (key === 'aksam') label = 'Akşama Kalan Süre';
                else if (key === 'yatsi') label = 'Yatsıya Kalan Süre';

                return {
                    key,
                    label: label,
                    icon: VAKIT_ICONS[key],
                    time: val,
                    remainingSec: vakitSec - nowSec,
                };
            }
        }

        // Tüm vakitler geçti → yarının imsağı
        if (tomorrowImsak) {
            const [h, m] = tomorrowImsak.split(':').map(Number);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(h, m, 0, 0);
            const remainingSec = Math.floor((tomorrow - now) / 1000);
            return {
                key: 'imsak',
                label: 'İmsaka Kalan Süre',
                icon: VAKIT_ICONS['imsak'],
                time: tomorrowImsak,
                remainingSec,
            };
        }

        return null;
    }

    // ──────────────────────────────────────────────────────
    // Gün türünü belirle — ana projeyle aynı mantık
    // NORMAL | CUMA | RAMAZAN | KANDIL (bitmask gibi çoklu)
    // ──────────────────────────────────────────────────────
    function getDayType(todayPT) {
        if (!todayPT) return { normal: true };

        const hicri = todayPT.hicriTarih || '';
        const miladi = todayPT.miladiTarih || '';
        const result = { normal: true, cuma: false, ramazan: false, kandil: false, bayram: false };

        // Cuma
        if (miladi.includes('Cuma')) {
            result.cuma = true;
            result.normal = false;
        }

        // Ramazan
        if (hicri.includes('Ramazan')) {
            result.ramazan = true;
            result.normal = false;
        }

        // Sabit Kandiller
        const kandiGunler = ['27 Recep', '15 Şaban', '27 Ramazan', '12 Rebiülevvel'];
        if (kandiGunler.some(k => hicri.includes(k))) {
            result.kandil = true;
            result.normal = false;
        }

        // Regaib Kandili (Recep ayı ilk Perşembesi)
        if (hicri.includes('Recep') && miladi.includes('Perşembe')) {
            const gun = parseInt(hicri);
            if (gun >= 1 && gun <= 7) {
                result.kandil = true;
                result.normal = false;
            }
        }

        return result;
    }

    // ──────────────────────────────────────────────────────
    // İftar / Sahur geri sayımı (Ramazan)
    // ──────────────────────────────────────────────────────
    function getRamadanCountdown(todayPT, tomorrowImsak) {
        if (!todayPT) return null;

        const now = new Date();
        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const aksamSec = timeToDk(todayPT.aksam) * 60;
        const imsakSec = timeToDk(todayPT.imsak) * 60;

        // Gece yarısı geçişi kontrolü:
        // Eğer nowSec < imsakSec ise gece yarısını geçmiş ama henüz imsak olmamış
        // (örn. 01:30 AM imsak 05:00 AM → hâlâ o günün orucu değil, önceki gecenin iftarı geçmiş)
        const isAfterMidnightBeforeImsak = nowSec < imsakSec;

        if (isAfterMidnightBeforeImsak) {
            // Gece yarısından imsağa kadar → İmsaka kalan süre (bugünün imsağı)
            if (tomorrowImsak) {
                // Önce bugünün imsağı üzerinden hesapla
                return {
                    tip: 'sahur',
                    label: 'İmsaka',
                    remainingSec: imsakSec - nowSec,
                };
            }
        }

        // İmsak geçmiş ama akşam olmamış → oruçluyuz, İftara X kaldı
        if (nowSec >= imsakSec && nowSec < aksamSec) {
            return {
                tip: 'iftar',
                label: 'İftara',
                remainingSec: aksamSec - nowSec,
            };
        }

        // Akşam geçti → yarının imsağına: İmsaka X kaldı
        if (tomorrowImsak) {
            const [h, m] = tomorrowImsak.split(':').map(Number);
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(h, m, 0, 0);
            return {
                tip: 'sahur',
                label: 'İmsaka',
                remainingSec: Math.floor((tomorrow - now) / 1000),
            };
        }

        return null;
    }

    // ──────────────────────────────────────────────────────
    // Saniyeyi SS:DD:SS formatına çevir
    // ──────────────────────────────────────────────────────
    function formatSeconds(totalSec) {
        if (totalSec < 0) totalSec = 0;
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Kısa format: "1 sa 23 dk"
    function formatSecondsShort(totalSec) {
        if (totalSec < 0) return '0 dk';
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        if (h === 0) return `${m} dk`;
        return `${h} sa ${m} dk`;
    }

    // ──────────────────────────────────────────────────────
    // Bugünün tarih string'ini üret
    // ──────────────────────────────────────────────────────
    function getTodayStr() {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')} ${AYLAR[now.getMonth()]} ${now.getFullYear()} ${GUNLER[now.getDay()]}`;
    }

    // ──────────────────────────────────────────────────────
    // Anlık saati formatla
    // ──────────────────────────────────────────────────────
    function formatClock() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }

    function formatClockNoSec() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }

    // Miladi tarih
    function formatMiladiDate() {
        const now = new Date();
        return `${String(now.getDate()).padStart(2, '0')} ${AYLAR[now.getMonth()]} ${now.getFullYear()} ${GUNLER[now.getDay()]}`;
    }

    // ──────────────────────────────────────────────────────
    // Ezan ekranı tetikleme kontrolü
    // Vakit öncesi X dakika içindeyse true döner
    // ──────────────────────────────────────────────────────
    function shouldShowEzan(todayPT, onceDk = 15) {
        if (!todayPT) return null;

        const now = new Date();
        const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

        const keys = todayPT.sabah
            ? VAKIT_KEYS
            : VAKIT_KEYS.filter(k => k !== 'sabah');

        for (const key of keys) {
            const val = todayPT[key];
            if (!val) continue;
            const [h, m] = val.split(':').map(Number);
            const vakitSec = h * 3600 + m * 60;
            const windowStart = vakitSec - onceDk * 60;

            if (nowSec >= windowStart && nowSec < vakitSec) {
                return {
                    key,
                    label: VAKIT_LABELS[key],
                    icon: VAKIT_ICONS[key],
                    time: val,
                    remainingSec: vakitSec - nowSec,
                    isEzanTime: false, // henüz vakit gelmedi
                };
            }

            // Tam vakit: ezan vakti
            if (nowSec >= vakitSec && nowSec < vakitSec + 600) { // 10 dk ezan ekranı kalır
                return {
                    key,
                    label: VAKIT_LABELS[key],
                    icon: VAKIT_ICONS[key],
                    time: val,
                    remainingSec: 0,
                    isEzanTime: true,
                };
            }
        }

        return null;
    }

    // ──────────────────────────────────────────────────────
    // Vakit aralığını saniye olarak hesapla
    // key: hedef vakit (örn 'ogle'), todayPT: bugünün vakit objesi
    // Dönen değer: önceki vakit başından bu vakite kadar geçen toplam saniye
    // (Dairesel sayaç halkasının %100'ü bu değere göre ayarlanır)
    // ──────────────────────────────────────────────────────
    function getPrayerIntervalSec(key, todayPT, tomorrowImsak) {
        if (!todayPT) return 3600; // Fallback: 1 saat

        const keys = todayPT.sabah
            ? VAKIT_KEYS
            : VAKIT_KEYS.filter(k => k !== 'sabah');

        const idx = keys.indexOf(key);

        // Hedef vaktin saniyesi
        const targetVal = todayPT[key];
        if (!targetVal) return 3600;
        const [th, tm] = targetVal.split(':').map(Number);
        const targetSec = th * 3600 + tm * 60;

        // Bir önceki vakit (yoksa gün başı 00:00)
        let prevSec = 0;
        if (idx > 0) {
            const prevKey = keys[idx - 1];
            const prevVal = todayPT[prevKey];
            if (prevVal) {
                const [ph, pm] = prevVal.split(':').map(Number);
                prevSec = ph * 3600 + pm * 60;
            }
        } else if (key === 'imsak' && tomorrowImsak) {
            // Yatsıdan yarının imsağına kadar aralık — gece geçişi
            const yatsiVal = todayPT['yatsi'];
            if (yatsiVal) {
                const [yh, ym] = yatsiVal.split(':').map(Number);
                const yatsiSec = yh * 3600 + ym * 60;
                // gece geçişi: (86400 - yatsiSec) + targetSec
                return (86400 - yatsiSec) + targetSec;
            }
        }

        const interval = targetSec - prevSec;
        return interval > 0 ? interval : 3600;
    }

    // ──────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────
    return {
        VAKIT_KEYS,
        VAKIT_ICONS,
        VAKIT_LABELS,
        calcNextPrayer,
        getDayType,
        getRamadanCountdown,
        getPrayerIntervalSec,
        shouldShowEzan,
        formatSeconds,
        formatSecondsShort,
        formatClock,
        formatClockNoSec,
        formatMiladiDate,
        getTodayStr,
        timeToDk,
    };

})();

window.PrayerEngine = PrayerEngine;
