/**
 * CAMI TV — settings.js
 * Ayarlar sayfası form mantığı.
 */

function initSettingsPage() {

    const settings = SettingsManager.load();
    let isDirty = false;

    // Sayfa açılışında kayıtlı dili uygula
    if (typeof I18n !== 'undefined') {
        I18n.setLanguage(settings.dil || 'tr');
    }

    // ──────────────────────────────────────────────────────
    // Tema uygula (ayarlar sayfasına da)
    // ──────────────────────────────────────────────────────
    const root = document.documentElement;
    if (settings.tema && settings.tema !== 'default' && settings.tema !== 'auto') {
        root.setAttribute('data-theme', settings.tema);
    }

    // ──────────────────────────────────────────────────────
    // FORM → SETTINGS Eşleme
    // ──────────────────────────────────────────────────────

    // Cami bilgileri
    const camiAdiEl = document.getElementById('s-cami-adi');
    camiAdiEl.value = settings.camiAdi || '';

    // Konum Seçimi (SearchableSelect)
    const ilContainer = document.getElementById('settings-il-container');
    const ilceContainer = document.getElementById('settings-ilce-container');
    let _locations = {};

    const ilSS = new SearchableSelect({
        container: ilContainer,
        placeholder: '— İl seçin —',
        onSelect: (value) => {
            ilceSS.setValue('', '');
            ilceSS.setDisabled(!value);
            if (!value || !_locations[value]) {
                ilceSS.setOptions([]);
            } else {
                const ilceOpts = Object.entries(_locations[value])
                    .map(([ilce, id]) => ({ value: `${ilce}::${id}`, label: ilce }))
                    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
                ilceSS.setOptions(ilceOpts);
            }
            markDirty();
        }
    });

    const ilceSS = new SearchableSelect({
        container: ilceContainer,
        placeholder: '— Önce il seçin —',
        disabled: true,
        onSelect: () => markDirty()
    });

    // Lokasyonları yükle
    DataManager.loadLocations().then(locations => {
        _locations = locations;
        const ilOpts = Object.keys(locations).sort((a, b) => a.localeCompare(b, 'tr'))
            .map(il => ({ value: il, label: il }));
        ilSS.setOptions(ilOpts);

        // Mevcut seçimi doldur
        if (settings.il && settings.ilce) {
            ilSS.setValue(settings.il, settings.il);
            const ilceOpts = Object.entries(locations[settings.il])
                .map(([ilce, id]) => ({ value: `${ilce}::${id}`, label: ilce }))
                .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
            ilceSS.setOptions(ilceOpts);
            ilceSS.setDisabled(false);
            ilceSS.setValue(`${settings.ilce}::${settings.ilceId}`, settings.ilce);
        }
    });

    // Görünüm
    setVal('s-tema', settings.tema);
    setVal('s-ekran-yonu', settings.ekranYonu);
    setVal('s-yazi-boyu', settings.yaziBoyu);
    if (document.getElementById('s-dil')) {
        setVal('s-dil', settings.dil || 'tr');
        document.getElementById('s-dil').addEventListener('change', (e) => {
            if (window.I18n) window.I18n.setLanguage(e.target.value);
            markDirty();
        });
    }

    setCheck('s-goster-ayet', settings.gosterAyet);
    setCheck('s-goster-hadis', settings.gosterHadis);
    setCheck('s-goster-sabah', settings.gosterSabah);
    setCheck('s-goster-esma', settings.gosterEsma);
    setCheck('s-goster-dua', settings.gosterDua);
    setCheck('s-goster-camibilgi', settings.gosterCamiBilgi);
    setCheck('s-goster-imsakiye', settings.gosterImsakiye);
    setCheck('s-goster-ticker', settings.gosterTickerBant);
    setCheck('s-goster-hicri', settings.gosterHicriTarih);

    // Cami Bilgi Textarea Toggle Logic
    const camiBilgiToggle = document.getElementById('s-goster-camibilgi');
    const camiBilgiContainer = document.getElementById('s-camibilgi-container');
    const camiBilgiMetin = document.getElementById('s-camibilgi-metin');

    if (camiBilgiMetin) {
        camiBilgiMetin.value = settings.camiBilgiMetin || '';
    }

    function updateCamiBilgiPanel() {
        if (camiBilgiContainer) {
            camiBilgiContainer.style.display = camiBilgiToggle?.checked ? 'flex' : 'none';
        }
    }
    updateCamiBilgiPanel();

    if (camiBilgiToggle) {
        camiBilgiToggle.addEventListener('change', () => {
            updateCamiBilgiPanel();
            markDirty();
        });
    }
    if (camiBilgiMetin) {
        camiBilgiMetin.addEventListener('input', markDirty);
    }

    // Carousel süre
    const carouselSlider = document.getElementById('s-carousel-sure');
    const carouselVal = document.getElementById('s-carousel-sure-val');
    carouselSlider.value = settings.carouselSure;
    carouselVal.textContent = settings.carouselSure + 's';
    carouselSlider.addEventListener('input', () => {
        carouselVal.textContent = carouselSlider.value + 's';
        markDirty();
    });

    // Ezan
    setCheck('s-sabah-imsaga-gore', settings.sabahImsagaGore);
    const ezanSlider = document.getElementById('s-ezan-once');
    const ezanVal = document.getElementById('s-ezan-once-val');
    ezanSlider.value = settings.ezanOnceDk;
    ezanVal.textContent = settings.ezanOnceDk + 'dk';
    ezanSlider.addEventListener('input', () => {
        ezanVal.textContent = ezanSlider.value + 'dk';
        markDirty();
    });
    setCheck('s-goster-cemaat', settings.gosterCemaat);
    // Cemaat panel: toggle'a göre göster/gizle
    const cemaatPanel = document.getElementById('cemaat-offsets-panel');
    const cemaatToggle = document.getElementById('s-goster-cemaat');
    function updateCemaatPanel() {
        if (cemaatPanel) cemaatPanel.style.display = cemaatToggle?.checked ? 'block' : 'none';
    }
    updateCemaatPanel();
    if (cemaatToggle) cemaatToggle.addEventListener('change', () => { updateCemaatPanel(); markDirty(); });

    // Cemaat offset değerlerini yükle
    const cO = settings.cemaatOffsets || {};
    ['imsak', 'sabah', 'ogle', 'ikindi', 'aksam', 'yatsi'].forEach(k => {
        const el = document.getElementById('co-' + k);
        if (el) el.value = cO[k] ?? (k === 'ogle' || k === 'ikindi' || k === 'aksam' ? 15 : k === 'yatsi' ? 30 : 0);
    });

    // Auto Boot (Android/TV Kiosk)
    const autoBootBtn = document.getElementById('s-auto-boot');
    if (autoBootBtn) {
        if (window.AndroidBridge && typeof AndroidBridge.getAutoBoot === 'function') {
            autoBootBtn.checked = AndroidBridge.getAutoBoot();
            autoBootBtn.addEventListener('change', markDirty);
        } else {
            autoBootBtn.disabled = true;
            autoBootBtn.parentElement.parentElement.parentElement.style.opacity = '0.4';
        }
    }

    // ──────────────────────────────────────────────────────
    // KIOSK / MİMARİ — TELEFONDAN KURULUM (Ayarlar Sayfası İçi)
    // ──────────────────────────────────────────────────────
    const qrView = document.getElementById('settings-qr-view');
    const formView = document.getElementById('settings-form-view');

    // Sadece Android üzerinde (TV'de) ve ağ IP'si varken QR formunu varsayılan olarak göster
    if (window.AndroidBridge && typeof AndroidBridge.getLocalIPAddress === 'function' && qrView && formView) {
        const bridgeIp = AndroidBridge.getLocalIPAddress();
        if (bridgeIp && bridgeIp !== "0.0.0.0") {
            qrView.style.display = 'flex';
            formView.style.display = 'none';

            const qrUrl = `http://${bridgeIp}:8080/settings.html`;
            const urlTextElement = document.getElementById('settings-main-qr-url');
            if (urlTextElement) urlTextElement.textContent = qrUrl;

            const qrContainer = document.getElementById('settings-main-qr-container');
            if (qrContainer) {
                qrContainer.innerHTML = '';
                try {
                    new QRCode(qrContainer, {
                        text: qrUrl,
                        width: 250,
                        height: 250,
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
            const btnContinue = document.getElementById('btn-settings-continue-tv');
            if (btnContinue) {
                btnContinue.onclick = () => {
                    qrView.style.display = 'none';
                    formView.style.display = 'block';
                };
            }
        } else {
            // IP Yoksa doğrudan formu göster
            if (qrView) qrView.style.display = 'none';
            if (formView) formView.style.display = 'block';
        }
    } else {
        // TV dışındaki bir cihazdan (PC, Telefon tarayıcısı vb.) giriliyorsa formu göster
        if (qrView) qrView.style.display = 'none';
        if (formView) formView.style.display = 'block';
    }

    // Güç yönetimi
    setVal('s-guc-mod', settings.gucMod);
    document.getElementById('s-guc-acis').value = settings.gucAcisSaati;
    document.getElementById('s-guc-kapanis').value = settings.gucKapanisSaati;
    updateGucBlocks(settings.gucMod);

    document.getElementById('s-guc-mod').addEventListener('change', (e) => {
        updateGucBlocks(e.target.value);
        markDirty();
    });

    // Parlaklık
    initRange('s-parlaklik-aktif', settings.gucAktifParlaklik, '%');
    initRange('s-parlaklik-pasif', settings.gucPasifParlaklik, '%');

    // Vakit offset tablosu
    buildOffsetTable(settings.gucPrayerOffsets);

    // ESP32
    setCheck('s-esp32-aktif', settings.esp32Aktif);
    document.getElementById('s-esp32-ip').value = settings.esp32Ip || '';
    setCheck('s-esp32-sicaklik', settings.esp32Sicaklik);
    updateEsp32Block(settings.esp32Aktif);
    document.getElementById('s-esp32-aktif').addEventListener('change', (e) => {
        updateEsp32Block(e.target.checked);
        markDirty();
    });

    // Duyurular
    renderDuyurular();

    // Duyuru ekleme
    document.getElementById('s-duyuru-ekle')?.addEventListener('click', () => {
        const metinEl = document.getElementById('s-duyuru-metin');
        const tipEl = document.getElementById('s-duyuru-tip');
        const metin = metinEl.value.trim();
        if (!metin) return;

        SettingsManager.addDuyuru(metin, tipEl.value);
        metinEl.value = '';
        renderDuyurular();
    });

    // Tümünü sıfırla
    document.getElementById('s-sil-tumu')?.addEventListener('click', () => {
        if (confirm('Tüm ayarlar, indirilen vakitler ve önbellek silinecek. Emin misiniz?')) {
            localStorage.removeItem('cami_tv_settings');
            const req = indexedDB.deleteDatabase('cami_tv_db');
            req.onsuccess = () => { window.location.href = 'index.html'; };
            req.onerror = () => { window.location.href = 'index.html'; };
        }
    });

    // ──────────────────────────────────────────────────────
    // DEĞİŞİKLİK TAKİBİ
    // ──────────────────────────────────────────────────────
    document.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('change', markDirty);
        el.addEventListener('input', markDirty);
    });

    function markDirty() {
        if (isDirty) return;
        isDirty = true;
        document.getElementById('save-bar').classList.add('visible');
    }

    // ──────────────────────────────────────────────────────
    // UZAKTAN AYAR (QR KOD)
    // ──────────────────────────────────────────────────────
    if (window.AndroidBridge && typeof AndroidBridge.getLocalIPAddress === 'function') {
        const ip = AndroidBridge.getLocalIPAddress();
        if (ip && ip !== "" && location.protocol !== 'http:') {
            const qrBtn = document.getElementById('btn-remote-qr');
            if (qrBtn) {
                qrBtn.style.display = 'flex';
                qrBtn.addEventListener('click', () => {
                    const qrContainer = document.getElementById('qr-code-container');
                    const urlStr = `http://${ip}:8080/settings.html`;

                    document.getElementById('qr-url-text').textContent = urlStr;
                    qrContainer.innerHTML = ''; // Temizle
                    try {
                        new QRCode(qrContainer, {
                            text: urlStr,
                            width: 200,
                            height: 200,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                            correctLevel: QRCode.CorrectLevel.H
                        });
                    } catch (e) {
                        console.error('QR Oluşturulamadı:', e);
                    }

                    document.getElementById('qr-modal').classList.remove('hidden');
                });
            }
        }
    }

    // ──────────────────────────────────────────────────────
    // KAYDET
    // ──────────────────────────────────────────────────────
    document.getElementById('btn-save')?.addEventListener('click', async () => {
        const statusEl = document.getElementById('save-status');
        const btnSave = document.getElementById('btn-save');
        const s = SettingsManager.load();

        // Konum değişikliği kontrolü
        const il = ilSS.getValue();
        const ilceVal = ilceSS.getValue();
        let konumDegisti = false;

        if (il && ilceVal) {
            const ilceParts = ilceVal.split('::');
            const ilce = ilceParts[0];
            const ilceId = parseInt(ilceParts[1]);

            if (s.il !== il || s.ilceId !== ilceId) {
                if (!navigator.onLine) {
                    alert('Konum değişikliği için internet bağlantısı gereklidir.');
                    return;
                }

                statusEl.textContent = 'Önbellek temizleniyor...';
                statusEl.style.color = 'var(--text-primary)';
                if (btnSave) btnSave.disabled = true;

                s.il = il;
                s.ilce = ilce;
                s.ilceId = ilceId;

                // Eski verileri temizle
                await DataManager.clearAllData();

                // Yeni konum için vakitleri indir
                statusEl.textContent = 'Vakitler indiriliyor...';
                try {
                    await DataManager.downloadAndSetup(il, ilce, ilceId, (msg) => {
                        statusEl.textContent = msg;
                    });
                    konumDegisti = true;
                } catch (e) {
                    statusEl.textContent = '✗ Vakitler indirilemedi. İnternet bağlantısını kontrol edin.';
                    statusEl.style.color = '#f87171';
                    if (btnSave) btnSave.disabled = false;
                    return;
                }

                if (btnSave) btnSave.disabled = false;
            }
        }

        // Cami bilgileri
        s.camiAdi = camiAdiEl.value.trim() || 'Cami TV';

        // Görünüm
        s.tema = getVal('s-tema');
        s.ekranYonu = getVal('s-ekran-yonu');
        s.yaziBoyu = getVal('s-yazi-boyu');
        if (document.getElementById('s-dil')) {
            s.dil = getVal('s-dil');
        }

        // İçerik
        s.gosterAyet = getCheck('s-goster-ayet');
        s.gosterHadis = getCheck('s-goster-hadis');
        s.gosterSabah = getCheck('s-goster-sabah');
        s.gosterEsma = getCheck('s-goster-esma');
        s.gosterDua = getCheck('s-goster-dua');
        s.gosterCamiBilgi = getCheck('s-goster-camibilgi', false);
        s.camiBilgiMetin = document.getElementById('s-camibilgi-metin') ? document.getElementById('s-camibilgi-metin').value.trim() : '';
        s.gosterImsakiye = getCheck('s-goster-imsakiye');
        s.gosterTickerBant = getCheck('s-goster-ticker');
        s.gosterHicriTarih = getCheck('s-goster-hicri');
        s.carouselSure = parseInt(carouselSlider.value) || 15;

        // Ezan & Cemaat
        s.sabahImsagaGore = getCheck('s-sabah-imsaga-gore');
        s.ezanOnceDk = parseInt(ezanSlider.value) || 15;
        s.gosterCemaat = getCheck('s-goster-cemaat');
        s.cemaatOffsets = {
            imsak: parseInt(document.getElementById('co-imsak')?.value) || 0,
            sabah: parseInt(document.getElementById('co-sabah')?.value) || 0,
            ogle: parseInt(document.getElementById('co-ogle')?.value) || 0,
            ikindi: parseInt(document.getElementById('co-ikindi')?.value) || 0,
            aksam: parseInt(document.getElementById('co-aksam')?.value) || 0,
            yatsi: parseInt(document.getElementById('co-yatsi')?.value) || 0,
        };

        // Auto Boot (Android/TV)
        if (window.AndroidBridge && typeof AndroidBridge.setAutoBoot === 'function') {
            AndroidBridge.setAutoBoot(getCheck('s-auto-boot'));
        }

        // Güç yönetimi
        s.gucMod = getVal('s-guc-mod');
        s.gucAcisSaati = document.getElementById('s-guc-acis').value;
        s.gucKapanisSaati = document.getElementById('s-guc-kapanis').value;
        s.gucAktifParlaklik = parseInt(document.getElementById('s-parlaklik-aktif').value);
        s.gucPasifParlaklik = parseInt(document.getElementById('s-parlaklik-pasif').value);

        // Offset tablosu
        readOffsetTable(s.gucPrayerOffsets);

        // ESP32
        s.esp32Aktif = getCheck('s-esp32-aktif');
        s.esp32Ip = document.getElementById('s-esp32-ip').value.trim();
        s.esp32Sicaklik = getCheck('s-esp32-sicaklik');

        const ok = SettingsManager.save(s);
        if (ok) {
            // Eğer telefon tarayıcısından (HTTP) açılmışsa ayarları TV'ye gönder
            if (location.protocol === 'http:') {
                fetch('/api/save', { method: 'POST', body: JSON.stringify(s) })
                    .then(() => {
                        statusEl.textContent = '✓ TV\'ye Gönderildi';
                        statusEl.style.color = 'var(--accent)';
                        isDirty = false;
                        setTimeout(() => location.reload(), 1500);
                    })
                    .catch(err => {
                        statusEl.textContent = '✗ Gönderim hatası';
                        statusEl.style.color = '#f87171';
                    });
                return;
            }

            statusEl.textContent = '✓ Kaydedildi';
            statusEl.style.color = 'var(--accent)';
            isDirty = false;
            setTimeout(() => {
                document.getElementById('save-bar').classList.remove('visible');
                statusEl.textContent = '';
                // Dinamik konum değişikliği sonrası veya normal kaydetme sonrası sayfayı yenilemek en temizi
                if (konumDegisti) {
                    location.href = 'index.html';
                }
            }, 1000);
        } else {
            statusEl.textContent = '✗ Kaydetme hatası';
            statusEl.style.color = '#f87171';
        }
    });

    // ──────────────────────────────────────────────────────
    // YARDIMCI FONKSİYONLAR
    // ──────────────────────────────────────────────────────
    function setVal(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function getVal(id) {
        return document.getElementById(id)?.value || '';
    }

    function setCheck(id, value) {
        const el = document.getElementById(id);
        if (el) el.checked = !!value;
    }

    function getCheck(id) {
        return document.getElementById(id)?.checked || false;
    }

    function initRange(id, value, suffix) {
        const slider = document.getElementById(id);
        const valEl = document.getElementById(id + '-val');
        if (!slider || !valEl) return;
        slider.value = value;
        valEl.textContent = value + suffix;
        slider.addEventListener('input', () => {
            valEl.textContent = slider.value + suffix;
            markDirty();
        });
    }

    function updateGucBlocks(mod) {
        const fixedBlock = document.getElementById('s-guc-fixed-block');
        const prayerBlock = document.getElementById('s-guc-prayer-block');
        fixedBlock.classList.toggle('hidden', mod !== 'fixed' && mod !== 'hybrid');
        prayerBlock.classList.toggle('hidden', mod !== 'prayer' && mod !== 'hybrid');
    }

    function updateEsp32Block(aktif) {
        document.getElementById('s-esp32-details')?.classList.toggle('hidden', !aktif);
    }

    // ──────────────────────────────────────────────────────
    // OFFSET TABLOSU — oluştur & oku
    // ──────────────────────────────────────────────────────
    function buildOffsetTable(offsets) {
        const tbody = document.getElementById('s-offset-tbody');
        if (!tbody) return;

        const vakitler = [
            { key: 'imsak', label: '🌙 İmsak' },
            { key: 'sabah', label: '🌅 Sabah' },
            { key: 'gunes', label: '☀️ Güneş' },
            { key: 'ogle', label: '🕐 Öğle' },
            { key: 'ikindi', label: '🌤️ İkindi' },
            { key: 'aksam', label: '🌆 Akşam' },
            { key: 'yatsi', label: '🌃 Yatsı' },
            { key: 'cuma', label: '🕌 Cuma' },
            { key: 'bayram', label: '☪️ Bayram' },
        ];

        tbody.innerHTML = '';
        vakitler.forEach(({ key, label }) => {
            const cfg = offsets[key] || { aktif: false, onceDk: 0, sonraDk: 0 };
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td class="vakit-name">${label}</td>
        <td><label class="toggle-switch" style="margin:0 auto;">
          <input type="checkbox" data-offset-key="${key}" data-offset-field="aktif" ${cfg.aktif ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label></td>
        <td><input type="number" data-offset-key="${key}" data-offset-field="onceDk" value="${cfg.onceDk}" min="0" max="120"></td>
        <td><input type="number" data-offset-key="${key}" data-offset-field="sonraDk" value="${cfg.sonraDk}" min="0" max="120"></td>
      `;
            tbody.appendChild(tr);
        });
    }

    function readOffsetTable(offsets) {
        document.querySelectorAll('[data-offset-key]').forEach(el => {
            const key = el.dataset.offsetKey;
            const field = el.dataset.offsetField;
            if (!offsets[key]) offsets[key] = { aktif: false, onceDk: 0, sonraDk: 0 };
            if (field === 'aktif') {
                offsets[key].aktif = el.checked;
            } else {
                offsets[key][field] = parseInt(el.value) || 0;
            }
        });
    }

    // ──────────────────────────────────────────────────────
    // DUYURU LİSTESİ
    // ──────────────────────────────────────────────────────
    function renderDuyurular() {
        const listEl = document.getElementById('s-duyuru-list');
        if (!listEl) return;

        const duyurular = SettingsManager.load().duyurular || [];

        if (duyurular.length === 0) {
            listEl.innerHTML = `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.82rem;">Henüz duyuru eklenmedi.</div>`;
            return;
        }

        listEl.innerHTML = '';
        duyurular.forEach(d => {
            const item = document.createElement('div');
            item.className = 'duyuru-item';
            item.innerHTML = `
        <span class="duyuru-tip ${d.tip}">${d.tip.toUpperCase()}</span>
        <span class="duyuru-text">${d.metin}</span>
        <button class="btn-delete" data-duyuru-id="${d.id}" aria-label="Sil">✕</button>
      `;
            listEl.appendChild(item);
        });

        // Silme butonları
        listEl.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.duyuruId);
                SettingsManager.removeDuyuru(id);
                renderDuyurular();
            });
        });
    }

}

// DOMContentLoaded zamanlamasını güvenli şekilde ele al
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsPage);
} else {
    initSettingsPage();
}
