// ── Log Viewer ──

let selectedFile = null;
let lastResponse = null;
let currentMode = 'upload'; // 'upload' or 'paste'
let tags = []; // keyword tags

const dropZone = document.getElementById('dropZone');
const dropText = document.getElementById('dropText');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitBtn');
const downloadBtn = document.getElementById('downloadBtn');
const tagsContainer = document.getElementById('tagsContainer');
const tagInput = document.getElementById('tagInput');
const pasteArea = document.getElementById('pasteArea');
const pasteInfo = document.getElementById('pasteInfo');

// ── localStorage Keys ──

const LS_TAGS = 'devhelper_logviewer_tags';
const LS_PASTE = 'devhelper_logviewer_paste';
const LS_TAB = 'devhelper_logviewer_tab';

function saveTags() {
    localStorage.setItem(LS_TAGS, JSON.stringify(tags));
}

function savePasteText() {
    localStorage.setItem(LS_PASTE, pasteArea.value);
}

function saveTab() {
    localStorage.setItem(LS_TAB, currentMode);
}

// ── Tag / Chips Input ──

function addTag(text) {
    text = text.trim();
    if (!text) return;
    // Avoid duplicates (case-insensitive)
    if (tags.some(t => t.toLowerCase() === text.toLowerCase())) return;

    tags.push(text);
    renderTags();
    tagInput.value = '';
    saveTags();
    updateSubmitState();
}

function removeTag(index) {
    tags.splice(index, 1);
    renderTags();
    tagInput.focus();
    saveTags();
    updateSubmitState();
}

function clearTags() {
    tags = [];
    renderTags();
    saveTags();
    tagInput.focus();
    updateSubmitState();
}

function clearPasteText() {
    pasteArea.value = '';
    pasteInfo.textContent = '';
    localStorage.removeItem(LS_PASTE);
    pasteArea.focus();
    updateSubmitState();
}

function renderTags() {
    // Remove existing tag elements
    tagsContainer.querySelectorAll('.tag').forEach(el => el.remove());

    // Insert tags before the input
    tags.forEach((text, i) => {
        const tag = document.createElement('span');
        tag.className = 'tag';
        tag.innerHTML = `<span title="${escapeHtml(text)}">${escapeHtml(text)}</span><button type="button" onclick="removeTag(${i})" title="Remove">&times;</button>`;
        tagsContainer.insertBefore(tag, tagInput);
    });

    // Update placeholder
    tagInput.placeholder = tags.length === 0
        ? 'Type keyword and press Enter or comma...'
        : 'Add more...';

    // Toggle clear button
    const clearBtn = document.getElementById('clearTagsBtn');
    if (tags.length > 0) {
        clearBtn.classList.remove('d-none');
    } else {
        clearBtn.classList.add('d-none');
    }
}

function getKeywordsString() {
    return tags.join(',');
}

function getKeywordsArray() {
    return [...tags];
}

tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        // Split by comma in case user pastes "ERROR,WARN,timeout"
        const parts = tagInput.value.split(',');
        parts.forEach(p => addTag(p));
        tagInput.value = '';
    } else if (e.key === 'Tab' && tagInput.value.trim()) {
        e.preventDefault();
        addTag(tagInput.value);
    } else if (e.key === 'Backspace' && !tagInput.value && tags.length > 0) {
        removeTag(tags.length - 1);
    }
});

// Handle paste of comma-separated keywords
tagInput.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData('text');
    const parts = pasted.split(',');
    parts.forEach(p => addTag(p));
});

tagInput.addEventListener('input', updateSubmitState);

// Submit on Enter key when tags exist and input is empty
tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !tagInput.value.trim() && tags.length > 0 && !submitBtn.disabled) {
        e.preventDefault();
        submitFilter();
    }
});

// ── Tab Switching ──

document.getElementById('tabUpload').addEventListener('shown.bs.tab', () => {
    currentMode = 'upload';
    saveTab();
    updateSubmitState();
});

document.getElementById('tabPaste').addEventListener('shown.bs.tab', () => {
    currentMode = 'paste';
    saveTab();
    pasteArea.focus();
    updateSubmitState();
});

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

// ── Paste Handling ──

pasteArea.addEventListener('input', () => {
    const text = pasteArea.value;
    if (text) {
        const lineCount = text.split('\n').length;
        const size = new Blob([text]).size;
        pasteInfo.textContent = `${lineCount.toLocaleString()} lines | ${formatSize(size)}`;
    } else {
        pasteInfo.textContent = '';
    }
    savePasteText();
    updateSubmitState();
});

// ── Submit State ──

function updateSubmitState() {
    const hasSource = currentMode === 'upload'
        ? !!selectedFile
        : pasteArea.value.trim().length > 0;
    const hasKeywords = tags.length > 0 || tagInput.value.trim().length > 0;
    submitBtn.disabled = !(hasSource && hasKeywords);
}

// ── Filter Submission ──

async function submitFilter() {
    // Flush any pending text in tagInput as a tag
    if (tagInput.value.trim()) {
        const parts = tagInput.value.split(',');
        parts.forEach(p => addTag(p));
        tagInput.value = '';
    }

    if (tags.length === 0) return;

    const hasSource = currentMode === 'upload'
        ? !!selectedFile
        : pasteArea.value.trim().length > 0;
    if (!hasSource) return;

    const formData = new FormData();

    if (currentMode === 'upload') {
        formData.append('file', selectedFile);
    } else {
        formData.append('content', pasteArea.value);
    }

    formData.append('keyword', getKeywordsString());
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

    const sourceLabel = data.fileName === 'pasted-text'
        ? `Source: Pasted text (${data.fileSize})`
        : `File: ${data.fileName} (${data.fileSize})`;
    statsText.textContent = `Showing ${data.matchedLines.toLocaleString()} of ${data.totalLines.toLocaleString()} lines | ${sourceLabel} | Processed in ${data.elapsedMs} ms`;

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
    const keywords = getKeywordsArray();
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

// ── Restore State from localStorage ──

(function restoreState() {
    // Restore tags
    try {
        const saved = localStorage.getItem(LS_TAGS);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                parsed.forEach(t => { if (typeof t === 'string' && t.trim()) tags.push(t.trim()); });
                renderTags();
            }
        }
    } catch (e) { /* ignore */ }

    // Restore pasted text
    const savedPaste = localStorage.getItem(LS_PASTE);
    if (savedPaste) {
        pasteArea.value = savedPaste;
        // Trigger info update
        pasteArea.dispatchEvent(new Event('input'));
    }

    // Restore active tab
    const savedTab = localStorage.getItem(LS_TAB);
    if (savedTab === 'paste') {
        const pasteTab = document.getElementById('tabPaste');
        new bootstrap.Tab(pasteTab).show();
    }

    updateSubmitState();
})();
