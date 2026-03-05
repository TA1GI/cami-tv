const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, 'web', 'settings.html');
const indexPath = path.join(__dirname, 'web', 'index.html');
const i18nPath = path.join(__dirname, 'web', 'js', 'i18n.js');

let settingsHtml = fs.readFileSync(settingsPath, 'utf8');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// The dictionary mapping Turkish texts to i18n keys
const translations = {
    // Settings headers and labels
    "Cami Bilgileri": "cami_bilgileri",
    "Cami Adı": "cami_adi",
    "Ekranda gösterilecek ad": "ekranda_gosterilecek_ad",
    "İl": "il",
    "İlçe": "ilce",
    "Görünüm": "gorunum",
    "Tema": "tema",
    "Ekran Yönü": "ekran_yonu",
    "Yazı Boyutu": "yazi_boyutu",
    "Dil / Language": "dil_secimi",
    "İçerik Gösterimi": "icerik_gosterimi",
    "Ayet Göster": "ayet_goster",
    "Hadis Göster": "hadis_goster",
    "Esmaül Hüsna Göster": "esma_goster",
    "Dua Göster": "dua_goster",
    "Haftalık İmsakiye": "haftalik_imsakiye",
    "Alt Ticker Bandı": "alt_ticker",
    "Hicri Tarih": "hicri_tarih",
    "Carousel Süresi": "carousel_suresi",
    "Her slide'ın gösterilme süresi": "slide_suresi_aciklama",
    "Ezan & Cemaat": "ezan_cemaat",
    "Ezan Öncesi Bildirim": "ezan_oncesi_bildirim",
    "Vakit girmeden kaç dk önce ezan ekranı açılsın": "ezan_bildirim_aciklama",
    "Sabah Namazı İmsaka Göre": "sabah_imsaka_gore",
    "Sabah ezanı imsakta okunur ve geri sayım imsaka göre işler": "sabah_imsaka_gore_aciklama",
    "Cemaatle Namaz Saatlerini Göster": "cemaat_goster",
    "Ezandan sonra cemaatin birlikte namaza durduğu saat": "cemaat_goster_aciklama",
    "Cemaat Dakikaları (ezanın kaç dk sonrası)": "cemaat_dakikalari",
    "Güç Yönetimi": "guc_yonetimi",
    "Çalışma Modu": "calisma_modu",
    "Sabit Saatlerde Açık": "sabit_saatlerde",
    "Sabit Açılış Saati": "sabit_acilis",
    "Sabit Kapanış Saati": "sabit_kapanis",
    "Maksimum Parlaklık (Aktif)": "maks_parlaklik",
    "Tasarruf Parlaklığı (Pasif)": "pasif_parlaklik",
    "Cihaz ESP32 Entegrasyonu": "esp32_entegrasyonu",
    "Akıllı Cihaz Röle Kontrolü": "role_kontrolu",
    "Cihaz ESP ile haberleşerek amfi ve prizleri yönetir": "role_kontrolu_aciklama",
    "ESP32 IP Adresi": "esp32_ip",
    "Ekstra Sensör Gösterimleri": "ekstra_sensor",
    "Sıcaklık ve Nem Göster": "sicaklik_nem_goster",
    "Sıfırla ve Yeniden Başlat": "sifirla_yeniden_baslat",
    "Otomatik Başlatma": "otomatik_baslatma",
    "Cihaz açıldığında uygulama otomatik başlasın": "otomatik_baslatma_aciklama",
    "Ayarları Kaydet ve Uygula": "ayarlari_kaydet",
    "Telefonla Ayarla": "telefonla_ayarla",

    // Options mapping
    "Yeşil (Koyu)": "tema_yesil",
    "Altın / Türk": "tema_altin",
    "Zümrüt Yeşili": "tema_zumrut",
    "Kufi (Kahve)": "tema_kufi",
    "Lacivert": "tema_lacivert",
    "Gece Moru": "tema_mor",
    "Açık (Beyaz)": "tema_acik",
    "Otomatik": "otomatik",
    "Yatay (TV)": "yatay_tv",
    "Dikey": "dikey",
    "Küçük": "boyut_kucuk",
    "Normal": "boyut_normal",
    "Büyük": "boyut_buyuk",
    "Çok Büyük": "boyut_cok_buyuk",
    "Sürekli Açık": "mod_surekli",
    "Sabit Saatler": "mod_sabit",
    "Namaz Vakitleri (Dinamik)": "mod_dinamik",
    "Karma Mod (Saat + Namaz)": "mod_karma",
    "Cihaz IP'si bulunamadı": "ip_bulunamadi",

    // index.html specific
    "NAMAZ VAKİTLERİ": "namaz_vakitleri_baslik",
    "15 GÜNLÜK İMSAKİYE": "imsakiye_baslik",
    "TARİH": "tarih"
};

const enTranslations = {
    "cami_bilgileri": "Mosque Information",
    "cami_adi": "Mosque Name",
    "ekranda_gosterilecek_ad": "Name to display on screen",
    "il": "City",
    "ilce": "District",
    "gorunum": "Appearance",
    "tema": "Theme",
    "ekran_yonu": "Screen Orientation",
    "yazi_boyutu": "Font Size",
    "dil_secimi": "Language",
    "icerik_gosterimi": "Content Display",
    "ayet_goster": "Show Quran Verse",
    "hadis_goster": "Show Hadith",
    "esma_goster": "Show Asma-ul Husna",
    "dua_goster": "Show Daily Prayer",
    "haftalik_imsakiye": "Weekly Timetable",
    "alt_ticker": "Bottom Ticker",
    "hicri_tarih": "Hijri Date",
    "carousel_suresi": "Carousel Duration",
    "slide_suresi_aciklama": "Duration of each slide",
    "ezan_cemaat": "Adhan & Jama'ah",
    "ezan_oncesi_bildirim": "Pre-Adhan Notification",
    "ezan_bildirim_aciklama": "Minutes before adhan to show screen",
    "sabah_imsaka_gore": "Fajr According to Imsak",
    "sabah_imsaka_gore_aciklama": "Fajr adhan and countdown is synced with Imsak",
    "cemaat_goster": "Show Jama'ah Times",
    "cemaat_goster_aciklama": "Time the congregation stands for prayer after Adhan",
    "cemaat_dakikalari": "Jama'ah Delays (minutes after adhan)",
    "guc_yonetimi": "Power Management",
    "calisma_modu": "Operating Mode",
    "sabit_saatlerde": "Open on Fixed Hours",
    "sabit_acilis": "Fixed Open Time",
    "sabit_kapanis": "Fixed Close Time",
    "maks_parlaklik": "Max Brightness (Active)",
    "pasif_parlaklik": "Eco Brightness (Passive)",
    "esp32_entegrasyonu": "IoT ESP32 Integration",
    "role_kontrolu": "Smart Relay Control",
    "role_kontrolu_aciklama": "Controls amps and sockets by communicating with ESP",
    "esp32_ip": "ESP32 IP Address",
    "ekstra_sensor": "Extra Sensor Displays",
    "sicaklik_nem_goster": "Show Temperature & Humidity",
    "sifirla_yeniden_baslat": "Reset & Restart",
    "otomatik_baslatma": "Auto Start",
    "otomatik_baslatma_aciklama": "Start app automatically on device boot",
    "ayarlari_kaydet": "Save & Apply Settings",
    "telefonla_ayarla": "Setup via Phone",

    "tema_yesil": "Green (Dark)",
    "tema_altin": "Gold / Turkic",
    "tema_zumrut": "Emerald Green",
    "tema_kufi": "Kufi (Brown)",
    "tema_lacivert": "Navy Blue",
    "tema_mor": "Night Purple",
    "tema_acik": "Light (White)",
    "otomatik": "Automatic",
    "yatay_tv": "Landscape (TV)",
    "dikey": "Portrait",
    "boyut_kucuk": "Small",
    "boyut_normal": "Normal",
    "boyut_buyuk": "Large",
    "boyut_cok_buyuk": "Extra Large",
    "mod_surekli": "Always On",
    "mod_sabit": "Fixed Times",
    "mod_dinamik": "Prayer Times (Dynamic)",
    "mod_karma": "Hybrid (Times + Prayers)",
    "ip_bulunamadi": "Device IP not found",

    "namaz_vakitleri_baslik": "PRAYER TIMES",
    "imsakiye_baslik": "15 DAYS TIMETABLE",
    "tarih": "DATE"
};

const arTranslations = {
    "cami_bilgileri": "معلومات المسجد",
    "cami_adi": "اسم المسجد",
    "ekranda_gosterilecek_ad": "الاسم الذي سيظهر على الشاشة",
    "il": "المدينة",
    "ilce": "المنطقة",
    "gorunum": "المظهر",
    "tema": "السمة",
    "ekran_yonu": "اتجاه الشاشة",
    "yazi_boyutu": "حجم الخط",
    "dil_secimi": "اللغة",
    "icerik_gosterimi": "عرض المحتوى",
    "ayet_goster": "عرض آية قرآنية",
    "hadis_goster": "عرض حديث شريف",
    "esma_goster": "عرض أسماء الله الحسنى",
    "dua_goster": "عرض دعاء",
    "haftalik_imsakiye": "إمساكية أسبوعية",
    "alt_ticker": "شريط الأخبار السفلي",
    "hicri_tarih": "التاريخ الهجري",
    "carousel_suresi": "مدة عرض الشرائح",
    "slide_suresi_aciklama": "المدة الزمنية لكل شريحة",
    "ezan_cemaat": "الأذان والجماعة",
    "ezan_oncesi_bildirim": "تنبيه قبل الأذان",
    "ezan_bildirim_aciklama": "الدقائق قبل الأذان لإظهار الشاشة",
    "sabah_imsaka_gore": "الفجر حسب الإمساك",
    "sabah_imsaka_gore_aciklama": "أذان الفجر والعد التنازلي مرتبط بوقت الإمساك",
    "cemaat_goster": "عرض أوقات الإقامة",
    "cemaat_goster_aciklama": "الوقت الذي تقام فيه الصلاة بعد الأذان",
    "cemaat_dakikalari": "دقائق الإقامة (بعد الأذان)",
    "guc_yonetimi": "إدارة الطاقة",
    "calisma_modu": "وضع التشغيل",
    "sabit_saatlerde": "مفتوح في ساعات محددة",
    "sabit_acilis": "وقت الفتح الثابت",
    "sabit_kapanis": "وقت الإغلاق الثابت",
    "maks_parlaklik": "السطوع الأقصى (نشط)",
    "pasif_parlaklik": "السطوع الاقتصادي (خامل)",
    "esp32_entegrasyonu": "تكامل أجهزة إنترنت الأشياء (ESP32)",
    "role_kontrolu": "التحكم الذكي بالتبديل",
    "role_kontrolu_aciklama": "يتحكم في مكبرات الصوت والمقابس عبر ESP",
    "esp32_ip": "عنوان IP لـ ESP32",
    "ekstra_sensor": "قراءات إضافية للحساسات",
    "sicaklik_nem_goster": "عرض درجة الحرارة والرطوبة",
    "sifirla_yeniden_baslat": "إعادة تعيين وإعادة تشغيل",
    "otomatik_baslatma": "تشغيل تلقائي",
    "otomatik_baslatma_aciklama": "تشغيل التطبيق تلقائيًا عند بدء الجهاز",
    "ayarlari_kaydet": "حفظ وتطبيق الإعدادات",
    "telefonla_ayarla": "إعداد عبر الهاتف",

    "tema_yesil": "أخضر (داكن)",
    "tema_altin": "ذهبي / تركي",
    "tema_zumrut": "أخضر زمردي",
    "tema_kufi": "كوفي (بني)",
    "tema_lacivert": "أزرق داكن",
    "tema_mor": "أرجواني ليلي",
    "tema_acik": "فاتح (أبيض)",
    "otomatik": "تلقائي",
    "yatay_tv": "أفقي (تلفاز)",
    "dikey": "عمودي",
    "boyut_kucuk": "صغير",
    "boyut_normal": "عادي",
    "boyut_buyuk": "كبير",
    "boyut_cok_buyuk": "كبير جداً",
    "mod_surekli": "يعمل دائماً",
    "mod_sabit": "أوقات ثابتة",
    "mod_dinamik": "أوقات الصلاة (ديناميكي)",
    "mod_karma": "مختلط (أوقات + صلوات)",
    "ip_bulunamadi": "لا يوجد عنوان IP",

    "namaz_vakitleri_baslik": "أوقات الصلاة",
    "imsakiye_baslik": "إمساكية 15 يوماً",
    "tarih": "التاريخ"
};

// Replace function
function applyI18n(html) {
    let result = html;
    for (const [trText, key] of Object.entries(translations)) {
        // Find literal text instances inside standard DIVs, SPANs, OPTIONs, H2s etc.
        // We do a regex that captures the tags before and after
        const valSafe = trText.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&"); // escape string

        // Let's replace elements wrapping the exact text.
        // <div class="something">Cami Bilgileri</div> -> <div class="something" data-i18n="cami_bilgileri">Cami Bilgileri</div>
        const rg = new RegExp(`(<(div|span|h2|option|a|button)([^>]*)>)\\s*${valSafe}\\s*(</\\2>)`, 'g');

        result = result.replace(rg, (match, p1, p2, p3, p4) => {
            // if it already has data-i18n, skip
            if (p3.includes('data-i18n=')) return match;
            return `<${p2}${p3} data-i18n="${key}">${trText}${p4}`;
        });
    }
    return result;
}

settingsHtml = applyI18n(settingsHtml);
indexHtml = applyI18n(indexHtml);

fs.writeFileSync(settingsPath, settingsHtml);
fs.writeFileSync(indexPath, indexHtml);

// Now update i18n.js
// We inject the new keys into I18nData
let i18nContent = fs.readFileSync(i18nPath, 'utf8');

// Convert objects to JSON fragments to inject
function objToJsStr(obj) {
    let str = "";
    for (let [k, v] of Object.entries(obj)) {
        str += `        "${k}": "${v.replace(/"/g, '\\"')}",\n`;
    }
    return str;
}

const trInject = objToJsStr(Object.fromEntries(Object.entries(translations).map(([k, v]) => [v, k])));
const enInject = objToJsStr(enTranslations);
const arInject = objToJsStr(arTranslations);

// Insert TR right before "ayarlar": "Ayarlar"
i18nContent = i18nContent.replace(/"ayarlar": "Ayarlar"\s*\}/, '"ayarlar": "Ayarlar",\n' + trInject.replace(/,\n$/, '\n') + '    }');
i18nContent = i18nContent.replace(/"ayarlar": "Settings"\s*\}/, '"ayarlar": "Settings",\n' + enInject.replace(/,\n$/, '\n') + '    }');
i18nContent = i18nContent.replace(/"ayarlar": "الإعدادات"\s*\}/, '"ayarlar": "الإعدادات",\n' + arInject.replace(/,\n$/, '\n') + '    }');

fs.writeFileSync(i18nPath, i18nContent);

console.log('Scripts injected metadata and translations successfully.');
