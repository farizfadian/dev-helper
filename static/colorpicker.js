document.addEventListener('DOMContentLoaded', function () {
    // ── DOM Elements ──
    const colorPreview = document.getElementById('colorPreview');
    const previewText = document.getElementById('previewText');
    const nativePicker = document.getElementById('nativePicker');
    const hexInput = document.getElementById('hexInput');
    const rgbR = document.getElementById('rgbR');
    const rgbG = document.getElementById('rgbG');
    const rgbB = document.getElementById('rgbB');
    const hslH = document.getElementById('hslH');
    const hslS = document.getElementById('hslS');
    const hslL = document.getElementById('hslL');
    const cssOutput = document.getElementById('cssOutput');
    const paletteGrid = document.getElementById('paletteGrid');
    const historyColors = document.getElementById('historyColors');
    const shadesRow = document.getElementById('shadesRow');
    const tintsRow = document.getElementById('tintsRow');

    const STORAGE_KEY = 'devhelper_colorpicker_color';
    const HISTORY_KEY = 'devhelper_colorpicker_history';
    const MAX_HISTORY = 12;

    let currentColor = { r: 233, g: 30, b: 99 }; // default #E91E63
    let history = [];

    // ── Preset Palette (Material Design + Web Classics) ──
    const PALETTE = [
        '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
        '#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50',
        '#8BC34A', '#CDDC39', '#FFEB3B', '#FFC107', '#FF9800',
        '#FF5722', '#795548', '#9E9E9E', '#607D8B', '#000000',
        '#FFFFFF', '#F8F9FA', '#DEE2E6', '#6C757D', '#343A40',
        '#0D6EFD', '#6610F2', '#D63384', '#DC3545', '#FD7E14',
        '#198754', '#20C997', '#0DCAF0', '#6F42C1', '#E83E8C',
    ];

    // ── Color Conversion Functions ──

    function hexToRgb(hex) {
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        const num = parseInt(hex, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255
        };
    }

    function rgbToHex(r, g, b) {
        return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s;
        const l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    function hslToRgb(h, s, l) {
        h /= 360; s /= 100; l /= 100;

        if (s === 0) {
            const val = Math.round(l * 255);
            return { r: val, g: val, b: val };
        }

        function hue2rgb(p, q, t) {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        return {
            r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
            g: Math.round(hue2rgb(p, q, h) * 255),
            b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
        };
    }

    // ── Luminance & Contrast (WCAG 2.0) ──

    function relativeLuminance(r, g, b) {
        const srgb = [r, g, b].map(function (c) {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    }

    function contrastRatio(lum1, lum2) {
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    // ── Update All UI ──

    function updateFromRgb(r, g, b, source) {
        r = clamp(r, 0, 255);
        g = clamp(g, 0, 255);
        b = clamp(b, 0, 255);
        currentColor = { r: r, g: g, b: b };

        const hex = rgbToHex(r, g, b);
        const hsl = rgbToHsl(r, g, b);

        // Update all inputs except the source to avoid loop
        if (source !== 'hex') hexInput.value = hex;
        if (source !== 'native') nativePicker.value = '#' + hex;
        if (source !== 'rgb') {
            rgbR.value = r;
            rgbG.value = g;
            rgbB.value = b;
        }
        if (source !== 'hsl') {
            hslH.value = hsl.h;
            hslS.value = hsl.s;
            hslL.value = hsl.l;
        }

        // Update preview
        const hexStr = '#' + hex;
        colorPreview.style.backgroundColor = hexStr;
        previewText.textContent = hexStr;

        // Choose preview text color based on luminance
        const lum = relativeLuminance(r, g, b);
        previewText.style.color = lum > 0.179 ? '#000000' : '#FFFFFF';

        // CSS output
        cssOutput.textContent = 'background-color: ' + hexStr + ';';

        // Contrast checker
        updateContrastChecker(r, g, b);

        // Shades & Tints
        updateShadesAndTints(r, g, b);

        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, hexStr);
    }

    function clamp(val, min, max) {
        val = parseInt(val) || 0;
        return Math.max(min, Math.min(max, val));
    }

    // ── Contrast Checker ──

    function updateContrastChecker(r, g, b) {
        const lumColor = relativeLuminance(r, g, b);
        const lumWhite = relativeLuminance(255, 255, 255);
        const lumBlack = relativeLuminance(0, 0, 0);

        const ratioOnWhite = contrastRatio(lumColor, lumWhite);
        const ratioOnBlack = contrastRatio(lumColor, lumBlack);

        // On White
        const contrastOnWhite = document.getElementById('contrastOnWhite');
        contrastOnWhite.style.backgroundColor = '#FFFFFF';
        contrastOnWhite.style.color = 'rgb(' + r + ',' + g + ',' + b + ')';
        document.getElementById('contrastWhiteText').style.color = 'rgb(' + r + ',' + g + ',' + b + ')';
        document.getElementById('contrastWhiteRatio').textContent = 'Ratio: ' + ratioOnWhite.toFixed(2) + ':1';
        document.getElementById('contrastWhiteRatio').style.color = '#666';

        const whiteAA = document.getElementById('contrastWhiteAA');
        const whiteAAA = document.getElementById('contrastWhiteAAA');
        whiteAA.className = 'contrast-badge ' + (ratioOnWhite >= 4.5 ? 'contrast-pass' : 'contrast-fail');
        whiteAAA.className = 'contrast-badge ' + (ratioOnWhite >= 7 ? 'contrast-pass' : 'contrast-fail');

        // On Black
        const contrastOnBlack = document.getElementById('contrastOnBlack');
        contrastOnBlack.style.backgroundColor = '#000000';
        contrastOnBlack.style.color = 'rgb(' + r + ',' + g + ',' + b + ')';
        document.getElementById('contrastBlackText').style.color = 'rgb(' + r + ',' + g + ',' + b + ')';
        document.getElementById('contrastBlackRatio').textContent = 'Ratio: ' + ratioOnBlack.toFixed(2) + ':1';
        document.getElementById('contrastBlackRatio').style.color = '#999';

        const blackAA = document.getElementById('contrastBlackAA');
        const blackAAA = document.getElementById('contrastBlackAAA');
        blackAA.className = 'contrast-badge ' + (ratioOnBlack >= 4.5 ? 'contrast-pass' : 'contrast-fail');
        blackAAA.className = 'contrast-badge ' + (ratioOnBlack >= 7 ? 'contrast-pass' : 'contrast-fail');
    }

    // ── Shades & Tints ──

    function updateShadesAndTints(r, g, b) {
        shadesRow.innerHTML = '';
        tintsRow.innerHTML = '';

        // Generate 8 shades (darker) and 8 tints (lighter)
        for (let i = 1; i <= 8; i++) {
            const factor = i / 9;

            // Shade: mix with black
            const sr = Math.round(r * (1 - factor));
            const sg = Math.round(g * (1 - factor));
            const sb = Math.round(b * (1 - factor));
            const shadeHex = '#' + rgbToHex(sr, sg, sb);

            const shadeEl = document.createElement('div');
            shadeEl.className = 'history-color flex-fill';
            shadeEl.style.backgroundColor = shadeHex;
            shadeEl.style.minWidth = '0';
            shadeEl.style.height = '28px';
            shadeEl.title = shadeHex;
            shadeEl.addEventListener('click', function () {
                const c = hexToRgb(shadeHex);
                updateFromRgb(c.r, c.g, c.b, 'palette');
                addToHistory(shadeHex);
            });
            shadesRow.appendChild(shadeEl);

            // Tint: mix with white
            const tr = Math.round(r + (255 - r) * factor);
            const tg = Math.round(g + (255 - g) * factor);
            const tb = Math.round(b + (255 - b) * factor);
            const tintHex = '#' + rgbToHex(tr, tg, tb);

            const tintEl = document.createElement('div');
            tintEl.className = 'history-color flex-fill';
            tintEl.style.backgroundColor = tintHex;
            tintEl.style.minWidth = '0';
            tintEl.style.height = '28px';
            tintEl.title = tintHex;
            tintEl.addEventListener('click', function () {
                const c = hexToRgb(tintHex);
                updateFromRgb(c.r, c.g, c.b, 'palette');
                addToHistory(tintHex);
            });
            tintsRow.appendChild(tintEl);
        }
    }

    // ── Event Listeners: Inputs ──

    // Native color picker
    nativePicker.addEventListener('input', function () {
        const rgb = hexToRgb(this.value);
        updateFromRgb(rgb.r, rgb.g, rgb.b, 'native');
    });

    nativePicker.addEventListener('change', function () {
        addToHistory('#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b));
    });

    // HEX input
    hexInput.addEventListener('input', function () {
        let val = this.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6);
        if (val.length === 6 || val.length === 3) {
            const rgb = hexToRgb(val);
            updateFromRgb(rgb.r, rgb.g, rgb.b, 'hex');
        }
    });

    hexInput.addEventListener('change', function () {
        addToHistory('#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b));
    });

    // RGB inputs
    [rgbR, rgbG, rgbB].forEach(function (input) {
        input.addEventListener('input', function () {
            updateFromRgb(
                parseInt(rgbR.value) || 0,
                parseInt(rgbG.value) || 0,
                parseInt(rgbB.value) || 0,
                'rgb'
            );
        });
        input.addEventListener('change', function () {
            addToHistory('#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b));
        });
    });

    // HSL inputs
    [hslH, hslS, hslL].forEach(function (input) {
        input.addEventListener('input', function () {
            const rgb = hslToRgb(
                parseInt(hslH.value) || 0,
                parseInt(hslS.value) || 0,
                parseInt(hslL.value) || 0
            );
            updateFromRgb(rgb.r, rgb.g, rgb.b, 'hsl');
        });
        input.addEventListener('change', function () {
            addToHistory('#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b));
        });
    });

    // ── Copy Buttons ──

    document.getElementById('copyHex').addEventListener('click', function () {
        copyText('#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b), this);
    });

    document.getElementById('copyRgb').addEventListener('click', function () {
        copyText('rgb(' + currentColor.r + ', ' + currentColor.g + ', ' + currentColor.b + ')', this);
    });

    document.getElementById('copyHsl').addEventListener('click', function () {
        const hsl = rgbToHsl(currentColor.r, currentColor.g, currentColor.b);
        copyText('hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)', this);
    });

    document.getElementById('copyCss').addEventListener('click', function () {
        copyText(cssOutput.textContent, this);
    });

    // Click preview to copy HEX
    colorPreview.addEventListener('click', function () {
        copyText('#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b));
        // Flash feedback on preview
        previewText.textContent = 'Copied!';
        setTimeout(function () {
            previewText.textContent = '#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b);
        }, 800);
    });

    // ── Random Color ──

    document.getElementById('randomBtn').addEventListener('click', function () {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        updateFromRgb(r, g, b, 'random');
        addToHistory('#' + rgbToHex(r, g, b));
    });

    // ── EyeDropper API (Chrome 95+) ──

    const eyedropperBtn = document.getElementById('eyedropperBtn');
    if (window.EyeDropper) {
        eyedropperBtn.addEventListener('click', function () {
            const dropper = new EyeDropper();
            dropper.open().then(function (result) {
                const rgb = hexToRgb(result.sRGBHex);
                updateFromRgb(rgb.r, rgb.g, rgb.b, 'eyedropper');
                addToHistory(result.sRGBHex.toUpperCase());
            }).catch(function () {
                // User cancelled
            });
        });
    } else {
        eyedropperBtn.style.display = 'none';
    }

    // ── Palette ──

    function renderPalette() {
        paletteGrid.innerHTML = '';
        PALETTE.forEach(function (color) {
            const el = document.createElement('div');
            el.className = 'palette-color';
            el.style.backgroundColor = color;
            el.title = color;
            el.addEventListener('click', function () {
                const rgb = hexToRgb(color);
                updateFromRgb(rgb.r, rgb.g, rgb.b, 'palette');
                addToHistory(color);
            });
            paletteGrid.appendChild(el);
        });
    }

    // ── History ──

    function loadHistory() {
        try {
            const saved = localStorage.getItem(HISTORY_KEY);
            if (saved) history = JSON.parse(saved);
        } catch (e) {
            history = [];
        }
    }

    function saveHistory() {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }

    function addToHistory(hexColor) {
        hexColor = hexColor.toUpperCase();
        // Remove duplicate if exists
        const idx = history.indexOf(hexColor);
        if (idx !== -1) history.splice(idx, 1);
        // Add to front
        history.unshift(hexColor);
        // Limit
        if (history.length > MAX_HISTORY) history.pop();
        saveHistory();
        renderHistory();
    }

    function renderHistory() {
        if (history.length === 0) {
            historyColors.innerHTML = '<span class="text-muted small">No colors yet</span>';
            return;
        }

        historyColors.innerHTML = '';
        history.forEach(function (color) {
            const el = document.createElement('div');
            el.className = 'history-color';
            el.style.backgroundColor = color;
            el.title = color + ' (click to use, right-click to copy)';
            el.addEventListener('click', function () {
                const rgb = hexToRgb(color);
                updateFromRgb(rgb.r, rgb.g, rgb.b, 'history');
            });
            el.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                copyText(color);
            });
            historyColors.appendChild(el);
        });
    }

    document.getElementById('clearHistoryBtn').addEventListener('click', function () {
        history = [];
        saveHistory();
        renderHistory();
    });

    // ── Copy Helper ──

    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(function () {
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check-lg"></i>';
                setTimeout(function () { btn.innerHTML = orig; }, 1200);
            }
        });
    }

    // ── Keyboard Shortcuts ──

    document.addEventListener('keydown', function (e) {
        // Don't trigger if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        // R = random color
        if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            document.getElementById('randomBtn').click();
        }
        // C = copy hex
        if (e.key === 'c' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            copyText('#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b));
            previewText.textContent = 'Copied!';
            setTimeout(function () {
                previewText.textContent = '#' + rgbToHex(currentColor.r, currentColor.g, currentColor.b);
            }, 800);
        }
    });

    // ── Initialize ──

    loadHistory();
    renderPalette();
    renderHistory();

    // Restore last used color from localStorage
    const savedColor = localStorage.getItem(STORAGE_KEY);
    if (savedColor) {
        const rgb = hexToRgb(savedColor);
        updateFromRgb(rgb.r, rgb.g, rgb.b, 'init');
    } else {
        // Default: #E91E63
        updateFromRgb(233, 30, 99, 'init');
    }
});
