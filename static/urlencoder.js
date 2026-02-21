document.addEventListener('DOMContentLoaded', function () {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const urlParserSection = document.getElementById('urlParserSection');
    const urlPartsBody = document.getElementById('urlPartsBody');

    // ── Encode ──
    document.getElementById('encodeBtn').addEventListener('click', function () {
        const text = inputText.value;
        if (!text) return;
        const mode = document.querySelector('input[name="encodeMode"]:checked').value;
        try {
            if (mode === 'component') {
                outputText.value = encodeURIComponent(text);
            } else {
                outputText.value = encodeURI(text);
            }
        } catch (e) {
            outputText.value = 'Error: ' + e.message;
        }
    });

    // ── Decode ──
    document.getElementById('decodeBtn').addEventListener('click', function () {
        const text = inputText.value;
        if (!text) return;
        const mode = document.querySelector('input[name="encodeMode"]:checked').value;
        try {
            if (mode === 'component') {
                outputText.value = decodeURIComponent(text);
            } else {
                outputText.value = decodeURI(text);
            }
            // Try to parse as URL
            parseURL(outputText.value);
        } catch (e) {
            outputText.value = 'Error: ' + e.message;
        }
    });

    // ── Swap ──
    document.getElementById('swapBtn').addEventListener('click', function () {
        const temp = inputText.value;
        inputText.value = outputText.value;
        outputText.value = temp;
    });

    // ── Clear ──
    document.getElementById('clearInputBtn').addEventListener('click', function () {
        inputText.value = '';
    });

    document.getElementById('clearAllBtn').addEventListener('click', function () {
        inputText.value = '';
        outputText.value = '';
        urlParserSection.classList.add('d-none');
    });

    // ── Copy ──
    document.getElementById('copyBtn').addEventListener('click', function () {
        if (!outputText.value) return;
        navigator.clipboard.writeText(outputText.value).then(() => {
            const btn = document.getElementById('copyBtn');
            const orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(() => btn.innerHTML = orig, 1500);
        });
    });

    // ── Paste ──
    document.getElementById('pasteBtn').addEventListener('click', function () {
        navigator.clipboard.readText().then(text => {
            inputText.value = text;
            // Auto-parse URL
            parseURL(text);
        });
    });

    // ── Auto-parse URL on input ──
    inputText.addEventListener('input', function () {
        parseURL(inputText.value);
    });

    // ── URL Parser ──
    function parseURL(text) {
        const trimmed = text.trim();
        try {
            // Only parse if it looks like a URL
            if (!trimmed.match(/^https?:\/\//i)) {
                urlParserSection.classList.add('d-none');
                return;
            }
            const url = new URL(trimmed);
            const parts = [];

            parts.push(['Protocol', url.protocol]);
            if (url.username) parts.push(['Username', url.username]);
            if (url.password) parts.push(['Password', url.password]);
            parts.push(['Host', url.host]);
            if (url.port) parts.push(['Port', url.port]);
            parts.push(['Pathname', url.pathname]);
            if (url.search) {
                parts.push(['Query', url.search]);
                // Parse individual query params
                url.searchParams.forEach((value, key) => {
                    parts.push(['  ' + key, value]);
                });
            }
            if (url.hash) parts.push(['Hash', url.hash]);

            urlPartsBody.innerHTML = parts.map(([label, value]) => {
                const isParam = label.startsWith('  ');
                const displayLabel = isParam ? `<span class="text-muted">├─</span> ${label.trim()}` : label;
                return `<tr><td>${displayLabel}</td><td>${escapeHtml(value)}</td></tr>`;
            }).join('');

            urlParserSection.classList.remove('d-none');
        } catch {
            urlParserSection.classList.add('d-none');
        }
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
});
