// ── i18n.js — Internationalization system for Dev Helper ──
(function() {
    'use strict';

    var LS_KEY = 'devhelper_language';
    var LANGUAGES = [
        { code: 'en', name: 'English', flag: 'us' },
        { code: 'en-GB', name: 'English (UK)', flag: 'gb' },
        { code: 'id', name: 'Bahasa Indonesia', flag: 'id' },
        { code: 'es', name: 'Español', flag: 'es' },
        { code: 'pt', name: 'Português', flag: 'br' },
        { code: 'de', name: 'Deutsch', flag: 'de' },
        { code: 'fr', name: 'Français', flag: 'fr' },
        { code: 'it', name: 'Italiano', flag: 'it' },
        { code: 'pl', name: 'Polski', flag: 'pl' },
        { code: 'hi', name: 'हिन्दी', flag: 'in' },
        { code: 'zh', name: '中文', flag: 'cn' },
        { code: 'ja', name: '日本語', flag: 'jp' },
        { code: 'ko', name: '한국어', flag: 'kr' },
        { code: 'ru', name: 'Русский', flag: 'ru' },
        { code: 'tr', name: 'Türkçe', flag: 'tr' },
        { code: 'nl', name: 'Nederlands', flag: 'nl' },
        { code: 'ar', name: 'العربية', flag: 'sa' },
        { code: 'th', name: 'ไทย', flag: 'th' },
        { code: 'vi', name: 'Tiếng Việt', flag: 'vn' },
        { code: 'uk', name: 'Українська', flag: 'ua' },
        { code: 'sv', name: 'Svenska', flag: 'se' },
    ];

    var currentLang = localStorage.getItem(LS_KEY) || 'en';
    var translations = {};
    var fallback = {};
    var isLoaded = false;

    // Deep get nested value by dot-separated key
    function deepGet(obj, path) {
        var keys = path.split('.');
        var val = obj;
        for (var i = 0; i < keys.length; i++) {
            if (val && typeof val === 'object') val = val[keys[i]];
            else return undefined;
        }
        return val;
    }

    // Translation function: t('key') or t('key', { name: 'X' })
    function t(key, params) {
        var val = deepGet(translations, key);
        if (val === undefined) val = deepGet(fallback, key);
        if (val === undefined || typeof val !== 'string') return key;
        if (params && typeof params === 'object') {
            return val.replace(/\{(\w+)\}/g, function(_, k) {
                return params[k] !== undefined ? params[k] : '{' + k + '}';
            });
        }
        return val;
    }

    // Apply translations to DOM elements with data-i18n attributes
    function applyTranslations() {
        if (!isLoaded) return;

        document.querySelectorAll('[data-i18n]').forEach(function(el) {
            var key = el.getAttribute('data-i18n');
            var translated = t(key);
            if (translated !== key) el.textContent = translated;
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-placeholder');
            var translated = t(key);
            if (translated !== key) el.placeholder = translated;
        });
        document.querySelectorAll('[data-i18n-title]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-title');
            var translated = t(key);
            if (translated !== key) el.title = translated;
        });
        document.querySelectorAll('[data-i18n-html]').forEach(function(el) {
            var key = el.getAttribute('data-i18n-html');
            var translated = t(key);
            if (translated !== key) el.innerHTML = translated;
        });

        // Auto-translate page heading (detected via pin star)
        translatePageHeading();
        // Auto-translate navbar tool names
        translateNavItems();
    }

    // Translate page heading text (h5 containing pin star)
    function translatePageHeading() {
        var pinStar = document.getElementById('pinToggle');
        if (!pinStar) return;
        var toolId = pinStar.dataset.tool;
        if (!toolId) return;
        var name = t('tools.' + toolId + '.name');
        if (name === 'tools.' + toolId + '.name') return;
        var h5 = pinStar.parentElement;
        if (!h5) return;
        var nodes = h5.childNodes;
        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].nodeType === 3 && nodes[i].textContent.trim()) {
                nodes[i].textContent = ' ' + name + ' ';
                break;
            }
        }
    }

    // Translate navbar pinned tool names
    function translateNavItems() {
        var navItems = document.querySelectorAll('#pinnedNav [data-tool]');
        navItems.forEach(function(li) {
            var toolId = li.dataset.tool;
            var link = li.querySelector('a');
            if (!link || !toolId) return;
            var name = t('tools.' + toolId + '.name');
            if (name === 'tools.' + toolId + '.name') return;
            var icon = link.querySelector('i');
            if (icon) {
                link.textContent = '';
                link.appendChild(icon);
                link.appendChild(document.createTextNode(' ' + name));
            }
        });
    }

    // Load translations from JSON
    function loadLanguage(lang) {
        return fetch('/static/i18n/' + lang + '.json')
            .then(function(resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            })
            .catch(function(e) {
                console.warn('i18n: Failed to load ' + lang + '.json:', e.message);
                return null;
            });
    }

    // Set language
    function setLanguage(lang) {
        currentLang = lang;
        localStorage.setItem(LS_KEY, lang);

        var promise;
        if (lang === 'en') {
            translations = fallback;
            promise = Promise.resolve();
        } else {
            promise = loadLanguage(lang).then(function(data) {
                translations = data || fallback;
            });
        }

        return promise.then(function() {
            applyTranslations();

            // Update language selector active state
            document.querySelectorAll('.lang-option').forEach(function(el) {
                el.classList.toggle('active', el.dataset.lang === lang);
            });

            // Update HTML lang attribute
            document.documentElement.lang = lang;

            // Dispatch event for page-specific JS
            window.dispatchEvent(new CustomEvent('devhelper-lang-change', { detail: { lang: lang } }));
        });
    }

    // Initialize
    function init() {
        return loadLanguage('en').then(function(data) {
            fallback = data || {};
            if (currentLang === 'en') {
                translations = fallback;
            } else {
                return loadLanguage(currentLang).then(function(d) {
                    translations = d || fallback;
                });
            }
        }).then(function() {
            isLoaded = true;
            applyTranslations();

            document.querySelectorAll('.lang-option').forEach(function(el) {
                el.classList.toggle('active', el.dataset.lang === currentLang);
            });

            document.documentElement.lang = currentLang;

            // Dispatch ready event
            window.dispatchEvent(new CustomEvent('devhelper-i18n-ready', { detail: { lang: currentLang } }));
        });
    }

    // Export to window
    window.t = t;
    window.i18n = {
        get lang() { return currentLang; },
        get languages() { return LANGUAGES; },
        get loaded() { return isLoaded; },
        setLanguage: setLanguage,
        applyTranslations: applyTranslations,
        init: init,
        t: t,
    };

    // Auto-init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
