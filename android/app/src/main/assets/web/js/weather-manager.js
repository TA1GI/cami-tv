/**
 * CAMI TV — weather-manager.js
 * Open-Meteo API ile hava durumu bilgisi.
 * Ücretsiz, API key gerektirmez.
 * Sadece internet varsa çalışır.
 */

const WeatherManager = (() => {

    const GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
    const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
    const UPDATE_INTERVAL = 30 * 60 * 1000; // 30 dakika

    let _settings = null;
    let _weatherData = null;
    let _timer = null;
    let _coordinates = null; // { lat, lon }

    // Hava kodu → emoji + açıklama
    const WEATHER_CODES = {
        0: { icon: '☀️', desc: 'Açık' },
        1: { icon: '🌤️', desc: 'Az bulutlu' },
        2: { icon: '⛅', desc: 'Parçalı bulutlu' },
        3: { icon: '☁️', desc: 'Bulutlu' },
        45: { icon: '🌫️', desc: 'Sisli' },
        48: { icon: '🌫️', desc: 'Kırağılı sis' },
        51: { icon: '🌦️', desc: 'Hafif çisenti' },
        53: { icon: '🌦️', desc: 'Çisenti' },
        55: { icon: '🌦️', desc: 'Yoğun çisenti' },
        56: { icon: '🌧️', desc: 'Dondurucu çisenti' },
        57: { icon: '🌧️', desc: 'Yoğun dondurucu çisenti' },
        61: { icon: '🌧️', desc: 'Hafif yağmur' },
        63: { icon: '🌧️', desc: 'Yağmurlu' },
        65: { icon: '🌧️', desc: 'Şiddetli yağmur' },
        66: { icon: '🌧️', desc: 'Dondurucu yağmur' },
        67: { icon: '🌧️', desc: 'Şiddetli dondurucu yağmur' },
        71: { icon: '🌨️', desc: 'Hafif kar' },
        73: { icon: '🌨️', desc: 'Karlı' },
        75: { icon: '❄️', desc: 'Yoğun kar' },
        77: { icon: '🌨️', desc: 'Kar taneleri' },
        80: { icon: '🌧️', desc: 'Hafif sağanak' },
        81: { icon: '🌧️', desc: 'Sağanak yağış' },
        82: { icon: '⛈️', desc: 'Şiddetli sağanak' },
        85: { icon: '🌨️', desc: 'Hafif kar sağanağı' },
        86: { icon: '❄️', desc: 'Yoğun kar sağanağı' },
        95: { icon: '⛈️', desc: 'Gök gürültülü fırtına' },
        96: { icon: '⛈️', desc: 'Dolu ile fırtına' },
        99: { icon: '⛈️', desc: 'Şiddetli dolu fırtınası' },
    };

    // ──────────────────────────────────────────────────────
    // BAŞLAT
    // ──────────────────────────────────────────────────────
    async function init(settings) {
        _settings = settings;

        if (!_settings.gosterHavaDurumu) {
            console.log('[Weather] Hava durumu kapalı.');
            return;
        }

        if (!navigator.onLine) {
            console.log('[Weather] İnternet yok, hava durumu atlanıyor.');
            return;
        }

        try {
            // İlçe adından koordinat bul
            await resolveCoordinates();

            if (_coordinates) {
                await fetchWeather();
                // Periyodik güncelleme başlat
                _timer = setInterval(async () => {
                    if (navigator.onLine && _settings.gosterHavaDurumu) {
                        await fetchWeather();
                    }
                }, UPDATE_INTERVAL);
            }
        } catch (e) {
            console.warn('[Weather] Başlatma hatası:', e);
        }
    }

    // ──────────────────────────────────────────────────────
    // KOORDİNAT ÇÖZÜMLEME (Geocoding)
    // ──────────────────────────────────────────────────────
    async function resolveCoordinates() {
        const ilce = _settings.ilce;
        const il = _settings.il;

        if (!ilce && !il) {
            console.warn('[Weather] Konum bilgisi yok.');
            return;
        }

        // Önce localStorage'dan cache kontrol et
        const cacheKey = `weather_coords_${il}_${ilce}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            try {
                _coordinates = JSON.parse(cached);
                console.log('[Weather] Koordinatlar cache\'den yüklendi:', _coordinates);
                return;
            } catch (e) { /* cache geçersiz */ }
        }

        // Open-Meteo Geocoding API ile koordinat bul
        const searchName = ilce || il;
        try {
            const url = `${GEOCODING_API}?name=${encodeURIComponent(searchName)}&count=5&language=tr&country_code=TR`;
            const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });

            if (!resp.ok) throw new Error(`Geocoding HTTP ${resp.status}`);

            const data = await resp.json();

            if (data.results && data.results.length > 0) {
                // İl eşleşmesi ara
                let best = data.results[0];
                for (const r of data.results) {
                    const admin = (r.admin1 || '').toLowerCase();
                    if (admin.includes(il.toLowerCase()) || il.toLowerCase().includes(admin)) {
                        best = r;
                        break;
                    }
                }

                _coordinates = {
                    lat: best.latitude,
                    lon: best.longitude,
                    name: best.name
                };

                // Cache'le
                localStorage.setItem(cacheKey, JSON.stringify(_coordinates));
                console.log('[Weather] Koordinatlar çözümlendi:', _coordinates);
            } else {
                console.warn('[Weather] Geocoding sonuç bulunamadı:', searchName);
            }
        } catch (e) {
            console.warn('[Weather] Geocoding hatası:', e);
        }
    }

    // ──────────────────────────────────────────────────────
    // HAVA DURUMU VERİSİ ÇEK
    // ──────────────────────────────────────────────────────
    async function fetchWeather() {
        if (!_coordinates) return;

        try {
            const url = `${WEATHER_API}?latitude=${_coordinates.lat}&longitude=${_coordinates.lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m&timezone=auto`;
            const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });

            if (!resp.ok) throw new Error(`Weather HTTP ${resp.status}`);

            const data = await resp.json();

            if (data.current) {
                const code = data.current.weather_code;
                const weatherInfo = WEATHER_CODES[code] || { icon: '🌤️', desc: 'Bilinmiyor' };

                _weatherData = {
                    temperature: Math.round(data.current.temperature_2m),
                    humidity: data.current.relative_humidity_2m,
                    windSpeed: data.current.wind_speed_10m,
                    weatherCode: code,
                    icon: weatherInfo.icon,
                    description: weatherInfo.desc,
                    lastUpdate: new Date().toISOString(),
                };

                console.log('[Weather] Güncellendi:', _weatherData);

                // DOM'u güncelle
                updateWeatherDisplay();
            }
        } catch (e) {
            console.warn('[Weather] Veri çekme hatası:', e);
        }
    }

    // ──────────────────────────────────────────────────────
    // DOM GÜNCELLE
    // ──────────────────────────────────────────────────────
    function updateWeatherDisplay() {
        if (!_weatherData) return;

        const text = `${_weatherData.icon} ${_weatherData.temperature}°C`;

        // Landscape topbar
        const lsWeather = document.getElementById('ls-weather-info');
        if (lsWeather) {
            lsWeather.textContent = text;
            lsWeather.title = `${_weatherData.description} | Nem: %${_weatherData.humidity} | Rüzgar: ${_weatherData.windSpeed} km/s`;
            lsWeather.classList.remove('hidden');
        }

        // Portrait
        const ptWeather = document.getElementById('pt-weather-info');
        if (ptWeather) {
            ptWeather.textContent = text;
            ptWeather.title = _weatherData.description;
            ptWeather.classList.remove('hidden');
        }
    }

    // ──────────────────────────────────────────────────────
    // TEMİZLE
    // ──────────────────────────────────────────────────────
    function destroy() {
        if (_timer) {
            clearInterval(_timer);
            _timer = null;
        }
    }

    // ──────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────
    return {
        init,
        destroy,
        getData: () => _weatherData,
        getCoordinates: () => _coordinates,
        refresh: fetchWeather,
    };

})();

window.WeatherManager = WeatherManager;
