/**
 * CAMI TV — searchable-select.js
 * 
 * - TV Modunda (AndroidBridge mevcut): Yerel Android modal diyaloğunu tetikleyen <select>
 *   kullanır. Böylece TV kumandasında sayfa kayması, çift imleç ve Geri (Back) tuşuyla
 *   sayfadan atma sorunları tamamen çözülür.
 * - Telefon / PC Modunda (Tarayıcıdan bağlantı): Arama kutulu (Search input) tam aranabilir
 *   özel dropdown kullanılır. Telefonla bağlanan kullanıcılar şehir ve ilçeyi yazarak kolayca bulur.
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

        // TV tespiti: Yalnızca Android TV uygulamasının WebView ortamında (AndroidBridge mevcutsa)
        // veya yerel dosya sisteminden TV modunda çalışıyorsa TV kabul edilir.
        // Telefondan Wi-Fi ile bağlanan kullanıcılarda AndroidBridge tanımsızdır, dolayısıyla
        // telefonlar arama kutulu (search input) zengin arayüzü kullanır.
        this._isTv = typeof window !== 'undefined' && (
            !!window.AndroidBridge ||
            (window.location.protocol === 'file:' && !navigator.userAgent.toLowerCase().includes('mobile'))
        );

        this._build();
        if (opts.disabled) this.setDisabled(true);

        if (!this._isTv) {
            // Dışarı tıklanınca kapat (sadece telefon/PC özel dropdown modunda)
            this._onDocClick = (e) => {
                if (this.el && !this.el.contains(e.target)) this.close();
            };
            document.addEventListener('click', this._onDocClick);
        }
    }

    _build() {
        // ─── 1. TV MODU: Yerel Android <select> (Modal Diyalog) ───
        if (this._isTv) {
            this.nativeSelect = document.createElement('select');
            this.nativeSelect.className = 'setting-select ss-native-select';
            this.nativeSelect.style.width = '100%';

            const defOpt = document.createElement('option');
            defOpt.value = '';
            defOpt.textContent = this.placeholder;
            this.nativeSelect.appendChild(defOpt);

            this.nativeSelect.addEventListener('change', () => {
                const sel = this.nativeSelect.options[this.nativeSelect.selectedIndex];
                const val = this.nativeSelect.value;
                const lbl = sel && val ? sel.text : '';
                this.selectedValue = val;
                this.selectedLabel = lbl;
                this.onSelect(val, lbl);
            });

            this.container.appendChild(this.nativeSelect);
            return;
        }

        // ─── 2. TELEFON / PC MODU: Aranabilir Özel Dropdown ───
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

        // Arama kutusu (Telefonda ve PC'de tamamen görünür ve aktiftir!)
        this.searchInput = document.createElement('input');
        this.searchInput.type = 'text';
        this.searchInput.className = 'ss-search';
        this.searchInput.placeholder = '🔍 Ara...';
        this.searchInput.autocomplete = 'off';
        this.searchInput.addEventListener('input', () => this._filter());

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.close();
                this.trigger.focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                const first = this.listEl.querySelector('.ss-option');
                if (first) first.focus();
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

    setOptions(options) {
        this.options = options || [];

        // TV Modunda yerel <select> seçeneklerini doldur
        if (this._isTv && this.nativeSelect) {
            this.nativeSelect.innerHTML = '';
            const defOpt = document.createElement('option');
            defOpt.value = '';
            defOpt.textContent = this.placeholder;
            this.nativeSelect.appendChild(defOpt);

            this.options.forEach(opt => {
                const o = document.createElement('option');
                o.value = opt.value;
                o.textContent = opt.label;
                if (opt.value === this.selectedValue) {
                    o.selected = true;
                }
                this.nativeSelect.appendChild(o);
            });
            return;
        }

        // Telefon / PC Modunda özel listeyi doldur
        this._renderList(this.options);
    }

    setValue(value, label) {
        this.selectedValue = value || '';
        this.selectedLabel = label || '';

        if (this._isTv && this.nativeSelect) {
            this.nativeSelect.value = this.selectedValue;
            return;
        }

        if (this.trigger) {
            const trigText = this.trigger.querySelector('.ss-trigger-text');
            if (trigText) {
                trigText.textContent = label || this.placeholder;
                trigText.classList.toggle('ss-has-value', !!label);
            }
        }
    }

    getValue() {
        if (this._isTv && this.nativeSelect) {
            return this.nativeSelect.value;
        }
        return this.selectedValue;
    }

    getLabel() {
        if (this._isTv && this.nativeSelect) {
            const sel = this.nativeSelect.options[this.nativeSelect.selectedIndex];
            return sel && this.nativeSelect.value ? sel.text : '';
        }
        return this.selectedLabel;
    }

    setDisabled(disabled) {
        if (this._isTv && this.nativeSelect) {
            this.nativeSelect.disabled = !!disabled;
            return;
        }

        if (this.trigger) {
            this.trigger.disabled = !!disabled;
        }
        if (this.el) {
            this.el.classList.toggle('ss-disabled', !!disabled);
        }
        if (disabled && this.isOpen) {
            this.close();
        }
    }

    open() {
        if (this._isTv || (this.trigger && this.trigger.disabled)) return;
        this.isOpen = true;
        this.el.classList.add('ss-open');
        this.searchInput.value = '';
        this._renderList(this.options);

        requestAnimationFrame(() => {
            this.searchInput.focus();
            const target = this.listEl.querySelector('.ss-selected');
            if (target) target.scrollIntoView({ block: 'nearest' });
        });
    }

    close() {
        if (this._isTv) return;
        this.isOpen = false;
        if (this.el) {
            this.el.classList.remove('ss-open');
        }
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

        if (items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'ss-empty';
            empty.textContent = 'Sonuç bulunamadı';
            this.listEl.appendChild(empty);
            return;
        }

        items.forEach((item, idx) => {
            const opt = document.createElement('div');
            opt.className = 'ss-option';
            opt.tabIndex = 0;
            opt.setAttribute('role', 'option');
            opt.dataset.value = item.value;
            opt.dataset.index = idx;
            if (item.value === this.selectedValue) opt.classList.add('ss-selected');
            opt.textContent = item.label;

            const selectOption = () => {
                this.setValue(item.value, item.label);
                this.close();
                this.onSelect(item.value, item.label);
                if (this.trigger) this.trigger.focus();
            };

            // Fare / dokunma seçimi (Telefon ve PC için)
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                selectOption();
            });

            this.listEl.appendChild(opt);
        });
    }

    destroy() {
        if (this._isTv && this.nativeSelect) {
            this.nativeSelect.remove();
            return;
        }
        if (this._onDocClick) {
            document.removeEventListener('click', this._onDocClick);
        }
        if (this.el) {
            this.el.remove();
        }
    }
}

window.SearchableSelect = SearchableSelect;
