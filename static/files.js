document.addEventListener('DOMContentLoaded', function () {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadProgress = document.getElementById('uploadProgress');
    const filesGrid = document.getElementById('filesGrid');
    const emptyState = document.getElementById('emptyState');
    const deleteAllBtn = document.getElementById('deleteAllBtn');
    const fileCount = document.getElementById('fileCount');
    const searchBox = document.getElementById('searchBox');

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
        '.txt': 'bi-file-earmark-text text-muted',
        '.md': 'bi-file-earmark-text text-muted',
        '.html': 'bi-file-earmark-code text-info',
        '.htm': 'bi-file-earmark-code text-info',
        '.json': 'bi-file-earmark-code text-info',
        '.xml': 'bi-file-earmark-code text-info',
        '.js': 'bi-file-earmark-code text-warning',
        '.ts': 'bi-file-earmark-code text-primary',
        '.py': 'bi-file-earmark-code text-success',
        '.cs': 'bi-file-earmark-code text-primary',
        '.java': 'bi-file-earmark-code text-danger',
        '.mp4': 'bi-file-earmark-play text-info',
        '.mp3': 'bi-file-earmark-music text-purple',
    };

    let filesMap = {};
    let allFiles = [];

    function getExt(name) {
        const i = name.lastIndexOf('.');
        return i !== -1 ? name.substring(i).toLowerCase() : '';
    }

    function isImage(name) { return imageExts.includes(getExt(name)); }
    function canOpenInBrowser(name) { return browserExts.includes(getExt(name)); }
    function getIcon(name) { return fileIcons[getExt(name)] || 'bi-file-earmark text-secondary'; }

    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function esc(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // Load files on page load
    loadFiles();

    // Search with debounce
    let searchTimeout;
    searchBox.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => renderFiles(), 200);
    });

    // Click to browse
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        for (const f of e.target.files) uploadFile(f);
        fileInput.value = '';
    });

    // Drag & drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drop-active'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('drop-active'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-active');
        for (const f of e.dataTransfer.files) uploadFile(f);
    });

    // Ctrl+V paste
    document.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.kind === 'file') {
                const file = item.getAsFile();
                if (file) uploadFile(file);
            }
        }
    });

    // Delete All
    deleteAllBtn.addEventListener('click', () => {
        if (!confirm('Delete ALL files? This cannot be undone.')) return;
        fetch('/api/files?all=true', { method: 'DELETE' }).then(() => loadFiles());
    });

    function uploadFile(file) {
        const name = file.name;
        if (!name || name === 'image.png' || name === 'blob') {
            const ext = file.type ? '.' + file.type.split('/')[1].replace('jpeg', 'jpg') : '.png';
            file = new File([file], 'screenshot' + ext, { type: file.type });
        }

        const formData = new FormData();
        formData.append('file', file);
        uploadProgress.classList.remove('d-none');

        fetch('/api/upload', { method: 'POST', body: formData })
            .then(res => { if (!res.ok) throw new Error('Upload failed'); return res.json(); })
            .then(() => { uploadProgress.classList.add('d-none'); loadFiles(); })
            .catch(err => { uploadProgress.classList.add('d-none'); alert('Upload failed: ' + err.message); });
    }

    function loadFiles() {
        fetch('/api/files')
            .then(res => res.json())
            .then(files => {
                files.sort((a, b) => b.modTime.localeCompare(a.modTime));
                allFiles = files;
                filesMap = {};
                files.forEach(f => filesMap[f.filename] = f);
                renderFiles();
            });
    }

    function renderFiles() {
        const search = searchBox.value.trim().toLowerCase();
        const filtered = search
            ? allFiles.filter(f => f.filename.toLowerCase().includes(search))
            : allFiles;

        if (allFiles.length === 0) {
            filesGrid.innerHTML = '';
            filesGrid.appendChild(emptyState);
            emptyState.classList.remove('d-none');
            deleteAllBtn.classList.add('d-none');
            fileCount.textContent = '';
            return;
        }

        emptyState.classList.add('d-none');
        deleteAllBtn.classList.remove('d-none');

        if (filtered.length === 0) {
            fileCount.textContent = `0 / ${allFiles.length} files`;
            filesGrid.innerHTML = '<div class="col-12 text-center text-muted py-5">No files match your search</div>';
            return;
        }

        fileCount.textContent = search
            ? `${filtered.length} / ${allFiles.length} files`
            : `${allFiles.length} files`;

        filesGrid.innerHTML = filtered.map(f => {
            const fname = esc(f.filename);
            let preview;
            if (isImage(f.filename)) {
                preview = `<img src="${f.url}" class="card-img-top" style="height: 140px; object-fit: cover; cursor: pointer;"
                                onclick="openLightbox('${f.url}')">`;
            } else if (canOpenInBrowser(f.filename)) {
                preview = `<div class="card-img-top d-flex align-items-center justify-content-center bg-light"
                                style="height: 140px; cursor: pointer;" onclick="window.open('${f.url}','_blank')">
                                <i class="bi ${getIcon(f.filename)}" style="font-size: 3rem;"></i>
                           </div>`;
            } else {
                preview = `<div class="card-img-top d-flex align-items-center justify-content-center bg-light" style="height: 140px;">
                                <i class="bi ${getIcon(f.filename)}" style="font-size: 3rem;"></i>
                           </div>`;
            }

            return `
                <div class="col">
                    <div class="card h-100 shadow-sm">
                        ${preview}
                        <div class="card-body p-2">
                            <p class="card-text small text-truncate mb-1" title="${fname}">${fname}</p>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted">${formatSize(f.size)}</small>
                                <div>
                                    <button class="btn btn-outline-primary btn-sm py-0 px-1 me-1" onclick="showDetail('${fname}')" title="Details">
                                        <i class="bi bi-info-circle"></i>
                                    </button>
                                    <button class="btn btn-outline-danger btn-sm py-0 px-1" onclick="deleteFile('${fname}')" title="Delete">
                                        <i class="bi bi-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    window.deleteFile = function (filename) {
        if (!confirm('Delete "' + filename + '"?')) return;
        fetch('/api/files?name=' + encodeURIComponent(filename), { method: 'DELETE' }).then(() => loadFiles());
    };

    window.showDetail = function (filename) {
        const f = filesMap[filename];
        if (!f) return;
        document.getElementById('detailFilename').textContent = f.filename;
        document.getElementById('detailUrl').value = f.url;
        document.getElementById('detailPath').value = f.path;
        document.getElementById('detailMeta').textContent = 'Size: ' + formatSize(f.size) + ' — Uploaded: ' + new Date(f.modTime).toLocaleString('sv-SE');
        document.getElementById('detailDeleteBtn').onclick = () => {
            bootstrap.Modal.getInstance(document.getElementById('fileDetailModal')).hide();
            window.deleteFile(f.filename);
        };
        new bootstrap.Modal(document.getElementById('fileDetailModal')).show();
    };

    window.openLightbox = function (url) {
        document.getElementById('lightboxImg').src = url;
        new bootstrap.Modal(document.getElementById('lightboxModal')).show();
    };
});

function copyField(fieldId) {
    const input = document.getElementById(fieldId);
    navigator.clipboard.writeText(input.value).then(() => {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-success py-2 px-3 small';
        toast.style.zIndex = '9999';
        toast.textContent = 'Copied!';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 1500);
    });
}
