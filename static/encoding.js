// ── Encoding Detector ──
document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const textInput = document.getElementById('textInput');
    const results = document.getElementById('results');
    const hexView = document.getElementById('hexView');
    const reDecodeBtn = document.getElementById('reDecodeBtn');
    const reDecodeEncoding = document.getElementById('reDecodeEncoding');
    const reDecodeOutput = document.getElementById('reDecodeOutput');

    let rawBytes = null;

    function detectEncoding(bytes) {
        const arr = new Uint8Array(bytes);
        const detected = [];

        // Check BOM
        if (arr.length >= 3 && arr[0] === 0xEF && arr[1] === 0xBB && arr[2] === 0xBF) {
            detected.push({ encoding: 'UTF-8', confidence: 100, bom: true });
        } else if (arr.length >= 2 && arr[0] === 0xFF && arr[1] === 0xFE) {
            detected.push({ encoding: 'UTF-16 LE', confidence: 100, bom: true });
        } else if (arr.length >= 2 && arr[0] === 0xFE && arr[1] === 0xFF) {
            detected.push({ encoding: 'UTF-16 BE', confidence: 100, bom: true });
        }

        // UTF-8 validation
        let validUtf8 = true;
        let utf8MultiByte = 0;
        for (let i = 0; i < arr.length; i++) {
            const b = arr[i];
            if (b <= 0x7F) continue;
            else if ((b & 0xE0) === 0xC0) { if (i + 1 >= arr.length || (arr[i+1] & 0xC0) !== 0x80) { validUtf8 = false; break; } utf8MultiByte++; i += 1; }
            else if ((b & 0xF0) === 0xE0) { if (i + 2 >= arr.length || (arr[i+1] & 0xC0) !== 0x80 || (arr[i+2] & 0xC0) !== 0x80) { validUtf8 = false; break; } utf8MultiByte++; i += 2; }
            else if ((b & 0xF8) === 0xF0) { if (i + 3 >= arr.length || (arr[i+1] & 0xC0) !== 0x80 || (arr[i+2] & 0xC0) !== 0x80 || (arr[i+3] & 0xC0) !== 0x80) { validUtf8 = false; break; } utf8MultiByte++; i += 3; }
            else { validUtf8 = false; break; }
        }

        // Check if pure ASCII
        const isAscii = arr.every(b => b <= 0x7F);

        if (isAscii) {
            detected.push({ encoding: 'ASCII', confidence: 100 });
            detected.push({ encoding: 'UTF-8', confidence: 95, note: '(ASCII is valid UTF-8)' });
        } else if (validUtf8 && utf8MultiByte > 0) {
            detected.push({ encoding: 'UTF-8', confidence: 95 });
        }

        // Check for high bytes → possible Latin-1/Windows-1252
        const highBytes = arr.filter(b => b >= 0x80 && b <= 0xFF).length;
        if (highBytes > 0 && !validUtf8) {
            detected.push({ encoding: 'ISO-8859-1', confidence: 60 });
            detected.push({ encoding: 'Windows-1252', confidence: 55 });
        }

        // Shift_JIS detection (simplified)
        let shiftJisScore = 0;
        for (let i = 0; i < arr.length - 1; i++) {
            const b1 = arr[i];
            const b2 = arr[i + 1];
            if ((b1 >= 0x81 && b1 <= 0x9F || b1 >= 0xE0 && b1 <= 0xEF) &&
                (b2 >= 0x40 && b2 <= 0x7E || b2 >= 0x80 && b2 <= 0xFC)) {
                shiftJisScore++;
                i++;
            }
        }
        if (shiftJisScore > 5) {
            detected.push({ encoding: 'Shift_JIS', confidence: Math.min(80, 40 + shiftJisScore) });
        }

        if (detected.length === 0) {
            detected.push({ encoding: 'Unknown', confidence: 0 });
        }

        // Sort by confidence
        detected.sort((a, b) => b.confidence - a.confidence);
        return detected;
    }

    function showResults(bytes) {
        rawBytes = bytes;
        const arr = new Uint8Array(bytes);
        const detected = detectEncoding(bytes);

        // Results
        let html = '<table class="table table-sm mb-0"><thead><tr><th>Encoding</th><th>Confidence</th><th>Notes</th></tr></thead><tbody>';
        detected.forEach(d => {
            const barColor = d.confidence >= 80 ? 'bg-success' : d.confidence >= 50 ? 'bg-warning' : 'bg-danger';
            html += `<tr>
                <td class="fw-semibold">${d.encoding}</td>
                <td><div class="progress" style="height:16px; width:120px;"><div class="progress-bar ${barColor}" style="width:${d.confidence}%">${d.confidence}%</div></div></td>
                <td>${d.bom ? '<span class="badge bg-info">BOM detected</span>' : ''}${d.note || ''}</td>
            </tr>`;
        });
        html += '</tbody></table>';
        html += `<div class="mt-2 text-muted" style="font-size:0.78rem;">File size: ${arr.length.toLocaleString()} bytes</div>`;
        results.innerHTML = html;

        // Hex view
        const maxBytes = Math.min(arr.length, 256);
        let hexStr = '';
        for (let i = 0; i < maxBytes; i += 16) {
            const offset = i.toString(16).padStart(8, '0');
            let hex = '';
            let ascii = '';
            for (let j = 0; j < 16; j++) {
                if (i + j < maxBytes) {
                    hex += arr[i + j].toString(16).padStart(2, '0') + ' ';
                    const b = arr[i + j];
                    ascii += (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
                } else {
                    hex += '   ';
                    ascii += ' ';
                }
            }
            hexStr += `${offset}  ${hex} |${ascii}|\n`;
        }
        hexView.textContent = hexStr;

        // Auto-decode with best encoding
        if (detected.length > 0 && detected[0].encoding !== 'Unknown') {
            const enc = detected[0].encoding.toLowerCase().replace(' ', '');
            reDecodeEncoding.value = enc === 'ascii' ? 'utf-8' : enc;
        }
    }

    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = function (e) { showResults(e.target.result); };
        reader.readAsArrayBuffer(file);
    }

    // File input
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', function () { if (this.files[0]) loadFile(this.files[0]); this.value = ''; });
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('drop-active'); }));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('drop-active'); }));
    dropZone.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });

    // Text input
    textInput.addEventListener('input', function () {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(this.value);
        showResults(bytes.buffer);
    });

    // Re-decode
    reDecodeBtn.addEventListener('click', function () {
        if (!rawBytes) return;
        try {
            const decoder = new TextDecoder(reDecodeEncoding.value, { fatal: false });
            reDecodeOutput.value = decoder.decode(rawBytes);
        } catch (e) {
            reDecodeOutput.value = 'Error: ' + e.message;
        }
    });
});
