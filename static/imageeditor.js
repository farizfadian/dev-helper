document.addEventListener('DOMContentLoaded', function () {
    // ── Elements ──
    const canvas = document.getElementById('mainCanvas');
    const ctx = canvas.getContext('2d');
    const overlay = document.getElementById('overlayCanvas');
    const octx = overlay.getContext('2d');
    const canvasArea = document.getElementById('canvasArea');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const dropHint = document.getElementById('dropHint');
    const cropOverlay = document.getElementById('cropOverlay');
    const cropSelection = document.getElementById('cropSelection');
    const fileInput = document.getElementById('fileInput');

    // State
    let imgLoaded = false;
    let undoStack = [];
    let redoStack = [];
    const MAX_UNDO = 30;
    let zoom = 1;
    let currentTool = 'select'; // select, crop, draw, text, shape, picker
    let fileName = 'image';
    let fileType = 'image/png';
    let originalFileSize = 0;

    // Adjustments state
    let adjustments = { brightness: 0, contrast: 0, saturate: 0, hue: 0, blur: 0, opacity: 100 };
    let adjustmentsDirty = false;

    // Crop state
    let cropStart = null;
    let cropRect = null;
    let cropping = false;

    // Draw state
    let drawing = false;
    let lastX = 0, lastY = 0;
    let isEraser = false;

    // Shape state
    let shaping = false;
    let shapeStart = null;

    // Before/After state
    let originalImageData = null;
    let showingBefore = false;

    // ── Image Loading ──

    function loadImage(src, name, type, size) {
        const img = new Image();
        img.onload = function () {
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            syncOverlay();

            fileName = name || 'image';
            fileType = type || 'image/png';
            originalFileSize = size || 0;

            undoStack = [];
            redoStack = [];
            pushUndo();
            originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            dropHint.style.display = 'none';
            canvasWrapper.style.display = 'inline-block';
            imgLoaded = true;
            enableTools();
            resetAdjustments();
            zoomFit();
            updateStatus();
            updateInfo();
        };
        img.onerror = function () { alert('Failed to load image'); };
        img.src = src;
    }

    function syncOverlay() {
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        overlay.style.width = canvas.width + 'px';
        overlay.style.height = canvas.height + 'px';
    }

    // ── File Input ──
    fileInput.addEventListener('change', function () {
        if (this.files[0]) loadFile(this.files[0]);
        this.value = '';
    });

    function loadFile(file) {
        if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
        const reader = new FileReader();
        reader.onload = function (e) { loadImage(e.target.result, file.name, file.type, file.size); };
        reader.readAsDataURL(file);
    }

    // Click drop hint to open file dialog
    dropHint.style.cursor = 'pointer';
    dropHint.addEventListener('click', function () { fileInput.click(); });

    // Drag & Drop
    canvasArea.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    canvasArea.addEventListener('drop', function (e) {
        e.preventDefault();
        if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
    });

    // Paste
    document.getElementById('pasteBtn').addEventListener('click', function () {
        navigator.clipboard.read().then(function (items) {
            for (var item of items) {
                for (var type of item.types) {
                    if (type.startsWith('image/')) {
                        item.getType(type).then(function (blob) { loadFile(new File([blob], 'pasted.' + type.split('/')[1], { type: type })); });
                        return;
                    }
                }
            }
            alert('No image in clipboard');
        }).catch(function () { alert('Cannot access clipboard'); });
    });

    document.addEventListener('paste', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        var items = e.clipboardData.items;
        for (var i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                loadFile(items[i].getAsFile());
                return;
            }
        }
    });

    // Sample image
    document.getElementById('sampleBtn').addEventListener('click', function () {
        var c = document.createElement('canvas');
        c.width = 640; c.height = 480;
        var g = c.getContext('2d');
        var grad = g.createLinearGradient(0, 0, 640, 480);
        grad.addColorStop(0, '#667eea'); grad.addColorStop(0.5, '#764ba2'); grad.addColorStop(1, '#f093fb');
        g.fillStyle = grad; g.fillRect(0, 0, 640, 480);
        // Circles
        for (var i = 0; i < 8; i++) {
            g.beginPath();
            g.arc(80 + i * 70, 200 + Math.sin(i) * 60, 30 + i * 5, 0, Math.PI * 2);
            g.fillStyle = 'rgba(255,255,255,' + (0.15 + i * 0.05) + ')';
            g.fill();
        }
        g.fillStyle = '#fff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center';
        g.fillText('Dev Helper', 320, 280);
        g.font = '18px sans-serif'; g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillText('Sample Image - 640 x 480', 320, 320);
        c.toBlob(function (blob) { loadFile(new File([blob], 'sample.png', { type: 'image/png' })); }, 'image/png');
    });

    // ── Undo / Redo ──

    function pushUndo() {
        if (undoStack.length >= MAX_UNDO) undoStack.shift();
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        redoStack = [];
        updateUndoButtons();
    }

    function undo() {
        if (undoStack.length <= 1) return;
        redoStack.push(undoStack.pop());
        var data = undoStack[undoStack.length - 1];
        canvas.width = data.width; canvas.height = data.height;
        ctx.putImageData(data, 0, 0);
        syncOverlay();
        updateUndoButtons();
        updateStatus();
    }

    function redo() {
        if (redoStack.length === 0) return;
        var data = redoStack.pop();
        canvas.width = data.width; canvas.height = data.height;
        ctx.putImageData(data, 0, 0);
        syncOverlay();
        undoStack.push(data);
        updateUndoButtons();
        updateStatus();
    }

    function updateUndoButtons() {
        document.getElementById('undoBtn').disabled = undoStack.length <= 1;
        document.getElementById('redoBtn').disabled = redoStack.length === 0;
    }

    document.getElementById('undoBtn').addEventListener('click', undo);
    document.getElementById('redoBtn').addEventListener('click', redo);

    // ── Zoom ──

    function setZoom(z) {
        zoom = Math.max(0.05, Math.min(10, z));
        canvasWrapper.style.transform = 'scale(' + zoom + ')';
        document.getElementById('zoomLabel').textContent = Math.round(zoom * 100) + '%';
        document.getElementById('statusZoom').textContent = 'Zoom: ' + Math.round(zoom * 100) + '%';
    }

    function zoomFit() {
        if (!imgLoaded) return;
        var areaW = canvasArea.clientWidth - 20;
        var areaH = canvasArea.clientHeight - 20;
        var z = Math.min(areaW / canvas.width, areaH / canvas.height, 1);
        setZoom(z);
    }

    document.getElementById('zoomInBtn').addEventListener('click', function () { setZoom(zoom * 1.25); });
    document.getElementById('zoomOutBtn').addEventListener('click', function () { setZoom(zoom / 1.25); });
    document.getElementById('zoomFitBtn').addEventListener('click', zoomFit);
    document.getElementById('zoom100Btn').addEventListener('click', function () { setZoom(1); });

    canvasArea.addEventListener('wheel', function (e) {
        if (!imgLoaded) return;
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9));
        }
    }, { passive: false });

    // ── Transform ──

    function rotate(deg) {
        if (!imgLoaded) return;
        var w = canvas.width, h = canvas.height;
        var imgData = ctx.getImageData(0, 0, w, h);
        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        tmp.getContext('2d').putImageData(imgData, 0, 0);

        if (deg === 90 || deg === -90) {
            canvas.width = h; canvas.height = w;
        }
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(deg * Math.PI / 180);
        ctx.drawImage(tmp, -w / 2, -h / 2);
        ctx.restore();
        syncOverlay();
        pushUndo();
        updateStatus();
    }

    function flip(dir) {
        if (!imgLoaded) return;
        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        tmp.getContext('2d').putImageData(imgData, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        if (dir === 'h') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
        else { ctx.translate(0, canvas.height); ctx.scale(1, -1); }
        ctx.drawImage(tmp, 0, 0);
        ctx.restore();
        pushUndo();
    }

    document.getElementById('rotateCWBtn').addEventListener('click', function () { rotate(90); });
    document.getElementById('rotateCCWBtn').addEventListener('click', function () { rotate(-90); });
    document.getElementById('flipHBtn').addEventListener('click', function () { flip('h'); });
    document.getElementById('flipVBtn').addEventListener('click', function () { flip('v'); });

    // ── Adjustments ──

    var adjSliders = ['Brightness', 'Contrast', 'Saturate', 'Hue', 'Blur', 'Opacity'];
    adjSliders.forEach(function (name) {
        var slider = document.getElementById('adj' + name);
        var val = document.getElementById('val' + name);
        slider.addEventListener('input', function () {
            val.textContent = this.value;
            adjustments[name.toLowerCase()] = parseInt(this.value);
            adjustmentsDirty = true;
            document.getElementById('applyAdjBtn').disabled = false;
            applyAdjustmentPreview();
        });
    });

    function buildFilterString(adj) {
        var parts = [];
        parts.push('brightness(' + (1 + adj.brightness / 100) + ')');
        parts.push('contrast(' + (1 + adj.contrast / 100) + ')');
        parts.push('saturate(' + (1 + adj.saturate / 100) + ')');
        if (adj.hue !== 0) parts.push('hue-rotate(' + adj.hue + 'deg)');
        if (adj.blur > 0) parts.push('blur(' + adj.blur + 'px)');
        if (adj.opacity < 100) parts.push('opacity(' + adj.opacity / 100 + ')');
        return parts.join(' ');
    }

    function applyAdjustmentPreview() {
        canvas.style.filter = buildFilterString(adjustments);
    }

    function commitAdjustments() {
        if (!adjustmentsDirty) return;
        var filterStr = buildFilterString(adjustments);
        var tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        var tctx = tmp.getContext('2d');
        tctx.filter = filterStr;
        tctx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.filter = 'none';
        ctx.drawImage(tmp, 0, 0);
        resetAdjustments();
        pushUndo();
    }

    function resetAdjustments() {
        adjustments = { brightness: 0, contrast: 0, saturate: 0, hue: 0, blur: 0, opacity: 100 };
        adjSliders.forEach(function (name) {
            var key = name.toLowerCase();
            var def = key === 'opacity' ? 100 : 0;
            document.getElementById('adj' + name).value = def;
            document.getElementById('val' + name).textContent = def;
        });
        canvas.style.filter = 'none';
        adjustmentsDirty = false;
        document.getElementById('applyAdjBtn').disabled = true;
    }

    document.getElementById('applyAdjBtn').addEventListener('click', commitAdjustments);
    document.getElementById('resetAdjBtn').addEventListener('click', function () {
        resetAdjustments();
    });

    // ── Quick Filters (Basic) ──

    document.querySelectorAll('.filter-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!imgLoaded) return;
            applyFilter(this.dataset.filter);
        });
    });

    function applyFilter(name) {
        var imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        if (name === 'sharpen' || name === 'emboss') {
            var kernel = name === 'sharpen'
                ? [0, -1, 0, -1, 5, -1, 0, -1, 0]
                : [-2, -1, 0, -1, 1, 1, 0, 1, 2];
            applyConvolution(imgData, kernel);
            ctx.putImageData(imgData, 0, 0);
            pushUndo();
            return;
        }

        var tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        var tctx = tmp.getContext('2d');
        var filterMap = {
            grayscale: 'grayscale(1)',
            sepia: 'sepia(1)',
            invert: 'invert(1)',
            vintage: 'sepia(0.4) contrast(1.2) brightness(0.9) saturate(0.8)',
            warm: 'sepia(0.3) saturate(1.4) brightness(1.05)',
            cool: 'saturate(0.8) brightness(1.05) hue-rotate(15deg)',
        };
        tctx.filter = filterMap[name] || 'none';
        tctx.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.filter = 'none';
        ctx.drawImage(tmp, 0, 0);
        pushUndo();
    }

    function applyConvolution(imgData, kernel) {
        var d = imgData.data;
        var w = imgData.width, h = imgData.height;
        var copy = new Uint8ClampedArray(d);
        var kSize = 3, half = 1;
        for (var y = half; y < h - half; y++) {
            for (var x = half; x < w - half; x++) {
                var r = 0, g = 0, b = 0;
                for (var ky = 0; ky < kSize; ky++) {
                    for (var kx = 0; kx < kSize; kx++) {
                        var idx = ((y + ky - half) * w + (x + kx - half)) * 4;
                        var ki = ky * kSize + kx;
                        r += copy[idx] * kernel[ki];
                        g += copy[idx + 1] * kernel[ki];
                        b += copy[idx + 2] * kernel[ki];
                    }
                }
                var i = (y * w + x) * 4;
                d[i] = r; d[i + 1] = g; d[i + 2] = b;
            }
        }
    }

    // ── Instagram Filters (41 filters from instagram.css) ──

    var IG_FILTERS = {
        '1977':      { filter: 'sepia(.5) hue-rotate(-30deg) saturate(1.4)', overlay: null },
        'Aden':      { filter: 'sepia(.2) brightness(1.15) saturate(1.4)', overlay: { color: 'rgba(125,105,24,0.1)', blend: 'multiply' } },
        'Amaro':     { filter: 'sepia(.35) contrast(1.1) brightness(1.2) saturate(1.3)', overlay: { color: 'rgba(125,105,24,0.2)', blend: 'overlay' } },
        'Ashby':     { filter: 'sepia(.5) contrast(1.2) saturate(1.8)', overlay: { color: 'rgba(125,105,24,0.35)', blend: 'lighten' } },
        'Brannan':   { filter: 'sepia(.4) contrast(1.25) brightness(1.1) saturate(.9) hue-rotate(-2deg)', overlay: null },
        'Brooklyn':  { filter: 'sepia(.25) contrast(1.25) brightness(1.25) hue-rotate(5deg)', overlay: { color: 'rgba(127,187,227,0.2)', blend: 'overlay' } },
        'Charmes':   { filter: 'sepia(.25) contrast(1.25) brightness(1.25) saturate(1.35) hue-rotate(-5deg)', overlay: { color: 'rgba(125,105,24,0.25)', blend: 'darken' } },
        'Clarendon': { filter: 'sepia(.15) contrast(1.25) brightness(1.25) hue-rotate(5deg)', overlay: { color: 'rgba(127,187,227,0.4)', blend: 'overlay' } },
        'Crema':     { filter: 'sepia(.5) contrast(1.25) brightness(1.15) saturate(.9) hue-rotate(-2deg)', overlay: { color: 'rgba(125,105,24,0.2)', blend: 'multiply' } },
        'Dogpatch':  { filter: 'sepia(.35) saturate(1.1) contrast(1.5)', overlay: null },
        'Earlybird': { filter: 'sepia(.25) contrast(1.25) brightness(1.15) saturate(.9) hue-rotate(-5deg)', overlay: { gradient: 'radial-gradient(circle,transparent 50%,rgba(125,105,24,0.2) 100%)', blend: 'multiply' } },
        'Gingham':   { filter: 'contrast(1.1) brightness(1.1)', overlay: { color: 'rgba(230,230,230,0.6)', blend: 'soft-light' } },
        'Ginza':     { filter: 'sepia(.25) contrast(1.15) brightness(1.2) saturate(1.35) hue-rotate(-5deg)', overlay: { color: 'rgba(125,105,24,0.15)', blend: 'darken' } },
        'Hefe':      { filter: 'sepia(.4) contrast(1.5) brightness(1.2) saturate(1.4) hue-rotate(-10deg)', overlay: { gradient: 'radial-gradient(circle,transparent 50%,rgba(0,0,0,0.25) 100%)', blend: 'multiply' } },
        'Helena':    { filter: 'sepia(.5) contrast(1.05) brightness(1.05) saturate(1.35)', overlay: { color: 'rgba(158,175,30,0.25)', blend: 'overlay' } },
        'Hudson':    { filter: 'sepia(.25) contrast(1.2) brightness(1.2) saturate(1.05) hue-rotate(-15deg)', overlay: { gradient: 'radial-gradient(circle,rgba(25,62,167,0.25) 25%,rgba(25,62,167,0.25) 100%)', blend: 'multiply' } },
        'Inkwell':   { filter: 'brightness(1.25) contrast(.85) grayscale(1)', overlay: null },
        'Juno':      { filter: 'sepia(.35) contrast(1.15) brightness(1.15) saturate(1.8)', overlay: { color: 'rgba(127,187,227,0.2)', blend: 'overlay' } },
        'Kelvin':    { filter: 'sepia(.15) contrast(1.5) brightness(1.1) hue-rotate(-10deg)', overlay: { gradient: 'radial-gradient(circle,rgba(128,78,15,0.25),rgba(128,78,15,0.5))', blend: 'overlay' } },
        'Lark':      { filter: 'sepia(.25) contrast(1.2) brightness(1.3) saturate(1.25)', overlay: null },
        'Lo-Fi':     { filter: 'saturate(1.1) contrast(1.5)', overlay: null },
        'Ludwig':    { filter: 'sepia(.25) contrast(1.05) brightness(1.05) saturate(2)', overlay: { color: 'rgba(125,105,24,0.1)', blend: 'overlay' } },
        'Maven':     { filter: 'sepia(.35) contrast(1.05) brightness(1.05) saturate(1.75)', overlay: { color: 'rgba(158,175,30,0.25)', blend: 'darken' } },
        'Mayfair':   { filter: 'contrast(1.1) brightness(1.15) saturate(1.1)', overlay: { gradient: 'radial-gradient(circle,transparent 50%,rgba(175,105,24,0.4) 100%)', blend: 'multiply' } },
        'Moon':      { filter: 'brightness(1.4) contrast(.95) saturate(0) sepia(.35)', overlay: null },
        'Nashville': { filter: 'sepia(.25) contrast(1.5) brightness(.9) hue-rotate(-15deg)', overlay: { gradient: 'radial-gradient(circle,rgba(128,78,15,0.5),rgba(128,78,15,0.65))', blend: 'screen' } },
        'Perpetua':  { filter: 'contrast(1.1) brightness(1.25) saturate(1.1)', overlay: { gradient: 'linear-gradient(to bottom,rgba(0,91,154,0.25),rgba(230,193,61,0.25))', blend: 'multiply' } },
        'Poprocket': { filter: 'sepia(.15) brightness(1.2)', overlay: { gradient: 'radial-gradient(circle,rgba(206,39,70,0.75) 40%,rgba(0,0,0,0.9) 80%)', blend: 'screen' } },
        'Reyes':     { filter: 'sepia(.75) contrast(.75) brightness(1.25) saturate(1.4)', overlay: null },
        'Rise':      { filter: 'sepia(.25) contrast(1.25) brightness(1.2) saturate(.9)', overlay: { gradient: 'radial-gradient(circle,transparent 50%,rgba(230,193,61,0.25) 100%)', blend: 'lighten' } },
        'Sierra':    { filter: 'sepia(.25) contrast(1.5) brightness(.9) hue-rotate(-15deg)', overlay: { gradient: 'radial-gradient(circle,rgba(128,78,15,0.5),rgba(0,0,0,0.65))', blend: 'screen' } },
        'Skyline':   { filter: 'sepia(.15) contrast(1.25) brightness(1.25) saturate(1.2)', overlay: null },
        'Slumber':   { filter: 'sepia(.35) contrast(1.25) saturate(1.25)', overlay: { color: 'rgba(125,105,24,0.2)', blend: 'darken' } },
        'Stinson':   { filter: 'sepia(.35) contrast(1.25) brightness(1.1) saturate(1.25)', overlay: { color: 'rgba(125,105,24,0.45)', blend: 'lighten' } },
        'Sutro':     { filter: 'sepia(.4) contrast(1.2) brightness(.9) saturate(1.4) hue-rotate(-10deg)', overlay: { gradient: 'radial-gradient(circle,transparent 50%,rgba(0,0,0,0.5) 90%)', blend: 'darken' } },
        'Toaster':   { filter: 'sepia(.25) contrast(1.5) brightness(.95) hue-rotate(-15deg)', overlay: { gradient: 'radial-gradient(circle,rgba(128,78,15,0.8),rgba(0,0,0,0.25))', blend: 'screen' } },
        'Valencia':  { filter: 'sepia(.25) contrast(1.1) brightness(1.1)', overlay: { color: 'rgba(230,193,61,0.1)', blend: 'lighten' } },
        'Vesper':    { filter: 'sepia(.35) contrast(1.15) brightness(1.2) saturate(1.3)', overlay: { color: 'rgba(125,105,24,0.25)', blend: 'overlay' } },
        'Walden':    { filter: 'sepia(.35) contrast(.8) brightness(1.25) saturate(1.4)', overlay: { color: 'rgba(229,240,128,0.5)', blend: 'darken' } },
        'Willow':    { filter: 'brightness(1.2) contrast(.85) saturate(.05) sepia(.2)', overlay: null },
        'X-Pro II':  { filter: 'sepia(.45) contrast(1.25) brightness(1.75) saturate(1.3) hue-rotate(-5deg)', overlay: { gradient: 'radial-gradient(circle,rgba(0,91,154,0.35),rgba(0,0,0,0.65))', blend: 'multiply' } },
    };

    // Build Instagram filter buttons
    var igGrid = document.getElementById('igFilterGrid');
    var igFilterSearch = document.getElementById('igFilterSearch');
    var igFilterNames = Object.keys(IG_FILTERS);

    function renderIgFilters(query) {
        igGrid.innerHTML = '';
        var q = (query || '').toLowerCase();
        igFilterNames.forEach(function (name) {
            if (q && name.toLowerCase().indexOf(q) === -1) return;
            var btn = document.createElement('button');
            btn.className = 'ig-filter-btn';
            btn.textContent = name;
            btn.title = name + ' — click to apply';
            btn.addEventListener('click', function () {
                if (!imgLoaded) return;
                applyIgFilter(name);
                // Highlight active
                igGrid.querySelectorAll('.ig-filter-btn').forEach(function (b) { b.classList.remove('active-filter'); });
                btn.classList.add('active-filter');
            });
            igGrid.appendChild(btn);
        });
    }

    renderIgFilters('');
    igFilterSearch.addEventListener('input', function () { renderIgFilters(this.value); });

    function applyIgFilter(name) {
        var def = IG_FILTERS[name];
        if (!def) return;

        var w = canvas.width, h = canvas.height;

        // Step 1: Apply CSS filter via offscreen canvas
        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        var tctx = tmp.getContext('2d');
        tctx.filter = def.filter;
        tctx.drawImage(canvas, 0, 0);

        // Step 2: Apply color/gradient overlay if defined
        if (def.overlay) {
            var ov = def.overlay;
            tctx.filter = 'none';
            tctx.globalCompositeOperation = ov.blend || 'multiply';
            if (ov.color) {
                tctx.fillStyle = ov.color;
                tctx.fillRect(0, 0, w, h);
            } else if (ov.gradient) {
                // Parse and apply gradient
                var grd = createGradientFromCSS(tctx, ov.gradient, w, h);
                if (grd) {
                    tctx.fillStyle = grd;
                    tctx.fillRect(0, 0, w, h);
                }
            }
            tctx.globalCompositeOperation = 'source-over';
        }

        // Step 3: Commit to main canvas
        ctx.clearRect(0, 0, w, h);
        canvas.style.filter = 'none';
        ctx.drawImage(tmp, 0, 0);
        pushUndo();
    }

    function createGradientFromCSS(tctx, cssGrad, w, h) {
        if (cssGrad.indexOf('radial-gradient') === 0) {
            var grd = tctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
            var stops = extractColorStops(cssGrad);
            stops.forEach(function (s) { grd.addColorStop(s.pos, s.color); });
            return grd;
        } else if (cssGrad.indexOf('linear-gradient') === 0) {
            // Parse direction
            var coords = parseLinearDirection(cssGrad, w, h);
            var grd = tctx.createLinearGradient(coords.x0, coords.y0, coords.x1, coords.y1);
            var stops = extractColorStops(cssGrad);
            stops.forEach(function (s) { grd.addColorStop(s.pos, s.color); });
            return grd;
        }
        return null;
    }

    function parseLinearDirection(cssGrad, w, h) {
        // Match direction keywords like "to bottom", "to top left", "135deg"
        var dirMatch = cssGrad.match(/linear-gradient\(\s*(to\s+[\w\s]+|[\d.]+deg)/i);
        if (!dirMatch) return { x0: 0, y0: 0, x1: 0, y1: h }; // default: to bottom
        var dir = dirMatch[1].trim().toLowerCase();
        if (dir.indexOf('deg') !== -1) {
            var angle = parseFloat(dir) * Math.PI / 180;
            var cx = w / 2, cy = h / 2;
            var len = Math.max(w, h);
            return { x0: cx - Math.sin(angle) * len / 2, y0: cy + Math.cos(angle) * len / 2, x1: cx + Math.sin(angle) * len / 2, y1: cy - Math.cos(angle) * len / 2 };
        }
        var map = {
            'to bottom': { x0: 0, y0: 0, x1: 0, y1: h },
            'to top': { x0: 0, y0: h, x1: 0, y1: 0 },
            'to right': { x0: 0, y0: 0, x1: w, y1: 0 },
            'to left': { x0: w, y0: 0, x1: 0, y1: 0 },
            'to bottom right': { x0: 0, y0: 0, x1: w, y1: h },
            'to bottom left': { x0: w, y0: 0, x1: 0, y1: h },
            'to top right': { x0: 0, y0: h, x1: w, y1: 0 },
            'to top left': { x0: w, y0: h, x1: 0, y1: 0 },
        };
        return map[dir] || { x0: 0, y0: 0, x1: 0, y1: h };
    }

    function extractColorStops(cssGrad) {
        // Extract rgba(...) or color values with optional percentage stops
        var stops = [];
        var inner = cssGrad.replace(/^[^(]+\(/, '').replace(/\)$/, '');
        // Remove leading direction/shape keywords (like "circle," "to bottom,")
        inner = inner.replace(/^(circle|ellipse|to\s+\w+)\s*,\s*/, '');
        // Match color stops: rgba(...) or #hex or named colors, optionally followed by percentage
        var regex = /(rgba?\([^)]+\)|#[0-9a-f]+|transparent|black|white)(?:\s+(?:at\s+)?(\d+)%)?/gi;
        var match;
        var rawStops = [];
        while ((match = regex.exec(inner)) !== null) {
            rawStops.push({ color: match[1], pos: match[2] ? parseInt(match[2]) / 100 : null });
        }
        // Assign positions to stops without explicit positions
        if (rawStops.length === 0) return [{ pos: 0, color: 'transparent' }, { pos: 1, color: 'transparent' }];
        if (rawStops.length === 1) {
            rawStops[0].pos = 0;
            return rawStops;
        }
        // First and last default to 0 and 1
        if (rawStops[0].pos === null) rawStops[0].pos = 0;
        if (rawStops[rawStops.length - 1].pos === null) rawStops[rawStops.length - 1].pos = 1;
        // Interpolate missing positions
        for (var i = 1; i < rawStops.length - 1; i++) {
            if (rawStops[i].pos === null) {
                var prev = rawStops[i - 1].pos;
                var next = null;
                for (var j = i + 1; j < rawStops.length; j++) {
                    if (rawStops[j].pos !== null) { next = rawStops[j].pos; break; }
                }
                rawStops[i].pos = (prev + next) / 2;
            }
        }
        return rawStops;
    }

    // ── Film Emulation Filters ──

    var FILM_FILTERS = {
        'Portra 160':    { filter: 'saturate(0.85) contrast(0.95) brightness(1.08) sepia(0.08)', overlay: { color: 'rgba(255,218,185,0.08)', blend: 'overlay' } },
        'Portra 400':    { filter: 'saturate(0.9) contrast(1.05) brightness(1.05) sepia(0.1)', overlay: { color: 'rgba(245,200,160,0.1)', blend: 'overlay' } },
        'Portra 800':    { filter: 'saturate(0.95) contrast(1.1) brightness(1.02) sepia(0.12) hue-rotate(-3deg)', overlay: { color: 'rgba(255,200,150,0.08)', blend: 'multiply' } },
        'Ektar 100':     { filter: 'saturate(1.6) contrast(1.2) brightness(1.05) sepia(0.05)', overlay: { color: 'rgba(255,100,50,0.06)', blend: 'overlay' } },
        'Gold 200':      { filter: 'saturate(1.15) contrast(1.05) brightness(1.1) sepia(0.15) hue-rotate(-5deg)', overlay: { color: 'rgba(255,200,50,0.1)', blend: 'overlay' } },
        'Velvia 50':     { filter: 'saturate(1.8) contrast(1.25) brightness(1.02)', overlay: { color: 'rgba(0,50,100,0.04)', blend: 'overlay' } },
        'Velvia 100':    { filter: 'saturate(1.6) contrast(1.2) brightness(1.05) hue-rotate(2deg)', overlay: null },
        'Provia 100F':   { filter: 'saturate(1.2) contrast(1.1) brightness(1.05)', overlay: null },
        'Superia 400':   { filter: 'saturate(1.1) contrast(1.1) brightness(1.02) sepia(0.08) hue-rotate(5deg)', overlay: { color: 'rgba(0,130,100,0.05)', blend: 'overlay' } },
        'Tri-X 400':     { filter: 'grayscale(1) contrast(1.3) brightness(1.05)', overlay: null },
        'HP5 Plus':      { filter: 'grayscale(1) contrast(1.15) brightness(1.1)', overlay: { color: 'rgba(200,200,200,0.05)', blend: 'overlay' } },
        'T-Max 400':     { filter: 'grayscale(1) contrast(1.4) brightness(0.95)', overlay: null },
        'Delta 3200':    { filter: 'grayscale(1) contrast(1.5) brightness(0.9)', overlay: { color: 'rgba(50,50,50,0.1)', blend: 'lighten' } },
        'Cinestill 800': { filter: 'saturate(1.2) contrast(1.15) brightness(1.05) sepia(0.05) hue-rotate(-8deg)', overlay: { color: 'rgba(255,80,50,0.06)', blend: 'screen' } },
        'Polaroid 600':  { filter: 'saturate(0.85) contrast(0.9) brightness(1.15) sepia(0.15)', overlay: { color: 'rgba(255,245,220,0.12)', blend: 'overlay' } },
        'Lomography':    { filter: 'saturate(1.5) contrast(1.4) brightness(0.95)', overlay: { gradient: 'radial-gradient(circle,transparent 40%,rgba(0,0,0,0.5) 100%)', blend: 'multiply' } },
    };

    var CINE_FILTERS = {
        'Teal & Orange': { filter: 'contrast(1.15) saturate(1.3)', overlay: { gradient: 'linear-gradient(to bottom,rgba(0,128,128,0.15),rgba(255,140,50,0.12))', blend: 'overlay' } },
        'Noir':          { filter: 'grayscale(1) contrast(1.4) brightness(0.9)', overlay: { gradient: 'radial-gradient(circle,transparent 30%,rgba(0,0,0,0.4) 100%)', blend: 'multiply' } },
        'Noir Warm':     { filter: 'grayscale(1) contrast(1.2) brightness(1.05) sepia(0.25)', overlay: null },
        'Matrix':        { filter: 'saturate(0.6) contrast(1.3) brightness(0.85) hue-rotate(80deg)', overlay: { color: 'rgba(0,60,0,0.15)', blend: 'overlay' } },
        'Blade Runner':  { filter: 'saturate(1.1) contrast(1.2) brightness(0.85) hue-rotate(-10deg)', overlay: { gradient: 'linear-gradient(to bottom,rgba(255,100,0,0.1),rgba(0,50,100,0.2))', blend: 'overlay' } },
        'Blockbuster':   { filter: 'contrast(1.3) saturate(1.2) brightness(0.95)', overlay: { gradient: 'linear-gradient(to bottom,rgba(0,80,140,0.12),rgba(220,120,30,0.1))', blend: 'overlay' } },
        'Bleach Bypass':  { filter: 'saturate(0.4) contrast(1.4) brightness(1.05)', overlay: null },
        'Cross Process': { filter: 'saturate(1.4) contrast(1.2) brightness(1.1) hue-rotate(15deg) sepia(0.1)', overlay: { color: 'rgba(0,100,50,0.08)', blend: 'overlay' } },
        'Day for Night': { filter: 'brightness(0.55) contrast(1.3) saturate(0.3) hue-rotate(200deg)', overlay: { color: 'rgba(0,20,60,0.3)', blend: 'overlay' } },
        'Orange & Teal': { filter: 'contrast(1.1) saturate(1.4) brightness(1.05)', overlay: { gradient: 'linear-gradient(to bottom,rgba(255,120,30,0.1),rgba(0,140,150,0.15))', blend: 'color' } },
        'Muted Film':    { filter: 'saturate(0.6) contrast(0.9) brightness(1.1) sepia(0.1)', overlay: null },
        'High Contrast': { filter: 'contrast(1.6) brightness(0.95) saturate(1.1)', overlay: null },
        'Desaturated':   { filter: 'saturate(0.3) contrast(1.1) brightness(1.05)', overlay: null },
    };

    var CREATIVE_FILTERS = {
        'Cyberpunk':     { filter: 'saturate(1.6) contrast(1.3) brightness(1.1) hue-rotate(-15deg)', overlay: { gradient: 'linear-gradient(135deg,rgba(255,0,100,0.15),rgba(0,200,255,0.15))', blend: 'overlay' } },
        'Vaporwave':     { filter: 'saturate(1.5) contrast(1.1) brightness(1.15) hue-rotate(240deg)', overlay: { gradient: 'linear-gradient(to bottom,rgba(255,100,200,0.2),rgba(100,200,255,0.15))', blend: 'overlay' } },
        'Synthwave':     { filter: 'saturate(1.4) contrast(1.2) brightness(0.9) hue-rotate(280deg)', overlay: { gradient: 'linear-gradient(to bottom,rgba(255,50,150,0.2),rgba(50,0,100,0.2))', blend: 'screen' } },
        'Duotone Blue':  { filter: 'grayscale(1) contrast(1.2) brightness(1.1)', overlay: { gradient: 'linear-gradient(to bottom,rgba(0,50,150,0.6),rgba(100,200,255,0.4))', blend: 'color' } },
        'Duotone Pink':  { filter: 'grayscale(1) contrast(1.2) brightness(1.1)', overlay: { gradient: 'linear-gradient(to bottom,rgba(200,0,100,0.5),rgba(255,150,200,0.4))', blend: 'color' } },
        'Duotone Green': { filter: 'grayscale(1) contrast(1.1) brightness(1.1)', overlay: { gradient: 'linear-gradient(to bottom,rgba(0,80,40,0.5),rgba(100,230,150,0.4))', blend: 'color' } },
        'Pop Art':       { filter: 'saturate(2) contrast(1.5) brightness(1.1)', overlay: null },
        'Dreamy':        { filter: 'brightness(1.15) contrast(0.85) saturate(1.2) blur(0.5px)', overlay: { color: 'rgba(255,220,240,0.1)', blend: 'overlay' } },
        'Faded':         { filter: 'contrast(0.8) brightness(1.2) saturate(0.7) sepia(0.1)', overlay: null },
        'Dramatic':      { filter: 'contrast(1.5) brightness(0.85) saturate(0.8)', overlay: { gradient: 'radial-gradient(circle,transparent 30%,rgba(0,0,0,0.5) 100%)', blend: 'multiply' } },
        'Golden Hour':   { filter: 'saturate(1.3) contrast(1.05) brightness(1.12) sepia(0.2) hue-rotate(-10deg)', overlay: { color: 'rgba(255,180,50,0.12)', blend: 'overlay' } },
        'Arctic':        { filter: 'brightness(1.15) contrast(1.1) saturate(0.7) hue-rotate(10deg)', overlay: { color: 'rgba(180,220,255,0.12)', blend: 'overlay' } },
        'Autumn':        { filter: 'saturate(1.3) contrast(1.1) brightness(1.05) sepia(0.15) hue-rotate(-15deg)', overlay: { color: 'rgba(200,100,0,0.08)', blend: 'overlay' } },
        'Lava':          { filter: 'saturate(1.5) contrast(1.3) brightness(0.95) hue-rotate(-20deg)', overlay: { gradient: 'linear-gradient(to bottom,rgba(255,50,0,0.15),rgba(200,100,0,0.1))', blend: 'overlay' } },
        'Deep Sea':      { filter: 'saturate(0.8) contrast(1.2) brightness(0.9) hue-rotate(160deg)', overlay: { color: 'rgba(0,40,80,0.15)', blend: 'overlay' } },
        'Sunset':        { filter: 'saturate(1.4) contrast(1.1) brightness(1.1) sepia(0.1) hue-rotate(-8deg)', overlay: { gradient: 'linear-gradient(to bottom,rgba(255,80,0,0.1),rgba(255,180,50,0.15))', blend: 'overlay' } },
    };

    // Build filter grids for Film, Cinematic, Creative
    function buildFilterCategory(filters, gridId, countId) {
        var grid = document.getElementById(gridId);
        var names = Object.keys(filters);
        document.getElementById(countId).textContent = '(' + names.length + ')';
        names.forEach(function (name) {
            var btn = document.createElement('button');
            btn.className = 'ig-filter-btn';
            btn.textContent = name;
            btn.title = name + ' — click to apply';
            btn.addEventListener('click', function () {
                if (!imgLoaded) return;
                applyAdvancedFilter(filters, name);
                grid.querySelectorAll('.ig-filter-btn').forEach(function (b) { b.classList.remove('active-filter'); });
                btn.classList.add('active-filter');
            });
            grid.appendChild(btn);
        });
    }

    function applyAdvancedFilter(collection, name) {
        var def = collection[name];
        if (!def) return;

        var w = canvas.width, h = canvas.height;
        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        var tctx = tmp.getContext('2d');

        // Layer 1: Background (cssco-style — shows through image opacity/blend)
        if (def.background) {
            var bg = def.background;
            if (bg.color) {
                tctx.fillStyle = bg.color;
                tctx.fillRect(0, 0, w, h);
            } else if (bg.gradient) {
                var bgGrd = createGradientFromCSS(tctx, bg.gradient, w, h);
                if (bgGrd) { tctx.fillStyle = bgGrd; tctx.fillRect(0, 0, w, h); }
            }
        }

        // Layer 2: Image with CSS filter + optional blend mode + opacity
        tctx.filter = def.filter;
        if (def.imgBlend) tctx.globalCompositeOperation = def.imgBlend;
        if (def.imgOpacity) tctx.globalAlpha = def.imgOpacity;
        tctx.drawImage(canvas, 0, 0);
        tctx.filter = 'none';
        tctx.globalCompositeOperation = 'source-over';
        tctx.globalAlpha = 1;

        // Layer 3: Overlay (color/gradient + blend mode + opacity)
        if (def.overlay) {
            var ov = def.overlay;
            tctx.globalCompositeOperation = ov.blend || 'multiply';
            if (ov.opacity) tctx.globalAlpha = ov.opacity;
            if (ov.color) {
                tctx.fillStyle = ov.color;
                tctx.fillRect(0, 0, w, h);
            } else if (ov.gradient) {
                var grd = createGradientFromCSS(tctx, ov.gradient, w, h);
                if (grd) { tctx.fillStyle = grd; tctx.fillRect(0, 0, w, h); }
            }
            tctx.globalCompositeOperation = 'source-over';
            tctx.globalAlpha = 1;
        }

        ctx.clearRect(0, 0, w, h);
        canvas.style.filter = 'none';
        ctx.drawImage(tmp, 0, 0);
        pushUndo();
    }

    // ── Color Blend Filters (colofilter.css / Duotone inspired) ──
    // Uses luminosity desaturation + color overlay blend modes

    var BLEND_FILTERS = {
        // Solid colors — Normal (hard-light), Dark (darken), Light (screen)
        'Red':            { filter: 'contrast(1.3)', overlay: { color: '#E50914', blend: 'hard-light' } },
        'Red Dark':       { filter: 'contrast(1.3)', overlay: { color: '#282581', blend: 'darken' } },
        'Red Light':      { filter: 'contrast(1.2) brightness(1.1)', overlay: { color: '#E50914', blend: 'screen' } },
        'Orange':         { filter: 'contrast(1.3)', overlay: { color: '#FCA300', blend: 'hard-light' } },
        'Orange Dark':    { filter: 'contrast(1.3)', overlay: { color: '#E07000', blend: 'darken' } },
        'Orange Light':   { filter: 'contrast(1.2) brightness(1.1)', overlay: { color: '#FCA300', blend: 'screen' } },
        'Blue':           { filter: 'contrast(1.3)', overlay: { color: '#0066BF', blend: 'hard-light' } },
        'Blue Dark':      { filter: 'contrast(1.3)', overlay: { color: '#93EF90', blend: 'lighten' } },
        'Blue Light':     { filter: 'contrast(1.2) brightness(1.1)', overlay: { color: '#0066BF', blend: 'color-dodge' } },
        'Yellow':         { filter: 'contrast(1.3)', overlay: { color: '#FEDD31', blend: 'hard-light' } },
        'Yellow Dark':    { filter: 'contrast(1.3)', overlay: { color: '#EF3CB4', blend: 'darken' } },
        'Yellow Light':   { filter: 'contrast(1.2) brightness(1.1)', overlay: { color: '#FEDD31', blend: 'screen' } },
        'Purple':         { filter: 'contrast(1.3)', overlay: { color: '#663399', blend: 'hard-light' } },
        'Purple Dark':    { filter: 'contrast(1.3)', overlay: { color: '#B10AFF', blend: 'lighten' } },
        'Purple Light':   { filter: 'contrast(1.2) brightness(1.1)', overlay: { color: '#663399', blend: 'screen' } },
        'Green':          { filter: 'contrast(1.3)', overlay: { color: '#11C966', blend: 'hard-light' } },
        'Green Dark':     { filter: 'contrast(1.3)', overlay: { color: '#2D3181', blend: 'darken' } },
        'Green Light':    { filter: 'contrast(1.2) brightness(1.1)', overlay: { color: '#11C966', blend: 'screen' } },
        'Pink':           { filter: 'contrast(1.3)', overlay: { color: '#EA4C89', blend: 'hard-light' } },
        'Pink Dark':      { filter: 'contrast(1.3)', overlay: { color: '#EA4C89', blend: 'darken' } },
        'Pink Light':     { filter: 'contrast(1.2) brightness(1.1)', overlay: { color: '#EA4C89', blend: 'color-dodge' } },
        'Teal':           { filter: 'contrast(1.3)', overlay: { color: '#008080', blend: 'hard-light' } },
        'Teal Dark':      { filter: 'contrast(1.3)', overlay: { color: '#004040', blend: 'darken' } },
        'Gold':           { filter: 'contrast(1.3)', overlay: { color: '#D4AF37', blend: 'hard-light' } },
        'Coral':          { filter: 'contrast(1.2)', overlay: { color: '#FF6F61', blend: 'hard-light' } },
        // Gradient blends (Duotone style)
        'Blue-Yellow':    { filter: 'contrast(1.3) grayscale(0.3)', overlay: { gradient: 'linear-gradient(to top left,#55ACEE,#FEDD31)', blend: 'hard-light' } },
        'Pink-Yellow':    { filter: 'contrast(1.3) grayscale(0.3)', overlay: { gradient: 'linear-gradient(to bottom right,#FAA6FB,#FBBC05)', blend: 'hard-light' } },
        'Red-Blue':       { filter: 'contrast(1.3) grayscale(0.3)', overlay: { gradient: 'linear-gradient(to bottom right,#3993E2,#E2544B)', blend: 'hard-light' } },
        'Purple-Orange':  { filter: 'contrast(1.3) grayscale(0.3)', overlay: { gradient: 'linear-gradient(to bottom right,#663399,#FF8C00)', blend: 'hard-light' } },
        'Teal-Pink':      { filter: 'contrast(1.3) grayscale(0.3)', overlay: { gradient: 'linear-gradient(to bottom right,#008080,#EA4C89)', blend: 'hard-light' } },
        'Green-Blue':     { filter: 'contrast(1.3) grayscale(0.3)', overlay: { gradient: 'linear-gradient(135deg,#11C966,#0066BF)', blend: 'hard-light' } },
        'Sunset Grad':    { filter: 'contrast(1.2) grayscale(0.2)', overlay: { gradient: 'linear-gradient(to bottom,#FF512F,#F09819)', blend: 'hard-light' } },
        'Ocean Grad':     { filter: 'contrast(1.2) grayscale(0.2)', overlay: { gradient: 'linear-gradient(to bottom,#2E3192,#1BFFFF)', blend: 'hard-light' } },
        'Forest Grad':    { filter: 'contrast(1.2) grayscale(0.2)', overlay: { gradient: 'linear-gradient(to bottom right,#134E5E,#71B280)', blend: 'hard-light' } },
        'Candy Grad':     { filter: 'contrast(1.2) grayscale(0.2)', overlay: { gradient: 'linear-gradient(135deg,#FF61D2,#FE9090,#FFC796)', blend: 'hard-light' } },
    };

    // ── CSSCO Filters (cssco.css by we-are-next — 3-layer technique) ──
    // Background gradient/color + image blend mode + overlay blend mode

    var CSSCO_FILTERS = {
        'C1':  { filter: 'grayscale(0.06) contrast(1.3)', imgBlend: 'hard-light', background: { gradient: 'linear-gradient(to bottom, #d5aeae, #8f8f8f, #c99d93, #185d62)' }, overlay: { color: '#58747b', blend: 'overlay' } },
        'F2':  { filter: 'contrast(1.5)', imgOpacity: 0.85, background: { gradient: 'linear-gradient(to bottom, #b8dfdc, #aaa)' }, overlay: { gradient: 'linear-gradient(to bottom, #aebab6 43%, #4a5580)', blend: 'soft-light' } },
        'G3':  { filter: 'contrast(1.3)', imgBlend: 'hard-light', background: { gradient: 'linear-gradient(to bottom, #485c6e, #b9b9b0 15%, #4b6974)' } },
        'P5':  { filter: 'contrast(1.5) grayscale(0.15)', imgOpacity: 0.8, background: { color: '#8facaf' }, overlay: { gradient: 'linear-gradient(to bottom left, #9ec1b3, #8c78a0, #646983, #252c37)', blend: 'overlay' } },
        'LV3': { filter: 'grayscale(0.2) contrast(1.3)', imgBlend: 'hard-light', background: { gradient: 'linear-gradient(-179deg, #a48a7a 0%, #927f77 37%, #ac8577 49%, #574d47 100%)' } },
        'B5':  { filter: 'grayscale(1) contrast(1.8) brightness(0.95)', imgOpacity: 0.9, background: { color: '#000' } },
        'A6':  { filter: 'grayscale(0.3) contrast(1.4) hue-rotate(-5deg)', imgBlend: 'hard-light', background: { color: '#a9a499' }, overlay: { color: '#eaeae9', blend: 'multiply' } },
        'KK2': { filter: 'grayscale(0.3) contrast(1.7)', imgBlend: 'hard-light', imgOpacity: 0.8, background: { gradient: 'linear-gradient(-179deg, #b1957d 29%, #7d7b73 57%, #ce9778 100%)' }, overlay: { color: '#dab66d', blend: 'darken', opacity: 0.15 } },
        'M5':  { filter: 'grayscale(0.4) contrast(1.1)', imgBlend: 'hard-light', background: { gradient: 'radial-gradient(#c09f81, #816c5f)' }, overlay: { gradient: 'linear-gradient(to bottom, #bbccce 50%, #000000)', blend: 'soft-light', opacity: 0.5 } },
        'M3':  { filter: 'grayscale(0.3) contrast(1.55)', imgBlend: 'hard-light', imgOpacity: 0.75, background: { color: '#817e72' }, overlay: { color: '#cce7de', blend: 'multiply', opacity: 0.35 } },
        'HB1': { filter: 'grayscale(0.2) contrast(1.3)', imgBlend: 'hard-light', background: { gradient: 'linear-gradient(-180deg, #8e8d9a 30%, #a6939f 48%, #6c7c95 65%, #6a7b95 58%, #c5cdd7 86%, #303743 100%)' }, overlay: { color: '#294459', blend: 'lighten', opacity: 0.5 } },
        'HB2': { filter: 'grayscale(0.2) contrast(1.3)', imgBlend: 'hard-light', background: { gradient: 'linear-gradient(-180deg, #8e8d9a 31%, #a69893 49%, #4c4644 58%, #c5cdd7 88%, #303d43 100%)' }, overlay: { color: '#315764', blend: 'overlay', opacity: 0.25 } },
        'ACG': { filter: 'grayscale(0.4) contrast(1.6) brightness(0.85) hue-rotate(-5deg)', imgBlend: 'darken', imgOpacity: 0.85, background: { color: '#eceedf' }, overlay: { gradient: 'linear-gradient(-180deg, #77766f 30%, #6a6f68 60%, #45353e 100%)', blend: 'overlay' } },
        'X1':  { filter: 'grayscale(1) contrast(1.9) brightness(1.1)', imgOpacity: 0.75, background: { color: '#444' }, overlay: { color: '#333', blend: 'lighten' } },
        'T1':  { filter: 'grayscale(0.2) contrast(1.4)', imgBlend: 'hard-light', background: { color: '#9d9990' }, overlay: { color: '#878787', blend: 'lighten', opacity: 0.5 } },
    };

    buildFilterCategory(FILM_FILTERS, 'filmFilterGrid', 'filmCount');
    buildFilterCategory(CINE_FILTERS, 'cineFilterGrid', 'cineCount');
    buildFilterCategory(CREATIVE_FILTERS, 'creativeFilterGrid', 'creativeCount');
    buildFilterCategory(BLEND_FILTERS, 'blendFilterGrid', 'blendCount');
    buildFilterCategory(CSSCO_FILTERS, 'csscoFilterGrid', 'csscoCount');

    // ── Quick Resize ──

    document.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (!imgLoaded) return;
            resizeTo(parseInt(this.dataset.w), parseInt(this.dataset.h));
        });
    });

    function resizeTo(w, h) {
        var tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        tmp.getContext('2d').drawImage(canvas, 0, 0);
        canvas.width = w; canvas.height = h;
        ctx.clearRect(0, 0, w, h);
        // Use high-quality downscaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(tmp, 0, 0, w, h);
        syncOverlay();
        pushUndo();
        zoomFit();
        updateStatus();
    }

    // Resize modal
    document.getElementById('resizeBtn').addEventListener('click', function () {
        if (!imgLoaded) return;
        document.getElementById('resizeW').value = canvas.width;
        document.getElementById('resizeH').value = canvas.height;
        document.getElementById('resizeInfo').textContent = 'Current: ' + canvas.width + ' x ' + canvas.height;
        new bootstrap.Modal(document.getElementById('resizeModal')).show();
    });

    var resizeAspect = 1;
    document.getElementById('resizeW').addEventListener('input', function () {
        if (document.getElementById('resizeLock').checked) {
            document.getElementById('resizeH').value = Math.round(this.value / resizeAspect);
        }
    });
    document.getElementById('resizeH').addEventListener('input', function () {
        if (document.getElementById('resizeLock').checked) {
            document.getElementById('resizeW').value = Math.round(this.value * resizeAspect);
        }
    });
    document.getElementById('resizeModal').addEventListener('show.bs.modal', function () {
        resizeAspect = canvas.width / canvas.height;
    });
    document.getElementById('applyResizeBtn').addEventListener('click', function () {
        var w = parseInt(document.getElementById('resizeW').value);
        var h = parseInt(document.getElementById('resizeH').value);
        if (w > 0 && h > 0) {
            resizeTo(w, h);
            bootstrap.Modal.getInstance(document.getElementById('resizeModal')).hide();
        }
    });

    // ── Tool Selection ──

    var toolBtns = {
        crop: document.getElementById('cropToolBtn'),
        draw: document.getElementById('drawToolBtn'),
        text: document.getElementById('textToolBtn'),
        shape: document.getElementById('shapeToolBtn'),
        picker: document.getElementById('pickerToolBtn'),
    };

    function setTool(name) {
        currentTool = name;
        Object.keys(toolBtns).forEach(function (k) { toolBtns[k].classList.toggle('active', k === name); });
        document.getElementById('cropOptions').classList.toggle('active', name === 'crop');
        document.getElementById('drawOptions').classList.toggle('active', name === 'draw');
        document.getElementById('textOptions').classList.toggle('active', name === 'text');
        document.getElementById('shapeOptions').classList.toggle('active', name === 'shape');

        cropOverlay.classList.toggle('active', name === 'crop');
        overlay.classList.toggle('active', name === 'draw' || name === 'shape');

        if (name === 'crop') { cropRect = null; cropSelection.classList.remove('visible'); }
        if (name !== 'crop' && name !== 'draw' && name !== 'shape' && name !== 'text' && name !== 'picker') {
            overlay.classList.remove('active');
            cropOverlay.classList.remove('active');
        }

        // Cursor
        if (name === 'draw') canvasWrapper.style.cursor = 'crosshair';
        else if (name === 'picker') canvasWrapper.style.cursor = 'crosshair';
        else if (name === 'text') canvasWrapper.style.cursor = 'text';
        else if (name === 'shape') canvasWrapper.style.cursor = 'crosshair';
        else canvasWrapper.style.cursor = 'default';
    }

    toolBtns.crop.addEventListener('click', function () { setTool(currentTool === 'crop' ? 'select' : 'crop'); });
    toolBtns.draw.addEventListener('click', function () { setTool(currentTool === 'draw' ? 'select' : 'draw'); });
    toolBtns.text.addEventListener('click', function () { setTool(currentTool === 'text' ? 'select' : 'text'); });
    toolBtns.shape.addEventListener('click', function () { setTool(currentTool === 'shape' ? 'select' : 'shape'); });
    toolBtns.picker.addEventListener('click', function () { setTool(currentTool === 'picker' ? 'select' : 'picker'); });

    // ── Crop Tool ──

    cropOverlay.addEventListener('mousedown', function (e) {
        if (currentTool !== 'crop') return;
        var rect = cropOverlay.getBoundingClientRect();
        cropStart = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
        cropping = true;
        cropSelection.classList.add('visible');
    });

    cropOverlay.addEventListener('mousemove', function (e) {
        if (!cropping) return;
        var rect = cropOverlay.getBoundingClientRect();
        var x = (e.clientX - rect.left) / zoom;
        var y = (e.clientY - rect.top) / zoom;
        var ratio = document.getElementById('cropRatio').value;

        var cx = Math.min(cropStart.x, x);
        var cy = Math.min(cropStart.y, y);
        var cw = Math.abs(x - cropStart.x);
        var ch = Math.abs(y - cropStart.y);

        if (ratio !== 'free') {
            var parts = ratio.split(':');
            var r = parseInt(parts[0]) / parseInt(parts[1]);
            ch = cw / r;
            if (y < cropStart.y) cy = cropStart.y - ch;
        }

        // Clamp
        cx = Math.max(0, cx); cy = Math.max(0, cy);
        cw = Math.min(cw, canvas.width - cx); ch = Math.min(ch, canvas.height - cy);

        cropRect = { x: cx, y: cy, w: cw, h: ch };
        cropSelection.style.left = cx + 'px';
        cropSelection.style.top = cy + 'px';
        cropSelection.style.width = cw + 'px';
        cropSelection.style.height = ch + 'px';
        document.getElementById('cropInfo').textContent = Math.round(cw) + ' x ' + Math.round(ch);
    });

    document.addEventListener('mouseup', function () { cropping = false; });

    document.getElementById('applyCropBtn').addEventListener('click', function () {
        if (!cropRect || cropRect.w < 2 || cropRect.h < 2) return;
        var x = Math.round(cropRect.x), y = Math.round(cropRect.y);
        var w = Math.round(cropRect.w), h = Math.round(cropRect.h);
        var imgData = ctx.getImageData(x, y, w, h);
        canvas.width = w; canvas.height = h;
        ctx.putImageData(imgData, 0, 0);
        syncOverlay();
        pushUndo();
        setTool('select');
        zoomFit();
        updateStatus();
    });

    document.getElementById('cancelCropBtn').addEventListener('click', function () { setTool('select'); });

    // ── Draw Tool ──

    var drawSize = document.getElementById('drawSize');
    var drawSizeVal = document.getElementById('drawSizeVal');
    drawSize.addEventListener('input', function () { drawSizeVal.textContent = this.value + 'px'; });

    document.getElementById('eraserBtn').addEventListener('click', function () {
        isEraser = !isEraser;
        this.classList.toggle('active', isEraser);
    });

    overlay.addEventListener('mousedown', function (e) {
        if (currentTool === 'draw') {
            drawing = true;
            var pos = getCanvasPos(e);
            lastX = pos.x; lastY = pos.y;
            octx.lineWidth = parseInt(drawSize.value);
            octx.lineCap = 'round';
            octx.lineJoin = 'round';
            if (isEraser) {
                octx.globalCompositeOperation = 'destination-out';
                octx.strokeStyle = 'rgba(0,0,0,1)';
            } else {
                octx.globalCompositeOperation = 'source-over';
                octx.strokeStyle = document.getElementById('drawColor').value;
            }
            octx.beginPath();
            octx.moveTo(lastX, lastY);
        } else if (currentTool === 'shape') {
            shaping = true;
            shapeStart = getCanvasPos(e);
        }
    });

    overlay.addEventListener('mousemove', function (e) {
        if (currentTool === 'draw' && drawing) {
            var pos = getCanvasPos(e);
            octx.lineTo(pos.x, pos.y);
            octx.stroke();
            lastX = pos.x; lastY = pos.y;
        } else if (currentTool === 'shape' && shaping) {
            var pos = getCanvasPos(e);
            octx.clearRect(0, 0, overlay.width, overlay.height);
            drawShapePreview(shapeStart, pos);
        }
    });

    overlay.addEventListener('mouseup', function (e) {
        if (currentTool === 'draw' && drawing) {
            drawing = false;
            // Merge overlay to main canvas
            ctx.drawImage(overlay, 0, 0);
            octx.clearRect(0, 0, overlay.width, overlay.height);
            octx.globalCompositeOperation = 'source-over';
            pushUndo();
        } else if (currentTool === 'shape' && shaping) {
            shaping = false;
            var pos = getCanvasPos(e);
            octx.clearRect(0, 0, overlay.width, overlay.height);
            drawShapeOnCanvas(shapeStart, pos);
            pushUndo();
        }
    });

    // ── Shape Drawing ──

    var shapeWidth = document.getElementById('shapeWidth');
    var shapeWidthVal = document.getElementById('shapeWidthVal');
    shapeWidth.addEventListener('input', function () { shapeWidthVal.textContent = this.value + 'px'; });

    function drawShapePreview(from, to) {
        var type = document.getElementById('shapeType').value;
        var color = document.getElementById('shapeColor').value;
        var lw = parseInt(shapeWidth.value);
        var fill = document.getElementById('shapeFill').checked;
        octx.strokeStyle = color;
        octx.fillStyle = color;
        octx.lineWidth = lw;
        drawShapeImpl(octx, type, from, to, fill);
    }

    function drawShapeOnCanvas(from, to) {
        var type = document.getElementById('shapeType').value;
        var color = document.getElementById('shapeColor').value;
        var lw = parseInt(shapeWidth.value);
        var fill = document.getElementById('shapeFill').checked;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        drawShapeImpl(ctx, type, from, to, fill);
    }

    function drawShapeImpl(c, type, from, to, fill) {
        var x = Math.min(from.x, to.x), y = Math.min(from.y, to.y);
        var w = Math.abs(to.x - from.x), h = Math.abs(to.y - from.y);
        c.beginPath();
        if (type === 'rect') {
            if (fill) c.fillRect(x, y, w, h);
            else c.strokeRect(x, y, w, h);
        } else if (type === 'circle') {
            var rx = w / 2, ry = h / 2;
            c.ellipse(x + rx, y + ry, rx, ry, 0, 0, Math.PI * 2);
            if (fill) c.fill(); else c.stroke();
        } else if (type === 'line') {
            c.moveTo(from.x, from.y);
            c.lineTo(to.x, to.y);
            c.stroke();
        } else if (type === 'arrow') {
            var dx = to.x - from.x, dy = to.y - from.y;
            var angle = Math.atan2(dy, dx);
            var headLen = Math.max(15, c.lineWidth * 4);
            c.moveTo(from.x, from.y);
            c.lineTo(to.x, to.y);
            c.stroke();
            c.beginPath();
            c.moveTo(to.x, to.y);
            c.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
            c.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
            c.closePath();
            c.fill();
        }
    }

    // ── Text Tool ──

    canvasWrapper.addEventListener('click', function (e) {
        if (currentTool === 'text' && imgLoaded) {
            var pos = getCanvasPos(e);
            var text = document.getElementById('textInput').value;
            if (!text) { document.getElementById('textInput').focus(); return; }
            var size = parseInt(document.getElementById('textSize').value);
            var color = document.getElementById('textColor').value;
            var font = document.getElementById('textFont').value;
            var bold = document.getElementById('textBold').checked ? 'bold ' : '';
            ctx.font = bold + size + 'px ' + font;
            ctx.fillStyle = color;
            ctx.textBaseline = 'top';
            ctx.fillText(text, pos.x, pos.y);
            pushUndo();
        } else if (currentTool === 'picker' && imgLoaded) {
            var pos = getCanvasPos(e);
            var px = ctx.getImageData(Math.round(pos.x), Math.round(pos.y), 1, 1).data;
            var hex = '#' + ((1 << 24) + (px[0] << 16) + (px[1] << 8) + px[2]).toString(16).slice(1);
            document.getElementById('statusColor').textContent = 'Color: ' + hex + ' rgb(' + px[0] + ',' + px[1] + ',' + px[2] + ')';
            document.getElementById('drawColor').value = hex;
            document.getElementById('shapeColor').value = hex;
            document.getElementById('textColor').value = hex;
            // Copy to clipboard
            navigator.clipboard.writeText(hex).catch(function () {});
        }
    });

    // ── Mouse Position & Color Picker on Hover ──

    canvasWrapper.addEventListener('mousemove', function (e) {
        if (!imgLoaded) return;
        var pos = getCanvasPos(e);
        var x = Math.round(pos.x), y = Math.round(pos.y);
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            document.getElementById('statusPos').textContent = 'Pos: ' + x + ', ' + y;
            if (currentTool === 'picker') {
                var px = ctx.getImageData(x, y, 1, 1).data;
                var hex = '#' + ((1 << 24) + (px[0] << 16) + (px[1] << 8) + px[2]).toString(16).slice(1);
                document.getElementById('statusColor').textContent = 'Color: ' + hex;
            }
        }
    });

    // ── Before/After ──

    document.getElementById('beforeAfterBtn').addEventListener('click', function () {
        if (!imgLoaded || !originalImageData) return;
        if (!showingBefore) {
            var current = ctx.getImageData(0, 0, canvas.width, canvas.height);
            canvas.width = originalImageData.width;
            canvas.height = originalImageData.height;
            ctx.putImageData(originalImageData, 0, 0);
            canvas._savedCurrent = current;
            this.classList.add('active');
            showingBefore = true;
        } else {
            if (canvas._savedCurrent) {
                canvas.width = canvas._savedCurrent.width;
                canvas.height = canvas._savedCurrent.height;
                ctx.putImageData(canvas._savedCurrent, 0, 0);
                delete canvas._savedCurrent;
            }
            this.classList.remove('active');
            showingBefore = false;
        }
        syncOverlay();
    });

    // ── Export ──

    document.querySelectorAll('[data-format]').forEach(function (item) {
        item.addEventListener('click', function (e) {
            e.preventDefault();
            exportImage(this.dataset.format, canvas.width, canvas.height, 0.92);
        });
    });

    document.getElementById('exportCustom').addEventListener('click', function (e) {
        e.preventDefault();
        document.getElementById('exportW').value = canvas.width;
        document.getElementById('exportH').value = canvas.height;
        new bootstrap.Modal(document.getElementById('exportModal')).show();
    });

    var exportAspect = 1;
    document.getElementById('exportW').addEventListener('input', function () {
        if (document.getElementById('exportLock').checked) {
            document.getElementById('exportH').value = Math.round(this.value / exportAspect);
        }
    });
    document.getElementById('exportH').addEventListener('input', function () {
        if (document.getElementById('exportLock').checked) {
            document.getElementById('exportW').value = Math.round(this.value * exportAspect);
        }
    });
    document.getElementById('exportModal').addEventListener('show.bs.modal', function () {
        exportAspect = canvas.width / canvas.height;
    });
    document.getElementById('exportQuality').addEventListener('input', function () {
        document.getElementById('exportQualityVal').textContent = this.value + '%';
    });
    document.getElementById('applyExportBtn').addEventListener('click', function () {
        var w = parseInt(document.getElementById('exportW').value);
        var h = parseInt(document.getElementById('exportH').value);
        var fmt = document.getElementById('exportFormat').value;
        var q = parseInt(document.getElementById('exportQuality').value) / 100;
        exportImage(fmt, w, h, q);
        bootstrap.Modal.getInstance(document.getElementById('exportModal')).hide();
    });

    function exportImage(format, w, h, quality) {
        if (!imgLoaded) return;
        // Commit any pending adjustments
        if (adjustmentsDirty) commitAdjustments();

        var tmp = document.createElement('canvas');
        tmp.width = w; tmp.height = h;
        var tctx = tmp.getContext('2d');
        tctx.imageSmoothingEnabled = true;
        tctx.imageSmoothingQuality = 'high';
        tctx.drawImage(canvas, 0, 0, w, h);

        var ext = format === 'image/jpeg' ? '.jpg' : format === 'image/webp' ? '.webp' : '.png';
        var dataUrl = tmp.toDataURL(format, quality);
        var a = document.createElement('a');
        a.href = dataUrl;
        a.download = fileName.replace(/\.[^.]+$/, '') + '-edited' + ext;
        a.click();
    }

    // ── Helper Functions ──

    function getCanvasPos(e) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / zoom,
            y: (e.clientY - rect.top) / zoom
        };
    }

    function enableTools() {
        var btns = ['rotateCWBtn', 'rotateCCWBtn', 'flipHBtn', 'flipVBtn',
            'cropToolBtn', 'resizeBtn', 'drawToolBtn', 'textToolBtn', 'shapeToolBtn', 'pickerToolBtn',
            'exportDropBtn', 'beforeAfterBtn'];
        btns.forEach(function (id) { document.getElementById(id).disabled = false; });
    }

    function updateStatus() {
        if (!imgLoaded) return;
        document.getElementById('statusDim').textContent = canvas.width + ' x ' + canvas.height + ' px';
        document.getElementById('statusFile').textContent = fileName + (originalFileSize ? ' (' + formatSize(originalFileSize) + ')' : '');
    }

    function updateInfo() {
        var panel = document.getElementById('imageInfoPanel');
        var info = document.getElementById('imageInfo');
        panel.style.display = 'block';
        info.innerHTML =
            'Name: ' + fileName + '<br>' +
            'Type: ' + fileType + '<br>' +
            'Size: ' + canvas.width + ' x ' + canvas.height + ' px<br>' +
            'Original: ' + (originalFileSize ? formatSize(originalFileSize) : 'N/A');
    }

    function formatSize(bytes) {
        if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return bytes + ' B';
    }

    // ── Keyboard Shortcuts ──

    document.addEventListener('keydown', function (e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); }
        else if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); fileInput.click(); }
        else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.25);
        else if (e.key === '-') setZoom(zoom / 1.25);
        else if (e.key === '0') setZoom(1);
        else if (e.key === 'c' || e.key === 'C') { if (imgLoaded) setTool(currentTool === 'crop' ? 'select' : 'crop'); }
        else if (e.key === 'd' || e.key === 'D') { if (imgLoaded) setTool(currentTool === 'draw' ? 'select' : 'draw'); }
        else if (e.key === 't' || e.key === 'T') { if (imgLoaded) setTool(currentTool === 'text' ? 'select' : 'text'); }
        else if (e.key === 's' || e.key === 'S') { if (imgLoaded && !e.ctrlKey) setTool(currentTool === 'shape' ? 'select' : 'shape'); }
        else if (e.key === 'i' || e.key === 'I') { if (imgLoaded) setTool(currentTool === 'picker' ? 'select' : 'picker'); }
        else if (e.key === 'Escape') setTool('select');
    });

    // ── Init ──
    setTool('select');
});
