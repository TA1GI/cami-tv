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

    // Hava Durumu
    setCheck('s-goster-hava', settings.gosterHavaDurumu);

    // ──────────────────────────────────────────────────────
    // ARKAPLAN RESİM
    // ──────────────────────────────────────────────────────
    const btnArkaplanSec = document.getElementById('btn-arkaplan-sec');
    const arkaplanDosya = document.getElementById('s-arkaplan-dosya');
    const arkaplanAyarlari = document.getElementById('arkaplan-ayarlari');
    const arkaplanOnizleme = document.getElementById('arkaplan-onizleme');
    const btnArkaplanKaldir = document.getElementById('btn-arkaplan-kaldir');
    const arkaplanOpaklik = document.getElementById('s-arkaplan-opaklik');
    const arkaplanOpaklikVal = document.getElementById('s-arkaplan-opaklik-val');
    const arkaplanBlur = document.getElementById('s-arkaplan-blur');
    const arkaplanBlurVal = document.getElementById('s-arkaplan-blur-val');

    // Mevcut resmi yükle
    if (settings.arkaplanResim && settings.arkaplanResim.length > 0) {
        if (arkaplanAyarlari) arkaplanAyarlari.style.display = 'block';
        if (arkaplanOnizleme) {
            let previewUrl = settings.arkaplanResim;
            // Android dosya yolları → file:// prefix ekle (TV'de yerel erişim)
            if (previewUrl.startsWith('/data/') || previewUrl.startsWith('/storage/')) {
                previewUrl = 'file://' + previewUrl;
            }
            // HTTP relative URL (/api/bg-image?t=...) ve base64 data URI olduğu gibi çalışır
            arkaplanOnizleme.style.backgroundImage = `url(${previewUrl})`;
        }
    }
    if (arkaplanOpaklik) {
        arkaplanOpaklik.value = settings.arkaplanOpaklık || 15;
        arkaplanOpaklikVal.textContent = '%' + (settings.arkaplanOpaklık || 15);
        arkaplanOpaklik.addEventListener('input', () => {
            arkaplanOpaklikVal.textContent = '%' + arkaplanOpaklik.value;
            markDirty();
        });
    }
    if (arkaplanBlur) {
        arkaplanBlur.value = settings.arkaplanBulaniklik || 0;
        arkaplanBlurVal.textContent = (settings.arkaplanBulaniklik || 0) + 'px';
        arkaplanBlur.addEventListener('input', () => {
            arkaplanBlurVal.textContent = arkaplanBlur.value + 'px';
            markDirty();
        });
    }

    if (btnArkaplanSec) {
        btnArkaplanSec.addEventListener('click', () => arkaplanDosya?.click());
    }

    if (arkaplanDosya) {
        arkaplanDosya.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                // Canvas ile küçült (max 1920x1080, %70 kalite)
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width;
                    let h = img.height;
                    const maxW = 1920, maxH = 1080;
                    if (w > maxW || h > maxH) {
                        const ratio = Math.min(maxW / w, maxH / h);
                        w = Math.round(w * ratio);
                        h = Math.round(h * ratio);
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                    settings.arkaplanResim = dataUrl;
                    if (arkaplanOnizleme) arkaplanOnizleme.style.backgroundImage = `url(${dataUrl})`;
                    if (arkaplanAyarlari) arkaplanAyarlari.style.display = 'block';
                    markDirty();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnArkaplanKaldir) {
        btnArkaplanKaldir.addEventListener('click', () => {
            settings.arkaplanResim = '';
            if (arkaplanOnizleme) arkaplanOnizleme.style.backgroundImage = '';
            if (arkaplanAyarlari) arkaplanAyarlari.style.display = 'none';
            markDirty();
        });
    }

    // ──────────────────────────────────────────────────────
    // İÇERİK TOGGLE + ALT AYARLAR (per-content)
    // ──────────────────────────────────────────────────────
    const CONTENT_TYPES = [
        { key: 'ayet', toggleId: 's-goster-ayet', settingKey: 'gosterAyet' },
        { key: 'hadis', toggleId: 's-goster-hadis', settingKey: 'gosterHadis' },
        { key: 'esma', toggleId: 's-goster-esma', settingKey: 'gosterEsma' },
        { key: 'dua', toggleId: 's-goster-dua', settingKey: 'gosterDua' },
        { key: 'imsakiye', toggleId: 's-goster-imsakiye', settingKey: 'gosterImsakiye' },
        { key: 'camibilgi', toggleId: 's-goster-camibilgi', settingKey: 'gosterCamiBilgi' },
    ];

    const ia = settings.icerikAyarlari || {};

    CONTENT_TYPES.forEach(ct => {
        const toggle = document.getElementById(ct.toggleId);
        const subPanel = document.getElementById('sub-' + ct.key);
        const sureSlider = document.getElementById('s-sure-' + ct.key);
        const sureVal = document.getElementById('s-sure-' + ct.key + '-val');
        const yaziSlider = document.getElementById('s-yazi-' + ct.key);
        const yaziVal = document.getElementById('s-yazi-' + ct.key + '-val');

        // Toggle durumunu yükle
        if (toggle) setCheck(ct.toggleId, settings[ct.settingKey]);

        // Alt panel ayarlarını yükle
        const cfg = ia[ct.key] || {};
        const sure = cfg.sure ?? 15;
        const yazi = cfg.yaziBoyu ?? 100;

        if (sureSlider) {
            sureSlider.value = sure;
            sureVal.textContent = sure + 's';
            sureSlider.addEventListener('input', () => {
                sureVal.textContent = sureSlider.value + 's';
                markDirty();
            });
        }
        if (yaziSlider) {
            yaziSlider.value = yazi;
            yaziVal.textContent = '%' + yazi;
            yaziSlider.addEventListener('input', () => {
                yaziVal.textContent = '%' + yaziSlider.value;
                markDirty();
            });
        }

        // Alt paneli toggle durumuna göre göster/gizle
        function updateSubPanel() {
            if (subPanel) subPanel.style.display = toggle?.checked ? 'block' : 'none';
        }
        updateSubPanel();

        if (toggle) {
            toggle.addEventListener('change', () => {
                updateSubPanel();
                markDirty();
            });
        }
    });

    // ──────────────────────────────────────────────────────
    // Cami Bilgi Listesi (Dinamik Çoklu Metin)
    // ──────────────────────────────────────────────────────
    const camiBilgiListEl = document.getElementById('s-camibilgi-list');
    const btnAddCamiBilgi = document.getElementById('btn-add-camibilgi');
    let currentCamiBilgi = Array.isArray(settings.camiBilgiMetin) ? [...settings.camiBilgiMetin] : [];

    function renderCamiBilgiList() {
        if (!camiBilgiListEl) return;
        camiBilgiListEl.innerHTML = '';

        if (currentCamiBilgi.length === 0) {
            // Eğer boşsa, en az 1 tane boş kutu gösterelim
            currentCamiBilgi.push('');
        }

        currentCamiBilgi.forEach((metin, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'camibilgi-item';

            const textarea = document.createElement('textarea');
            textarea.className = 'form-input camibilgi-input';
            textarea.rows = 3;
            textarea.placeholder = I18n.get('camibilgi_placeholder') || 'Caminizin adı, adresi, vakıf bilgileri vb.';
            textarea.value = metin;
            textarea.style.cssText = 'width: 100%; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-card); color: var(--text-primary); padding: 10px; font-family: inherit; resize: vertical;';

            textarea.addEventListener('input', (e) => {
                currentCamiBilgi[index] = e.target.value;
                markDirty();
            });

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-danger-small';
            btnDel.innerHTML = '🗑️';
            btnDel.title = 'Sil';
            btnDel.onclick = () => {
                // Son kutuyu siliyorsa içini boşalt, tamamen yok etme
                if (currentCamiBilgi.length === 1) {
                    currentCamiBilgi[0] = '';
                } else {
                    currentCamiBilgi.splice(index, 1);
                }
                renderCamiBilgiList();
                markDirty();
            };

            const headerWrapper = document.createElement('div');
            headerWrapper.style.display = 'flex';
            headerWrapper.style.justifyContent = 'space-between';
            headerWrapper.style.alignItems = 'center';
            headerWrapper.style.marginBottom = '5px';

            const titleLabel = document.createElement('label');
            titleLabel.style.fontSize = '0.8rem';
            titleLabel.style.color = 'var(--accent)';
            titleLabel.innerText = `Slayt ${index + 1}`;

            headerWrapper.appendChild(titleLabel);
            headerWrapper.appendChild(btnDel);

            itemDiv.appendChild(headerWrapper);
            itemDiv.appendChild(textarea);
            camiBilgiListEl.appendChild(itemDiv);
        });
    }

    if (btnAddCamiBilgi) {
        btnAddCamiBilgi.addEventListener('click', () => {
            currentCamiBilgi.push('');
            renderCamiBilgiList();
            markDirty();
        });
    }

    // İlk render
    renderCamiBilgiList();

    setCheck('s-goster-sabah', settings.gosterSabah);
    setCheck('s-goster-ticker', settings.gosterTickerBant);
    setCheck('s-goster-hicri', settings.gosterHicriTarih);

    // ── Cuma Yardımı ──────────────────────────────────────
    setCheck('s-goster-cuma-yardimi', settings.gosterCumaYardimi);
    const cumaYardimSubPanel = document.getElementById('sub-cuma-yardimi');
    const cumaYardimToggle = document.getElementById('s-goster-cuma-yardimi');
    function updateCumaYardimPanel() {
        if (cumaYardimSubPanel) cumaYardimSubPanel.style.display = cumaYardimToggle?.checked ? 'block' : 'none';
    }
    updateCumaYardimPanel();
    if (cumaYardimToggle) cumaYardimToggle.addEventListener('change', () => { updateCumaYardimPanel(); markDirty(); });

    const baslangicEl = document.getElementById('s-cuma-yardim-baslangic');
    const bitisEl = document.getElementById('s-cuma-yardim-bitis');
    if (baslangicEl) { baslangicEl.value = settings.cumaYardimBaslangicDk ?? 15; baslangicEl.addEventListener('input', markDirty); }
    if (bitisEl) { bitisEl.value = settings.cumaYardimBitisDk ?? 45; bitisEl.addEventListener('input', markDirty); }
    setVal('s-cuma-yardim-gorunum', settings.cumaYardimGorunum || 'tam-ekran');

    const cumaMetinler = settings.cumaYardimMetinler || {};
    const cumaMetinTr = document.getElementById('s-cuma-metin-tr');
    const cumaMetinAr = document.getElementById('s-cuma-metin-ar');
    const cumaMetinEn = document.getElementById('s-cuma-metin-en');
    if (cumaMetinTr) { cumaMetinTr.value = cumaMetinler.tr || ''; cumaMetinTr.addEventListener('input', markDirty); }
    if (cumaMetinAr) { cumaMetinAr.value = cumaMetinler.ar || ''; cumaMetinAr.addEventListener('input', markDirty); }
    if (cumaMetinEn) { cumaMetinEn.value = cumaMetinler.en || ''; cumaMetinEn.addEventListener('input', markDirty); }

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
            // TV WebView'ından açılmış — native değeri oku
            autoBootBtn.checked = AndroidBridge.getAutoBoot();
        } else {
            // Telefondan açılmış — settings JSON'dan oku (varsayılan: true)
            autoBootBtn.checked = settings.autoBoot !== undefined ? settings.autoBoot : true;
        }
        autoBootBtn.addEventListener('change', markDirty);
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

    let editDuyuruId = null;
    const duyuruGorunumEl = document.getElementById('s-duyuru-gorunum');
    const duyuruTamEkranModuWrapEl = document.getElementById('s-duyuru-tam-ekran-modu-wrap');
    const duyuruTamEkranModuEl = document.getElementById('s-duyuru-tam-ekran-modu');

    function updateTamEkranModuVisibility() {
        const isTamEkran = duyuruGorunumEl?.value === 'tam-ekran';
        if (duyuruTamEkranModuWrapEl) {
            duyuruTamEkranModuWrapEl.style.display = isTamEkran ? 'block' : 'none';
        }
        if (!isTamEkran && duyuruTamEkranModuEl) {
            duyuruTamEkranModuEl.value = 'surekli';
        }
    }

    if (duyuruGorunumEl) {
        duyuruGorunumEl.addEventListener('change', () => {
            updateTamEkranModuVisibility();
            markDirty();
        });
    }
    updateTamEkranModuVisibility();

    // Gelişmiş duyuru ekleme / düzenleme
    document.getElementById('s-duyuru-ekle')?.addEventListener('click', () => {
        const metinEl = document.getElementById('s-duyuru-metin');
        const metin = metinEl?.value?.trim();
        if (!metin) { alert('Lütfen en az Türkçe metin girin.'); return; }

        // Gün seçimlerini topla
        const gunler = [];
        document.querySelectorAll('#s-duyuru-gunler input[type=checkbox]:checked').forEach(cb => {
            gunler.push(parseInt(cb.value));
        });

        const duyuruData = {
            metin: metin,
            metinAr: document.getElementById('s-duyuru-metin-ar')?.value?.trim() || '',
            metinEn: document.getElementById('s-duyuru-metin-en')?.value?.trim() || '',
            tip: document.getElementById('s-duyuru-tip')?.value || 'normal',
            gorunum: document.getElementById('s-duyuru-gorunum')?.value || 'carousel',
            tamEkranModu: document.getElementById('s-duyuru-tam-ekran-modu')?.value || 'surekli',
            tekrar: document.getElementById('s-duyuru-tekrar')?.value || 'kalici',
            gunler: gunler,
            zamanBaslangic: document.getElementById('s-duyuru-zaman-baslangic')?.value || '',
            zamanBitis: document.getElementById('s-duyuru-zaman-bitis')?.value || '',
            tarihBaslangic: document.getElementById('s-duyuru-tarih-baslangic')?.value || '',
            tarihBitis: document.getElementById('s-duyuru-tarih-bitis')?.value || '',
        };

        if (editDuyuruId !== null) {
            SettingsManager.updateDuyuru(editDuyuruId, duyuruData);
            editDuyuruId = null;
            document.getElementById('s-duyuru-ekle').textContent = '📢 Duyuru Ekle';
            document.getElementById('s-duyuru-iptal').style.display = 'none';
        } else {
            SettingsManager.addDuyuru(duyuruData);
        }

        // Formu temizle
        if (metinEl) metinEl.value = '';
        const metinArEl = document.getElementById('s-duyuru-metin-ar');
        const metinEnEl = document.getElementById('s-duyuru-metin-en');
        if (metinArEl) metinArEl.value = '';
        if (metinEnEl) metinEnEl.value = '';
        document.querySelectorAll('#s-duyuru-gunler input[type=checkbox]').forEach(cb => cb.checked = false);
        const zamanBas = document.getElementById('s-duyuru-zaman-baslangic');
        const zamanBit = document.getElementById('s-duyuru-zaman-bitis');
        const tarihBas = document.getElementById('s-duyuru-tarih-baslangic');
        const tarihBit = document.getElementById('s-duyuru-tarih-bitis');
        if (zamanBas) zamanBas.value = '';
        if (zamanBit) zamanBit.value = '';
        if (tarihBas) tarihBas.value = '';
        if (tarihBit) tarihBit.value = '';
        const tipEl = document.getElementById('s-duyuru-tip');
        const gorunumEl = document.getElementById('s-duyuru-gorunum');
        const tekrarEl = document.getElementById('s-duyuru-tekrar');
        if (tipEl) tipEl.value = 'normal';
        if (gorunumEl) gorunumEl.value = 'carousel';
        if (tekrarEl) tekrarEl.value = 'kalici';
        if (duyuruTamEkranModuEl) duyuruTamEkranModuEl.value = 'surekli';
        updateTamEkranModuVisibility();

        renderDuyurular();
    });

    document.getElementById('s-duyuru-iptal')?.addEventListener('click', () => {
        editDuyuruId = null;
        document.getElementById('s-duyuru-ekle').textContent = '📢 Duyuru Ekle';
        document.getElementById('s-duyuru-iptal').style.display = 'none';
        
        // Formu temizle
        document.getElementById('s-duyuru-metin').value = '';
        document.getElementById('s-duyuru-metin-ar').value = '';
        document.getElementById('s-duyuru-metin-en').value = '';
        document.querySelectorAll('#s-duyuru-gunler input[type=checkbox]').forEach(cb => cb.checked = false);
        document.getElementById('s-duyuru-zaman-baslangic').value = '';
        document.getElementById('s-duyuru-zaman-bitis').value = '';
        document.getElementById('s-duyuru-tarih-baslangic').value = '';
        document.getElementById('s-duyuru-tarih-bitis').value = '';
        document.getElementById('s-duyuru-tip').value = 'normal';
        document.getElementById('s-duyuru-gorunum').value = 'carousel';
        document.getElementById('s-duyuru-tekrar').value = 'kalici';
        if (duyuruTamEkranModuEl) duyuruTamEkranModuEl.value = 'surekli';
        updateTamEkranModuVisibility();
    });

    // Tümünü sıfırla
    document.getElementById('s-sil-tumu')?.addEventListener('click', () => {
        if (confirm('Tüm ayarlar, indirilen vakitler ve önbellek silinecek. Emin misiniz?')) {
            if (location.protocol === 'http:') {
                // Telefondan TV'ye sıfırlama komutu gönder
                fetch('/api/reset', { method: 'POST' })
                    .then(() => {
                        localStorage.removeItem('cami_tv_settings');
                        window.location.href = 'index.html';
                    })
                    .catch(err => alert('Sıfırlama hatası (TV ulaşılamıyor olabilir).'));
            } else {
                localStorage.removeItem('cami_tv_settings');
                const req = indexedDB.deleteDatabase('cami_tv_db');
                req.onsuccess = () => { window.location.href = 'index.html'; };
                req.onerror = () => { window.location.href = 'index.html'; };
            }
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

        // Hava durumu
        s.gosterHavaDurumu = getCheck('s-goster-hava');

        // Arkaplan resim
        s.arkaplanResim = settings.arkaplanResim || '';
        s.arkaplanOpaklık = parseInt(document.getElementById('s-arkaplan-opaklik')?.value) || 15;
        s.arkaplanBulaniklik = parseInt(document.getElementById('s-arkaplan-blur')?.value) || 0;

        // İçerik toggle'ları ve per-content ayarları
        CONTENT_TYPES.forEach(ct => {
            s[ct.settingKey] = getCheck(ct.toggleId);
            if (!s.icerikAyarlari) s.icerikAyarlari = {};
            if (!s.icerikAyarlari[ct.key]) s.icerikAyarlari[ct.key] = {};
            const sureEl = document.getElementById('s-sure-' + ct.key);
            const yaziEl = document.getElementById('s-yazi-' + ct.key);
            s.icerikAyarlari[ct.key].sure = parseInt(sureEl?.value) || 15;
            s.icerikAyarlari[ct.key].yaziBoyu = parseInt(yaziEl?.value) || 100;
        });
        s.camiBilgiMetin = currentCamiBilgi.map(m => m.trim()).filter(m => m !== '');
        s.gosterSabah = getCheck('s-goster-sabah');
        s.gosterTickerBant = getCheck('s-goster-ticker');
        s.gosterHicriTarih = getCheck('s-goster-hicri');

        // Cuma Yardımı
        s.gosterCumaYardimi = getCheck('s-goster-cuma-yardimi');
        s.cumaYardimBaslangicDk = parseInt(document.getElementById('s-cuma-yardim-baslangic')?.value) || 15;
        s.cumaYardimBitisDk = parseInt(document.getElementById('s-cuma-yardim-bitis')?.value) || 45;
        s.cumaYardimGorunum = getVal('s-cuma-yardim-gorunum') || 'tam-ekran';
        s.cumaYardimMetinler = {
            tr: document.getElementById('s-cuma-metin-tr')?.value.trim() || '',
            ar: document.getElementById('s-cuma-metin-ar')?.value.trim() || '',
            en: document.getElementById('s-cuma-metin-en')?.value.trim() || '',
        };

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

        // Auto Boot (Android/TV) — her zaman settings JSON'a kaydet
        s.autoBoot = getCheck('s-auto-boot');
        if (window.AndroidBridge && typeof AndroidBridge.setAutoBoot === 'function') {
            AndroidBridge.setAutoBoot(s.autoBoot);
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

        const GUN_ISIMLERI = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
        const GORUNUM_MAP = { carousel: 'Slayt', 'tam-ekran': 'Tam Ekran', 'sadece-ticker': 'Ticker' };
        const TAM_EKRAN_MOD_MAP = { surekli: 'Sürekli', sirali: 'Sıralı' };
        const TEKRAR_MAP = { kalici: 'Kalıcı', gunluk: 'Günlük', haftalik: 'Haftalık', 'tek-sefer': 'Tek Sefer' };

        listEl.innerHTML = '';
        duyurular.forEach(d => {
            const item = document.createElement('div');
            item.className = 'duyuru-item';

            // Detay bilgileri
            let detaylar = [];
            const gorunumLabel = GORUNUM_MAP[d.gorunum] || 'Slayt';
            const tekrarLabel = TEKRAR_MAP[d.tekrar] || 'Kalıcı';
            detaylar.push(gorunumLabel);
            if ((d.gorunum || 'carousel') === 'tam-ekran') {
                detaylar.push(`Mod: ${TAM_EKRAN_MOD_MAP[d.tamEkranModu || 'surekli'] || 'Sürekli'}`);
            }
            detaylar.push(tekrarLabel);

            if (d.gunler && d.gunler.length > 0 && d.gunler.length < 7) {
                detaylar.push(d.gunler.map(g => GUN_ISIMLERI[g]).join(','));
            }
            if (d.zamanBaslangic || d.zamanBitis) {
                detaylar.push(`${d.zamanBaslangic || '...'}-${d.zamanBitis || '...'}`);
            }

            const dilBadges = [
                d.metin ? 'TR' : '',
                d.metinAr ? 'AR' : '',
                d.metinEn ? 'EN' : '',
            ].filter(Boolean).join(' ');

            item.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
            <span class="duyuru-tip ${d.tip}">${d.tip.toUpperCase()}</span>
            ${dilBadges ? `<span style="font-size:0.65rem;color:var(--text-muted);">${dilBadges}</span>` : ''}
          </div>
          <div class="duyuru-text">${d.metin}</div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">${detaylar.join(' · ')}</div>
        </div>
        <div style="display:flex;gap:4px;">
            <button class="btn-edit" data-duyuru-id="${d.id}" aria-label="Düzenle" style="background:transparent;border:none;cursor:pointer;opacity:0.7;">✏️</button>
            <button class="btn-delete" data-duyuru-id="${d.id}" aria-label="Sil">✕</button>
        </div>
      `;
            listEl.appendChild(item);
        });

        // Düzenle butonları
        listEl.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = parseInt(btn.dataset.duyuruId);
                const d = duyurular.find(x => x.id === id);
                if (!d) return;

                editDuyuruId = id;
                document.getElementById('s-duyuru-metin').value = d.metin || '';
                document.getElementById('s-duyuru-metin-ar').value = d.metinAr || '';
                document.getElementById('s-duyuru-metin-en').value = d.metinEn || '';
                document.getElementById('s-duyuru-tip').value = d.tip || 'normal';
                document.getElementById('s-duyuru-gorunum').value = d.gorunum || 'carousel';
                if (duyuruTamEkranModuEl) duyuruTamEkranModuEl.value = d.tamEkranModu || 'surekli';
                document.getElementById('s-duyuru-tekrar').value = d.tekrar || 'kalici';
                document.getElementById('s-duyuru-zaman-baslangic').value = d.zamanBaslangic || '';
                document.getElementById('s-duyuru-zaman-bitis').value = d.zamanBitis || '';
                document.getElementById('s-duyuru-tarih-baslangic').value = d.tarihBaslangic || '';
                document.getElementById('s-duyuru-tarih-bitis').value = d.tarihBitis || '';
                updateTamEkranModuVisibility();

                // Günleri seç
                document.querySelectorAll('#s-duyuru-gunler input[type=checkbox]').forEach(cb => {
                    const val = parseInt(cb.value);
                    cb.checked = d.gunler && d.gunler.includes(val);
                });

                document.getElementById('s-duyuru-ekle').textContent = '💾 Değişiklikleri Kaydet';
                document.getElementById('s-duyuru-iptal').style.display = 'block';

                // Ekranda form görünecek şekilde scroll
                document.querySelector('.duyuru-add-form').scrollIntoView({ behavior: 'smooth' });
            });
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
