// ── Translator — Ollama-powered translation tool ──
document.addEventListener('DOMContentLoaded', function () {
    // ── Constants ──
    var OLLAMA_KEY = 'devhelper_ollama_url';
    var HISTORY_KEY = 'devhelper_translator_history';
    var SETTINGS_KEY = 'devhelper_translator_settings';
    var DEFAULT_URL = 'http://localhost:11434';
    var MAX_HISTORY = 30;
    var AUTO_TRANSLATE_DELAY = 800; // ms debounce

    var LANGUAGES = [
        { code: 'auto', name: 'Auto-Detect' },
        { code: 'en', name: 'English' },
        { code: 'id', name: 'Bahasa Indonesia' },
        { code: 'es', name: 'Espa\u00f1ol' },
        { code: 'pt', name: 'Portugu\u00eas' },
        { code: 'de', name: 'Deutsch' },
        { code: 'fr', name: 'Fran\u00e7ais' },
        { code: 'it', name: 'Italiano' },
        { code: 'nl', name: 'Nederlands' },
        { code: 'pl', name: 'Polski' },
        { code: 'sv', name: 'Svenska' },
        { code: 'tr', name: 'T\u00fcrk\u00e7e' },
        { code: 'ru', name: '\u0420\u0443\u0441\u0441\u043a\u0438\u0439' },
        { code: 'uk', name: '\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430' },
        { code: 'ar', name: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' },
        { code: 'hi', name: '\u0939\u093f\u0928\u094d\u0926\u0940' },
        { code: 'zh', name: '\u4e2d\u6587' },
        { code: 'ja', name: '\u65e5\u672c\u8a9e' },
        { code: 'ko', name: '\ud55c\uad6d\uc5b4' },
        { code: 'th', name: '\u0e44\u0e17\u0e22' },
        { code: 'vi', name: 'Ti\u1ebfng Vi\u1ec7t' },
    ];

    // ── DOM ──
    var sourceLang = document.getElementById('sourceLang');
    var targetLang = document.getElementById('targetLang');
    var sourceText = document.getElementById('sourceText');
    var targetText = document.getElementById('targetText');
    var translateBtn = document.getElementById('translateBtn');
    var swapBtn = document.getElementById('swapBtn');
    var clearAllBtn = document.getElementById('clearAllBtn');
    var clearSourceBtn = document.getElementById('clearSourceBtn');
    var pasteBtn = document.getElementById('pasteBtn');
    var copyResultBtn = document.getElementById('copyResultBtn');
    var listenBtn = document.getElementById('listenBtn');
    var autoTranslate = document.getElementById('autoTranslate');
    var modelSelect = document.getElementById('modelSelect');
    var statusDot = document.getElementById('statusDot');
    var statusText = document.getElementById('statusText');
    var sourceCharCount = document.getElementById('sourceCharCount');
    var targetCharCount = document.getElementById('targetCharCount');
    var detectedLang = document.getElementById('detectedLang');
    var translationTime = document.getElementById('translationTime');
    var translatingOverlay = document.getElementById('translatingOverlay');
    var sourceLangLabel = document.getElementById('sourceLangLabel');
    var targetLangLabel = document.getElementById('targetLangLabel');
    var historyToggle = document.getElementById('historyToggle');
    var historyList = document.getElementById('historyList');
    var historyChevron = document.getElementById('historyChevron');
    var clearHistoryBtn = document.getElementById('clearHistoryBtn');
    var settingsBtn = document.getElementById('settingsBtn');

    // ── State ──
    var isTranslating = false;
    var abortController = null;
    var ollamaConnected = false;
    var autoTranslateTimer = null;
    var history = [];
    var historyOpen = false;

    // ── Settings ──
    function getSettings() {
        try {
            var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
            return {
                model: s.model || '',
                sourceLang: s.sourceLang || 'auto',
                targetLang: s.targetLang || 'en',
                autoTranslate: s.autoTranslate !== undefined ? s.autoTranslate : false,
            };
        } catch (e) {
            return { model: '', sourceLang: 'auto', targetLang: 'en', autoTranslate: false };
        }
    }

    function saveSettings(s) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    }

    function getOllamaUrl() {
        return localStorage.getItem(OLLAMA_KEY) || DEFAULT_URL;
    }

    // ── Populate language dropdowns ──
    function buildLangOptions(selectEl, includeAuto) {
        selectEl.innerHTML = '';
        LANGUAGES.forEach(function (lang) {
            if (lang.code === 'auto' && !includeAuto) return;
            var opt = document.createElement('option');
            opt.value = lang.code;
            opt.textContent = lang.name;
            selectEl.appendChild(opt);
        });
    }

    buildLangOptions(sourceLang, true);
    buildLangOptions(targetLang, false);

    // Restore saved language selections
    var settings = getSettings();
    sourceLang.value = settings.sourceLang;
    targetLang.value = settings.targetLang;
    autoTranslate.checked = settings.autoTranslate;

    // ── Language name helper ──
    function getLangName(code) {
        for (var i = 0; i < LANGUAGES.length; i++) {
            if (LANGUAGES[i].code === code) return LANGUAGES[i].name;
        }
        return code;
    }

    // ── Update labels ──
    function updateLabels() {
        sourceLangLabel.textContent = sourceLang.value === 'auto' ? 'Source (Auto-Detect)' : getLangName(sourceLang.value);
        targetLangLabel.textContent = getLangName(targetLang.value);
    }
    updateLabels();

    sourceLang.addEventListener('change', function () {
        updateLabels();
        var s = getSettings();
        s.sourceLang = sourceLang.value;
        saveSettings(s);
        if (autoTranslate.checked && sourceText.value.trim()) scheduleAutoTranslate();
    });

    targetLang.addEventListener('change', function () {
        updateLabels();
        var s = getSettings();
        s.targetLang = targetLang.value;
        saveSettings(s);
        if (autoTranslate.checked && sourceText.value.trim()) scheduleAutoTranslate();
    });

    // ── Model loading ──
    function loadModels() {
        var ollamaUrl = getOllamaUrl();
        statusDot.className = 'status-dot checking';
        statusText.textContent = 'Checking Ollama...';

        fetch('/api/aichat/models?url=' + encodeURIComponent(ollamaUrl))
            .then(function (resp) { return resp.json(); })
            .then(function (data) {
                if (data.error) throw new Error(data.error);
                if (data.models && data.models.length > 0) {
                    modelSelect.innerHTML = '';
                    var savedModel = getSettings().model;
                    data.models.forEach(function (m) {
                        var opt = document.createElement('option');
                        opt.value = m.name;
                        opt.textContent = m.name;
                        if (m.name === savedModel) opt.selected = true;
                        modelSelect.appendChild(opt);
                    });
                    if (!savedModel || !data.models.some(function (m) { return m.name === savedModel; })) {
                        // Prefer aya-expanse if available
                        var preferred = data.models.find(function (m) { return m.name.indexOf('aya') >= 0; });
                        if (preferred) modelSelect.value = preferred.name;
                    }
                    statusDot.className = 'status-dot connected';
                    statusText.textContent = 'Connected';
                    ollamaConnected = true;
                } else {
                    modelSelect.innerHTML = '<option value="">No models found</option>';
                    statusDot.className = 'status-dot disconnected';
                    statusText.textContent = 'No models available';
                    ollamaConnected = false;
                }
            })
            .catch(function (err) {
                modelSelect.innerHTML = '<option value="">Connection failed</option>';
                statusDot.className = 'status-dot disconnected';
                statusText.textContent = 'Disconnected';
                ollamaConnected = false;
            });
    }

    modelSelect.addEventListener('change', function () {
        var s = getSettings();
        s.model = modelSelect.value;
        saveSettings(s);
    });

    // ── Translate ──
    function translate() {
        var text = sourceText.value.trim();
        if (!text) { showToast('Enter text to translate'); return; }
        if (isTranslating) return;
        if (!ollamaConnected) { showToast('Not connected to Ollama'); return; }

        var model = modelSelect.value;
        if (!model) { showToast('No model selected'); return; }

        var srcLang = sourceLang.value;
        var tgtLang = targetLang.value;
        var srcName = srcLang === 'auto' ? '' : getLangName(srcLang);
        var tgtName = getLangName(tgtLang);

        // Build prompt
        var prompt;
        if (srcLang === 'auto') {
            prompt = 'Translate the following text to ' + tgtName + '. Reply with ONLY the translation, nothing else. Do not add quotes, explanations, or notes.\n\n' + text;
        } else {
            prompt = 'Translate the following ' + srcName + ' text to ' + tgtName + '. Reply with ONLY the translation, nothing else. Do not add quotes, explanations, or notes.\n\n' + text;
        }

        var messages = [
            { role: 'system', content: 'You are a professional translator. You translate text accurately and naturally. Reply with ONLY the translated text. Never add explanations, notes, or alternative translations.' },
            { role: 'user', content: prompt }
        ];

        isTranslating = true;
        targetText.value = '';
        translatingOverlay.classList.add('show');
        translateBtn.disabled = true;
        translateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Translating...';
        translationTime.textContent = '';
        detectedLang.textContent = '';

        abortController = new AbortController();
        var startTime = Date.now();
        var result = '';

        fetch('/api/aichat/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ollamaUrl: getOllamaUrl(),
                model: model,
                messages: messages,
            }),
            signal: abortController.signal,
        })
        .then(function (resp) {
            if (!resp.ok) throw new Error('Server error ' + resp.status);
            var reader = resp.body.getReader();
            var decoder = new TextDecoder();
            var buffer = '';

            translatingOverlay.classList.remove('show');

            function processStream() {
                return reader.read().then(function (chunk) {
                    if (chunk.done) return;

                    buffer += decoder.decode(chunk.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (var i = 0; i < lines.length; i++) {
                        var line = lines[i];
                        if (line.indexOf('data: ') !== 0) continue;
                        var data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            var parsed = JSON.parse(data);
                            if (parsed.message && parsed.message.content) {
                                result += parsed.message.content;
                                targetText.value = result;
                                targetCharCount.textContent = result.length + ' characters';
                            }
                        } catch (e) { /* skip */ }
                    }

                    return processStream();
                });
            }

            return processStream();
        })
        .then(function () {
            var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            translationTime.textContent = elapsed + 's';

            // Clean up — remove leading/trailing quotes if present
            var cleaned = result.trim();
            if ((cleaned.charAt(0) === '"' && cleaned.charAt(cleaned.length - 1) === '"') ||
                (cleaned.charAt(0) === '\u201c' && cleaned.charAt(cleaned.length - 1) === '\u201d')) {
                cleaned = cleaned.slice(1, -1);
            }
            targetText.value = cleaned;
            targetCharCount.textContent = cleaned.length + ' characters';

            // Auto-detect: try to detect source language from context
            if (srcLang === 'auto' && cleaned) {
                detectSourceLanguage(text);
            }

            // Save to history
            addToHistory(text, cleaned, srcLang, tgtLang);
        })
        .catch(function (err) {
            if (err.name !== 'AbortError') {
                targetText.value = 'Error: ' + err.message;
                showToast('Translation failed: ' + err.message);
            }
        })
        .finally(function () {
            isTranslating = false;
            abortController = null;
            translatingOverlay.classList.remove('show');
            translateBtn.disabled = false;
            translateBtn.innerHTML = '<i class="bi bi-translate"></i> Translate';
        });
    }

    // ── Detect source language (lightweight) ──
    function detectSourceLanguage(text) {
        var model = modelSelect.value;
        if (!model || !ollamaConnected) return;

        var messages = [
            { role: 'system', content: 'You are a language detector. Reply with ONLY the language name in English. Nothing else.' },
            { role: 'user', content: 'What language is the following text written in? Reply with just the language name.\n\n' + text.slice(0, 200) }
        ];

        fetch('/api/aichat/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ollamaUrl: getOllamaUrl(),
                model: model,
                messages: messages,
            }),
        })
        .then(function (resp) { return resp.body.getReader(); })
        .then(function (reader) {
            var decoder = new TextDecoder();
            var buffer = '';
            var langResult = '';

            function read() {
                return reader.read().then(function (chunk) {
                    if (chunk.done) return;
                    buffer += decoder.decode(chunk.value, { stream: true });
                    var lines = buffer.split('\n');
                    buffer = lines.pop();
                    for (var i = 0; i < lines.length; i++) {
                        if (lines[i].indexOf('data: ') !== 0) continue;
                        var d = lines[i].slice(6);
                        if (d === '[DONE]') continue;
                        try {
                            var p = JSON.parse(d);
                            if (p.message && p.message.content) langResult += p.message.content;
                        } catch (e) {}
                    }
                    return read();
                });
            }

            return read().then(function () {
                var detected = langResult.trim().split('\n')[0].trim();
                if (detected) {
                    detectedLang.textContent = 'Detected: ' + detected;
                }
            });
        })
        .catch(function () { /* silent */ });
    }

    // ── Event Handlers ──

    translateBtn.addEventListener('click', function () {
        if (isTranslating) {
            if (abortController) abortController.abort();
        } else {
            translate();
        }
    });

    // Ctrl+Enter to translate
    sourceText.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            translate();
        }
    });

    // Char count update
    sourceText.addEventListener('input', function () {
        var len = sourceText.value.length;
        sourceCharCount.textContent = len + ' characters';
        if (autoTranslate.checked && sourceText.value.trim()) {
            scheduleAutoTranslate();
        }
    });

    // Auto-translate debounce
    function scheduleAutoTranslate() {
        if (autoTranslateTimer) clearTimeout(autoTranslateTimer);
        autoTranslateTimer = setTimeout(function () {
            if (sourceText.value.trim() && !isTranslating) translate();
        }, AUTO_TRANSLATE_DELAY);
    }

    autoTranslate.addEventListener('change', function () {
        var s = getSettings();
        s.autoTranslate = autoTranslate.checked;
        saveSettings(s);
    });

    // Swap languages
    swapBtn.addEventListener('click', function () {
        if (sourceLang.value === 'auto') {
            showToast('Cannot swap when source is Auto-Detect');
            return;
        }
        var tmpLang = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = tmpLang;

        var tmpText = sourceText.value;
        sourceText.value = targetText.value;
        targetText.value = tmpText;

        updateLabels();
        sourceCharCount.textContent = sourceText.value.length + ' characters';
        targetCharCount.textContent = targetText.value.length + ' characters';
        detectedLang.textContent = '';

        var s = getSettings();
        s.sourceLang = sourceLang.value;
        s.targetLang = targetLang.value;
        saveSettings(s);
    });

    // Paste
    pasteBtn.addEventListener('click', function () {
        navigator.clipboard.readText().then(function (text) {
            sourceText.value = text;
            sourceCharCount.textContent = text.length + ' characters';
            sourceText.focus();
            if (autoTranslate.checked && text.trim()) scheduleAutoTranslate();
        }).catch(function () {
            showToast('Failed to read clipboard');
        });
    });

    // Copy result
    copyResultBtn.addEventListener('click', function () {
        var text = targetText.value;
        if (!text) { showToast('Nothing to copy'); return; }
        navigator.clipboard.writeText(text).then(function () {
            copyResultBtn.innerHTML = '<i class="bi bi-check"></i> Copied!';
            setTimeout(function () {
                copyResultBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy';
            }, 1500);
        });
    });

    // Listen (TTS)
    var currentUtterance = null;
    listenBtn.addEventListener('click', function () {
        if (speechSynthesis.speaking) {
            speechSynthesis.cancel();
            listenBtn.innerHTML = '<i class="bi bi-volume-up"></i>';
            return;
        }
        var text = targetText.value.trim();
        if (!text) { showToast('No text to listen'); return; }
        var utterance = new SpeechSynthesisUtterance(text);
        var tgtCode = targetLang.value;
        // Map to BCP-47 for speech synthesis
        var langMap = { en: 'en-US', id: 'id-ID', es: 'es-ES', pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', it: 'it-IT', nl: 'nl-NL', pl: 'pl-PL', sv: 'sv-SE', tr: 'tr-TR', ru: 'ru-RU', uk: 'uk-UA', ar: 'ar-SA', hi: 'hi-IN', zh: 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', th: 'th-TH', vi: 'vi-VN' };
        utterance.lang = langMap[tgtCode] || tgtCode;
        utterance.rate = 0.9;
        listenBtn.innerHTML = '<i class="bi bi-stop-circle"></i>';
        utterance.onend = function () { listenBtn.innerHTML = '<i class="bi bi-volume-up"></i>'; };
        utterance.onerror = function () { listenBtn.innerHTML = '<i class="bi bi-volume-up"></i>'; };
        speechSynthesis.speak(utterance);
    });

    // Clear
    clearSourceBtn.addEventListener('click', function () {
        sourceText.value = '';
        sourceCharCount.textContent = '0 characters';
        detectedLang.textContent = '';
        sourceText.focus();
    });

    clearAllBtn.addEventListener('click', function () {
        sourceText.value = '';
        targetText.value = '';
        sourceCharCount.textContent = '0 characters';
        targetCharCount.textContent = '0 characters';
        detectedLang.textContent = '';
        translationTime.textContent = '';
        sourceText.focus();
    });

    // Settings
    settingsBtn.addEventListener('click', function () {
        document.getElementById('settingsOllamaUrl').value = getOllamaUrl();
        new bootstrap.Modal(document.getElementById('settingsModal')).show();
    });

    document.getElementById('saveSettingsBtn').addEventListener('click', function () {
        var newUrl = document.getElementById('settingsOllamaUrl').value.trim() || DEFAULT_URL;
        localStorage.setItem(OLLAMA_KEY, newUrl);
        bootstrap.Modal.getInstance(document.getElementById('settingsModal')).hide();
        showToast('Settings saved');
        loadModels();
    });

    // ── History ──
    function loadHistory() {
        try { history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); }
        catch (e) { history = []; }
    }

    function saveHistory() {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function addToHistory(source, target, srcLang, tgtLang) {
        // Avoid duplicates of the exact same source
        history = history.filter(function (h) { return h.source !== source; });
        history.unshift({
            source: source.slice(0, 200),
            target: target.slice(0, 200),
            srcLang: srcLang,
            tgtLang: tgtLang,
            time: new Date().toISOString(),
        });
        if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
        saveHistory();
        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            historyList.innerHTML = '<div class="text-center text-muted small p-3">No translations yet</div>';
            return;
        }

        var html = '';
        history.forEach(function (h, idx) {
            var srcName = h.srcLang === 'auto' ? 'Auto' : getLangName(h.srcLang);
            var tgtName = getLangName(h.tgtLang);
            html += '<div class="history-item" data-idx="' + idx + '">' +
                '<div class="hist-source">' + escapeHtml(h.source) + '</div>' +
                '<span class="hist-arrow"><i class="bi bi-arrow-right"></i></span>' +
                '<div class="hist-target">' + escapeHtml(h.target) + '</div>' +
                '<span class="hist-langs">' + srcName + ' → ' + tgtName + '</span>' +
                '</div>';
        });
        historyList.innerHTML = html;

        historyList.querySelectorAll('.history-item').forEach(function (el) {
            el.addEventListener('click', function () {
                var idx = parseInt(this.dataset.idx);
                var h = history[idx];
                if (!h) return;
                sourceText.value = h.source;
                targetText.value = h.target;
                if (h.srcLang !== 'auto') sourceLang.value = h.srcLang;
                targetLang.value = h.tgtLang;
                updateLabels();
                sourceCharCount.textContent = h.source.length + ' characters';
                targetCharCount.textContent = h.target.length + ' characters';
            });
        });
    }

    historyToggle.addEventListener('click', function (e) {
        if (e.target.closest('#clearHistoryBtn')) return;
        historyOpen = !historyOpen;
        historyList.style.display = historyOpen ? '' : 'none';
        historyChevron.className = historyOpen ? 'bi bi-chevron-up ms-2' : 'bi bi-chevron-down ms-2';
    });

    clearHistoryBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        history = [];
        saveHistory();
        renderHistory();
        showToast('History cleared');
    });

    // ── Toast ──
    function showToast(msg) {
        var toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-dark py-2 px-3 small shadow-sm';
        toast.style.zIndex = '9999';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 1500);
    }

    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ── Init ──
    loadHistory();
    renderHistory();
    loadModels();
    sourceText.focus();
});
