const HISTORY_KEY = 'devhelper_recent_uploads';
const HISTORY_MAX = 20;

function loadHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch { return []; }
}

function saveHistory(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
}

document.addEventListener('DOMContentLoaded', function () {
    // Init Bootstrap tooltips
    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(function(el) {
        new bootstrap.Tooltip(el);
    });

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadProgress = document.getElementById('uploadProgress');
    const resultCard = document.getElementById('resultCard');
    const historySection = document.getElementById('historySection');
    const historyList = document.getElementById('historyList');

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            uploadFile(e.target.files[0]);
            fileInput.value = '';
        }
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drop-active');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-active');
        if (e.dataTransfer.files.length > 0) {
            uploadFile(e.dataTransfer.files[0]);
        }
    });

    // Ctrl+V paste
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) {
                    uploadFile(file);
                    return;
                }
            }
        }
    });

    function uploadFile(file) {
        // If pasted image has no proper name, give it a simple one
        // Server will add the timestamp prefix automatically
        const name = file.name;
        if (!name || name === 'image.png' || name === 'blob') {
            const ext = file.type ? '.' + file.type.split('/')[1].replace('jpeg', 'jpg') : '.png';
            file = new File([file], 'screenshot' + ext, { type: file.type });
        }

        const formData = new FormData();
        formData.append('file', file);

        uploadProgress.classList.remove('d-none');
        resultCard.classList.add('d-none');

        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => {
            if (!res.ok) throw new Error('Upload failed');
            return res.json();
        })
        .then(data => {
            uploadProgress.classList.add('d-none');
            showResult(data);
            addToHistory(data);
        })
        .catch(err => {
            uploadProgress.classList.add('d-none');
            alert('Upload failed: ' + err.message);
        });
    }

    const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const browserExts = ['.pdf', '.html', '.htm', '.txt', '.md', '.xml', '.json', '.csv', '.mp4', '.mp3', '.webm', '.ogg', '.wav'];

    const fileIcons = {
        '.pdf': 'bi-file-earmark-pdf text-danger',
        '.doc': 'bi-file-earmark-word text-primary',
        '.docx': 'bi-file-earmark-word text-primary',
        '.xls': 'bi-file-earmark-excel text-success',
        '.xlsx': 'bi-file-earmark-excel text-success',
        '.csv': 'bi-file-earmark-spreadsheet text-success',
        '.ppt': 'bi-file-earmark-ppt text-warning',
        '.pptx': 'bi-file-earmark-ppt text-warning',
        '.zip': 'bi-file-earmark-zip text-secondary',
        '.rar': 'bi-file-earmark-zip text-secondary',
        '.7z': 'bi-file-earmark-zip text-secondary',
        '.txt': 'bi-file-earmark-text text-muted',
        '.json': 'bi-file-earmark-code text-info',
        '.xml': 'bi-file-earmark-code text-info',
        '.html': 'bi-file-earmark-code text-info',
        '.js': 'bi-file-earmark-code text-warning',
        '.ts': 'bi-file-earmark-code text-primary',
        '.py': 'bi-file-earmark-code text-success',
        '.cs': 'bi-file-earmark-code text-primary',
        '.java': 'bi-file-earmark-code text-danger',
        '.mp4': 'bi-file-earmark-play text-info',
        '.mp3': 'bi-file-earmark-music text-purple',
    };

    function getFileExt(filename) {
        const dot = filename.lastIndexOf('.');
        return dot !== -1 ? filename.substring(dot).toLowerCase() : '';
    }

    function isImage(filename) {
        return imageExts.includes(getFileExt(filename));
    }

    function canOpenInBrowser(filename) {
        return browserExts.includes(getFileExt(filename));
    }

    function getFileIcon(filename) {
        const ext = getFileExt(filename);
        return fileIcons[ext] || 'bi-file-earmark text-secondary';
    }

    function showResult(data) {
        document.getElementById('resultFilename').textContent = data.filename;
        document.getElementById('fileUrl').value = data.url;
        document.getElementById('filePath').value = data.path;

        // Preview
        const previewArea = document.getElementById('previewArea');
        if (isImage(data.filename)) {
            previewArea.innerHTML = `
                <img src="${data.url}" class="rounded border"
                     style="width: 120px; height: 120px; object-fit: cover; cursor: pointer;"
                     title="Click to preview"
                     onclick="openLightbox('${data.url}')">
            `;
        } else {
            const clickable = canOpenInBrowser(data.filename);
            previewArea.innerHTML = `
                <div class="rounded border d-flex align-items-center justify-content-center bg-light"
                     style="width: 120px; height: 120px; ${clickable ? 'cursor: pointer;' : ''}"
                     ${clickable ? `onclick="window.open('${data.url}', '_blank')" title="Click to open PDF"` : ''}>
                    <i class="bi ${getFileIcon(data.filename)}" style="font-size: 3rem;"></i>
                </div>
            `;
        }

        resultCard.classList.remove('d-none');
    }

    function addToHistory(data) {
        // Save to localStorage
        const list = loadHistory();
        list.unshift({ filename: data.filename, url: data.url, path: data.path });
        saveHistory(list);

        // Render
        historySection.classList.remove('d-none');
        renderHistoryItem(data);
    }

    function renderHistoryItem(data) {
        const item = document.createElement('div');
        item.className = 'card card-body py-2 px-3 mb-2 small';

        let preview;
        if (isImage(data.filename)) {
            preview = `<img src="${data.url}" class="rounded me-2" style="width:32px;height:32px;object-fit:cover;cursor:pointer;" onclick="openLightbox('${data.url}')">`;
        } else if (canOpenInBrowser(data.filename)) {
            preview = `<i class="bi ${getFileIcon(data.filename)} me-2" style="font-size:1.2rem;cursor:pointer;" onclick="window.open('${data.url}', '_blank')" title="Open in browser"></i>`;
        } else {
            preview = `<i class="bi ${getFileIcon(data.filename)} me-2" style="font-size:1.2rem;"></i>`;
        }

        item.innerHTML = `
            <div class="d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center text-truncate me-2" style="max-width: 350px;">
                    ${preview}
                    <span class="text-truncate">${data.filename}</span>
                </div>
                <div>
                    <button class="btn btn-outline-primary btn-sm py-0 px-1 me-1" onclick="copyText('${data.url}')" title="Copy URL">
                        <i class="bi bi-link-45deg"></i>
                    </button>
                    <button class="btn btn-outline-secondary btn-sm py-0 px-1" onclick="copyText('${escapeForAttr(data.path)}')" title="Copy Path">
                        <i class="bi bi-folder2"></i>
                    </button>
                </div>
            </div>
        `;
        historyList.appendChild(item);
    }

    // Clear history button
    document.getElementById('clearHistoryBtn').addEventListener('click', function () {
        if (!confirm('Clear all recent uploads history?')) return;
        localStorage.removeItem(HISTORY_KEY);
        historyList.innerHTML = '';
        historySection.classList.add('d-none');
    });

    // Restore recent uploads from localStorage (must be after helper declarations)
    const saved = loadHistory();
    if (saved.length > 0) {
        historySection.classList.remove('d-none');
        saved.forEach(data => renderHistoryItem(data));
    }
});

function openLightbox(url) {
    document.getElementById('lightboxImg').src = url;
    new bootstrap.Modal(document.getElementById('lightboxModal')).show();
}

function escapeForAttr(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function copyField(fieldId) {
    const input = document.getElementById(fieldId);
    copyText(input.value);
}

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Brief visual feedback
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-success py-2 px-3 small';
        toast.style.zIndex = '9999';
        toast.textContent = 'Copied!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    });
}
