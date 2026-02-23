document.addEventListener('DOMContentLoaded', function () {
    const binaryInput = document.getElementById('binaryInput');
    const octalInput = document.getElementById('octalInput');
    const decimalInput = document.getElementById('decimalInput');
    const hexInput = document.getElementById('hexInput');
    const bitGrid = document.getElementById('bitGrid');
    const bitIndexRow = document.getElementById('bitIndexRow');
    const twosComplementInfo = document.getElementById('twosComplementInfo');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const infoText = document.getElementById('infoText');

    const inputs = [binaryInput, octalInput, decimalInput, hexInput];

    const STORAGE_KEY = 'devhelper_baseconv_value';

    // Validation patterns for each base
    const validators = {
        2: /^-?[01]+$/,
        8: /^-?[0-7]+$/,
        10: /^-?[0-9]+$/,
        16: /^-?[0-9a-fA-F]+$/
    };

    let debounceTimer = null;
    let currentBitWidth = 32;

    // ── Conversion Logic ──

    function parseInput(value, base) {
        value = value.trim();
        if (!value || value === '-') return null;

        // Validate
        if (!validators[base].test(value)) return undefined; // invalid

        const isNegative = value.startsWith('-');
        const absValue = isNegative ? value.slice(1) : value;

        let num;
        if (base === 10) {
            num = BigInt(value);
        } else {
            num = BigInt('0x0'); // start at 0
            // Parse manually for non-decimal bases
            const digits = absValue.toLowerCase();
            const baseBig = BigInt(base);
            num = 0n;
            for (let i = 0; i < digits.length; i++) {
                const digit = parseInt(digits[i], base);
                num = num * baseBig + BigInt(digit);
            }
            if (isNegative) num = -num;
        }

        return num;
    }

    function toBase(num, base) {
        if (num === 0n) return '0';

        const isNegative = num < 0n;
        let abs = isNegative ? -num : num;
        const baseBig = BigInt(base);
        let result = '';

        while (abs > 0n) {
            const digit = Number(abs % baseBig);
            result = digit.toString(base).toUpperCase() + result;
            abs = abs / baseBig;
        }

        return (isNegative ? '-' : '') + result;
    }

    function updateAllFields(sourceInput, value) {
        const base = parseInt(sourceInput.dataset.base);

        // Clear error
        errorMsg.classList.add('d-none');

        if (!value || value.trim() === '' || value.trim() === '-') {
            // Clear all other fields
            inputs.forEach(function (inp) {
                if (inp !== sourceInput) inp.value = '';
            });
            updateBitVisualization(0n);
            updateInfo(null);
            saveToStorage('');
            return;
        }

        const num = parseInput(value, base);

        if (num === undefined) {
            // Invalid input
            showError('Invalid character for base ' + base + '. Allowed: ' + getAllowedChars(base));
            return;
        }

        if (num === null) return;

        // Update other fields
        inputs.forEach(function (inp) {
            if (inp === sourceInput) return;
            const targetBase = parseInt(inp.dataset.base);
            inp.value = toBase(num, targetBase);
        });

        updateBitVisualization(num);
        updateInfo(num);
        saveToStorage(num.toString());
    }

    function getAllowedChars(base) {
        switch (base) {
            case 2: return '0, 1';
            case 8: return '0-7';
            case 10: return '0-9';
            case 16: return '0-9, A-F';
            default: return '';
        }
    }

    function showError(msg) {
        errorText.textContent = msg;
        errorMsg.classList.remove('d-none');
    }

    // ── Bit Visualization ──

    function updateBitVisualization(num) {
        const width = currentBitWidth;

        // Handle two's complement for negative numbers
        let bits;
        if (num < 0n) {
            // Two's complement: flip bits + 1
            const mask = (1n << BigInt(width)) - 1n;
            const twosComp = ((-num) ^ mask) + 1n;
            bits = twosComp & mask;

            twosComplementInfo.classList.remove('d-none');
            twosComplementInfo.innerHTML =
                '<span class="text-info">Two\'s complement (' + width + '-bit): </span>' +
                '<span>' + num.toString() + ' → unsigned ' + bits.toString() + '</span>';
        } else {
            bits = num;
            twosComplementInfo.classList.add('d-none');
        }

        // Check if value fits in bit width
        const maxUnsigned = (1n << BigInt(width)) - 1n;
        const displayBits = bits & maxUnsigned;

        // Check overflow
        if (num >= 0n && num > maxUnsigned) {
            twosComplementInfo.classList.remove('d-none');
            twosComplementInfo.innerHTML =
                '<span class="text-warning"><i class="bi bi-exclamation-triangle"></i> Value exceeds ' + width + '-bit range. Showing lower ' + width + ' bits.</span>';
        }

        // Build bit squares
        let gridHtml = '';
        let indexHtml = '';

        for (let i = width - 1; i >= 0; i--) {
            const bit = (displayBits >> BigInt(i)) & 1n;
            const isOne = bit === 1n;
            gridHtml += '<span class="bit-square ' + (isOne ? 'bit-1' : 'bit-0') + '">' + (isOne ? '1' : '0') + '</span>';
            indexHtml += '<span class="bit-index">' + i + '</span>';

            // Add separator every 4 bits (nibble boundary)
            if (i > 0 && i % 4 === 0) {
                gridHtml += '<span class="bit-separator"></span>';
                indexHtml += '<span class="bit-index-sep"></span>';
            }
        }

        bitGrid.innerHTML = gridHtml;
        bitIndexRow.innerHTML = indexHtml;
    }

    function updateInfo(num) {
        if (num === null || num === undefined) {
            infoText.textContent = '';
            return;
        }

        const parts = [];

        // Number of bits needed
        const abs = num < 0n ? -num : num;
        if (abs > 0n) {
            const bitCount = abs.toString(2).length;
            parts.push(bitCount + ' bits needed');
        }

        // Byte count
        if (abs > 0n) {
            const bitCount = abs.toString(2).length;
            const bytes = Math.ceil(bitCount / 8);
            parts.push(bytes + ' byte' + (bytes !== 1 ? 's' : ''));
        }

        // Power of 2 check
        if (abs > 0n && (abs & (abs - 1n)) === 0n) {
            const exp = abs.toString(2).length - 1;
            parts.push('2^' + exp);
        }

        // Max value check
        if (abs === 255n) parts.push('max uint8');
        else if (abs === 65535n) parts.push('max uint16');
        else if (abs === 4294967295n) parts.push('max uint32');
        else if (abs === 2147483647n) parts.push('max int32');
        else if (abs === 32767n) parts.push('max int16');
        else if (abs === 127n) parts.push('max int8');

        infoText.textContent = parts.join(' · ');
    }

    // ── Event Listeners ──

    inputs.forEach(function (inp) {
        inp.addEventListener('input', function () {
            const self = this;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function () {
                updateAllFields(self, self.value);
            }, 50);
        });

        // Allow paste
        inp.addEventListener('paste', function () {
            const self = this;
            setTimeout(function () {
                updateAllFields(self, self.value);
            }, 10);
        });

        // Strip prefixes on paste (0b, 0o, 0x)
        inp.addEventListener('input', function () {
            let val = this.value.trim();
            const base = parseInt(this.dataset.base);
            if (base === 2 && (val.startsWith('0b') || val.startsWith('0B'))) {
                this.value = val.slice(2);
            } else if (base === 8 && (val.startsWith('0o') || val.startsWith('0O'))) {
                this.value = val.slice(2);
            } else if (base === 16 && (val.startsWith('0x') || val.startsWith('0X'))) {
                this.value = val.slice(2);
            }
        });
    });

    // Bit width toggle
    document.querySelectorAll('input[name="bitWidth"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
            currentBitWidth = parseInt(this.value);
            // Re-render bits with current value
            const val = decimalInput.value.trim();
            if (val) {
                const num = parseInput(val, 10);
                if (num !== undefined && num !== null) {
                    updateBitVisualization(num);
                }
            } else {
                updateBitVisualization(0n);
            }
        });
    });

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', function () {
        inputs.forEach(function (inp) { inp.value = ''; });
        errorMsg.classList.add('d-none');
        updateBitVisualization(0n);
        updateInfo(null);
        saveToStorage('');
    });

    // Quick values
    document.querySelectorAll('.quick-values [data-value]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const val = this.dataset.value;
            decimalInput.value = val;
            updateAllFields(decimalInput, val);
        });
    });

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const targetId = this.dataset.target;
            const target = document.getElementById(targetId);
            if (!target || !target.value) return;
            copyText(target.value, this);
        });
    });

    // ── Copy Helper ──

    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(function () {
            if (btn) {
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check-lg"></i>';
                setTimeout(function () { btn.innerHTML = orig; }, 1500);
            }
        });
    }

    // ── Keyboard Shortcut ──

    document.addEventListener('keydown', function (e) {
        // Ctrl+Shift+C → copy decimal value
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            if (decimalInput.value) {
                copyText(decimalInput.value);
            }
        }
        // Escape → clear
        if (e.key === 'Escape') {
            document.getElementById('clearBtn').click();
        }
    });

    // ── localStorage Persistence ──

    function saveToStorage(val) {
        try {
            localStorage.setItem(STORAGE_KEY, val);
        } catch (e) { /* ignore */ }
    }

    function loadFromStorage() {
        try {
            const val = localStorage.getItem(STORAGE_KEY);
            if (val && val !== '') {
                decimalInput.value = val;
                updateAllFields(decimalInput, val);
            } else {
                updateBitVisualization(0n);
            }
        } catch (e) {
            updateBitVisualization(0n);
        }
    }

    // ── Init ──
    loadFromStorage();
});
