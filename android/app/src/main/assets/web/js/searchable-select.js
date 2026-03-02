/**
 * CAMI TV — searchable-select.js
 * Tekrar kullanılabilir aranabilir dropdown bileşeni.
 * Arama kutusu her açılışta boş başlar.
 */

class SearchableSelect {
    /**
     * @param {Object} opts
     * @param {HTMLElement} opts.container - Bileşenin yerleştirileceği DOM elementi
     * @param {string} opts.placeholder - Seçim yapılmadan önceki metin
     * @param {Function} opts.onSelect - Seçim yapılınca çağrılır: (value, label) => void
     * @param {boolean} [opts.disabled=false] - Başlangıçta devre dışı mı
     */
    constructor(opts) {
        this.container = opts.container;
        this.placeholder = opts.placeholder || '— Seçin —';
        this.onSelect = opts.onSelect || (() => { });
        this.options = []; // [{value, label}]
        this.selectedValue = '';
        this.selectedLabel = '';
        this.isOpen = false;

        this._build();
        if (opts.disabled) this.setDisabled(true);

        // Dışarı tıklanınca kapat
        this._onDocClick = (e) => {
            if (!this.el.contains(e.target)) this.close();
        };
        document.addEventListener('click', this._onDocClick);
    }

    _build() {
        this.el = document.createElement('div');
        this.el.className = 'ss-wrapper';

        // Tetikleyici buton
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = 'ss-trigger';
        this.trigger.innerHTML = `<span class="ss-trigger-text">${this.placeholder}</span><span class="ss-arrow">▾</span>`;
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isOpen ? this.close() : this.open();
        });

        // Dropdown panel
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'ss-dropdown';

        // Arama kutusu
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'ss-search';
        this.searchInput.placeholder = '🔍 Ara...';
        this.searchInput.autocomplete = 'off';
        this.searchInput.addEventListener('input', () => this._filter());

        // Klavye / TV Kumandası (D-Pad) Navigasyonu
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
                this.trigger.focus();
                return;
            }
            if (!this.isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                e.preventDefault();
                this.open();
                return;
            }
            if (this.isOpen) {
                const options = Array.from(this.listEl.querySelectorAll('.ss-option'));
                if (options.length === 0) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.focusedOptionIndex = (this.focusedOptionIndex + 1) % options.length;
                    this._updateFocus(options);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.focusedOptionIndex = (this.focusedOptionIndex - 1 + options.length) % options.length;
                    this._updateFocus(options);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (this.focusedOptionIndex >= 0 && this.focusedOptionIndex < options.length) {
                        options[this.focusedOptionIndex].click();
                        this.trigger.focus();
                    }
                }
            }
        });

        // Trigger butonu klavye kontrolü
        this.trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.isOpen ? this.close() : this.open();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (!this.isOpen) this.open();
            }
        });

        // Seçenek listesi
        this.listEl = document.createElement('div');
        this.listEl.className = 'ss-list';

        this.dropdown.appendChild(this.searchInput);
        this.dropdown.appendChild(this.listEl);

        this.el.appendChild(this.trigger);
        this.el.appendChild(this.dropdown);
        this.container.appendChild(this.el);
    }

    /**
     * Seçenekleri ayarla / güncelle
     * @param {Array<{value:string, label:string}>} options
     */
    setOptions(options) {
        this.options = options;
        this._renderList(options);
    }

    /**
     * Mevcut seçili değeri göster (arama kutusunu doldurmaz)
     */
    setValue(value, label) {
        this.selectedValue = value;
        this.selectedLabel = label || '';
        const trigText = this.trigger.querySelector('.ss-trigger-text');
        trigText.textContent = label || this.placeholder;
        trigText.classList.toggle('ss-has-value', !!label);
    }

    getValue() {
        return this.selectedValue;
    }

    getLabel() {
        return this.selectedLabel;
    }

    setDisabled(disabled) {
        this.trigger.disabled = disabled;
        this.el.classList.toggle('ss-disabled', disabled);
        if (disabled) this.close();
    }

    open() {
        if (this.trigger.disabled) return;
        this.isOpen = true;
        this.el.classList.add('ss-open');
        // Arama kutusu her zaman boş başlasın
        this.searchInput.value = '';
        this._renderList(this.options);
        // Kısa gecikme ile focus (animasyon için)
        requestAnimationFrame(() => {
            this.searchInput.focus();
            // Seçili öğe varsa ona kaydır
            const selected = this.listEl.querySelector('.ss-selected');
            if (selected) {
                selected.scrollIntoView({ block: 'nearest' });
                // Odaklanmış öğe indexini seçili öğeye ayarla
                const allOpts = Array.from(this.listEl.querySelectorAll('.ss-option'));
                this.focusedOptionIndex = allOpts.indexOf(selected);
                this._updateFocus(allOpts);
            }
        });
    }

    close() {
        this.isOpen = false;
        this.el.classList.remove('ss-open');
    }

    _filter() {
        const q = this.searchInput.value.toLowerCase().trim();
        if (!q) {
            this._renderList(this.options);
            return;
        }
        const filtered = this.options.filter(o => o.label.toLowerCase().includes(q));
        this._renderList(filtered);
    }

    _renderList(items) {
        this.listEl.innerHTML = '';
        this.focusedOptionIndex = -1;

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ss-empty';
            empty.textContent = 'Sonuç bulunamadı';
            this.listEl.appendChild(empty);
            return;
        }

        items.forEach(item => {
            const opt = document.createElement('div');
            opt.className = 'ss-option';
            if (item.value === this.selectedValue) opt.classList.add('ss-selected');
            opt.textContent = item.label;
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setValue(item.value, item.label);
                this.close();
                this.onSelect(item.value, item.label);
            });
            this.listEl.appendChild(opt);
        });
    }

    _updateFocus(options) {
        options.forEach((opt, idx) => {
            if (idx === this.focusedOptionIndex) {
                opt.classList.add('ss-focused');
                opt.scrollIntoView({ block: 'nearest' });
            } else {
                opt.classList.remove('ss-focused');
            }
        });
    }

    destroy() {
        document.removeEventListener('click', this._onDocClick);
        this.el.remove();
    }
}

window.SearchableSelect = SearchableSelect;
