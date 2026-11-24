/**
 * CAMI TV — tv-select-modal.js
 * 
 * Android TV ve tüm TV platformları için D-Pad uyumlu evrensel seçim modalı.
 * - TV kumandasında (Yukarı, Aşağı, OK, Geri) tuşlarıyla %100 kararlı çalışır.
 * - Atmaca TV, Mi Box, TCL, Philips, Sony veya emülatör fark etmeksizin tüm
 *   cihazlarda aynı estetik ve kusursuz deneyimi sağlar.
 * - Geri (Back) tuşuna basıldığında ayarlar sayfasından çıkmaz, sadece modalı kapatır.
 */

class TvSelectModal {
    static isOpen = false;
    static currentOpts = null;
    static triggerEl = null;

    /**
     * TV ortamında mıyız? (AndroidBridge varsa veya file:// protokolü)
     */
    static get isTv() {
        return typeof window !== 'undefined' && (
            !!window.AndroidBridge ||
            (window.location.protocol === 'file:' && !navigator.userAgent.toLowerCase().includes('mobile'))
        );
    }

    /**
     * Modal DOM yapısını hazırla
     */
    static init() {
        if (document.getElementById('tv-select-modal-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'tv-select-modal-backdrop';
        backdrop.className = 'tv-modal-backdrop';
        backdrop.style.display = 'none';

        backdrop.innerHTML = `
            <div class="tv-modal-box" role="dialog" aria-modal="true">
                <div class="tv-modal-header">
                    <div class="tv-modal-title" id="tv-modal-title-text">—</div>
                    <div class="tv-modal-hint">▲ / ▼ Gezin • [OK] Seç • [Geri] Kapat</div>
                </div>
                <div class="tv-modal-list" id="tv-modal-list-el"></div>
            </div>
        `;

        document.body.appendChild(backdrop);

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) TvSelectModal.close();
        });

        // TV Kumandası tuş yakalayıcı (Capture phase ile tüm tuşları güvenle yönetir)
        document.addEventListener('keydown', TvSelectModal._onKeyDown, true);

        // TV ortamında herhangi bir <select> etiketine fare veya kumanda ile basıldığında da TvSelectModal aç
        if (TvSelectModal.isTv) {
            document.addEventListener('mousedown', (e) => {
                const sel = e.target.closest('select');
                if (sel && !sel.disabled) {
                    e.preventDefault();
                    e.stopPropagation();
                    TvSelectModal.openForSelect(sel);
                }
            }, true);

            document.addEventListener('keydown', (e) => {
                if (TvSelectModal.isOpen) return;
                const active = document.activeElement;
                if (active && active.tagName === 'SELECT' && !active.disabled) {
                    if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 23 || e.keyCode === 66 || e.keyCode === 13) {
                        e.preventDefault();
                        e.stopPropagation();
                        TvSelectModal.openForSelect(active);
                    }
                }
            }, true);
        }
    }

    /**
     * Modal aç
     * @param {Object} opts
     * @param {string} opts.title - Başlık metni
     * @param {Array<{value: string, label: string}>} opts.options - Seçenekler
     * @param {string} opts.selectedValue - Şu an seçili değer
     * @param {Function} opts.onSelect - (value, label) => void
     * @param {HTMLElement} [opts.triggerEl] - Modalı açan eleman (kapanınca odaklanacak)
     */
    static open(opts) {
        TvSelectModal.init();
        TvSelectModal.isOpen = true;
        TvSelectModal.currentOpts = opts;
        TvSelectModal.triggerEl = opts.triggerEl || document.activeElement;

        // Android tarafına modalın açık olduğunu bildir (Back tuşu sayfadan atmasın)
        if (window.AndroidBridge && typeof window.AndroidBridge.setModalOpen === 'function') {
            try {
                window.AndroidBridge.setModalOpen(true);
            } catch (_) {}
        }

        const backdrop = document.getElementById('tv-select-modal-backdrop');
        const titleEl = document.getElementById('tv-modal-title-text');
        const listEl = document.getElementById('tv-modal-list-el');

        titleEl.textContent = opts.title || 'Seçim Yapın';
        listEl.innerHTML = '';

        let activeItemEl = null;

        (opts.options || []).forEach((opt, idx) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'tv-modal-item';
            itemEl.tabIndex = 0;
            itemEl.dataset.value = opt.value;
            itemEl.dataset.index = idx;

            const isSelected = String(opt.value) === String(opts.selectedValue);
            if (isSelected) {
                itemEl.classList.add('selected');
            }

            itemEl.innerHTML = `
                <span class="tv-modal-item-label">${opt.label}</span>
                <span class="tv-modal-item-check">${isSelected ? '✓' : ''}</span>
            `;

            const choose = () => {
                TvSelectModal._chooseItem(opt.value, opt.label);
            };

            itemEl.addEventListener('click', (e) => {
                e.stopPropagation();
                choose();
            });

            listEl.appendChild(itemEl);

            if (isSelected && !activeItemEl) {
                activeItemEl = itemEl;
            }
        });

        backdrop.style.display = 'flex';

        // Öncelikli olarak seçili olan elemana, yoksa ilk elemana odaklan
        const toFocus = activeItemEl || listEl.querySelector('.tv-modal-item');
        if (toFocus) {
            TvSelectModal._focusItem(toFocus);
            setTimeout(() => {
                toFocus.scrollIntoView({ block: 'center', behavior: 'instant' });
            }, 50);
        }
    }

    /**
     * Standart bir HTML <select> elemanı için modal açar
     * @param {HTMLSelectElement} selectEl
     */
    static openForSelect(selectEl) {
        if (!selectEl) return;
        const row = selectEl.closest('.setting-row') || selectEl.closest('.sub-setting-row') || selectEl.closest('.ce-filter-group');
        const labelEl = row ? row.querySelector('.setting-label, label') : null;
        const title = labelEl ? labelEl.textContent.trim() : (selectEl.name || 'Seçim Yapın');

        const options = Array.from(selectEl.options).map(o => ({
            value: o.value,
            label: o.text
        }));

        TvSelectModal.open({
            title: title,
            options: options,
            selectedValue: selectEl.value,
            triggerEl: selectEl,
            onSelect: (val) => {
                if (selectEl.value !== val) {
                    selectEl.value = val;
                    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
    }

    /**
     * Modalı kapat
     */
    static close() {
        if (!TvSelectModal.isOpen) return;
        TvSelectModal.isOpen = false;

        // Android tarafına modalın kapandığını bildir
        if (window.AndroidBridge && typeof window.AndroidBridge.setModalOpen === 'function') {
            try {
                window.AndroidBridge.setModalOpen(false);
            } catch (_) {}
        }

        const backdrop = document.getElementById('tv-select-modal-backdrop');
        if (backdrop) backdrop.style.display = 'none';

        if (TvSelectModal.triggerEl && typeof TvSelectModal.triggerEl.focus === 'function') {
            TvSelectModal.triggerEl.focus();
        }
    }

    /**
     * Seçeneği onayla
     */
    static _chooseItem(value, label) {
        const cb = TvSelectModal.currentOpts && TvSelectModal.currentOpts.onSelect;
        TvSelectModal.close();
        if (typeof cb === 'function') {
            cb(value, label);
        }
    }

    /**
     * Odaklama
     */
    static _focusItem(itemEl) {
        if (!itemEl) return;
        const listEl = document.getElementById('tv-modal-list-el');
        if (!listEl) return;

        listEl.querySelectorAll('.tv-modal-item').forEach(i => i.classList.remove('tv-focused'));
        itemEl.classList.add('tv-focused');
        itemEl.focus();
        itemEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    /**
     * Yön tuşuyla gezinme (-1: Yukarı, 1: Aşağı)
     */
    static _moveFocus(dir) {
        const listEl = document.getElementById('tv-modal-list-el');
        if (!listEl) return;

        const items = Array.from(listEl.querySelectorAll('.tv-modal-item'));
        if (items.length === 0) return;

        const current = listEl.querySelector('.tv-modal-item.tv-focused') || document.activeElement;
        let idx = items.indexOf(current);

        if (idx === -1) {
            idx = dir > 0 ? 0 : items.length - 1;
        } else {
            idx += dir;
            if (idx < 0) idx = items.length - 1;
            if (idx >= items.length) idx = 0;
        }

        TvSelectModal._focusItem(items[idx]);
    }

    /**
     * Kumanda tuş olayları
     */
    static _onKeyDown(e) {
        if (!TvSelectModal.isOpen) return;

        const isDown = e.key === 'ArrowDown' || e.keyCode === 20 || e.keyCode === 40;
        const isUp = e.key === 'ArrowUp' || e.keyCode === 19 || e.keyCode === 38;
        const isEnter = e.key === 'Enter' || e.key === ' ' || e.keyCode === 23 || e.keyCode === 66 || e.keyCode === 13;
        const isBack = e.key === 'Escape' || e.key === 'GoBack' || e.keyCode === 27 || e.keyCode === 4 || e.keyCode === 111;

        if (isDown) {
            e.preventDefault();
            e.stopPropagation();
            TvSelectModal._moveFocus(1);
        } else if (isUp) {
            e.preventDefault();
            e.stopPropagation();
            TvSelectModal._moveFocus(-1);
        } else if (isEnter) {
            e.preventDefault();
            e.stopPropagation();
            const listEl = document.getElementById('tv-modal-list-el');
            const focused = listEl ? (listEl.querySelector('.tv-modal-item.tv-focused') || document.activeElement) : null;
            if (focused && focused.classList.contains('tv-modal-item')) {
                const val = focused.dataset.value;
                const lbl = focused.querySelector('.tv-modal-item-label')?.textContent || '';
                TvSelectModal._chooseItem(val, lbl);
            }
        } else if (isBack) {
            e.preventDefault();
            e.stopPropagation();
            TvSelectModal.close();
        }
    }
}

// Global erişim
window.TvSelectModal = TvSelectModal;
window.closeTvModal = () => {
    const editModal = document.getElementById('duyuru-edit-modal-backdrop');
    if (editModal && editModal.style.display !== 'none') {
        editModal.style.display = 'none';
        if (window.AndroidBridge && typeof AndroidBridge.setModalOpen === 'function') {
            AndroidBridge.setModalOpen(false);
        }
        return;
    }
    TvSelectModal.close();
};

// DOM yüklendiğinde otomatik başlat
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => TvSelectModal.init());
    } else {
        TvSelectModal.init();
    }
}
