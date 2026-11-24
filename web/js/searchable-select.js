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
        // ─── 1. TV MODU: Kumanda Uyumlu TvSelectModal Tetikleyicisi ───
        if (this._isTv) {
            this.tvTrigger = document.createElement('button');
            this.tvTrigger.type = 'button';
            this.tvTrigger.className = 'setting-select ss-tv-trigger';
            this.tvTrigger.tabIndex = 0;
            this.tvTrigger.innerHTML = `<span class="ss-trigger-text">${this.selectedLabel || this.placeholder}</span><span class="ss-arrow">▾</span>`;

            const openTvModal = (e) => {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (this.tvTrigger.disabled) return;
                if (typeof TvSelectModal === 'undefined') return;

                TvSelectModal.open({
                    title: this.placeholder,
                    options: this.options,
                    selectedValue: this.selectedValue,
                    triggerEl: this.tvTrigger,
                    onSelect: (val, lbl) => {
                        this.setValue(val, lbl);
                        this.onSelect(val, lbl);
                    }
                });
            };

            this.tvTrigger.addEventListener('click', openTvModal);
            this.tvTrigger.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 23 || e.keyCode === 66 || e.keyCode === 13) {
                    openTvModal(e);
                }
            });

            this.container.appendChild(this.tvTrigger);
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

        // TV Modunda seçenekler güncellendiğinde mevcut seçimin etiketini tazele
        if (this._isTv && this.tvTrigger) {
            if (this.selectedValue) {
                const found = this.options.find(o => String(o.value) === String(this.selectedValue));
                if (found) {
                    this.setValue(found.value, found.label);
                }
            }
            return;
        }

        // Telefon / PC Modunda özel listeyi doldur
        this._renderList(this.options);
    }

    setValue(value, label) {
        this.selectedValue = value || '';
        this.selectedLabel = label || '';

        if (this._isTv && this.tvTrigger) {
            if (!this.selectedLabel && this.selectedValue && this.options.length > 0) {
                const found = this.options.find(o => String(o.value) === String(this.selectedValue));
                if (found) this.selectedLabel = found.label;
            }
            const trigText = this.tvTrigger.querySelector('.ss-trigger-text');
            if (trigText) {
                trigText.textContent = this.selectedLabel || this.placeholder;
                trigText.classList.toggle('ss-has-value', !!this.selectedLabel);
            }
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
        return this.selectedValue;
    }

    getLabel() {
        return this.selectedLabel;
    }

    setDisabled(disabled) {
        if (this._isTv && this.tvTrigger) {
            this.tvTrigger.disabled = !!disabled;
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

    setPlaceholder(placeholder) {
        this.placeholder = placeholder || '— Seçin —';
        if (this._isTv && this.tvTrigger) {
            if (!this.selectedLabel && !this.selectedValue) {
                const trigText = this.tvTrigger.querySelector('.ss-trigger-text');
                if (trigText) trigText.textContent = this.placeholder;
            }
            return;
        }
        if (this.trigger && !this.selectedLabel) {
            const trigText = this.trigger.querySelector('.ss-trigger-text');
            if (trigText) trigText.textContent = this.placeholder;
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

    static normalize(str) {
        if (!str) return '';
        return String(str)
            .toLocaleLowerCase('tr-TR')
            .replace(/i̇/g, 'i')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .trim();
    }

    _filter() {
        const raw = (this.searchInput.value || '').trim();
        if (!raw) {
            this._renderList(this.options);
            return;
        }
        const qTr = raw.toLocaleLowerCase('tr-TR');
        const qNorm = SearchableSelect.normalize(raw);

        const filtered = this.options.filter(o => {
            if (!o || !o.label) return false;
            const lTr = o.label.toLocaleLowerCase('tr-TR');
            const lNorm = SearchableSelect.normalize(o.label);
            return lTr.includes(qTr) || lNorm.includes(qNorm);
        });
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
        if (this._isTv && this.tvTrigger) {
            this.tvTrigger.remove();
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
