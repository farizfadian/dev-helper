// ── Log Viewer ──

let selectedFile = null;
let lastResponse = null;

const dropZone = document.getElementById('dropZone');
const dropText = document.getElementById('dropText');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitBtn');
const downloadBtn = document.getElementById('downloadBtn');
const keywordInput = document.getElementById('keywordInput');

// ── File Upload Handling ──

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        selectFile(e.target.files[0]);
    }
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drop-active');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drop-active');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drop-active');
    if (e.dataTransfer.files.length > 0) {
        selectFile(e.dataTransfer.files[0]);
    }
});

function selectFile(file) {
    selectedFile = file;
    dropZone.classList.add('has-file');
    dropText.innerHTML = `<i class="bi bi-file-earmark-check text-success"></i> <strong>${escapeHtml(file.name)}</strong> (${formatSize(file.size)})`;
    updateSubmitState();
}

function updateSubmitState() {
    submitBtn.disabled = !(selectedFile && keywordInput.value.trim());
}

keywordInput.addEventListener('input', updateSubmitState);

// Submit on Enter key
keywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !submitBtn.disabled) {
        submitFilter();
    }
});

// ── Filter Submission ──

async function submitFilter() {
    if (!selectedFile || !keywordInput.value.trim()) return;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('keyword', keywordInput.value.trim());
    formData.append('mode', document.querySelector('input[name="mode"]:checked').value);
    formData.append('caseSensitive', document.getElementById('caseSensitive').checked.toString());
    formData.append('regex', document.getElementById('useRegex').checked.toString());
    formData.append('contextLines', document.getElementById('contextLines').value);

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Filtering...';

    try {
        const resp = await fetch('/api/logviewer', { method: 'POST', body: formData });
        if (!resp.ok) {
            const errText = await resp.text();
            alert('Error: ' + errText);
            return;
        }

        lastResponse = await resp.json();
        renderResults(lastResponse);
    } catch (err) {
        alert('Request failed: ' + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="bi bi-funnel"></i> Filter';
        updateSubmitState();
    }
}

// ── Render Results ──

function renderResults(data) {
    // Stats bar
    const statsBar = document.getElementById('statsBar');
    const statsText = document.getElementById('statsText');
    statsBar.classList.remove('d-none');
    statsText.textContent = `Showing ${data.matchedLines.toLocaleString()} of ${data.totalLines.toLocaleString()} lines | File: ${data.fileName} (${data.fileSize}) | Processed in ${data.elapsedMs} ms`;

    // Action buttons
    document.getElementById('copyBtn').classList.remove('d-none');
    document.getElementById('saveBtn').classList.remove('d-none');
    if (navigator.share) document.getElementById('shareBtn').classList.remove('d-none');
    downloadBtn.classList.remove('d-none');
    document.getElementById('savedInfo').classList.add('d-none');

    // Results table
    const tbody = document.getElementById('resultsBody');
    tbody.innerHTML = '';

    if (data.results.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-4">
            <i class="bi bi-search fs-1 d-block mb-2"></i>
            No matches found for the given keywords
        </td></tr>`;
        return;
    }

    // Get keywords for highlighting
    const keywords = keywordInput.value.trim().split(',').map(k => k.trim()).filter(k => k);
    const isRegex = document.getElementById('useRegex').checked;
    const isCaseSensitive = document.getElementById('caseSensitive').checked;

    for (const row of data.results) {
        const tr = document.createElement('tr');

        if (row.lineNum === -1) {
            // Separator
            tr.className = 'result-separator';
            tr.innerHTML = `<td colspan="3">${row.text}</td>`;
        } else {
            const copyBtn = `<button class="line-copy-btn" title="Copy line" onclick="copyText(\`${escapeForTemplate(row.text)}\`)"><i class="bi bi-clipboard"></i></button>`;
            const content = row.isMatch
                ? highlightKeywords(escapeHtml(row.text), keywords, isRegex, isCaseSensitive)
                : escapeHtml(row.text);
            tr.className = row.isMatch ? 'result-match' : 'result-context';
            tr.innerHTML = `<td class="line-num">${row.lineNum}</td><td class="log-text">${content}</td><td class="line-copy-cell">${copyBtn}</td>`;
        }

        tbody.appendChild(tr);
    }
}

// ── Highlight Keywords ──

function highlightKeywords(text, keywords, isRegex, isCaseSensitive) {
    if (!keywords.length) return text;

    for (const kw of keywords) {
        try {
            let pattern;
            if (isRegex) {
                pattern = new RegExp(`(${kw})`, isCaseSensitive ? 'g' : 'gi');
            } else {
                pattern = new RegExp(`(${escapeRegex(kw)})`, isCaseSensitive ? 'g' : 'gi');
            }
            text = text.replace(pattern, '<mark>$1</mark>');
        } catch (e) {
            // Invalid regex, skip
        }
    }
    return text;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── Copy Results ──

function getResultsText() {
    if (!lastResponse || !lastResponse.results.length) return '';
    return lastResponse.results
        .filter(r => r.lineNum !== -1)
        .map(r => r.text)
        .join('\n');
}

function copyResults() {
    const text = getResultsText();
    if (text) copyText(text);
}

// ── Share Results ──

async function shareResults() {
    const text = getResultsText();
    if (!text) return;

    try {
        await navigator.share({
            title: `Filtered: ${lastResponse.fileName}`,
            text: text
        });
    } catch (err) {
        if (err.name !== 'AbortError') {
            // Fallback to copy if share fails
            copyText(text);
        }
    }
}

// ── Save Results to /files ──

async function saveResults() {
    if (!lastResponse || !lastResponse.results.length) return;

    const lines = lastResponse.results
        .filter(r => r.lineNum !== -1)
        .map(r => r.text);

    const content = lines.join('\n');
    const baseName = lastResponse.fileName.replace(/\.[^.]+$/, '');
    const fileName = `${baseName}_filtered.log`;

    const blob = new Blob([content], { type: 'text/plain' });
    const file = new File([blob], fileName, { type: 'text/plain' });

    const formData = new FormData();
    formData.append('file', file);

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

    try {
        const resp = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!resp.ok) {
            alert('Failed to save file');
            return;
        }

        const data = await resp.json();

        // Show saved file info
        document.getElementById('savedUrl').value = data.url;
        document.getElementById('savedPath').value = data.path;
        document.getElementById('savedInfo').classList.remove('d-none');
    } catch (err) {
        alert('Save failed: ' + err.message);
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="bi bi-save"></i> Save';
    }
}

// ── Download Results ──

function downloadResults() {
    if (!lastResponse || !lastResponse.results.length) return;

    const lines = lastResponse.results
        .filter(r => r.lineNum !== -1)
        .map(r => r.text);

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const baseName = lastResponse.fileName.replace(/\.[^.]+$/, '');
    a.download = `${baseName}_filtered.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── Utilities ──

function escapeForTemplate(str) {
    return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatSize(bytes) {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return bytes + ' B';
}

function copyField(fieldId) {
    const field = document.getElementById(fieldId);
    copyText(field.value);
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 badge bg-success fs-6';
        toast.textContent = 'Copied!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    });
}
