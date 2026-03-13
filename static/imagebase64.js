document.addEventListener('DOMContentLoaded', function () {
    // ── Elements ──
    const dropZone = document.getElementById('dropZone');
    const imageFileInput = document.getElementById('imageFileInput');
    const b64FileInput = document.getElementById('b64FileInput');
    const b64Output = document.getElementById('b64Output');
    const b64Input = document.getElementById('b64Input');
    const imageMeta = document.getElementById('imageMeta');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const stats = document.getElementById('stats');
    const b64OutputStats = document.getElementById('b64OutputStats');
    const b64OutputSize = document.getElementById('b64OutputSize');
    const b64InputStats = document.getElementById('b64InputStats');
    const b64InputValid = document.getElementById('b64InputValid');
    const outputFormat = document.getElementById('outputFormat');
    const quality = document.getElementById('quality');
    const qualityVal = document.getElementById('qualityVal');
    const qualityRow = document.getElementById('qualityRow');
    const autoConvert = document.getElementById('autoConvert');
    const directionLabel = document.getElementById('directionLabel');
    const previewContainer = document.getElementById('previewContainer');
    const previewMeta = document.getElementById('previewMeta');

    // Panels
    const imageInputPanel = document.getElementById('imageInputPanel');
    const base64InputPanel = document.getElementById('base64InputPanel');
    const base64OutputPanel = document.getElementById('base64OutputPanel');
    const imagePreviewPanel = document.getElementById('imagePreviewPanel');
    const snippetsSection = document.getElementById('snippetsSection');
    const snippetsList = document.getElementById('snippetsList');

    // Snippet elements
    const snippetDataUri = document.getElementById('snippetDataUri');
    const snippetCss = document.getElementById('snippetCss');
    const snippetHtml = document.getElementById('snippetHtml');
    const snippetMd = document.getElementById('snippetMd');
    const snippetJson = document.getElementById('snippetJson');

    let mode = 'img2b64'; // 'img2b64' or 'b642img'
    let currentFile = null; // File object
    let currentDataUri = ''; // Full data:image/...;base64,...
    let currentB64 = ''; // Raw base64 string
    let currentMimeType = '';
    let debounceTimer = null;

    // ── Mode Switching ──

    function setMode(newMode) {
        mode = newMode;
        if (mode === 'img2b64') {
            directionLabel.textContent = 'to Base64';
            imageInputPanel.classList.remove('d-none');
            base64InputPanel.classList.add('d-none');
            base64OutputPanel.classList.remove('d-none');
            imagePreviewPanel.classList.add('d-none');
            snippetsSection.classList.remove('d-none');
            qualityRow.classList.remove('d-none');
        } else {
            directionLabel.textContent = 'from Base64';
            imageInputPanel.classList.add('d-none');
            base64InputPanel.classList.remove('d-none');
            base64OutputPanel.classList.add('d-none');
            imagePreviewPanel.classList.remove('d-none');
            snippetsSection.classList.add('d-none');
            qualityRow.classList.add('d-none');
        }
    }

    // ── Swap ──
    document.getElementById('swapBtn').addEventListener('click', function () {
        if (mode === 'img2b64') {
            // Transfer output to input for reverse
            if (currentDataUri) {
                setMode('b642img');
                b64Input.value = currentDataUri;
                updateB64InputStats();
                if (autoConvert.checked) b64ToImage();
            } else {
                setMode('b642img');
            }
        } else {
            // Transfer preview back
            setMode('img2b64');
            clearAll();
        }
    });

    // ── Convert Button ──
    document.getElementById('convertBtn').addEventListener('click', function () {
        if (mode === 'img2b64') {
            imageToBase64();
        } else {
            b64ToImage();
        }
    });

    // ── Image to Base64 ──

    function imageToBase64() {
        if (!currentFile) return;
        clearError();

        const fmt = outputFormat.value;
        const q = parseInt(quality.value) / 100;

        if (fmt === 'auto') {
            // Read as-is (preserves original format)
            const reader = new FileReader();
            reader.onload = function (e) {
                currentDataUri = e.target.result;
                currentMimeType = currentFile.type || guessMimeType(currentFile.name);
                currentB64 = currentDataUri.split(',')[1] || '';
                showBase64Output();
            };
            reader.readAsDataURL(currentFile);
        } else {
            // Convert via Canvas to specified format
            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);
                    currentDataUri = canvas.toDataURL(fmt, q);
                    currentMimeType = fmt;
                    currentB64 = currentDataUri.split(',')[1] || '';
                    showBase64Output();
                };
                img.onerror = function () {
                    showError('Failed to load image for conversion');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(currentFile);
        }
    }

    function showBase64Output() {
        b64Output.value = currentB64;
        updateSnippets();
        snippetsList.classList.remove('d-none');

        const rawSize = currentFile ? currentFile.size : 0;
        const b64Size = currentB64.length;
        b64OutputStats.textContent = b64Size.toLocaleString() + ' chars';
        b64OutputSize.textContent = formatSize(b64Size) + ' (base64)';
        if (rawSize) {
            stats.textContent = 'Original: ' + formatSize(rawSize) + ' | Base64: ' + formatSize(b64Size) + ' (ratio: ' + (b64Size / rawSize * 100).toFixed(1) + '%)';
        }
    }

    function updateSnippets() {
        if (!currentDataUri) return;
        snippetDataUri.textContent = currentDataUri.length > 120 ? currentDataUri.substring(0, 120) + '...' : currentDataUri;
        snippetCss.textContent = 'background-image: url(' + currentDataUri.substring(0, 80) + '...);';
        snippetHtml.textContent = '<img src="' + currentDataUri.substring(0, 60) + '..." alt="image" />';
        snippetMd.textContent = '![image](' + currentDataUri.substring(0, 60) + '...)';
        snippetJson.textContent = '"image": "' + currentB64.substring(0, 80) + '..."';

        // Store full values as data attributes
        snippetDataUri.dataset.full = currentDataUri;
        snippetCss.dataset.full = 'background-image: url(' + currentDataUri + ');';
        snippetHtml.dataset.full = '<img src="' + currentDataUri + '" alt="image" />';
        snippetMd.dataset.full = '![image](' + currentDataUri + ')';
        snippetJson.dataset.full = '"image": "' + currentB64 + '"';
    }

    // ── Base64 to Image ──

    function b64ToImage() {
        const input = b64Input.value.trim();
        if (!input) return;
        clearError();

        let dataUri;
        if (input.startsWith('data:image/')) {
            dataUri = input;
        } else {
            // Try to detect MIME from base64 header bytes
            const mime = detectMimeFromB64(input);
            dataUri = 'data:' + mime + ';base64,' + input;
        }

        const img = new Image();
        img.onload = function () {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(img);
            previewMeta.textContent = img.naturalWidth + ' x ' + img.naturalHeight + ' px | ' + formatSize(input.length) + ' (base64)';
            previewMeta.classList.remove('d-none');
            currentDataUri = dataUri;
            currentB64 = dataUri.split(',')[1] || input;
            currentMimeType = dataUri.match(/data:(image\/[^;]+)/)?.[1] || 'image/png';
            b64InputValid.innerHTML = '<span class="text-success"><i class="bi bi-check-circle"></i> Valid image</span>';
        };
        img.onerror = function () {
            showError('Invalid base64 image data. Make sure it is a valid base64-encoded image.');
            b64InputValid.innerHTML = '<span class="text-danger"><i class="bi bi-x-circle"></i> Invalid</span>';
            previewContainer.innerHTML = '<div class="preview-placeholder"><i class="bi bi-exclamation-triangle" style="font-size:2rem;color:var(--bs-danger);"></i><div>Cannot decode image</div></div>';
            previewMeta.classList.add('d-none');
        };
        img.style.maxWidth = '100%';
        img.style.maxHeight = '280px';
        img.style.objectFit = 'contain';
        img.style.borderRadius = '4px';
        img.src = dataUri;
    }

    // ── Drag & Drop ──

    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            loadImageFile(file);
        } else {
            showError('Please drop an image file (PNG, JPG, WebP, GIF, SVG, BMP, ICO)');
        }
    });
    dropZone.addEventListener('click', function () {
        imageFileInput.click();
    });

    // ── File Input ──

    imageFileInput.addEventListener('change', function () {
        if (this.files[0]) loadImageFile(this.files[0]);
        this.value = '';
    });

    function loadImageFile(file) {
        currentFile = file;
        clearError();

        // Show preview in drop zone
        const reader = new FileReader();
        reader.onload = function (e) {
            dropZone.innerHTML = '<img class="preview-img" src="' + e.target.result + '" alt="Preview">';
            imageMeta.textContent = file.name + ' | ' + formatSize(file.size) + ' | ' + (file.type || 'unknown type');
            imageMeta.classList.remove('d-none');

            // Get dimensions
            const img = new Image();
            img.onload = function () {
                imageMeta.textContent = file.name + ' | ' + img.naturalWidth + 'x' + img.naturalHeight + ' | ' + formatSize(file.size) + ' | ' + (file.type || 'unknown');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);

        if (autoConvert.checked) {
            setTimeout(imageToBase64, 100);
        }
    }

    // ── Paste Image (Ctrl+V) ──

    document.getElementById('pasteImageBtn').addEventListener('click', function () {
        navigator.clipboard.read().then(function (items) {
            for (const item of items) {
                for (const type of item.types) {
                    if (type.startsWith('image/')) {
                        item.getType(type).then(function (blob) {
                            const file = new File([blob], 'pasted-image.' + type.split('/')[1], { type: type });
                            loadImageFile(file);
                        });
                        return;
                    }
                }
            }
            showError('No image found in clipboard. Try copying an image first.');
        }).catch(function () {
            showError('Clipboard access denied. Try Ctrl+V instead.');
        });
    });

    // Global Ctrl+V paste handler
    document.addEventListener('paste', function (e) {
        if (mode !== 'img2b64') return;
        // Don't intercept if user is typing in textarea
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                const blob = items[i].getAsFile();
                loadImageFile(blob);
                return;
            }
        }
    });

    // ── Paste Base64 ──

    document.getElementById('pasteB64Btn').addEventListener('click', function () {
        navigator.clipboard.readText().then(function (text) {
            b64Input.value = text;
            updateB64InputStats();
            if (autoConvert.checked) b64ToImage();
        });
    });

    // ── Base64 File Import ──

    b64FileInput.addEventListener('change', function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            b64Input.value = e.target.result;
            updateB64InputStats();
            if (autoConvert.checked) b64ToImage();
        };
        reader.readAsText(file);
        this.value = '';
    });

    // ── Auto-convert on Base64 Input ──

    b64Input.addEventListener('input', function () {
        updateB64InputStats();
        if (autoConvert.checked) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(b64ToImage, 400);
        }
    });

    function updateB64InputStats() {
        const val = b64Input.value;
        if (val) {
            b64InputStats.textContent = val.length.toLocaleString() + ' chars';
        } else {
            b64InputStats.textContent = '';
            b64InputValid.innerHTML = '';
        }
    }

    // ── Quality Slider ──

    quality.addEventListener('input', function () {
        qualityVal.textContent = this.value + '%';
    });
    quality.addEventListener('change', function () {
        if (currentFile && autoConvert.checked && outputFormat.value !== 'auto') {
            imageToBase64();
        }
    });

    // ── Format Change ──

    outputFormat.addEventListener('change', function () {
        // Show/hide quality for formats that support it
        const fmt = this.value;
        if (fmt === 'image/png') {
            qualityRow.style.opacity = '0.5';
            qualityRow.title = 'PNG is lossless — quality does not apply';
        } else {
            qualityRow.style.opacity = '1';
            qualityRow.title = '';
        }
        if (currentFile && autoConvert.checked) {
            imageToBase64();
        }
    });

    // ── Copy Buttons ──

    document.getElementById('copyB64Btn').addEventListener('click', function () {
        if (!b64Output.value) return;
        copyText(b64Output.value, this);
    });

    document.getElementById('copyDataUriBtn').addEventListener('click', function () {
        if (!currentDataUri) return;
        copyText(currentDataUri, this);
    });

    document.getElementById('copyCssBtn').addEventListener('click', function () {
        if (!currentDataUri) return;
        copyText('background-image: url(' + currentDataUri + ');', this);
    });

    document.getElementById('copyHtmlBtn').addEventListener('click', function () {
        if (!currentDataUri) return;
        copyText('<img src="' + currentDataUri + '" alt="image" />', this);
    });

    document.getElementById('copyMdBtn').addEventListener('click', function () {
        if (!currentDataUri) return;
        copyText('![image](' + currentDataUri + ')', this);
    });

    document.getElementById('copyJsonBtn').addEventListener('click', function () {
        if (!currentB64) return;
        copyText('"image": "' + currentB64 + '"', this);
    });

    // Snippet items — click to copy
    document.querySelectorAll('.snippet-item').forEach(function (item) {
        item.addEventListener('click', function () {
            const valueEl = this.querySelector('.snippet-value');
            if (valueEl && valueEl.dataset.full) {
                copyText(valueEl.dataset.full, this.querySelector('.snippet-copy'));
            }
        });
    });

    // Copy image to clipboard (for b642img mode)
    document.getElementById('copyImgBtn').addEventListener('click', function () {
        if (!currentDataUri) return;
        const btn = this;
        fetch(currentDataUri)
            .then(function (r) { return r.blob(); })
            .then(function (blob) {
                // Clipboard API only supports PNG
                if (blob.type !== 'image/png') {
                    // Convert to PNG via canvas
                    const img = previewContainer.querySelector('img');
                    if (!img) return;
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    canvas.getContext('2d').drawImage(img, 0, 0);
                    canvas.toBlob(function (pngBlob) {
                        navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]).then(function () {
                            flashBtn(btn, 'Copied!');
                        });
                    }, 'image/png');
                } else {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () {
                        flashBtn(btn, 'Copied!');
                    });
                }
            }).catch(function () {
                showError('Failed to copy image to clipboard');
            });
    });

    // ── Download Buttons ──

    document.getElementById('downloadB64Btn').addEventListener('click', function () {
        if (!b64Output.value) return;
        downloadText(b64Output.value, 'image-base64.txt');
    });

    document.getElementById('downloadImgBtn').addEventListener('click', function () {
        if (!currentDataUri) return;
        const ext = currentMimeType ? currentMimeType.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg') : 'png';
        const a = document.createElement('a');
        a.href = currentDataUri;
        a.download = 'decoded-image.' + ext;
        a.click();
    });

    // Open in new tab
    document.getElementById('openNewTabBtn').addEventListener('click', function () {
        if (!currentDataUri) return;
        const w = window.open();
        w.document.write('<img src="' + currentDataUri + '" style="max-width:100%;background:repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 0 0/20px 20px;">');
        w.document.title = 'Image Preview';
    });

    // ── Clear Buttons ──

    document.getElementById('clearImageBtn').addEventListener('click', function () {
        resetDropZone();
        currentFile = null;
        currentDataUri = '';
        currentB64 = '';
        b64Output.value = '';
        imageMeta.classList.add('d-none');
        snippetsList.classList.add('d-none');
        b64OutputStats.textContent = '';
        b64OutputSize.textContent = '';
        stats.textContent = '';
        clearError();
    });

    document.getElementById('clearB64InputBtn').addEventListener('click', function () {
        b64Input.value = '';
        b64InputStats.textContent = '';
        b64InputValid.innerHTML = '';
        resetPreview();
        clearError();
    });

    document.getElementById('clearAllBtn').addEventListener('click', clearAll);

    function clearAll() {
        currentFile = null;
        currentDataUri = '';
        currentB64 = '';
        currentMimeType = '';
        resetDropZone();
        b64Output.value = '';
        b64Input.value = '';
        imageMeta.classList.add('d-none');
        snippetsList.classList.add('d-none');
        b64OutputStats.textContent = '';
        b64OutputSize.textContent = '';
        b64InputStats.textContent = '';
        b64InputValid.innerHTML = '';
        stats.textContent = '';
        resetPreview();
        clearError();
    }

    // ── Sample ──

    document.getElementById('sampleBtn').addEventListener('click', function () {
        if (mode === 'img2b64') {
            // Generate a sample 100x100 gradient image via Canvas
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            const gradient = ctx.createLinearGradient(0, 0, 200, 200);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 200, 200);
            // Draw text
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('Dev Helper', 100, 90);
            ctx.font = '14px sans-serif';
            ctx.fillText('Sample Image', 100, 115);

            canvas.toBlob(function (blob) {
                const file = new File([blob], 'sample-image.png', { type: 'image/png' });
                loadImageFile(file);
            }, 'image/png');
        } else {
            // Sample base64 — small 1x1 red PNG
            b64Input.value = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
            updateB64InputStats();
            b64ToImage();
        }
    });

    // ── Helper Functions ──

    function resetDropZone() {
        dropZone.innerHTML = '<i class="bi bi-image drop-icon"></i><span class="drop-text">Drop image here, paste, or click Browse</span><span class="drop-text small">PNG, JPG, WebP, GIF, SVG, BMP, ICO</span>';
    }

    function resetPreview() {
        previewContainer.innerHTML = '<div class="preview-placeholder"><i class="bi bi-image" style="font-size: 2rem;"></i><div>Image preview will appear here</div></div>';
        previewMeta.classList.add('d-none');
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorMsg.classList.remove('d-none');
    }

    function clearError() {
        errorMsg.classList.add('d-none');
    }

    function guessMimeType(filename) {
        const ext = (filename || '').split('.').pop().toLowerCase();
        const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon' };
        return map[ext] || 'image/png';
    }

    function detectMimeFromB64(b64) {
        // Detect image type from first bytes of base64
        if (b64.startsWith('iVBOR')) return 'image/png';
        if (b64.startsWith('/9j/')) return 'image/jpeg';
        if (b64.startsWith('R0lGOD')) return 'image/gif';
        if (b64.startsWith('UklGR')) return 'image/webp';
        if (b64.startsWith('PD94bW') || b64.startsWith('PHN2Zy')) return 'image/svg+xml';
        if (b64.startsWith('Qk0')) return 'image/bmp';
        return 'image/png'; // Default fallback
    }

    function formatSize(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' B';
    }

    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(function () {
            if (btn) flashBtn(btn, 'Copied!');
        });
    }

    function flashBtn(btn, msg) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="bi bi-check-lg"></i> ' + msg;
        setTimeout(function () { btn.innerHTML = orig; }, 1500);
    }

    function downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── Keyboard Shortcuts ──

    document.addEventListener('keydown', function (e) {
        // Ctrl+Enter → convert
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('convertBtn').click();
        }
    });

    // ── Init ──
    setMode('img2b64');
});
