document.addEventListener('DOMContentLoaded', function () {
    const CONTENT_KEY = 'devhelper_stringutils_content';

    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const statChars = document.getElementById('statChars');
    const statWords = document.getElementById('statWords');
    const statLines = document.getElementById('statLines');
    const statSentences = document.getElementById('statSentences');
    const statBytes = document.getElementById('statBytes');

    // ── String Operations ──
    const operations = {
        // Case
        uppercase: function (s) { return s.toUpperCase(); },
        lowercase: function (s) { return s.toLowerCase(); },
        titlecase: function (s) {
            return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
        },
        camelcase: function (s) {
            return splitWords(s).map(function (w, i) {
                var lower = w.toLowerCase();
                return i === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
            }).join('');
        },
        pascalcase: function (s) {
            return splitWords(s).map(function (w) {
                var lower = w.toLowerCase();
                return lower.charAt(0).toUpperCase() + lower.slice(1);
            }).join('');
        },
        snakecase: function (s) {
            return splitWords(s).map(function (w) { return w.toLowerCase(); }).join('_');
        },
        kebabcase: function (s) {
            return splitWords(s).map(function (w) { return w.toLowerCase(); }).join('-');
        },
        constantcase: function (s) {
            return splitWords(s).map(function (w) { return w.toUpperCase(); }).join('_');
        },
        dotcase: function (s) {
            return splitWords(s).map(function (w) { return w.toLowerCase(); }).join('.');
        },

        // Text cleanup
        trim: function (s) {
            return s.split('\n').map(function (line) { return line.trim(); }).join('\n').trim();
        },
        remove_extra_spaces: function (s) {
            return s.replace(/[^\S\n]+/g, ' ').replace(/^ | $/gm, '');
        },
        remove_all_whitespace: function (s) {
            return s.replace(/\s+/g, '');
        },
        remove_blank_lines: function (s) {
            return s.split('\n').filter(function (line) { return line.trim() !== ''; }).join('\n');
        },

        // Transform
        reverse_string: function (s) {
            return Array.from(s).reverse().join('');
        },
        reverse_words: function (s) {
            return s.split(/\s+/).reverse().join(' ');
        },
        sort_asc: function (s) {
            return s.split('\n').sort(function (a, b) { return a.localeCompare(b); }).join('\n');
        },
        sort_desc: function (s) {
            return s.split('\n').sort(function (a, b) { return b.localeCompare(a); }).join('\n');
        },
        unique_lines: function (s) {
            var seen = new Set();
            return s.split('\n').filter(function (line) {
                if (seen.has(line)) return false;
                seen.add(line);
                return true;
            }).join('\n');
        },
        shuffle_lines: function (s) {
            var lines = s.split('\n');
            for (var i = lines.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = lines[i];
                lines[i] = lines[j];
                lines[j] = temp;
            }
            return lines.join('\n');
        },

        // Encode / Decode
        url_encode: function (s) {
            return encodeURIComponent(s);
        },
        url_decode: function (s) {
            try { return decodeURIComponent(s); }
            catch (e) { return 'Error: ' + e.message; }
        },
        html_encode: function (s) {
            var div = document.createElement('div');
            div.textContent = s;
            return div.innerHTML;
        },
        html_decode: function (s) {
            var div = document.createElement('div');
            div.innerHTML = s;
            return div.textContent;
        },

        // Count
        count_chars: function (s) {
            var total = s.length;
            var noSpaces = s.replace(/\s/g, '').length;
            return 'Total characters: ' + total + '\nWithout spaces: ' + noSpaces;
        },
        count_words: function (s) {
            var words = s.trim() ? s.trim().split(/\s+/).length : 0;
            return 'Word count: ' + words;
        },
        count_lines: function (s) {
            var lines = s ? s.split('\n').length : 0;
            var nonEmpty = s ? s.split('\n').filter(function (l) { return l.trim() !== ''; }).length : 0;
            return 'Total lines: ' + lines + '\nNon-empty lines: ' + nonEmpty;
        },
        count_sentences: function (s) {
            var sentences = s.trim() ? s.split(/[.!?]+/).filter(function (seg) { return seg.trim() !== ''; }).length : 0;
            return 'Sentence count: ' + sentences;
        },

        // Generate / Extract
        slug: function (s) {
            return s.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/[\s_]+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '');
        },
        extract_emails: function (s) {
            var matches = s.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g);
            if (!matches || matches.length === 0) return 'No email addresses found.';
            var unique = Array.from(new Set(matches));
            return unique.join('\n') + '\n\n(' + unique.length + ' email' + (unique.length !== 1 ? 's' : '') + ' found)';
        },
        extract_urls: function (s) {
            var matches = s.match(/https?:\/\/[^\s<>"')\]]+/g);
            if (!matches || matches.length === 0) return 'No URLs found.';
            var unique = Array.from(new Set(matches));
            return unique.join('\n') + '\n\n(' + unique.length + ' URL' + (unique.length !== 1 ? 's' : '') + ' found)';
        },
        extract_numbers: function (s) {
            var matches = s.match(/-?\d+\.?\d*/g);
            if (!matches || matches.length === 0) return 'No numbers found.';
            return matches.join('\n') + '\n\n(' + matches.length + ' number' + (matches.length !== 1 ? 's' : '') + ' found)';
        }
    };

    // ── Word Splitting Helper ──
    // Splits on spaces, underscores, hyphens, dots, and camelCase boundaries
    function splitWords(str) {
        return str
            // Insert space before uppercase letters in camelCase
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            // Insert space between consecutive uppercase and lowercase (e.g., "HTMLParser" -> "HTML Parser")
            .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
            // Split on non-alphanumeric
            .split(/[\s_\-\.]+/)
            .filter(function (w) { return w.length > 0; });
    }

    // ── Operation Button Clicks ──
    document.querySelectorAll('[data-op]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var op = this.dataset.op;
            var input = inputText.value;
            if (!input && !['count_chars', 'count_words', 'count_lines', 'count_sentences'].includes(op)) return;
            if (operations[op]) {
                outputText.value = operations[op](input);
            }
        });
    });

    // ── Swap ──
    document.getElementById('swapBtn').addEventListener('click', function () {
        var temp = inputText.value;
        inputText.value = outputText.value;
        outputText.value = temp;
        updateStats();
        saveContent();
    });

    // ── Clear ──
    document.getElementById('clearInputBtn').addEventListener('click', function () {
        inputText.value = '';
        updateStats();
        saveContent();
    });

    document.getElementById('clearAllBtn').addEventListener('click', function () {
        inputText.value = '';
        outputText.value = '';
        updateStats();
        saveContent();
    });

    // ── Copy ──
    document.getElementById('copyBtn').addEventListener('click', function () {
        if (!outputText.value) return;
        navigator.clipboard.writeText(outputText.value).then(function () {
            var btn = document.getElementById('copyBtn');
            var orig = btn.innerHTML;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
            setTimeout(function () { btn.innerHTML = orig; }, 1500);
        });
    });

    // ── Paste ──
    document.getElementById('pasteBtn').addEventListener('click', function () {
        navigator.clipboard.readText().then(function (text) {
            inputText.value = text;
            updateStats();
            saveContent();
        });
    });

    // ── Live Stats ──
    function updateStats() {
        var text = inputText.value;
        statChars.textContent = text.length;
        statWords.textContent = text.trim() ? text.trim().split(/\s+/).length : 0;
        statLines.textContent = text ? text.split('\n').length : 0;
        statSentences.textContent = text.trim() ? text.split(/[.!?]+/).filter(function (s) { return s.trim() !== ''; }).length : 0;
        statBytes.textContent = new TextEncoder().encode(text).length;
    }

    inputText.addEventListener('input', function () {
        updateStats();
        saveContent();
    });

    // ── Persistence ──
    function saveContent() {
        localStorage.setItem(CONTENT_KEY, inputText.value);
    }

    function loadContent() {
        var saved = localStorage.getItem(CONTENT_KEY);
        if (saved) {
            inputText.value = saved;
        }
    }

    // ── Init ──
    loadContent();
    updateStats();
});
