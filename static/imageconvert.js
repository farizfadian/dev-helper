document.addEventListener('DOMContentLoaded', function () {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const thumbGrid = document.getElementById('thumbGrid');
    const fileCount = document.getElementById('fileCount');
    const convertBtn = document.getElementById('convertBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const outputFormat = document.getElementById('outputFormat');
    const quality = document.getElementById('quality');
    const qualityVal = document.getElementById('qualityVal');
    const qualityNote = document.getElementById('qualityNote');
    const resizeMode = document.getElementById('resizeMode');
    const resizeInputs = document.getElementById('resizeInputs');
    const resizeW = document.getElementById('resizeW');
    const resizeH = document.getElementById('resizeH');
    const resizeSep = document.getElementById('resizeSep');
    const resizeUnit = document.getElementById('resizeUnit');
    const stripTransparency = document.getElementById('stripTransparency');
    const bgColor = document.getElementById('bgColor');
    const preserveName = document.getElementById('preserveName');
    const autoDownload = document.getElementById('autoDownload');
    const progressWrap = document.getElementById('progressWrap');
    const progressBar = document.getElementById('progressBar');
    const progressLabel = document.getElementById('progressLabel');
    const progressPercent = document.getElementById('progressPercent');
    const resultsSection = document.getElementById('resultsSection');
    const resultsBody = document.getElementById('resultsBody');
    const totalSaved = document.getElementById('totalSaved');
    const stats = document.getElementById('stats');

    // State
    let images = []; // { file, name, origUrl, origSize, origW, origH }
    let results = []; // { name, origSize, convSize, convUrl, convBlob, origUrl, origW, origH, newW, newH }

    // ── Drop Zone ──
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        addFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

    // Paste support
    document.addEventListener('paste', e => {
        const files = [];
        for (const item of e.clipboardData.items) {
            if (item.type.startsWith('image/')) {
                const f = item.getAsFile();
                if (f) files.push(f);
            }
        }
        if (files.length) addFiles(files);
    });

    function addFiles(fileList) {
        const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif', 'image/svg+xml', 'image/tiff', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/avif'];
        for (const f of fileList) {
            if (!f.type.startsWith('image/') && !validTypes.includes(f.type)) continue;
            const url = URL.createObjectURL(f);
            images.push({ file: f, name: f.name, origUrl: url, origSize: f.size, origW: 0, origH: 0 });
        }
        // Load dimensions
        images.forEach((img, i) => {
            if (img.origW > 0) return;
            const el = new Image();
            el.onload = () => { img.origW = el.naturalWidth; img.origH = el.naturalHeight; renderThumbs(); };
            el.src = img.origUrl;
        });
        renderThumbs();
        updateUI();
    }

    function renderThumbs() {
        if (images.length === 0) {
            thumbGrid.classList.add('d-none');
            dropZone.classList.remove('d-none');
            return;
        }
        dropZone.classList.add('d-none');
        thumbGrid.classList.remove('d-none');
        thumbGrid.innerHTML = images.map((img, i) => `
            <div class="thumb-card" data-idx="${i}">
                <button class="thumb-remove" onclick="removeImage(${i})" title="Remove">&times;</button>
                <div class="thumb-img-wrap"><img src="${img.origUrl}" alt="${esc(img.name)}"></div>
                <div class="thumb-info">
                    <div class="thumb-name" title="${esc(img.name)}">${esc(img.name)}</div>
                    <div class="thumb-meta">${formatSize(img.origSize)}${img.origW ? ` &middot; ${img.origW}&times;${img.origH}` : ''}</div>
                </div>
            </div>
        `).join('') + `
            <div class="thumb-card" style="cursor:pointer; display:flex; align-items:center; justify-content:center; min-height:100px;" onclick="document.getElementById('fileInput').click()">
                <div class="text-center text-muted">
                    <i class="bi bi-plus-lg" style="font-size:1.5rem;"></i>
                    <div style="font-size:0.75rem;">Add more</div>
                </div>
            </div>
        `;
    }

    window.removeImage = function (idx) {
        URL.revokeObjectURL(images[idx].origUrl);
        images.splice(idx, 1);
        renderThumbs();
        updateUI();
    };

    function updateUI() {
        fileCount.textContent = `${images.length} file${images.length !== 1 ? 's' : ''}`;
        convertBtn.disabled = images.length === 0;
        if (images.length === 0) {
            resultsSection.classList.add('d-none');
            results = [];
        }
    }

    // ── Quality slider ──
    quality.addEventListener('input', () => { qualityVal.textContent = quality.value + '%'; });
    outputFormat.addEventListener('change', updateQualityState);
    function updateQualityState() {
        const fmt = outputFormat.value;
        const hasQuality = (fmt === 'image/jpeg' || fmt === 'image/webp');
        quality.disabled = !hasQuality;
        qualityNote.textContent = hasQuality ? 'Applies to JPEG & WebP' : 'Not applicable for this format';
    }

    // ── Resize controls ──
    resizeMode.addEventListener('change', () => {
        const mode = resizeMode.value;
        if (mode === 'none') {
            resizeInputs.classList.add('d-none');
            return;
        }
        resizeInputs.classList.remove('d-none');
        resizeW.classList.remove('d-none');
        resizeH.classList.add('d-none');
        resizeSep.classList.add('d-none');
        resizeUnit.textContent = '';

        if (mode === 'percent') {
            resizeW.placeholder = 'Percent';
            resizeW.value = '50';
            resizeUnit.textContent = '%';
        } else if (mode === 'width') {
            resizeW.placeholder = 'Max width';
            resizeW.value = '800';
            resizeUnit.textContent = 'px';
        } else if (mode === 'height') {
            resizeW.placeholder = 'Max height';
            resizeW.value = '600';
            resizeUnit.textContent = 'px';
        } else if (mode === 'fit' || mode === 'exact') {
            resizeW.placeholder = 'Width';
            resizeW.value = '800';
            resizeH.placeholder = 'Height';
            resizeH.value = '600';
            resizeH.classList.remove('d-none');
            resizeSep.classList.remove('d-none');
            resizeUnit.textContent = 'px';
        }
    });

    // ── Strip transparency ──
    stripTransparency.addEventListener('change', () => {
        bgColor.classList.toggle('d-none', !stripTransparency.checked);
    });

    // ── Convert ──
    convertBtn.addEventListener('click', convertAll);

    async function convertAll() {
        if (images.length === 0) return;
        results = [];
        resultsBody.innerHTML = '';
        resultsSection.classList.add('d-none');
        progressWrap.classList.remove('d-none');
        convertBtn.disabled = true;

        const fmt = outputFormat.value;
        const q = (fmt === 'image/jpeg' || fmt === 'image/webp') ? parseInt(quality.value) / 100 : undefined;
        const mode = resizeMode.value;
        const wVal = parseInt(resizeW.value) || 0;
        const hVal = parseInt(resizeH.value) || 0;
        const strip = stripTransparency.checked;
        const bg = bgColor.value;
        const ext = formatToExt(fmt);

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            progressLabel.textContent = `Converting ${i + 1}/${images.length}: ${img.name}`;
            const pct = Math.round(((i) / images.length) * 100);
            progressBar.style.width = pct + '%';
            progressPercent.textContent = pct + '%';

            try {
                const result = await convertOne(img, fmt, q, mode, wVal, hVal, strip, bg, ext);
                results.push(result);
            } catch (err) {
                results.push({
                    name: img.name, origSize: img.origSize, convSize: 0, convUrl: null, convBlob: null,
                    origUrl: img.origUrl, origW: img.origW, origH: img.origH, newW: 0, newH: 0, error: err.message
                });
            }
        }

        progressBar.style.width = '100%';
        progressPercent.textContent = '100%';
        progressLabel.textContent = 'Done!';

        renderResults();
        resultsSection.classList.remove('d-none');
        convertBtn.disabled = false;
        downloadAllBtn.disabled = results.filter(r => r.convBlob).length === 0;

        setTimeout(() => { progressWrap.classList.add('d-none'); }, 1500);

        if (autoDownload.checked) downloadAll();

        updateStats();
    }

    function convertOne(img, fmt, q, mode, wVal, hVal, strip, bg, ext) {
        return new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => {
                let w = el.naturalWidth;
                let h = el.naturalHeight;

                // Resize calculation
                const dims = calcResize(w, h, mode, wVal, hVal);
                w = dims.w;
                h = dims.h;

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');

                // Background for transparency stripping or JPEG
                if (strip || fmt === 'image/jpeg' || fmt === 'image/bmp') {
                    ctx.fillStyle = strip ? bg : '#ffffff';
                    ctx.fillRect(0, 0, w, h);
                }

                ctx.drawImage(el, 0, 0, w, h);

                canvas.toBlob(blob => {
                    if (!blob) { reject(new Error('Conversion failed')); return; }
                    const outName = preserveName.checked
                        ? img.name.replace(/\.[^.]+$/, '') + '.' + ext
                        : img.name.replace(/\.[^.]+$/, '') + '_converted.' + ext;
                    const convUrl = URL.createObjectURL(blob);
                    resolve({
                        name: outName, origName: img.name,
                        origSize: img.origSize, convSize: blob.size,
                        convUrl, convBlob: blob,
                        origUrl: img.origUrl,
                        origW: el.naturalWidth, origH: el.naturalHeight,
                        newW: w, newH: h
                    });
                }, fmt, q);
            };
            el.onerror = () => reject(new Error('Failed to load image'));
            el.src = img.origUrl;
        });
    }

    function calcResize(w, h, mode, wVal, hVal) {
        if (mode === 'none' || !wVal) return { w, h };
        if (mode === 'percent') {
            const scale = wVal / 100;
            return { w: Math.round(w * scale), h: Math.round(h * scale) };
        }
        if (mode === 'width') {
            if (w <= wVal) return { w, h };
            const scale = wVal / w;
            return { w: wVal, h: Math.round(h * scale) };
        }
        if (mode === 'height') {
            if (h <= wVal) return { w, h };
            const scale = wVal / h;
            return { w: Math.round(w * scale), h: wVal };
        }
        if (mode === 'fit') {
            const sw = wVal / w, sh = hVal / h;
            const scale = Math.min(sw, sh, 1);
            return { w: Math.round(w * scale), h: Math.round(h * scale) };
        }
        if (mode === 'exact') {
            return { w: wVal, h: hVal };
        }
        return { w, h };
    }

    // ── Results ──
    function renderResults() {
        resultsBody.innerHTML = results.map((r, i) => {
            if (r.error) {
                return `<tr class="table-danger">
                    <td><i class="bi bi-x-circle text-danger"></i></td>
                    <td>${esc(r.name)}</td>
                    <td>${formatSize(r.origSize)}</td>
                    <td colspan="3"><span class="text-danger">${esc(r.error)}</span></td>
                    <td></td>
                </tr>`;
            }
            const diff = r.convSize - r.origSize;
            const pct = r.origSize ? Math.round((diff / r.origSize) * 100) : 0;
            const cls = diff < 0 ? 'size-smaller' : diff > 0 ? 'size-larger' : 'size-same';
            const sign = diff < 0 ? '' : '+';
            const dimChanged = (r.origW !== r.newW || r.origH !== r.newH);
            return `<tr>
                <td><img src="${r.convUrl}" style="max-width:48px;max-height:36px;border-radius:3px;cursor:pointer;" onclick="showCompare(${i})" title="Click to compare"></td>
                <td><span title="${esc(r.name)}">${esc(r.name)}</span></td>
                <td>${formatSize(r.origSize)}</td>
                <td>${formatSize(r.convSize)}</td>
                <td><span class="${cls}">${sign}${formatSize(Math.abs(diff))} (${sign}${pct}%)</span></td>
                <td>${r.newW}&times;${r.newH}${dimChanged ? ` <small class="text-muted">(was ${r.origW}&times;${r.origH})</small>` : ''}</td>
                <td>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-primary" onclick="downloadOne(${i})" title="Download"><i class="bi bi-download"></i></button>
                        <button class="btn btn-sm btn-outline-secondary" onclick="showCompare(${i})" title="Compare"><i class="bi bi-columns-gap"></i></button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    function updateStats() {
        const success = results.filter(r => !r.error);
        const totalOrig = success.reduce((s, r) => s + r.origSize, 0);
        const totalConv = success.reduce((s, r) => s + r.convSize, 0);
        const diff = totalConv - totalOrig;
        const pct = totalOrig ? Math.round((diff / totalOrig) * 100) : 0;
        const sign = diff < 0 ? '' : '+';
        totalSaved.textContent = `Total: ${formatSize(totalOrig)} → ${formatSize(totalConv)} (${sign}${pct}%)`;
        stats.textContent = `${success.length} converted successfully${results.length - success.length > 0 ? `, ${results.length - success.length} failed` : ''}`;
    }

    // ── Download ──
    window.downloadOne = function (idx) {
        const r = results[idx];
        if (!r || !r.convUrl) return;
        const a = document.createElement('a');
        a.href = r.convUrl;
        a.download = r.name;
        a.click();
    };

    downloadAllBtn.addEventListener('click', downloadAll);

    async function downloadAll() {
        const blobs = results.filter(r => r.convBlob);
        if (blobs.length === 0) return;

        if (blobs.length === 1) {
            downloadOne(results.indexOf(blobs[0]));
            return;
        }

        // Use JSZip if available, otherwise download individually
        if (typeof JSZip !== 'undefined') {
            const zip = new JSZip();
            blobs.forEach(r => zip.file(r.name, r.convBlob));
            const content = await zip.generateAsync({ type: 'blob' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(content);
            a.download = 'converted-images.zip';
            a.click();
            URL.revokeObjectURL(a.href);
        } else {
            // Fallback: download one by one
            blobs.forEach((r, i) => {
                setTimeout(() => {
                    const a = document.createElement('a');
                    a.href = r.convUrl;
                    a.download = r.name;
                    a.click();
                }, i * 300);
            });
        }
    }

    // ── Compare Modal ──
    window.showCompare = function (idx) {
        const r = results[idx];
        if (!r || r.error) return;
        document.getElementById('compareOrigImg').src = r.origUrl;
        document.getElementById('compareConvImg').src = r.convUrl;
        document.getElementById('compareOrigInfo').textContent = `${r.origW}×${r.origH} · ${formatSize(r.origSize)}`;
        document.getElementById('compareConvInfo').textContent = `${r.newW}×${r.newH} · ${formatSize(r.convSize)}`;
        new bootstrap.Modal(document.getElementById('compareModal')).show();
    };

    // ── Clear ──
    clearAllBtn.addEventListener('click', () => {
        images.forEach(img => URL.revokeObjectURL(img.origUrl));
        results.forEach(r => { if (r.convUrl) URL.revokeObjectURL(r.convUrl); });
        images = [];
        results = [];
        renderThumbs();
        updateUI();
        resultsSection.classList.add('d-none');
        progressWrap.classList.add('d-none');
        stats.textContent = '';
        totalSaved.textContent = '';
    });

    // ── Helpers ──
    function formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function formatToExt(mime) {
        const map = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/gif': 'gif' };
        return map[mime] || 'png';
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function copyText(text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied!');
        });
    }

    function showToast(msg) {
        let t = document.getElementById('_toast');
        if (!t) {
            t = document.createElement('div');
            t.id = '_toast';
            t.style.cssText = 'position:fixed;bottom:20px;right:20px;background:var(--bs-success);color:#fff;padding:8px 16px;border-radius:6px;font-size:0.85rem;z-index:9999;opacity:0;transition:opacity 0.3s;';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.opacity = '1';
        setTimeout(() => { t.style.opacity = '0'; }, 2000);
    }

    // Init
    updateQualityState();
});
