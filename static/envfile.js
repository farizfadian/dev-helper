// ── Env File Editor ──
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const compareFile = document.getElementById('compareFile');
    const pasteBtn = document.getElementById('pasteBtn');
    const addKeyBtn = document.getElementById('addKeyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportGroup = document.getElementById('exportGroup');
    const searchBar = document.getElementById('searchBar');
    const searchInput = document.getElementById('searchInput');
    const showComments = document.getElementById('showComments');
    const maskValues = document.getElementById('maskValues');
    const statsBar = document.getElementById('statsBar');
    const dropZone = document.getElementById('dropZone');
    const tableWrap = document.getElementById('tableWrap');
    const envBody = document.getElementById('envBody');
    const comparePanel = document.getElementById('comparePanel');
    const compareBody = document.getElementById('compareBody');

    let entries = []; // { type: 'kv'|'comment'|'blank', key, value, comment, raw }
    let compareEntries = null;

    function parseEnv(text) {
        const lines = text.split('\n');
        const result = [];
        for (let line of lines) {
            line = line.replace(/\r$/, '');
            const trimmed = line.trim();
            if (trimmed === '') {
                result.push({ type: 'blank', raw: line });
            } else if (trimmed.startsWith('#')) {
                result.push({ type: 'comment', raw: line, comment: trimmed });
            } else {
                const eqIdx = line.indexOf('=');
                if (eqIdx > 0) {
                    const key = line.substring(0, eqIdx).trim();
                    let val = line.substring(eqIdx + 1);
                    // Remove surrounding quotes
                    val = val.trim();
                    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                        val = val.slice(1, -1);
                    }
                    result.push({ type: 'kv', key, value: val, raw: line });
                } else {
                    result.push({ type: 'comment', raw: line, comment: trimmed });
                }
            }
        }
        return result;
    }

    function loadData(text) {
        entries = parseEnv(text);
        showUI();
        renderTable();
    }

    function showUI() {
        dropZone.classList.add('d-none');
        tableWrap.classList.remove('d-none');
        searchBar.classList.remove('d-none');
        [addKeyBtn, exportGroup, clearBtn].forEach(el => el.classList.remove('d-none'));
    }

    function renderTable() {
        const query = searchInput.value.toLowerCase().trim();
        const showCmts = showComments.checked;
        const mask = maskValues.checked;
        let kvCount = 0;
        let emptyCount = 0;

        let html = '';
        let idx = 0;
        entries.forEach((entry, i) => {
            if (entry.type === 'blank') return;
            if (entry.type === 'comment') {
                if (!showCmts) return;
                html += `<tr class="env-comment"><td></td><td colspan="2">${escapeHtml(entry.comment)}</td><td></td></tr>`;
                return;
            }

            kvCount++;
            if (entry.value === '') emptyCount++;

            if (query && !entry.key.toLowerCase().includes(query) && !entry.value.toLowerCase().includes(query)) return;

            idx++;
            const missingClass = compareEntries && !compareEntries.some(e => e.type === 'kv' && e.key === entry.key) ? ' env-row-extra' : '';
            const valDisplay = mask ? '••••••••' : escapeHtml(entry.value);
            const emptyClass = entry.value === '' ? ' env-empty' : '';

            html += `<tr data-idx="${i}" class="${missingClass}">
                <td style="color:var(--bs-secondary-color);">${idx}</td>
                <td class="key-cell"><input type="text" value="${escapeHtml(entry.key)}" data-field="key" data-idx="${i}"></td>
                <td class="val-cell"><input type="${mask ? 'password' : 'text'}" value="${escapeHtml(entry.value)}" data-field="value" data-idx="${i}"></td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-secondary py-0 px-1 copy-val-btn" data-idx="${i}" title="Copy value"><i class="bi bi-clipboard"></i></button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-1 delete-btn" data-idx="${i}" title="Delete"><i class="bi bi-trash"></i></button>
                    </div>
                </td>
            </tr>`;
        });

        envBody.innerHTML = html || '<tr><td colspan="4" class="text-center text-muted py-4">No entries</td></tr>';
        statsBar.innerHTML = `<span class="stats-badge badge bg-secondary">${kvCount} keys</span> ` +
            (emptyCount > 0 ? `<span class="stats-badge badge bg-warning text-dark">${emptyCount} empty</span>` : '');

        bindEvents();
    }

    function bindEvents() {
        envBody.querySelectorAll('input[data-field]').forEach(input => {
            input.addEventListener('change', function () {
                const idx = parseInt(this.dataset.idx);
                entries[idx][this.dataset.field] = this.value;
            });
        });
        envBody.querySelectorAll('.copy-val-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.dataset.idx);
                navigator.clipboard.writeText(entries[idx].value).then(() => {
                    this.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
                    setTimeout(() => { this.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1000);
                });
            });
        });
        envBody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const idx = parseInt(this.dataset.idx);
                entries.splice(idx, 1);
                renderTable();
            });
        });
    }

    // Generate .env text from entries
    function toEnvText() {
        return entries.map(e => {
            if (e.type === 'blank') return '';
            if (e.type === 'comment') return e.comment;
            const val = e.value.includes(' ') || e.value.includes('#') || e.value.includes('"')
                ? `"${e.value.replace(/"/g, '\\"')}"` : e.value;
            return `${e.key}=${val}`;
        }).join('\n');
    }

    // File input
    fileInput.addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = e => loadData(e.target.result);
        reader.readAsText(f); this.value = '';
    });

    // Paste
    pasteBtn.addEventListener('click', async function () {
        try { const t = await navigator.clipboard.readText(); if (t.trim()) loadData(t); } catch {
            const t = prompt('Paste .env content:');
            if (t && t.trim()) loadData(t);
        }
    });

    // Drop zone
    dropZone.addEventListener('click', () => fileInput.click());
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('drop-active'); }));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('drop-active'); }));
    dropZone.addEventListener('drop', function (e) {
        const f = e.dataTransfer.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = ev => loadData(ev.target.result);
        reader.readAsText(f);
    });

    // Add key
    addKeyBtn.addEventListener('click', function () {
        entries.push({ type: 'kv', key: 'NEW_KEY', value: '', raw: '' });
        renderTable();
        const lastInput = envBody.querySelector('tr:last-child input[data-field="key"]');
        if (lastInput) { lastInput.focus(); lastInput.select(); }
    });

    // Clear
    clearBtn.addEventListener('click', function () {
        entries = [];
        compareEntries = null;
        dropZone.classList.remove('d-none');
        tableWrap.classList.add('d-none');
        searchBar.classList.add('d-none');
        comparePanel.classList.add('d-none');
        [addKeyBtn, exportGroup, clearBtn].forEach(el => el.classList.add('d-none'));
    });

    // Search, filters
    searchInput.addEventListener('input', renderTable);
    showComments.addEventListener('change', renderTable);
    maskValues.addEventListener('change', renderTable);

    // Compare
    compareFile.addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            compareEntries = parseEnv(e.target.result);
            runCompare();
            renderTable();
        };
        reader.readAsText(f); this.value = '';
    });

    function runCompare() {
        if (!compareEntries || entries.length === 0) return;
        const envKeys = new Set(entries.filter(e => e.type === 'kv').map(e => e.key));
        const exampleKeys = new Set(compareEntries.filter(e => e.type === 'kv').map(e => e.key));

        const missing = [...exampleKeys].filter(k => !envKeys.has(k));
        const extra = [...envKeys].filter(k => !exampleKeys.has(k));

        let html = '';
        if (missing.length > 0) {
            html += `<p class="mb-1"><strong class="text-danger"><i class="bi bi-exclamation-triangle"></i> Missing keys (${missing.length}):</strong></p>`;
            html += '<div class="mb-2">' + missing.map(k => `<code class="me-1">${escapeHtml(k)}</code>`).join('') + '</div>';
        }
        if (extra.length > 0) {
            html += `<p class="mb-1"><strong class="text-warning"><i class="bi bi-info-circle"></i> Extra keys (${extra.length}):</strong></p>`;
            html += '<div class="mb-2">' + extra.map(k => `<code class="me-1">${escapeHtml(k)}</code>`).join('') + '</div>';
        }
        if (missing.length === 0 && extra.length === 0) {
            html = '<p class="mb-0 text-success"><i class="bi bi-check-circle"></i> All keys match!</p>';
        }

        compareBody.innerHTML = html;
        comparePanel.classList.remove('d-none');
    }

    // Export
    function downloadFile(content, name, mime) {
        const blob = new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name; a.click();
        URL.revokeObjectURL(url);
    }

    document.getElementById('exportEnv').addEventListener('click', e => { e.preventDefault(); downloadFile(toEnvText(), '.env', 'text/plain'); });
    document.getElementById('exportJson').addEventListener('click', function (e) {
        e.preventDefault();
        const obj = {};
        entries.filter(e => e.type === 'kv').forEach(e => { obj[e.key] = e.value; });
        downloadFile(JSON.stringify(obj, null, 2), 'env.json', 'application/json');
    });
    document.getElementById('exportYaml').addEventListener('click', function (e) {
        e.preventDefault();
        const lines = entries.filter(e => e.type === 'kv').map(e => {
            const v = e.value;
            const needsQuote = v === '' || v === 'true' || v === 'false' || !isNaN(Number(v)) || v.includes(':') || v.includes('#');
            return `${e.key}: ${needsQuote ? '"' + v.replace(/"/g, '\\"') + '"' : v}`;
        });
        downloadFile(lines.join('\n'), 'env.yaml', 'text/yaml');
    });
    document.getElementById('exportDocker').addEventListener('click', function (e) {
        e.preventDefault();
        const lines = entries.filter(e => e.type === 'kv').map(e => `${e.key}=${e.value}`);
        downloadFile(lines.join('\n'), 'docker.env', 'text/plain');
    });
    document.getElementById('exportCopy').addEventListener('click', function (e) {
        e.preventDefault();
        navigator.clipboard.writeText(toEnvText()).then(() => {
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i> Copied!';
            setTimeout(() => { this.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 1500);
        });
    });

    // Global paste
    document.addEventListener('paste', function (e) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
        const text = e.clipboardData.getData('text');
        if (text && text.trim() && entries.length === 0) { e.preventDefault(); loadData(text); }
    });

    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }
});
