document.addEventListener('DOMContentLoaded', function () {
    const qrPreview = document.getElementById('qrPreview');
    const qrCanvas = document.getElementById('qrCanvas');
    const downloadPngBtn = document.getElementById('downloadPngBtn');
    const copyImageBtn = document.getElementById('copyImageBtn');
    const downloadSvgBtn = document.getElementById('downloadSvgBtn');
    const clearQrBtn = document.getElementById('clearQrBtn');
    const qrStats = document.getElementById('qrStats');

    // Input fields
    const textContent = document.getElementById('textContent');
    const urlContent = document.getElementById('urlContent');
    const wifiSsid = document.getElementById('wifiSsid');
    const wifiPassword = document.getElementById('wifiPassword');
    const wifiEncryption = document.getElementById('wifiEncryption');
    const vcardName = document.getElementById('vcardName');
    const vcardPhone = document.getElementById('vcardPhone');
    const vcardEmail = document.getElementById('vcardEmail');
    const vcardOrg = document.getElementById('vcardOrg');
    const vcardUrl = document.getElementById('vcardUrl');

    // Options
    const qrSize = document.getElementById('qrSize');
    const qrErrorLevel = document.getElementById('qrErrorLevel');
    const qrFgColor = document.getElementById('qrFgColor');
    const qrBgColor = document.getElementById('qrBgColor');
    const fgColorLabel = document.getElementById('fgColorLabel');
    const bgColorLabel = document.getElementById('bgColorLabel');

    let currentType = 'text';
    let debounceTimer = null;
    let lastQrData = null; // Store last generated QR data for SVG export

    // ── localStorage Persistence ──
    const STORAGE_KEY = 'devhelper_qrcode_content';

    function saveContent() {
        try {
            const data = {
                type: currentType,
                text: textContent.value,
                url: urlContent.value,
                wifi: {
                    ssid: wifiSsid.value,
                    password: wifiPassword.value,
                    encryption: wifiEncryption.value
                },
                vcard: {
                    name: vcardName.value,
                    phone: vcardPhone.value,
                    email: vcardEmail.value,
                    org: vcardOrg.value,
                    url: vcardUrl.value
                },
                options: {
                    size: qrSize.value,
                    errorLevel: qrErrorLevel.value,
                    fgColor: qrFgColor.value,
                    bgColor: qrBgColor.value
                }
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) { /* ignore */ }
    }

    function loadContent() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const data = JSON.parse(raw);

            if (data.text) textContent.value = data.text;
            if (data.url) urlContent.value = data.url;
            if (data.wifi) {
                if (data.wifi.ssid) wifiSsid.value = data.wifi.ssid;
                if (data.wifi.password) wifiPassword.value = data.wifi.password;
                if (data.wifi.encryption) wifiEncryption.value = data.wifi.encryption;
            }
            if (data.vcard) {
                if (data.vcard.name) vcardName.value = data.vcard.name;
                if (data.vcard.phone) vcardPhone.value = data.vcard.phone;
                if (data.vcard.email) vcardEmail.value = data.vcard.email;
                if (data.vcard.org) vcardOrg.value = data.vcard.org;
                if (data.vcard.url) vcardUrl.value = data.vcard.url;
            }
            if (data.options) {
                if (data.options.size) qrSize.value = data.options.size;
                if (data.options.errorLevel) qrErrorLevel.value = data.options.errorLevel;
                if (data.options.fgColor) {
                    qrFgColor.value = data.options.fgColor;
                    fgColorLabel.textContent = data.options.fgColor;
                }
                if (data.options.bgColor) {
                    qrBgColor.value = data.options.bgColor;
                    bgColorLabel.textContent = data.options.bgColor;
                }
            }
            if (data.type) {
                switchInputType(data.type);
            }
        } catch (e) { /* ignore */ }
    }

    // ── Input Type Switching ──

    function switchInputType(type) {
        currentType = type;

        // Toggle buttons
        document.querySelectorAll('.input-type-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.type === type);
        });

        // Toggle panels
        document.querySelectorAll('.input-panel').forEach(function (panel) {
            panel.classList.add('d-none');
        });

        var panelMap = { text: 'inputText', url: 'inputUrl', wifi: 'inputWifi', vcard: 'inputVcard' };
        var panel = document.getElementById(panelMap[type]);
        if (panel) panel.classList.remove('d-none');

        debouncedGenerate();
    }

    document.querySelectorAll('.input-type-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchInputType(this.dataset.type);
        });
    });

    // ── WiFi password toggle ──
    document.getElementById('wifiTogglePass').addEventListener('click', function () {
        var input = wifiPassword;
        var icon = this.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            icon.className = 'bi bi-eye-slash';
        } else {
            input.type = 'password';
            icon.className = 'bi bi-eye';
        }
    });

    // ── Get QR Content ──

    function getQrContent() {
        switch (currentType) {
            case 'text':
                return textContent.value.trim();

            case 'url':
                var url = urlContent.value.trim();
                if (url && !url.match(/^https?:\/\//i)) {
                    url = 'https://' + url;
                }
                return url;

            case 'wifi':
                var ssid = wifiSsid.value.trim();
                if (!ssid) return '';
                var pwd = wifiPassword.value;
                var enc = wifiEncryption.value;
                // Escape special characters in SSID and password
                var escapedSsid = escapeWifiField(ssid);
                var escapedPwd = escapeWifiField(pwd);
                if (enc === 'nopass') {
                    return 'WIFI:T:nopass;S:' + escapedSsid + ';;';
                }
                return 'WIFI:T:' + enc + ';S:' + escapedSsid + ';P:' + escapedPwd + ';;';

            case 'vcard':
                var name = vcardName.value.trim();
                if (!name) return '';
                var parts = name.split(' ');
                var lastName = parts.length > 1 ? parts.pop() : '';
                var firstName = parts.join(' ') || lastName;
                if (lastName === '' && firstName) {
                    lastName = firstName;
                    firstName = '';
                }

                var vcard = 'BEGIN:VCARD\nVERSION:3.0\n';
                vcard += 'N:' + lastName + ';' + firstName + ';;;\n';
                vcard += 'FN:' + name + '\n';
                if (vcardPhone.value.trim()) {
                    vcard += 'TEL;TYPE=CELL:' + vcardPhone.value.trim() + '\n';
                }
                if (vcardEmail.value.trim()) {
                    vcard += 'EMAIL:' + vcardEmail.value.trim() + '\n';
                }
                if (vcardOrg.value.trim()) {
                    vcard += 'ORG:' + vcardOrg.value.trim() + '\n';
                }
                if (vcardUrl.value.trim()) {
                    vcard += 'URL:' + vcardUrl.value.trim() + '\n';
                }
                vcard += 'END:VCARD';
                return vcard;

            default:
                return '';
        }
    }

    function escapeWifiField(str) {
        // Escape special WiFi QR characters: \, ;, ,, ", :
        return str.replace(/\\/g, '\\\\')
                  .replace(/;/g, '\\;')
                  .replace(/,/g, '\\,')
                  .replace(/"/g, '\\"')
                  .replace(/:/g, '\\:');
    }

    // ── QR Code Generation ──

    function generateQr() {
        var content = getQrContent();
        saveContent();

        if (!content) {
            qrPreview.innerHTML = '<span class="placeholder-text"><i class="bi bi-qr-code" style="font-size: 3rem; opacity: 0.3;"></i><br>Enter content to generate QR code</span>';
            downloadPngBtn.disabled = true;
            copyImageBtn.disabled = true;
            downloadSvgBtn.disabled = true;
            qrStats.textContent = '';
            lastQrData = null;
            return;
        }

        var ecLevel = qrErrorLevel.value || 'M';

        try {
            // typeNumber 0 = auto-detect
            var qr = qrcode(0, ecLevel);
            qr.addData(content);
            qr.make();

            var moduleCount = qr.getModuleCount();
            var size = parseInt(qrSize.value);
            var cellSize = Math.floor(size / (moduleCount + 2)); // +2 for margin
            var margin = Math.floor((size - cellSize * moduleCount) / 2);

            var fgColor = qrFgColor.value;
            var bgColor = qrBgColor.value;

            // Draw on canvas
            qrCanvas.width = size;
            qrCanvas.height = size;
            var ctx = qrCanvas.getContext('2d');

            // Background
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, size, size);

            // Modules
            ctx.fillStyle = fgColor;
            for (var row = 0; row < moduleCount; row++) {
                for (var col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        ctx.fillRect(
                            margin + col * cellSize,
                            margin + row * cellSize,
                            cellSize,
                            cellSize
                        );
                    }
                }
            }

            // Store QR data for SVG export
            lastQrData = {
                moduleCount: moduleCount,
                isDark: function (row, col) { return qr.isDark(row, col); },
                size: size,
                cellSize: cellSize,
                margin: margin,
                fgColor: fgColor,
                bgColor: bgColor
            };

            // Display preview
            var img = new Image();
            img.src = qrCanvas.toDataURL('image/png');
            img.style.maxWidth = '100%';
            img.style.imageRendering = 'pixelated';
            img.alt = 'QR Code';
            qrPreview.innerHTML = '';
            qrPreview.appendChild(img);

            // Enable buttons
            downloadPngBtn.disabled = false;
            copyImageBtn.disabled = false;
            downloadSvgBtn.disabled = false;

            // Stats
            var contentBytes = new TextEncoder().encode(content).length;
            qrStats.textContent = moduleCount + 'x' + moduleCount + ' modules | ' +
                size + 'x' + size + ' px | ' +
                contentBytes + ' bytes | EC: ' + qrErrorLevel.value;

        } catch (e) {
            qrPreview.innerHTML = '<span class="placeholder-text text-danger"><i class="bi bi-exclamation-triangle" style="font-size: 2rem;"></i><br>Error: ' + (e.message || e || 'Unknown error') + '<br><small>Try reducing content length or increasing error correction level</small></span>';
            downloadPngBtn.disabled = true;
            copyImageBtn.disabled = true;
            downloadSvgBtn.disabled = true;
            qrStats.textContent = '';
            lastQrData = null;
        }
    }

    // ── Debounced Generation ──

    function debouncedGenerate() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(generateQr, 300);
    }

    // ── Event Listeners for Auto-Generate ──

    // Text inputs
    textContent.addEventListener('input', debouncedGenerate);
    urlContent.addEventListener('input', debouncedGenerate);
    wifiSsid.addEventListener('input', debouncedGenerate);
    wifiPassword.addEventListener('input', debouncedGenerate);
    wifiEncryption.addEventListener('change', debouncedGenerate);
    vcardName.addEventListener('input', debouncedGenerate);
    vcardPhone.addEventListener('input', debouncedGenerate);
    vcardEmail.addEventListener('input', debouncedGenerate);
    vcardOrg.addEventListener('input', debouncedGenerate);
    vcardUrl.addEventListener('input', debouncedGenerate);

    // Options
    qrSize.addEventListener('change', debouncedGenerate);
    qrErrorLevel.addEventListener('change', debouncedGenerate);
    qrFgColor.addEventListener('input', function () {
        fgColorLabel.textContent = this.value;
        debouncedGenerate();
    });
    qrBgColor.addEventListener('input', function () {
        bgColorLabel.textContent = this.value;
        debouncedGenerate();
    });

    // Reset colors
    document.getElementById('resetColorsBtn').addEventListener('click', function () {
        qrFgColor.value = '#000000';
        qrBgColor.value = '#ffffff';
        fgColorLabel.textContent = '#000000';
        bgColorLabel.textContent = '#ffffff';
        debouncedGenerate();
    });

    // ── Download PNG ──

    downloadPngBtn.addEventListener('click', function () {
        qrCanvas.toBlob(function (blob) {
            if (!blob) return;
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            var typeName = currentType === 'vcard' ? 'contact' : currentType;
            a.download = 'qrcode-' + typeName + '-' + qrSize.value + 'px.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    });

    // ── Download SVG ──

    downloadSvgBtn.addEventListener('click', function () {
        if (!lastQrData) return;

        var d = lastQrData;
        var svgParts = [];
        svgParts.push('<?xml version="1.0" encoding="UTF-8"?>');
        svgParts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + d.size + '" height="' + d.size + '" viewBox="0 0 ' + d.size + ' ' + d.size + '">');
        svgParts.push('<rect width="' + d.size + '" height="' + d.size + '" fill="' + d.bgColor + '"/>');

        for (var row = 0; row < d.moduleCount; row++) {
            for (var col = 0; col < d.moduleCount; col++) {
                if (d.isDark(row, col)) {
                    svgParts.push('<rect x="' + (d.margin + col * d.cellSize) + '" y="' + (d.margin + row * d.cellSize) + '" width="' + d.cellSize + '" height="' + d.cellSize + '" fill="' + d.fgColor + '"/>');
                }
            }
        }

        svgParts.push('</svg>');
        var svgContent = svgParts.join('\n');
        var blob = new Blob([svgContent], { type: 'image/svg+xml' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var typeName = currentType === 'vcard' ? 'contact' : currentType;
        a.download = 'qrcode-' + typeName + '-' + d.size + 'px.svg';
        a.click();
        URL.revokeObjectURL(url);
    });

    // ── Copy Image to Clipboard ──

    copyImageBtn.addEventListener('click', function () {
        var btn = this;
        qrCanvas.toBlob(function (blob) {
            if (!blob) return;
            try {
                var item = new ClipboardItem({ 'image/png': blob });
                navigator.clipboard.write([item]).then(function () {
                    var orig = btn.innerHTML;
                    btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
                    setTimeout(function () { btn.innerHTML = orig; }, 1500);
                }).catch(function () {
                    // Fallback: copy as data URL
                    navigator.clipboard.writeText(qrCanvas.toDataURL('image/png')).then(function () {
                        var orig = btn.innerHTML;
                        btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied URL';
                        setTimeout(function () { btn.innerHTML = orig; }, 1500);
                    });
                });
            } catch (e) {
                // ClipboardItem not supported — copy data URL
                navigator.clipboard.writeText(qrCanvas.toDataURL('image/png')).then(function () {
                    var orig = btn.innerHTML;
                    btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied URL';
                    setTimeout(function () { btn.innerHTML = orig; }, 1500);
                });
            }
        }, 'image/png');
    });

    // ── Clear ──

    clearQrBtn.addEventListener('click', function () {
        textContent.value = '';
        urlContent.value = '';
        wifiSsid.value = '';
        wifiPassword.value = '';
        wifiEncryption.value = 'WPA';
        vcardName.value = '';
        vcardPhone.value = '';
        vcardEmail.value = '';
        vcardOrg.value = '';
        vcardUrl.value = '';

        qrPreview.innerHTML = '<span class="placeholder-text"><i class="bi bi-qr-code" style="font-size: 3rem; opacity: 0.3;"></i><br>Enter content to generate QR code</span>';
        downloadPngBtn.disabled = true;
        copyImageBtn.disabled = true;
        downloadSvgBtn.disabled = true;
        qrStats.textContent = '';
        lastQrData = null;

        saveContent();
    });

    // ── Keyboard shortcut: Ctrl+Enter to download ──
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            if (!downloadPngBtn.disabled) downloadPngBtn.click();
        }
    });

    // ── Load saved content and initial generate ──
    loadContent();
    generateQr();
});
