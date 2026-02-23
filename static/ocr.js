// OCR — Text Recognition (Tesseract.js v5)
document.addEventListener('DOMContentLoaded', function() {
    var dropZone = document.getElementById('dropZone');
    var fileInput = document.getElementById('fileInput');
    var previewWrap = document.getElementById('previewWrap');
    var previewImg = document.getElementById('previewImg');
    var btnBrowse = document.getElementById('btnBrowse');
    var btnPaste = document.getElementById('btnPaste');
    var btnClear = document.getElementById('btnClear');
    var btnRecognize = document.getElementById('btnRecognize');
    var btnCopy = document.getElementById('btnCopy');
    var btnDownload = document.getElementById('btnDownload');
    var btnClearResult = document.getElementById('btnClearResult');
    var progressWrap = document.getElementById('progressWrap');
    var progressBar = document.getElementById('progressBar');
    var statusText = document.getElementById('statusText');
    var resultText = document.getElementById('resultText');
    var resultInfo = document.getElementById('resultInfo');
    var confidenceBadge = document.getElementById('confidenceBadge');
    var ocrLang = document.getElementById('ocrLang');
    var btnCamera = document.getElementById('btnCamera');

    var currentFile = null;
    var worker = null;
    var isProcessing = false;

    // Check camera support
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        btnCamera.style.display = '';
    }

    // ── File Input ──
    dropZone.addEventListener('click', function() { fileInput.click(); });
    btnBrowse.addEventListener('click', function() { fileInput.click(); });

    fileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) loadImage(this.files[0]);
    });

    // Drag & drop
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        dropZone.classList.add('drag-active');
    });
    dropZone.addEventListener('dragleave', function() {
        dropZone.classList.remove('drag-active');
    });
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            loadImage(e.dataTransfer.files[0]);
        }
    });

    // Paste (Ctrl+V)
    document.addEventListener('paste', function(e) {
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                e.preventDefault();
                loadImage(items[i].getAsFile());
                return;
            }
        }
    });

    btnPaste.addEventListener('click', function() {
        if (navigator.clipboard && navigator.clipboard.read) {
            navigator.clipboard.read().then(function(items) {
                for (var i = 0; i < items.length; i++) {
                    var types = items[i].types;
                    for (var j = 0; j < types.length; j++) {
                        if (types[j].indexOf('image') !== -1) {
                            items[i].getType(types[j]).then(function(blob) {
                                loadImage(new File([blob], 'clipboard.png', { type: blob.type }));
                            });
                            return;
                        }
                    }
                }
            }).catch(function() {
                alert('No image in clipboard. Try Ctrl+V after copying a screenshot.');
            });
        }
    });

    // Camera capture
    btnCamera.addEventListener('click', function() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.onchange = function() {
            if (this.files && this.files[0]) loadImage(this.files[0]);
        };
        input.click();
    });

    function loadImage(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select an image file (PNG, JPG, WEBP, BMP, GIF)');
            return;
        }
        currentFile = file;
        var reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewWrap.classList.remove('d-none');
            dropZone.style.display = 'none';
            btnRecognize.disabled = false;
            // Reset result
            resetResult();
        };
        reader.readAsDataURL(file);
    }

    btnClear.addEventListener('click', function() {
        clearImage();
    });

    function clearImage() {
        currentFile = null;
        previewImg.src = '';
        previewWrap.classList.add('d-none');
        dropZone.style.display = '';
        btnRecognize.disabled = true;
        fileInput.value = '';
        progressWrap.classList.add('d-none');
    }

    function resetResult() {
        resultText.value = '';
        resultInfo.textContent = '';
        confidenceBadge.classList.add('d-none');
        btnCopy.disabled = true;
        btnDownload.disabled = true;
        btnClearResult.disabled = true;
    }

    // ── OCR Recognition ──
    btnRecognize.addEventListener('click', function() {
        if (!currentFile || isProcessing) return;
        recognize();
    });

    async function recognize() {
        isProcessing = true;
        btnRecognize.disabled = true;
        btnRecognize.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Processing...';
        progressWrap.classList.remove('d-none');
        resetResult();

        var lang = ocrLang.value;

        try {
            // Terminate previous worker if language changed
            if (worker) {
                await worker.terminate();
                worker = null;
            }

            updateProgress(0, 'Loading OCR engine...');

            worker = await Tesseract.createWorker(lang, 1, {
                logger: function(m) {
                    if (m.status === 'recognizing text') {
                        updateProgress(Math.round(m.progress * 100), 'Recognizing text...');
                    } else if (m.status === 'loading language traineddata') {
                        var pct = Math.round(m.progress * 100);
                        updateProgress(pct, 'Downloading language data... ' + pct + '%');
                    } else if (m.status) {
                        updateProgress(0, m.status);
                    }
                }
            });

            updateProgress(50, 'Recognizing text...');

            var result = await worker.recognize(currentFile);
            var text = result.data.text;
            var confidence = Math.round(result.data.confidence);

            updateProgress(100, 'Done!');

            resultText.value = text;
            resultText.readOnly = false;

            // Confidence badge
            confidenceBadge.textContent = confidence + '% confidence';
            confidenceBadge.className = 'ocr-confidence ' +
                (confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low');
            confidenceBadge.classList.remove('d-none');

            // Info
            var words = text.trim().split(/\s+/).filter(function(w) { return w; }).length;
            var chars = text.length;
            var lines = text.split('\n').filter(function(l) { return l.trim(); }).length;
            resultInfo.textContent = words + ' words · ' + chars + ' chars · ' + lines + ' lines';

            btnCopy.disabled = false;
            btnDownload.disabled = false;
            btnClearResult.disabled = false;

        } catch(err) {
            updateProgress(0, 'Error: ' + err.message);
            resultText.value = 'Error: ' + err.message;
        } finally {
            isProcessing = false;
            btnRecognize.disabled = false;
            btnRecognize.innerHTML = '<i class="bi bi-eye"></i> Recognize Text';
        }
    }

    function updateProgress(pct, status) {
        progressBar.style.width = pct + '%';
        progressBar.textContent = pct + '%';
        if (status) statusText.textContent = status;
    }

    // ── Result Actions ──
    btnCopy.addEventListener('click', function() {
        var text = resultText.value;
        if (!text) return;
        navigator.clipboard.writeText(text).then(function() {
            var orig = btnCopy.innerHTML;
            btnCopy.innerHTML = '<i class="bi bi-check2"></i> Copied!';
            setTimeout(function() { btnCopy.innerHTML = orig; }, 1500);
        });
    });

    btnDownload.addEventListener('click', function() {
        var text = resultText.value;
        if (!text) return;
        var blob = new Blob([text], { type: 'text/plain' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'ocr-result.txt';
        a.click();
        URL.revokeObjectURL(a.href);
    });

    btnClearResult.addEventListener('click', function() {
        resetResult();
    });

    // ── Pin star ──
    document.querySelectorAll('.pin-star').forEach(function(btn) {
        var toolId = btn.dataset.tool;
        var pinned = JSON.parse(localStorage.getItem('devhelper_pinned_tools') || '[]');
        var icon = btn.querySelector('i');
        if (pinned.indexOf(toolId) !== -1) {
            icon.className = 'bi bi-star-fill text-warning';
        }
        btn.addEventListener('click', function() {
            var pinned = JSON.parse(localStorage.getItem('devhelper_pinned_tools') || '[]');
            var idx = pinned.indexOf(toolId);
            if (idx !== -1) {
                pinned.splice(idx, 1);
                icon.className = 'bi bi-star';
            } else {
                pinned.push(toolId);
                icon.className = 'bi bi-star-fill text-warning';
            }
            localStorage.setItem('devhelper_pinned_tools', JSON.stringify(pinned));
        });
    });
});
