document.addEventListener('DOMContentLoaded', function () {
    // ── State ──
    let snippets = [];
    let currentSnippet = null;
    let editor = null;
    let activeCategory = 'all';
    let searchQuery = '';
    let saveTimeout = null;

    const CATEGORIES = ['General', 'Frontend', 'Backend', 'Database', 'DevOps', 'Utility'];

    const LANGUAGES = [
        { id: 'javascript', name: 'JavaScript' },
        { id: 'typescript', name: 'TypeScript' },
        { id: 'python', name: 'Python' },
        { id: 'go', name: 'Go' },
        { id: 'java', name: 'Java' },
        { id: 'csharp', name: 'C#' },
        { id: 'html', name: 'HTML' },
        { id: 'css', name: 'CSS' },
        { id: 'sql', name: 'SQL' },
        { id: 'shell', name: 'Bash' },
        { id: 'json', name: 'JSON' },
        { id: 'yaml', name: 'YAML' },
        { id: 'xml', name: 'XML' },
        { id: 'dockerfile', name: 'Dockerfile' },
        { id: 'markdown', name: 'Markdown' },
        { id: 'rust', name: 'Rust' },
        { id: 'php', name: 'PHP' },
        { id: 'ruby', name: 'Ruby' },
        { id: 'swift', name: 'Swift' },
        { id: 'kotlin', name: 'Kotlin' },
        { id: 'cpp', name: 'C++' },
        { id: 'c', name: 'C' },
        { id: 'plaintext', name: 'Plain Text' },
    ];

    // ── DOM refs ──
    var snippetList = document.getElementById('snippetList');
    var snippetSearch = document.getElementById('snippetSearch');
    var newSnippetBtn = document.getElementById('newSnippetBtn');
    var newSnippetBtn2 = document.getElementById('newSnippetBtn2');
    var editorEmpty = document.getElementById('editorEmpty');
    var editorContent = document.getElementById('editorContent');
    var snippetTitle = document.getElementById('snippetTitle');
    var snippetLanguage = document.getElementById('snippetLanguage');
    var snippetCategory = document.getElementById('snippetCategory');
    var snippetDesc = document.getElementById('snippetDesc');
    var pinSnippetBtn = document.getElementById('pinSnippetBtn');
    var copyCodeBtn = document.getElementById('copyCodeBtn');
    var duplicateBtn = document.getElementById('duplicateBtn');
    var deleteSnippetBtn = document.getElementById('deleteSnippetBtn');
    var tagsList = document.getElementById('tagsList');
    var tagInput = document.getElementById('tagInput');
    var categoriesBar = document.getElementById('categoriesBar');
    var saveStatus = document.getElementById('saveStatus');
    var monacoDiv = document.getElementById('monacoEditor');
    var lineInfo = document.getElementById('lineInfo');

    // Populate language dropdown
    LANGUAGES.forEach(function (lang) {
        var opt = document.createElement('option');
        opt.value = lang.id;
        opt.textContent = lang.name;
        snippetLanguage.appendChild(opt);
    });

    // ── API ──
    async function fetchSnippets() {
        var resp = await fetch('/api/snippets');
        snippets = await resp.json();
        return snippets;
    }

    async function createSnippet(snippet) {
        var resp = await fetch('/api/snippets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snippet),
        });
        return resp.json();
    }

    async function updateSnippet(snippet) {
        var resp = await fetch('/api/snippets', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(snippet),
        });
        return resp.json();
    }

    async function deleteSnippetAPI(id) {
        await fetch('/api/snippets?id=' + encodeURIComponent(id), { method: 'DELETE' });
    }

    // ── Generate unique ID ──
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // ── Render snippet list ──
    function renderSnippetList() {
        var q = searchQuery.trim();
        var filtered;

        if (q) {
            // Score-based ranking
            filtered = [];
            snippets.forEach(function (s) {
                if (activeCategory !== 'all' && s.category !== activeCategory) return;
                var sc = scoreSnippet(s, q);
                if (sc > 0) filtered.push({ snippet: s, score: sc });
            });
            // Sort by score desc, then pinned, then updatedAt
            filtered.sort(function (a, b) {
                if (a.score !== b.score) return b.score - a.score;
                if (a.snippet.pinned !== b.snippet.pinned) return b.snippet.pinned ? 1 : -1;
                return new Date(b.snippet.updatedAt) - new Date(a.snippet.updatedAt);
            });
            filtered = filtered.map(function (item) { return item.snippet; });
        } else {
            // No query — filter by category only
            filtered = snippets.filter(function (s) {
                if (activeCategory !== 'all' && s.category !== activeCategory) return false;
                return true;
            });
            // Sort: pinned first, then by updatedAt desc
            filtered.sort(function (a, b) {
                if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
                return new Date(b.updatedAt) - new Date(a.updatedAt);
            });
        }

        if (filtered.length === 0) {
            snippetList.innerHTML = '<div class="snippets-empty">'
                + '<i class="bi bi-code-square"></i>'
                + '<p class="mt-2 mb-0 small">No snippets found</p>'
                + '</div>';
            return;
        }

        snippetList.innerHTML = filtered.map(function (s) {
            var isActive = currentSnippet && currentSnippet.id === s.id;
            var desc = (s.description || '').substring(0, 100);
            var timeAgo = formatTimeAgo(s.updatedAt);
            var pinIcon = s.pinned ? '<i class="bi bi-pin-fill text-primary" style="font-size:0.6rem"></i>' : '';
            var langName = getLangName(s.language);
            return '<div class="snippet-card' + (isActive ? ' active' : '') + '" data-id="' + s.id + '">'
                + '<div class="snippet-card-title">'
                + '<span class="lang-badge">' + escapeHtml(langName) + '</span> '
                + escapeHtml(s.title || 'Untitled') + ' ' + pinIcon
                + '</div>'
                + '<div class="snippet-card-desc">' + escapeHtml(desc) + '</div>'
                + '<div class="snippet-card-meta">'
                + '<span>' + timeAgo + '</span>'
                + '<span>&middot; ' + escapeHtml(s.category || 'General') + '</span>'
                + '</div></div>';
        }).join('');

        snippetList.querySelectorAll('.snippet-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = card.dataset.id;
                var s = snippets.find(function (sn) { return sn.id === id; });
                if (s) selectSnippet(s);
            });
        });
    }

    function getLangName(langId) {
        var found = LANGUAGES.find(function (l) { return l.id === langId; });
        return found ? found.name : langId || 'Text';
    }

    // ── Categories ──
    function renderCategories() {
        var cats = new Set();
        snippets.forEach(function (s) { if (s.category) cats.add(s.category); });

        var html = '<button class="cat-btn' + (activeCategory === 'all' ? ' active' : '') + '" data-cat="all">All</button>';
        CATEGORIES.forEach(function (c) {
            if (cats.has(c) || c === 'General') {
                html += '<button class="cat-btn' + (activeCategory === c ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
            }
        });
        // Custom categories
        cats.forEach(function (c) {
            if (!CATEGORIES.includes(c)) {
                html += '<button class="cat-btn' + (activeCategory === c ? ' active' : '') + '" data-cat="' + c + '">' + escapeHtml(c) + '</button>';
            }
        });

        categoriesBar.innerHTML = html;

        categoriesBar.querySelectorAll('.cat-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeCategory = btn.dataset.cat;
                renderCategories();
                renderSnippetList();
            });
        });
    }

    // ── Select snippet ──
    function selectSnippet(snippet) {
        currentSnippet = snippet;
        editorEmpty.classList.add('d-none');
        editorContent.classList.remove('d-none');

        snippetTitle.value = snippet.title || '';
        snippetLanguage.value = snippet.language || 'javascript';
        snippetCategory.value = snippet.category || 'General';
        snippetDesc.value = snippet.description || '';
        updatePinButton();
        renderTags();
        renderSnippetList();

        if (editor) {
            editor.setValue(snippet.code || '');
            var model = editor.getModel();
            if (model) {
                monaco.editor.setModelLanguage(model, snippet.language || 'javascript');
            }
        }
    }

    function deselectSnippet() {
        currentSnippet = null;
        editorContent.classList.add('d-none');
        editorEmpty.classList.remove('d-none');
        renderSnippetList();
    }

    // ── New snippet ──
    async function newSnippet() {
        var snippet = {
            id: generateId(),
            title: '',
            code: '',
            language: 'javascript',
            description: '',
            category: activeCategory !== 'all' ? activeCategory : 'General',
            tags: [],
            pinned: false,
        };
        var created = await createSnippet(snippet);
        await fetchSnippets();
        renderCategories();
        var found = snippets.find(function (s) { return s.id === created.id; });
        selectSnippet(found || created);
        snippetTitle.focus();
    }

    // ── Auto-save with debounce ──
    function scheduleSave() {
        if (!currentSnippet) return;
        clearTimeout(saveTimeout);
        showSaveStatus('saving');
        saveTimeout = setTimeout(async function () {
            if (!currentSnippet) return;
            currentSnippet.title = snippetTitle.value;
            currentSnippet.code = editor ? editor.getValue() : '';
            currentSnippet.language = snippetLanguage.value;
            currentSnippet.description = snippetDesc.value;
            currentSnippet.category = snippetCategory.value;
            await updateSnippet(currentSnippet);
            await fetchSnippets();
            if (currentSnippet) {
                var found = snippets.find(function (s) { return s.id === currentSnippet.id; });
                if (found) currentSnippet = found;
            }
            renderSnippetList();
            renderCategories();
            showSaveStatus('saved');
        }, 600);
    }

    function showSaveStatus(status) {
        saveStatus.className = 'save-status ' + status;
        if (status === 'saving') {
            saveStatus.textContent = 'Saving...';
        } else if (status === 'saved') {
            saveStatus.textContent = 'Saved';
            setTimeout(function () {
                if (saveStatus.textContent === 'Saved') saveStatus.textContent = '';
            }, 2000);
        }
    }

    // ── Tags ──
    function renderTags() {
        if (!currentSnippet) { tagsList.innerHTML = ''; return; }
        tagsList.innerHTML = (currentSnippet.tags || []).map(function (t, i) {
            return '<span class="snippet-tag">' + escapeHtml(t)
                + ' <span class="remove-tag" data-idx="' + i + '">&times;</span></span>';
        }).join('');

        tagsList.querySelectorAll('.remove-tag').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.dataset.idx);
                currentSnippet.tags.splice(idx, 1);
                renderTags();
                scheduleSave();
            });
        });
    }

    tagInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            var tag = tagInput.value.trim().replace(/,/g, '');
            if (tag && currentSnippet && !(currentSnippet.tags || []).includes(tag)) {
                if (!currentSnippet.tags) currentSnippet.tags = [];
                currentSnippet.tags.push(tag);
                renderTags();
                scheduleSave();
            }
            tagInput.value = '';
        }
        if (e.key === 'Backspace' && !tagInput.value && currentSnippet && currentSnippet.tags && currentSnippet.tags.length) {
            currentSnippet.tags.pop();
            renderTags();
            scheduleSave();
        }
    });

    // ── Pin snippet ──
    function updatePinButton() {
        if (!currentSnippet) return;
        var icon = pinSnippetBtn.querySelector('i');
        if (currentSnippet.pinned) {
            icon.className = 'bi bi-pin-fill text-primary';
            pinSnippetBtn.title = 'Unpin snippet';
        } else {
            icon.className = 'bi bi-pin';
            pinSnippetBtn.title = 'Pin snippet';
        }
    }

    pinSnippetBtn.addEventListener('click', function () {
        if (!currentSnippet) return;
        currentSnippet.pinned = !currentSnippet.pinned;
        updatePinButton();
        scheduleSave();
    });

    // ── Copy code ──
    function copyCode() {
        if (!editor) return;
        var code = editor.getValue();
        navigator.clipboard.writeText(code).then(function () {
            copyCodeBtn.innerHTML = '<i class="bi bi-check2 text-white"></i> Copied!';
            setTimeout(function () {
                copyCodeBtn.innerHTML = '<i class="bi bi-clipboard-code"></i> Copy Code';
            }, 1500);
        });
    }

    copyCodeBtn.addEventListener('click', copyCode);

    // ── Duplicate snippet ──
    duplicateBtn.addEventListener('click', async function () {
        if (!currentSnippet) return;
        var dup = {
            id: generateId(),
            title: (currentSnippet.title || 'Untitled') + ' (copy)',
            code: currentSnippet.code || '',
            language: currentSnippet.language || 'javascript',
            description: currentSnippet.description || '',
            category: currentSnippet.category || 'General',
            tags: (currentSnippet.tags || []).slice(),
            pinned: false,
        };
        var created = await createSnippet(dup);
        await fetchSnippets();
        renderCategories();
        var found = snippets.find(function (s) { return s.id === created.id; });
        selectSnippet(found || created);
    });

    // ── Delete snippet ──
    deleteSnippetBtn.addEventListener('click', async function () {
        if (!currentSnippet) return;
        if (!confirm('Delete "' + (currentSnippet.title || 'Untitled') + '"? This cannot be undone.')) return;
        await deleteSnippetAPI(currentSnippet.id);
        await fetchSnippets();
        deselectSnippet();
        renderCategories();
    });

    // ── Language change → update Monaco ──
    snippetLanguage.addEventListener('change', function () {
        if (editor && editor.getModel()) {
            monaco.editor.setModelLanguage(editor.getModel(), snippetLanguage.value);
        }
        scheduleSave();
    });

    // ── Search ──
    var searchDebounce;
    snippetSearch.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function () {
            searchQuery = snippetSearch.value;
            renderSnippetList();
        }, 200);
    });

    // ── Input events → auto-save ──
    snippetTitle.addEventListener('input', scheduleSave);
    snippetCategory.addEventListener('change', scheduleSave);
    snippetDesc.addEventListener('input', scheduleSave);

    // ── New snippet buttons ──
    newSnippetBtn.addEventListener('click', newSnippet);
    newSnippetBtn2.addEventListener('click', newSnippet);

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', function (e) {
        // Ctrl+N — new snippet
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            var spotlight = document.getElementById('spotlightBackdrop');
            if (spotlight && spotlight.classList.contains('show')) return;
            e.preventDefault();
            newSnippet();
        }
        // Ctrl+Shift+C — copy code
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            copyCode();
        }
    });

    // ── Levenshtein distance ──
    function levenshtein(a, b) {
        if (a === b) return 0;
        if (!a.length) return b.length;
        if (!b.length) return a.length;
        var prev = [];
        var curr = [];
        for (var j = 0; j <= b.length; j++) prev[j] = j;
        for (var i = 1; i <= a.length; i++) {
            curr[0] = i;
            for (var j2 = 1; j2 <= b.length; j2++) {
                var cost = a[i - 1] === b[j2 - 1] ? 0 : 1;
                curr[j2] = Math.min(prev[j2] + 1, curr[j2 - 1] + 1, prev[j2 - 1] + cost);
            }
            var tmp = prev; prev = curr; curr = tmp;
        }
        return prev[b.length];
    }

    // ── Score a snippet against a search query ──
    function scoreSnippet(snippet, query) {
        var q = query.toLowerCase();
        var score = 0;
        var title = (snippet.title || '').toLowerCase();
        var desc = (snippet.description || '').toLowerCase();
        var code = (snippet.code || '').toLowerCase();
        var lang = (snippet.language || '').toLowerCase();
        var tags = (snippet.tags || []).map(function(t) { return t.toLowerCase(); });

        // Exact substring matches
        if (title.includes(q)) { score += 100; if (title.indexOf(q) === 0) score += 20; }
        if (tags.some(function(t) { return t.includes(q); })) score += 80;
        if (lang.includes(q)) score += 70;
        if (desc.includes(q)) score += 50;
        if (code.includes(q)) score += 30;

        // Word boundary matches
        var qWords = q.split(/\s+/).filter(Boolean);
        var titleWords = title.split(/\W+/).filter(Boolean);
        var descWords = desc.split(/\W+/).filter(Boolean);
        qWords.forEach(function(qw) {
            if (titleWords.some(function(tw) { return tw.indexOf(qw) === 0; })) score += 60;
            if (descWords.some(function(dw) { return dw.indexOf(qw) === 0; })) score += 30;
        });

        // Fuzzy matching (Levenshtein)
        var maxDist = q.length <= 3 ? 1 : 2;
        qWords.forEach(function(qw) {
            if (qw.length < 2) return;
            var bestTitle = Infinity;
            titleWords.forEach(function(tw) {
                var d = levenshtein(qw, tw.substring(0, qw.length + maxDist));
                if (d < bestTitle) bestTitle = d;
            });
            if (bestTitle <= maxDist) score += 40;

            tags.forEach(function(t) {
                if (levenshtein(qw, t) <= maxDist) score += 35;
            });

            var bestDesc = Infinity;
            descWords.forEach(function(dw) {
                var d = levenshtein(qw, dw.substring(0, qw.length + maxDist));
                if (d < bestDesc) bestDesc = d;
            });
            if (bestDesc <= maxDist) score += 15;
        });

        return score;
    }

    // ── Helpers ──
    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function formatTimeAgo(dateStr) {
        if (!dateStr) return '';
        var now = new Date();
        var date = new Date(dateStr);
        var diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'just now';
        if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
        if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
        if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
        return date.toLocaleDateString();
    }

    // ── Monaco Editor init ──
    require.config({ paths: { 'vs': '/static/monaco-editor/min/vs' } });
    window.MonacoEnvironment = {
        getWorkerUrl: function (workerId, label) {
            var base = window.location.origin + '/static/monaco-editor/min';
            return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(
                "self.MonacoEnvironment = { baseUrl: '" + base + "/' }; importScripts('" + base + "/vs/base/worker/workerMain.js');"
            );
        }
    };

    require(['vs/editor/editor.main'], function () {
        var isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        editor = monaco.editor.create(monacoDiv, {
            value: '',
            language: 'javascript',
            theme: isDark ? 'vs-dark' : 'vs',
            minimap: { enabled: true },
            wordWrap: 'off',
            lineNumbers: 'on',
            fontSize: 14,
            padding: { top: 8 },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            tabSize: 2,
            bracketPairColorization: { enabled: true },
        });

        // Content change → auto-save
        editor.onDidChangeModelContent(function () {
            scheduleSave();
        });

        // Cursor position info
        editor.onDidChangeCursorPosition(function () {
            var pos = editor.getPosition();
            var model = editor.getModel();
            if (pos && model) {
                lineInfo.textContent = 'Ln ' + pos.lineNumber + ', Col ' + pos.column + ' | ' + model.getLineCount() + ' lines';
            }
        });

        // Theme sync
        window.addEventListener('devhelper-theme', function (e) {
            monaco.editor.setTheme(e.detail.theme === 'dark' ? 'vs-dark' : 'vs');
        });

        // Load snippets after Monaco is ready
        init();
    });

    async function init() {
        await fetchSnippets();
        renderCategories();
        renderSnippetList();
    }
});
