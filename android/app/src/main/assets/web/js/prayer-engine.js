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
        imsak: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/><polygon points="14 6 15 8 17 8 15.5 9.5 16 11.5 14 10.5 12 11.5 12.5 9.5 11 8 13 8 14 6"/></svg>`,
        sabah: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v4"/><path d="M4.22 8.22l2.83 2.83"/><path d="M19.78 8.22l-2.83 2.83"/><path d="M2 18h20"/><path d="M6 14a6 6 0 0 1 12 0"/></svg>`,
        gunes: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.22 4.22l1.42 1.42"/><path d="M18.36 18.36l1.42 1.42"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M4.22 19.78l1.42-1.42"/><path d="M18.36 5.64l1.42-1.42"/></svg>`,
        ogle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16"/><path d="M12 4A6 6 0 0 0 6 10v12"/><path d="M12 4A6 6 0 0 1 18 10v12"/><path d="M12 4V2"/><path d="M2 22v-8"/><path d="M22 22v-8"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M9 22v-4a3 3 0 0 1 6 0v4"/></svg>`,
        ikindi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22h20"/><rect x="6" y="6" width="12" height="16"/><path d="M6 10h12"/><path d="M6 14h12"/></svg>`,
        aksam: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h20"/><path d="M5 22h14"/><path d="M8 14a4 4 0 0 1 8 0"/><path d="M12 6v4"/><path d="M6.3 8.3l2.8 2.8"/><path d="M17.7 8.3l-2.8 2.8"/></svg>`,
        yatsi: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"/><path d="M9 4h6l2 4H7l2-4z"/><path d="M7 8v10l2 4h6l2-4V8H7z"/><path d="M12 13v3"/></svg>`,
        kible: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`
    };

    // Dinamik get için wrapper
    function getVakitLabel(key) {
        return typeof I18n !== 'undefined' ? I18n.get(key) : key;
    }

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
                let label = typeof I18n !== 'undefined' ? I18n.get('kalan_sure', { vakit: I18n.get(key) }) : key;

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
                label: typeof I18n !== 'undefined' ? I18n.get('kalan_sure', { vakit: I18n.get('imsak') }) : 'imsak',
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
                    label: typeof I18n !== 'undefined' ? I18n.get('kalan_sure', { vakit: I18n.get('sahur') }) : 'Sahur',
                    remainingSec: imsakSec - nowSec,
                };
            }
        }

        // İmsak geçmiş ama akşam olmamış → oruçluyuz, İftara X kaldı
        if (nowSec >= imsakSec && nowSec < aksamSec) {
            return {
                tip: 'iftar',
                label: typeof I18n !== 'undefined' ? I18n.get('kalan_sure', { vakit: I18n.get('iftar') }) : 'İftar',
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
                label: typeof I18n !== 'undefined' ? I18n.get('kalan_sure', { vakit: I18n.get('sahur') }) : 'Sahur',
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
                    label: getVakitLabel(key),
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
                    label: getVakitLabel(key),
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
        getVakitLabel,
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
