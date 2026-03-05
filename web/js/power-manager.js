/**
 * CAMI TV — power-manager.js
 * Ekran güç yönetimi motoru.
 * Mod: always | fixed | prayer | hybrid
 *
 * Android WebView ortamında: AndroidBridge üzerinden donanım kontrolü
 * Tarayıcı ortamında: CSS filter ile görsel karartma
 */

const PowerManager = (() => {

    let _settings = null;
    let _todayPT = null;   // Bugünün namaz vakitleri
    let _timer = null;   // setInterval handle
    let _isScreenOn = true;
    let _hasAndroidBridge = false;

    // ──────────────────────────────────────────────────────
    // Başlat
    // ──────────────────────────────────────────────────────
    function init(settings, todayPrayerTimes) {
        _settings = settings;
        _todayPT = todayPrayerTimes;
        _hasAndroidBridge = typeof AndroidBridge !== 'undefined' && AndroidBridge.isAvailable?.();

        // Her dakika kontrol et
        if (_timer) clearInterval(_timer);
        _timer = setInterval(check, 60 * 1000);

        // Hemen bir kontrol yap
        check();
    }

    // Vakitler değişince güncelle
    function updatePrayerTimes(todayPrayerTimes) {
        _todayPT = todayPrayerTimes;
    }

    // ──────────────────────────────────────────────────────
    // Ana kontrol fonksiyonu (her dk çağrılır)
    // ──────────────────────────────────────────────────────
    function check() {
        if (!_settings) return;

        const mod = _settings.gucMod;

        switch (mod) {
            case 'always':
                turnOn();
                break;
            case 'fixed':
                checkFixed();
                break;
            case 'prayer':
                checkPrayer();
                break;
            case 'hybrid':
                // Her ikisi: sabit kapatma saati var, arası namaz bazlı
                checkPrayer();
                // Gece sabit kapatma saatini de kontrol et
                const nowDk = nowToDk();
                const kapanisDk = timeToDk(_settings.gucKapanisSaati);
                const acisDk = timeToDk(_settings.gucAcisSaati);
                if (nowDk >= kapanisDk || nowDk < acisDk) {
                    turnOff();
                }
                break;
        }
    }

    // ──────────────────────────────────────────────────────
    // Sabit Saat Modu
    // ──────────────────────────────────────────────────────
    function checkFixed() {
        const nowDk = nowToDk();
        const acisDk = timeToDk(_settings.gucAcisSaati);
        const kapDk = timeToDk(_settings.gucKapanisSaati);

        // Gece yarısını geçen aralıklar (ör: 22:00 - 06:00)
        let shouldBeOn;
        if (acisDk < kapDk) {
            shouldBeOn = nowDk >= acisDk && nowDk < kapDk;
        } else {
            // Gece yarısını geçiyor
            shouldBeOn = nowDk >= acisDk || nowDk < kapDk;
        }

        shouldBeOn ? turnOn() : turnOff();
    }

    // ──────────────────────────────────────────────────────
    // Namaz Vakti Bazlı Mod
    // Ana projedeki shouldDeviceBeOn() mantığının aynısı
    // ──────────────────────────────────────────────────────
    function checkPrayer() {
        if (!_todayPT) {
            turnOff(); // Veri yoksa kapalı
            return;
        }

        const nowDk = nowToDk();
        const today = new Date();
        const dayName = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'][today.getDay()];
        const offsets = _settings.gucPrayerOffsets;
        const PT = _todayPT;

        // Her vakit için açık pencere hesapla
        let shouldBeOn = false;

        const vakitler = ['imsak', 'sabah', 'gunes', 'ogle', 'ikindi', 'aksam', 'yatsi'];
        for (const key of vakitler) {
            const cfg = offsets[key];
            if (!cfg?.aktif) continue;

            const vakitStr = PT[key];
            if (!vakitStr) continue;

            const [h, m] = vakitStr.split(':').map(Number);
            const vakitDk = h * 60 + m;
            const acilisDk = vakitDk - cfg.onceDk;
            const kapanisDk = vakitDk + cfg.sonraDk;

            if (nowDk >= acilisDk && nowDk < kapanisDk) {
                shouldBeOn = true;
                break;
            }
        }

        // Cuma özel kontrolü
        if (!shouldBeOn && dayName === 'cuma' && offsets.cuma?.aktif && PT.ogle) {
            const [h, m] = PT.ogle.split(':').map(Number);
            const ogleDk = h * 60 + m;
            const acilisDk = ogleDk - offsets.cuma.onceDk;
            const kapanisDk = ogleDk + offsets.cuma.sonraDk;
            if (nowDk >= acilisDk && nowDk < kapanisDk) shouldBeOn = true;
        }

        shouldBeOn ? turnOn() : setDimmed();
    }

    // ──────────────────────────────────────────────────────
    // Ekran Kontrol Fonksiyonları
    // ──────────────────────────────────────────────────────
    function turnOn() {
        _isScreenOn = true;
        const dimmer = document.getElementById('screen-dimmer');
        const aktif = Number(_settings.gucAktifParlaklik || 100);

        if (aktif >= 100) {
            dimmer.style.removeProperty('--dim-level');
            dimmer.classList.remove('dimmed', 'blackout');
        } else {
            dimmer.style.setProperty('--dim-level', String(1 - aktif / 100));
            dimmer.classList.add('dimmed');
            dimmer.classList.remove('blackout');
        }

        if (_hasAndroidBridge) {
            try { AndroidBridge.turnScreenOn(); } catch (e) { }
        }
    }

    function turnOff() {
        _isScreenOn = false;
        const dimmer = document.getElementById('screen-dimmer');
        dimmer.classList.add('blackout');
        dimmer.classList.remove('dimmed');

        if (_hasAndroidBridge) {
            try { AndroidBridge.turnScreenOff(); } catch (e) { }
        }
    }

    // Kısmi karartma (prayer modunda, pasif pencere)
    function setDimmed() {
        _isScreenOn = false;
        const pasif = Number(_settings.gucPasifParlaklik || 10);

        const dimmer = document.getElementById('screen-dimmer');
        dimmer.style.setProperty('--dim-level', String(1 - pasif / 100));

        if (pasif === 0) {
            dimmer.classList.remove('dimmed');
            dimmer.classList.add('blackout');
            if (_hasAndroidBridge) {
                try { AndroidBridge.turnScreenOff(); } catch (e) { }
            }
        } else {
            dimmer.classList.add('dimmed');
            dimmer.classList.remove('blackout');
            if (_hasAndroidBridge) {
                try { AndroidBridge.turnScreenOn(); } catch (e) { }
            }
        }
    }

    // Hafif dokunuşta (uzaktan kumanda) geçici uyandırma
    function wakeTemporary(ms = 10000) {
        turnOn();
        setTimeout(() => check(), ms);
    }

    // ──────────────────────────────────────────────────────
    // Yardımcı fonksiyonlar
    // ──────────────────────────────────────────────────────
    function timeToDk(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    function nowToDk() {
        const n = new Date();
        return n.getHours() * 60 + n.getMinutes();
    }

    // ──────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────
    return {
        init,
        updatePrayerTimes,
        check,
        turnOn,
        turnOff,
        setDimmed,
        wakeTemporary,
        isOn: () => _isScreenOn,
    };

})();

window.PowerManager = PowerManager;
