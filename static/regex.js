document.addEventListener('DOMContentLoaded', function () {
    // ── DOM refs ──
    var regexInput = document.getElementById('regexInput');
    var testInput = document.getElementById('testInput');
    var highlightResult = document.getElementById('highlightResult');
    var matchCount = document.getElementById('matchCount');
    var matchDetails = document.getElementById('matchDetails');
    var regexError = document.getElementById('regexError');
    var replaceToggle = document.getElementById('replaceToggle');
    var replaceSection = document.getElementById('replaceSection');
    var replaceInput = document.getElementById('replaceInput');
    var replaceResult = document.getElementById('replaceResult');
    var patternsMenu = document.getElementById('patternsMenu');
    var cheatSheet = document.getElementById('cheatSheet');
    var toggleDetails = document.getElementById('toggleDetails');
    var clearAllBtn = document.getElementById('clearAllBtn');
    var copyRegexBtn = document.getElementById('copyRegexBtn');
    var shareBtn = document.getElementById('shareBtn');
    var pasteTestBtn = document.getElementById('pasteTestBtn');
    var copyReplaceBtn = document.getElementById('copyReplaceBtn');

    var showAllDetails = false;
    var MAX_DETAILS = 20;

    // ── Flags ──
    function getFlags() {
        var flags = '';
        document.querySelectorAll('.flag-btn.active').forEach(function (b) {
            flags += b.dataset.flag;
        });
        return flags;
    }

    document.querySelectorAll('.flag-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            btn.classList.toggle('active');
            runRegex();
        });
    });

    // ── Common patterns ──
    var PATTERNS = [
        { cat: 'Common', items: [
            { name: 'Email Address', pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}', flags: 'gi', sample: 'Contact us at john@example.com or support@company.co.uk for more info.' },
            { name: 'URL (http/https)', pattern: 'https?:\\/\\/[\\w\\-._~:/?#\\[\\]@!$&\'()*+,;=%]+', flags: 'gi', sample: 'Visit https://example.com/path?q=1 or http://test.org/page#section for details.' },
            { name: 'IPv4 Address', pattern: '\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b', flags: 'g', sample: 'Server IPs: 192.168.1.1, 10.0.0.255, 172.16.254.1' },
            { name: 'Phone Number', pattern: '\\+?\\d{1,4}[\\s.\\-]?\\(?\\d{1,4}\\)?[\\s.\\-]?\\d{1,4}[\\s.\\-]?\\d{1,9}', flags: 'g', sample: 'Call +1 (555) 123-4567 or +62 812-3456-7890' },
            { name: 'Hex Color', pattern: '#(?:[0-9a-fA-F]{3}){1,2}\\b', flags: 'gi', sample: 'Colors: #ff6600, #abc, #1a2B3c, #000000' },
        ]},
        { cat: 'Date & Time', items: [
            { name: 'Date (YYYY-MM-DD)', pattern: '\\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\\d|3[01])', flags: 'g', sample: 'Dates: 2024-01-15, 2023-12-31, 2025-06-01' },
            { name: 'Date (DD/MM/YYYY)', pattern: '(?:0[1-9]|[12]\\d|3[01])\\/(?:0[1-9]|1[0-2])\\/\\d{4}', flags: 'g', sample: 'Dates: 15/01/2024, 31/12/2023, 01/06/2025' },
            { name: 'Time (HH:MM:SS)', pattern: '(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d)?', flags: 'g', sample: 'Times: 14:30:00, 08:15, 23:59:59' },
            { name: 'ISO 8601 Datetime', pattern: '\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+\\-]\\d{2}:?\\d{2})?', flags: 'g', sample: '2024-01-15T14:30:00Z and 2024-06-01T08:00:00+07:00' },
        ]},
        { cat: 'Code & Data', items: [
            { name: 'HTML Tag', pattern: '<\\/?[a-zA-Z][a-zA-Z0-9]*(?:\\s[^>]*)?\\/?>',  flags: 'gi', sample: '<div class="test">Hello</div><br/><img src="x.png">' },
            { name: 'JSON String', pattern: '"(?:[^"\\\\]|\\\\.)*"', flags: 'g', sample: '{"name": "John", "msg": "Hello \\"World\\""}' },
            { name: 'UUID', pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', flags: 'gi', sample: 'ID: 550e8400-e29b-41d4-a716-446655440000' },
            { name: 'MAC Address', pattern: '(?:[0-9a-fA-F]{2}[:\\-]){5}[0-9a-fA-F]{2}', flags: 'gi', sample: 'MAC: 00:1A:2B:3C:4D:5E, AA-BB-CC-DD-EE-FF' },
            { name: 'Semantic Version', pattern: '\\bv?\\d+\\.\\d+\\.\\d+(?:-[\\w.]+)?(?:\\+[\\w.]+)?\\b', flags: 'g', sample: 'Versions: v1.2.3, 2.0.0-beta.1, 3.1.0+build.123' },
        ]},
        { cat: 'Validation', items: [
            { name: 'Strong Password', pattern: '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}', flags: 'g', sample: 'Test: Abc12345!, weak, P@ssw0rd!, hello' },
            { name: 'Username (3-16 chars)', pattern: '\\b[a-zA-Z0-9_\\-]{3,16}\\b', flags: 'g', sample: 'Users: john_doe, admin, a, user-123, toolongusernamehere' },
            { name: 'Credit Card', pattern: '\\b(?:\\d[ \\-]*?){13,16}\\b', flags: 'g', sample: '4111-1111-1111-1111, 5500 0000 0000 0004' },
            { name: 'Hashtag', pattern: '#[a-zA-Z_][\\w]*', flags: 'g', sample: 'Trending: #JavaScript #web_dev #AI2024 #100DaysOfCode' },
        ]},
    ];

    // Build patterns dropdown
    PATTERNS.forEach(function (group) {
        var header = document.createElement('li');
        header.innerHTML = '<h6 class="dropdown-header">' + group.cat + '</h6>';
        patternsMenu.appendChild(header);
        group.items.forEach(function (p) {
            var li = document.createElement('li');
            li.innerHTML = '<a class="dropdown-item pattern-item small" href="#">' + p.name + '</a>';
            li.querySelector('a').addEventListener('click', function (e) {
                e.preventDefault();
                regexInput.value = p.pattern;
                testInput.value = p.sample;
                // Set flags
                document.querySelectorAll('.flag-btn').forEach(function (b) {
                    b.classList.toggle('active', p.flags.includes(b.dataset.flag));
                });
                runRegex();
                regexInput.focus();
            });
            patternsMenu.appendChild(li);
        });
    });

    // ── Cheat sheet ──
    var CHEATSHEET = [
        { title: 'Character Classes', items: [
            ['.', 'Any character (except newline)'],
            ['\\d', 'Digit [0-9]'],
            ['\\D', 'Not a digit'],
            ['\\w', 'Word char [a-zA-Z0-9_]'],
            ['\\W', 'Not a word char'],
            ['\\s', 'Whitespace (space, tab, newline)'],
            ['\\S', 'Not whitespace'],
            ['[abc]', 'Character set (a or b or c)'],
            ['[^abc]', 'Negated set (not a, b, c)'],
            ['[a-z]', 'Range (a through z)'],
        ]},
        { title: 'Quantifiers', items: [
            ['*', '0 or more'],
            ['+', '1 or more'],
            ['?', '0 or 1 (optional)'],
            ['{n}', 'Exactly n times'],
            ['{n,}', 'n or more times'],
            ['{n,m}', 'Between n and m times'],
            ['*?', 'Lazy 0+ (as few as possible)'],
            ['+?', 'Lazy 1+'],
            ['??', 'Lazy 0 or 1'],
        ]},
        { title: 'Anchors & Boundaries', items: [
            ['^', 'Start of string (or line with m flag)'],
            ['$', 'End of string (or line with m flag)'],
            ['\\b', 'Word boundary'],
            ['\\B', 'Not a word boundary'],
        ]},
        { title: 'Groups & References', items: [
            ['(abc)', 'Capture group'],
            ['(?:abc)', 'Non-capturing group'],
            ['(?<name>abc)', 'Named capture group'],
            ['\\1', 'Back-reference to group 1'],
            ['(a|b)', 'Alternation (a or b)'],
        ]},
        { title: 'Lookaround', items: [
            ['(?=abc)', 'Positive lookahead'],
            ['(?!abc)', 'Negative lookahead'],
            ['(?<=abc)', 'Positive lookbehind'],
            ['(?<!abc)', 'Negative lookbehind'],
        ]},
        { title: 'Flags', items: [
            ['g', 'Global — find all matches'],
            ['i', 'Case insensitive'],
            ['m', 'Multiline — ^ and $ per line'],
            ['s', 'Dotall — . matches newline'],
            ['u', 'Unicode support'],
        ]},
        { title: 'Escapes', items: [
            ['\\\\', 'Literal backslash'],
            ['\\.', 'Literal dot'],
            ['\\n', 'Newline'],
            ['\\t', 'Tab'],
            ['\\r', 'Carriage return'],
            ['\\0', 'Null character'],
        ]},
        { title: 'Replace Tokens', items: [
            ['$1, $2', 'Capture group 1, 2, ...'],
            ['$&', 'Entire match'],
            ['$`', 'Text before match'],
            ["$'", 'Text after match'],
            ['$$', 'Literal dollar sign'],
        ]},
    ];

    // Build cheat sheet
    var cheatHtml = '';
    CHEATSHEET.forEach(function (section) {
        cheatHtml += '<div class="cheat-section">';
        cheatHtml += '<div class="cheat-section-title" data-section="' + section.title + '">'
            + '<i class="bi bi-chevron-down" style="font-size:0.65rem;"></i> ' + section.title + '</div>';
        cheatHtml += '<div class="cheat-section-body">';
        section.items.forEach(function (item) {
            cheatHtml += '<div class="cheat-row" data-syntax="' + escapeAttr(item[0]) + '">'
                + '<span class="cheat-syntax">' + escapeHtml(item[0]) + '</span>'
                + '<span class="cheat-desc">' + escapeHtml(item[1]) + '</span>'
                + '</div>';
        });
        cheatHtml += '</div></div>';
    });
    cheatSheet.innerHTML = cheatHtml;

    // Collapsible cheat sheet sections
    cheatSheet.querySelectorAll('.cheat-section-title').forEach(function (title) {
        title.addEventListener('click', function () {
            var body = title.nextElementSibling;
            var icon = title.querySelector('i');
            if (body.style.display === 'none') {
                body.style.display = '';
                icon.className = 'bi bi-chevron-down';
            } else {
                body.style.display = 'none';
                icon.className = 'bi bi-chevron-right';
            }
        });
    });

    // Click cheat sheet row → insert into regex input
    cheatSheet.querySelectorAll('.cheat-row').forEach(function (row) {
        row.addEventListener('click', function () {
            var syntax = row.dataset.syntax;
            var start = regexInput.selectionStart;
            var end = regexInput.selectionEnd;
            var val = regexInput.value;
            regexInput.value = val.slice(0, start) + syntax + val.slice(end);
            regexInput.focus();
            regexInput.setSelectionRange(start + syntax.length, start + syntax.length);
            runRegex();
        });
    });

    // ── Run regex ──
    var runTimeout;
    function runRegex() {
        clearTimeout(runTimeout);
        runTimeout = setTimeout(executeRegex, 100);
    }

    function executeRegex() {
        var pattern = regexInput.value;
        var text = testInput.value;
        var flags = getFlags();

        // Clear error
        regexError.classList.add('d-none');
        regexInput.classList.remove('is-invalid');

        if (!pattern) {
            highlightResult.innerHTML = text ? escapeHtml(text) : '<span style="color: var(--bs-secondary-color); font-style: italic;">Matches will be highlighted here...</span>';
            matchCount.textContent = '0 matches';
            matchCount.className = 'badge bg-secondary';
            matchDetails.innerHTML = '';
            toggleDetails.classList.add('d-none');
            if (replaceToggle.checked) replaceResult.textContent = text || '';
            return;
        }

        if (!text) {
            highlightResult.innerHTML = '<span style="color: var(--bs-secondary-color); font-style: italic;">Enter test string above...</span>';
            matchCount.textContent = '0 matches';
            matchCount.className = 'badge bg-secondary';
            matchDetails.innerHTML = '';
            toggleDetails.classList.add('d-none');
            if (replaceToggle.checked) replaceResult.textContent = '';
            return;
        }

        try {
            var regex = new RegExp(pattern, flags);

            // Find matches
            var matches = [];
            if (flags.includes('g')) {
                var m;
                var safetyCount = 0;
                var lastIndex = -1;
                regex.lastIndex = 0;
                while ((m = regex.exec(text)) !== null && safetyCount < 10000) {
                    matches.push({
                        match: m[0],
                        index: m.index,
                        groups: m.slice(1),
                        namedGroups: m.groups || null,
                    });
                    // Prevent infinite loop on zero-length matches
                    if (regex.lastIndex === lastIndex) {
                        regex.lastIndex++;
                    }
                    lastIndex = regex.lastIndex;
                    safetyCount++;
                }
            } else {
                var m = regex.exec(text);
                if (m) {
                    matches.push({
                        match: m[0],
                        index: m.index,
                        groups: m.slice(1),
                        namedGroups: m.groups || null,
                    });
                }
            }

            // Highlight matches
            var html = '';
            var lastIdx = 0;
            matches.forEach(function (m) {
                if (m.index >= lastIdx) {
                    html += escapeHtml(text.slice(lastIdx, m.index));
                    html += '<mark>' + escapeHtml(m.match) + '</mark>';
                    lastIdx = m.index + m.match.length;
                }
            });
            html += escapeHtml(text.slice(lastIdx));
            highlightResult.innerHTML = html || escapeHtml(text);

            // Match count
            matchCount.textContent = matches.length + ' match' + (matches.length !== 1 ? 'es' : '');
            matchCount.className = matches.length > 0 ? 'badge bg-success' : 'badge bg-secondary';

            // Match details
            renderMatchDetails(matches);

            // Replace
            if (replaceToggle.checked) {
                try {
                    var replaceRegex = new RegExp(pattern, flags);
                    var replaced = text.replace(replaceRegex, replaceInput.value);
                    replaceResult.textContent = replaced;
                } catch (e) {
                    replaceResult.textContent = 'Replace error: ' + e.message;
                }
            }

        } catch (e) {
            regexError.textContent = e.message;
            regexError.classList.remove('d-none');
            regexInput.classList.add('is-invalid');
            highlightResult.innerHTML = escapeHtml(text);
            matchCount.textContent = 'Error';
            matchCount.className = 'badge bg-danger';
            matchDetails.innerHTML = '';
            toggleDetails.classList.add('d-none');
        }
    }

    // ── Render match details ──
    function renderMatchDetails(matches) {
        if (matches.length === 0) {
            matchDetails.innerHTML = '<div class="text-center small text-muted py-2">No matches found</div>';
            toggleDetails.classList.add('d-none');
            return;
        }

        var limit = showAllDetails ? matches.length : Math.min(matches.length, MAX_DETAILS);

        // Toggle button
        if (matches.length > MAX_DETAILS) {
            toggleDetails.classList.remove('d-none');
            toggleDetails.innerHTML = showAllDetails
                ? '<i class="bi bi-chevron-up"></i> Show less'
                : '<i class="bi bi-chevron-down"></i> Show all (' + matches.length + ')';
        } else {
            toggleDetails.classList.add('d-none');
        }

        var html = '<div class="table-responsive"><table class="table table-sm match-table mb-0">';
        html += '<thead><tr><th>#</th><th>Match</th><th>Index</th><th>Length</th>';

        // Check if any match has groups
        var hasGroups = matches.some(function (m) { return m.groups.length > 0; });
        var maxGroups = 0;
        if (hasGroups) {
            matches.forEach(function (m) { maxGroups = Math.max(maxGroups, m.groups.length); });
            for (var g = 1; g <= maxGroups; g++) {
                html += '<th>Group ' + g + '</th>';
            }
        }
        html += '</tr></thead><tbody>';

        for (var i = 0; i < limit; i++) {
            var m = matches[i];
            html += '<tr>';
            html += '<td>' + (i + 1) + '</td>';
            html += '<td><span class="match-text">' + escapeHtml(truncate(m.match, 60)) + '</span></td>';
            html += '<td>' + m.index + '</td>';
            html += '<td>' + m.match.length + '</td>';
            if (hasGroups) {
                for (var g = 0; g < maxGroups; g++) {
                    var grp = m.groups[g];
                    html += '<td>' + (grp !== undefined ? '<span class="group-text">' + escapeHtml(truncate(grp, 40)) + '</span>' : '<span class="text-muted">—</span>') + '</td>';
                }
            }
            html += '</tr>';
        }
        html += '</tbody></table></div>';

        if (limit < matches.length) {
            html += '<div class="text-center small text-muted py-1">Showing ' + limit + ' of ' + matches.length + ' matches</div>';
        }

        matchDetails.innerHTML = html;
    }

    // ── Toggle show all details ──
    toggleDetails.addEventListener('click', function () {
        showAllDetails = !showAllDetails;
        runRegex();
    });

    // ── Replace toggle ──
    replaceToggle.addEventListener('change', function () {
        replaceSection.classList.toggle('d-none', !replaceToggle.checked);
        if (replaceToggle.checked) runRegex();
    });

    // ── Event listeners ──
    regexInput.addEventListener('input', runRegex);
    testInput.addEventListener('input', runRegex);
    replaceInput.addEventListener('input', runRegex);

    // ── Buttons ──
    clearAllBtn.addEventListener('click', function () {
        regexInput.value = '';
        testInput.value = '';
        replaceInput.value = '';
        replaceResult.textContent = '';
        // Reset flags to just 'g'
        document.querySelectorAll('.flag-btn').forEach(function (b) {
            b.classList.toggle('active', b.dataset.flag === 'g');
        });
        runRegex();
        regexInput.focus();
    });

    copyRegexBtn.addEventListener('click', function () {
        if (!regexInput.value) return;
        var full = '/' + regexInput.value + '/' + getFlags();
        navigator.clipboard.writeText(full).then(function () {
            copyRegexBtn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied';
            setTimeout(function () { copyRegexBtn.innerHTML = '<i class="bi bi-clipboard"></i> Copy'; }, 1500);
        });
    });

    shareBtn.addEventListener('click', function () {
        var data = {
            p: regexInput.value,
            f: getFlags(),
            t: testInput.value,
        };
        if (replaceToggle.checked && replaceInput.value) {
            data.r = replaceInput.value;
        }
        var hash = '#' + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
        var url = window.location.origin + window.location.pathname + hash;
        navigator.clipboard.writeText(url).then(function () {
            shareBtn.innerHTML = '<i class="bi bi-check2 text-success"></i> Copied!';
            setTimeout(function () { shareBtn.innerHTML = '<i class="bi bi-share"></i> Share'; }, 1500);
        });
        history.replaceState(null, '', hash);
    });

    pasteTestBtn.addEventListener('click', function () {
        navigator.clipboard.readText().then(function (text) {
            testInput.value = text;
            runRegex();
        });
    });

    copyReplaceBtn.addEventListener('click', function () {
        var text = replaceResult.textContent;
        if (!text) return;
        navigator.clipboard.writeText(text).then(function () {
            copyReplaceBtn.innerHTML = '<i class="bi bi-check2 text-success"></i>';
            setTimeout(function () { copyReplaceBtn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
        });
    });

    // ── Load from URL hash (share) ──
    function loadFromHash() {
        var hash = window.location.hash;
        if (!hash || hash.length < 2) return;
        try {
            var json = decodeURIComponent(escape(atob(hash.slice(1))));
            var data = JSON.parse(json);
            if (data.p) regexInput.value = data.p;
            if (data.f) {
                document.querySelectorAll('.flag-btn').forEach(function (b) {
                    b.classList.toggle('active', data.f.includes(b.dataset.flag));
                });
            }
            if (data.t) testInput.value = data.t;
            if (data.r) {
                replaceToggle.checked = true;
                replaceSection.classList.remove('d-none');
                replaceInput.value = data.r;
            }
            runRegex();
        } catch (e) { /* ignore invalid hash */ }
    }

    // ── Keyboard shortcut: Ctrl+Enter to focus regex input ──
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            regexInput.focus();
            regexInput.select();
        }
    });

    // ── Helpers ──
    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return (str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function truncate(str, max) {
        if (!str || str.length <= max) return str;
        return str.substring(0, max) + '...';
    }

    // ── Init ──
    loadFromHash();
    if (!window.location.hash) {
        regexInput.focus();
    }
});
