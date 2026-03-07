/**
 * CAMI TV — content-editor.js
 * İçerik düzenleyici sayfa mantığı.
 * Ayet, Hadis, Dua, Esmâ yönetimi.
 * Telefondan düzenlenir → /api/save ile TV'ye gönderilir → Carousel otomatik güncellenir.
 */

(function () {

    const TABS = ['ayetler', 'hadisler', 'dualar', 'esmaulhusna'];

    // Her tab'ın alan yapısı (JSON'dan analiz edilmiş)
    const FIELD_DEFS = {
        ayetler: [
            { key: 'arapca', label: 'Arapça Metin', type: 'textarea', rtl: true },
            { key: 'turkce', label: 'Türkçe Meal', type: 'textarea' },
            { key: 'referans', label: 'Referans (Ör: Bakara 2:255)', type: 'input' },
        ],
        hadisler: [
            { key: 'arapca', label: 'Arapça Metin', type: 'textarea', rtl: true },
            { key: 'turkce', label: 'Türkçe Anlam', type: 'textarea' },
            { key: 'referans', label: 'Referans (Ör: Buhârî, Savm, 5)', type: 'input' },
        ],
        dualar: [
            { key: 'baslik', label: 'Başlık (Ör: Camiye Girme Duası)', type: 'input' },
            { key: 'arapca', label: 'Arapça Metin', type: 'textarea', rtl: true },
            { key: 'turkce', label: 'Türkçe Okunuş', type: 'textarea' },
            { key: 'anlam', label: 'Türkçe Anlam', type: 'textarea' },
        ],
        esmaulhusna: [
            { key: 'arapca', label: 'Arapça İsim', type: 'input', rtl: true },
            { key: 'turkce', label: 'Türkçe İsim (Ör: Er-Rahmân)', type: 'input' },
            { key: 'anlam', label: 'Anlam', type: 'textarea' },
        ],
    };

    let _activeTab = 'ayetler';
    let _originalData = {};    // Sunucudan gelen orijinal JSON'lar
    let _settings = null;      // SettingsManager'dan yüklenen
    let _customContent = null; // _settings.customContent referansı
    let _isDirty = false;
    let _selectedIds = new Set();

    // ──────────────────────────────────────────────────────
    // Tema uygula
    // ──────────────────────────────────────────────────────
    _settings = SettingsManager.load();
    if (_settings.tema && _settings.tema !== 'default' && _settings.tema !== 'auto') {
        document.documentElement.setAttribute('data-theme', _settings.tema);
    }
    if (typeof I18n !== 'undefined') {
        I18n.setLanguage(_settings.dil || 'tr');
    }

    // ──────────────────────────────────────────────────────
    // Başlatma
    // ──────────────────────────────────────────────────────
    async function init() {
        // customContent'i settings'ten yükle
        _customContent = _settings.customContent || {
            custom: { ayetler: [], hadisler: [], dualar: [], esmaulhusna: [] },
            disabled: { ayetler: [], hadisler: [], dualar: [], esmaulhusna: [] },
        };
        // Alt alanları garanti et
        TABS.forEach(t => {
            if (!_customContent.custom[t]) _customContent.custom[t] = [];
            if (!_customContent.disabled[t]) _customContent.disabled[t] = [];
        });

        // Orijinal verileri yükle (DataManager varsa onu tercih et, yoksa fetch)
        for (const tab of TABS) {
            try {
                if (typeof DataManager !== 'undefined' && DataManager.loadContent) {
                    _originalData[tab] = await DataManager.loadContent(tab);
                } else {
                    const res = await fetch(`data/${tab}.json`);
                    if (res.ok) _originalData[tab] = await res.json();
                    else _originalData[tab] = [];
                }
            } catch (e) {
                _originalData[tab] = [];
            }
        }

        // Tab event'leri
        document.querySelectorAll('.ce-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                _activeTab = btn.dataset.tab;
                document.querySelectorAll('.ce-tab').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                _selectedIds.clear();
                document.getElementById('ce-select-all').checked = false;
                render();
            });
        });

        // Search & filter
        document.getElementById('ce-search').addEventListener('input', render);
        document.getElementById('ce-filter').addEventListener('change', render);

        // Select all
        document.getElementById('ce-select-all').addEventListener('change', (e) => {
            const items = getFilteredItems();
            if (e.target.checked) {
                items.forEach(item => _selectedIds.add(itemUID(item)));
            } else {
                _selectedIds.clear();
            }
            render();
        });

        // Bulk actions
        document.getElementById('ce-bulk-toggle').addEventListener('click', bulkToggle);
        document.getElementById('ce-bulk-delete').addEventListener('click', bulkDelete);

        // Add button
        document.getElementById('ce-add-btn').addEventListener('click', handleAdd);

        // Save button
        document.getElementById('ce-save-btn').addEventListener('click', handleSave);

        // Modal close
        document.getElementById('ce-modal-close').addEventListener('click', closeModal);
        document.getElementById('ce-modal-cancel').addEventListener('click', closeModal);
        document.querySelector('.ce-modal-overlay').addEventListener('click', closeModal);

        render();
    }

    // ──────────────────────────────────────────────────────
    // Yardımcılar
    // ──────────────────────────────────────────────────────
    function itemUID(item) {
        return (item._custom ? 'c_' : 'o_') + item.id;
    }

    function getMergedItems() {
        const orig = (_originalData[_activeTab] || []).map(item => ({ ...item, _custom: false }));
        const custom = (_customContent.custom[_activeTab] || []).map(item => ({ ...item, _custom: true }));
        return [...orig, ...custom];
    }

    function getFilteredItems() {
        let items = getMergedItems();
        const filter = document.getElementById('ce-filter').value;
        const search = document.getElementById('ce-search').value.trim().toLowerCase();
        const disabled = _customContent.disabled[_activeTab] || [];

        if (filter === 'active') items = items.filter(i => !disabled.includes(itemUID(i)));
        else if (filter === 'inactive') items = items.filter(i => disabled.includes(itemUID(i)));
        else if (filter === 'custom') items = items.filter(i => i._custom);
        else if (filter === 'original') items = items.filter(i => !i._custom);

        if (search) {
            items = items.filter(i => {
                const fields = Object.values(i).filter(v => typeof v === 'string');
                return fields.some(f => f.toLowerCase().includes(search));
            });
        }

        return items;
    }

    function getNextCustomId() {
        const existing = _customContent.custom[_activeTab] || [];
        if (existing.length === 0) return 1000;
        return Math.max(...existing.map(i => i.id)) + 1;
    }

    // ──────────────────────────────────────────────────────
    // Render
    // ──────────────────────────────────────────────────────
    function render() {
        const listEl = document.getElementById('ce-list');
        const emptyEl = document.getElementById('ce-empty');
        const items = getFilteredItems();
        const disabled = _customContent.disabled[_activeTab] || [];

        const hasSelection = _selectedIds.size > 0;
        document.getElementById('ce-bulk-toggle').disabled = !hasSelection;
        document.getElementById('ce-bulk-delete').disabled = !hasSelection;

        if (items.length === 0) {
            listEl.innerHTML = '';
            emptyEl.classList.remove('hidden');
            renderAddForm();
            return;
        }

        emptyEl.classList.add('hidden');
        listEl.innerHTML = items.map(item => {
            const uid = itemUID(item);
            const isDisabled = disabled.includes(uid);
            const isSelected = _selectedIds.has(uid);

            let previewHtml = '';

            if (item.baslik) {
                previewHtml += `<div style="font-weight:700;color:var(--accent);margin-bottom:4px;">${escHtml(item.baslik)}</div>`;
            }
            if (item.arapca) {
                previewHtml += `<div class="ce-item-arabic">${escHtml(item.arapca)}</div>`;
            }
            if (item.turkce) {
                previewHtml += `<div class="ce-item-turkish">${escHtml(item.turkce)}</div>`;
            }
            if (item.anlam && _activeTab !== 'dualar') {
                previewHtml += `<div class="ce-item-turkish" style="margin-top:2px;font-style:italic;">${escHtml(item.anlam)}</div>`;
            }
            if (item.referans) {
                previewHtml += `<div class="ce-item-ref">${escHtml(item.referans)}</div>`;
            }

            return `
            <div class="ce-item ${isDisabled ? 'inactive' : ''} ${isSelected ? 'selected' : ''}" data-uid="${uid}">
                <input type="checkbox" class="ce-item-check" ${isSelected ? 'checked' : ''} data-uid="${uid}">
                <div class="ce-item-body">
                    <div class="ce-item-number">#${item.id} <span class="ce-item-badge ${item._custom ? 'custom' : 'original'}">${item._custom ? 'Özel' : 'Sunucu'}</span></div>
                    ${previewHtml}
                </div>
                <div class="ce-item-actions">
                    <button class="ce-item-btn toggle-btn" data-uid="${uid}" title="${isDisabled ? 'Aktif Yap' : 'Pasif Yap'}">${isDisabled ? '👁️' : '🚫'}</button>
                    <button class="ce-item-btn edit-btn" data-uid="${uid}" title="Düzenle">✏️</button>
                    ${item._custom ? `<button class="ce-item-btn delete-btn" data-uid="${uid}" title="Sil">🗑️</button>` : ''}
                </div>
            </div>`;
        }).join('');

        // Event'ler
        listEl.querySelectorAll('.ce-item-check').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const uid = e.target.dataset.uid;
                if (e.target.checked) _selectedIds.add(uid);
                else _selectedIds.delete(uid);
                render();
            });
        });
        listEl.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleItem(btn.dataset.uid));
        });
        listEl.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.uid));
        });
        listEl.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteItem(btn.dataset.uid));
        });

        renderAddForm();
    }

    // ──────────────────────────────────────────────────────
    // Add Form
    // ──────────────────────────────────────────────────────
    function renderAddForm() {
        const formEl = document.getElementById('ce-add-form');
        const fields = FIELD_DEFS[_activeTab];

        formEl.innerHTML = fields.map(f => {
            if (f.type === 'textarea') {
                return `<label>${f.label}</label><textarea data-key="${f.key}" rows="2" class="${f.rtl ? 'rtl' : ''}" placeholder="${f.label}"></textarea>`;
            }
            return `<label>${f.label}</label><input data-key="${f.key}" type="text" class="${f.rtl ? 'rtl' : ''}" placeholder="${f.label}">`;
        }).join('');
    }

    function handleAdd() {
        const fields = FIELD_DEFS[_activeTab];
        const newItem = { id: getNextCustomId() };
        let hasContent = false;

        fields.forEach(f => {
            const el = document.querySelector(`#ce-add-form [data-key="${f.key}"]`);
            newItem[f.key] = el ? el.value.trim() : '';
            if (newItem[f.key]) hasContent = true;
        });

        if (!hasContent) return;

        _customContent.custom[_activeTab].push(newItem);
        markDirty();
        render();

        // Clear form
        document.querySelectorAll('#ce-add-form input, #ce-add-form textarea').forEach(el => el.value = '');
    }

    // ──────────────────────────────────────────────────────
    // Toggle / Delete
    // ──────────────────────────────────────────────────────
    function toggleItem(uid) {
        const disabled = _customContent.disabled[_activeTab];
        const idx = disabled.indexOf(uid);
        if (idx >= 0) disabled.splice(idx, 1);
        else disabled.push(uid);
        markDirty();
        render();
    }

    function deleteItem(uid) {
        if (!uid.startsWith('c_')) return;
        const id = parseInt(uid.replace('c_', ''));
        _customContent.custom[_activeTab] = _customContent.custom[_activeTab].filter(i => i.id !== id);

        const disabled = _customContent.disabled[_activeTab];
        const didx = disabled.indexOf(uid);
        if (didx >= 0) disabled.splice(didx, 1);

        _selectedIds.delete(uid);
        markDirty();
        render();
    }

    // ──────────────────────────────────────────────────────
    // Bulk Actions
    // ──────────────────────────────────────────────────────
    function bulkToggle() {
        const disabled = _customContent.disabled[_activeTab];
        _selectedIds.forEach(uid => {
            const idx = disabled.indexOf(uid);
            if (idx >= 0) disabled.splice(idx, 1);
            else disabled.push(uid);
        });
        _selectedIds.clear();
        document.getElementById('ce-select-all').checked = false;
        markDirty();
        render();
    }

    function bulkDelete() {
        if (!confirm('Seçili özel içerikler silinecek. Emin misiniz?')) return;
        _selectedIds.forEach(uid => {
            if (uid.startsWith('c_')) {
                const id = parseInt(uid.replace('c_', ''));
                _customContent.custom[_activeTab] = _customContent.custom[_activeTab].filter(i => i.id !== id);
            }
            const disabled = _customContent.disabled[_activeTab];
            const didx = disabled.indexOf(uid);
            if (didx >= 0) disabled.splice(didx, 1);
        });
        _selectedIds.clear();
        document.getElementById('ce-select-all').checked = false;
        markDirty();
        render();
    }

    // ──────────────────────────────────────────────────────
    // Edit Modal
    // ──────────────────────────────────────────────────────
    let _editingItem = null;

    function openEditModal(uid) {
        const all = getMergedItems();
        const item = all.find(i => itemUID(i) === uid);
        if (!item) return;

        _editingItem = item;

        const fields = FIELD_DEFS[_activeTab];
        const bodyEl = document.getElementById('ce-modal-body');

        bodyEl.innerHTML = fields.map(f => {
            const val = escHtml(item[f.key] || '');
            if (f.type === 'textarea') {
                return `<label>${f.label}</label><textarea data-key="${f.key}" rows="3" class="${f.rtl ? 'rtl' : ''}">${val}</textarea>`;
            }
            return `<label>${f.label}</label><input data-key="${f.key}" type="text" class="${f.rtl ? 'rtl' : ''}" value="${val}">`;
        }).join('');

        document.getElementById('ce-modal').classList.remove('hidden');

        document.getElementById('ce-modal-save').onclick = () => {
            const fields = FIELD_DEFS[_activeTab];

            if (_editingItem._custom) {
                // Özel içerik — doğrudan düzenle
                fields.forEach(f => {
                    const el = document.querySelector(`#ce-modal-body [data-key="${f.key}"]`);
                    _editingItem[f.key] = el ? el.value.trim() : '';
                });
                const idx = _customContent.custom[_activeTab].findIndex(i => i.id === _editingItem.id);
                if (idx >= 0) {
                    fields.forEach(f => {
                        _customContent.custom[_activeTab][idx][f.key] = _editingItem[f.key];
                    });
                }
            } else {
                // Orijinal içerik — özel kopya oluştur
                const clone = { ...item, id: getNextCustomId() };
                delete clone._custom;
                fields.forEach(f => {
                    const el = document.querySelector(`#ce-modal-body [data-key="${f.key}"]`);
                    clone[f.key] = el ? el.value.trim() : '';
                });
                _customContent.custom[_activeTab].push(clone);

                // Orijinali pasif yap
                const origUID = 'o_' + item.id;
                if (!_customContent.disabled[_activeTab].includes(origUID)) {
                    _customContent.disabled[_activeTab].push(origUID);
                }
            }

            markDirty();
            closeModal();
            render();
        };
    }

    function closeModal() {
        document.getElementById('ce-modal').classList.add('hidden');
        _editingItem = null;
    }

    // ──────────────────────────────────────────────────────
    // Save — SettingsManager + /api/save pipeline
    // ──────────────────────────────────────────────────────
    function markDirty() {
        _isDirty = true;
        document.getElementById('ce-save-bar').classList.add('visible');
    }

    function handleSave() {
        const statusEl = document.getElementById('ce-save-status');

        // Settings'e customContent'i geri yaz
        _settings.customContent = _customContent;
        const ok = SettingsManager.save(_settings);

        if (!ok) {
            statusEl.textContent = '✗ Kaydetme hatası';
            statusEl.style.color = '#f87171';
            return;
        }

        // Telefon tarayıcısından açılmışsa (HTTP) → TV'ye gönder
        if (location.protocol === 'http:') {
            statusEl.textContent = '⏳ TV\'ye gönderiliyor...';
            statusEl.style.color = 'var(--text-muted)';

            fetch('/api/save', {
                method: 'POST',
                body: JSON.stringify(_settings),
            })
                .then(() => {
                    statusEl.textContent = '✓ TV\'ye gönderildi!';
                    statusEl.style.color = 'var(--accent)';
                    _isDirty = false;
                    setTimeout(() => {
                        document.getElementById('ce-save-bar').classList.remove('visible');
                        statusEl.textContent = '';
                    }, 2000);
                })
                .catch(err => {
                    statusEl.textContent = '✗ Gönderim hatası: ' + err.message;
                    statusEl.style.color = '#f87171';
                });
            return;
        }

        // TV üzerinden doğrudan — zaten localStorage'a yazıldı
        statusEl.textContent = '✓ Kaydedildi!';
        statusEl.style.color = 'var(--accent)';
        _isDirty = false;
        setTimeout(() => {
            document.getElementById('ce-save-bar').classList.remove('visible');
            statusEl.textContent = '';
        }, 2000);
    }

    // ──────────────────────────────────────────────────────
    // Utility
    // ──────────────────────────────────────────────────────
    function escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Start
    init();

})();
