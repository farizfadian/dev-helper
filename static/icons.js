document.addEventListener('DOMContentLoaded', function () {
    // ── State ──
    var activeLib = 'bootstrap';
    var activeCategory = 'all';
    var searchQuery = '';
    var selectedIcon = null;
    var loadedLibs = { bootstrap: false, fa: false, tabler: false };
    var loadedCSS = { fa: false, tabler: false };

    // CSS CDN URLs (lazy-loaded per tab)
    var CSS_URLS = {
        fa: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css',
        tabler: 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.24.0/dist/tabler-icons.min.css'
    };

    // Class prefix per library
    var CLASS_PREFIX = {
        bootstrap: function (name) { return 'bi bi-' + name; },
        fa: function (name, cat) {
            if (cat === 'Brands') return 'fa-brands fa-' + name;
            if (cat === 'Regular') return 'fa-regular fa-' + name;
            return 'fa-solid fa-' + name;
        },
        tabler: function (name) { return 'ti ti-' + name; }
    };

    // ── DOM refs ──
    var iconTabs = document.getElementById('iconTabs');
    var iconSearch = document.getElementById('iconSearch');
    var categoriesBar = document.getElementById('categoriesBar');
    var iconsGrid = document.getElementById('iconsGrid');
    var gridLoading = document.getElementById('gridLoading');
    var gridWrap = document.getElementById('gridWrap');
    var iconCount = document.getElementById('iconCount');
    var detailPanel = document.getElementById('detailPanel');
    var detailEmpty = document.getElementById('detailEmpty');
    var detailContent = document.getElementById('detailContent');
    var detailIcon = document.getElementById('detailIcon');
    var detailName = document.getElementById('detailName');
    var detailClass = document.getElementById('detailClass');
    var detailHTML = document.getElementById('detailHTML');
    var detailJSX = document.getElementById('detailJSX');
    var copyClassBtn = document.getElementById('copyClassBtn');
    var copyHTMLBtn = document.getElementById('copyHTMLBtn');
    var recentSection = document.getElementById('recentSection');
    var recentGrid = document.getElementById('recentGrid');

    var RECENT_KEY = 'devhelper_icons_recent';
    var MAX_RECENT = 30;

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

    // ── Score an icon against a search query ──
    function scoreIcon(name, keywords, query) {
        var q = query.toLowerCase();
        var n = name.toLowerCase();
        var kw = (keywords || '').toLowerCase();
        var score = 0;

        // Exact substring in name
        if (n.includes(q)) {
            score += 100;
            if (n.indexOf(q) === 0) score += 20;
            // Exact full match
            if (n === q) score += 50;
        }

        // Exact substring in keywords
        if (kw.includes(q)) score += 60;

        // Word boundary match
        var nameParts = n.split('-');
        var kwParts = kw.split(/[\s,]+/).filter(Boolean);
        var qWords = q.split(/[\s-]+/).filter(Boolean);

        qWords.forEach(function (qw) {
            if (nameParts.some(function (np) { return np.indexOf(qw) === 0; })) score += 40;
            if (kwParts.some(function (kp) { return kp.indexOf(qw) === 0; })) score += 30;
        });

        // Fuzzy matching
        var maxDist = q.length <= 3 ? 1 : 2;
        qWords.forEach(function (qw) {
            if (qw.length < 2) return;
            nameParts.forEach(function (np) {
                if (levenshtein(qw, np) <= maxDist) score += 25;
            });
            kwParts.forEach(function (kp) {
                if (levenshtein(qw, kp) <= maxDist) score += 15;
            });
        });

        return score;
    }

    // ── Load library data (lazy script loading) ──
    function loadLibData(lib, callback) {
        if (loadedLibs[lib]) { callback(); return; }

        var src = '/static/icons-' + lib + '.js';
        if (lib === 'fa') src = '/static/icons-fa.js';

        gridLoading.classList.remove('d-none');
        var script = document.createElement('script');
        script.src = src;
        script.onload = function () {
            loadedLibs[lib] = true;
            gridLoading.classList.add('d-none');
            callback();
        };
        script.onerror = function () {
            gridLoading.classList.add('d-none');
            iconsGrid.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-exclamation-triangle" style="font-size:2rem;"></i><p class="mt-2">Failed to load icon data</p></div>';
        };
        document.head.appendChild(script);
    }

    // ── Load CSS for library (lazy) ──
    function loadLibCSS(lib) {
        if (lib === 'bootstrap' || loadedCSS[lib]) return;
        var url = CSS_URLS[lib];
        if (!url) return;
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        document.head.appendChild(link);
        loadedCSS[lib] = true;
    }

    // ── Get data for active library ──
    function getLibData() {
        if (activeLib === 'bootstrap') return window.ICONS_BOOTSTRAP || [];
        if (activeLib === 'fa') return window.ICONS_FA || [];
        if (activeLib === 'tabler') return window.ICONS_TABLER || [];
        return [];
    }

    // ── Render categories ──
    function renderCategories() {
        var data = getLibData();
        var html = '<button class="cat-btn' + (activeCategory === 'all' ? ' active' : '') + '" data-cat="all">All</button>';
        data.forEach(function (group) {
            html += '<button class="cat-btn' + (activeCategory === group.cat ? ' active' : '') + '" data-cat="' + escapeHtml(group.cat) + '">'
                + escapeHtml(group.cat) + ' <span class="text-muted">(' + group.items.length + ')</span></button>';
        });
        categoriesBar.innerHTML = html;

        categoriesBar.querySelectorAll('.cat-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeCategory = btn.dataset.cat;
                renderCategories();
                renderGrid();
            });
        });
    }

    // ── Render icon grid ──
    function renderGrid() {
        var data = getLibData();
        var q = searchQuery.trim();
        var items = [];

        // Collect items
        data.forEach(function (group) {
            if (activeCategory !== 'all' && group.cat !== activeCategory) return;
            group.items.forEach(function (item) {
                var name = item[0];
                var keywords = item[1] || '';
                items.push({ name: name, keywords: keywords, cat: group.cat });
            });
        });

        // Filter/score
        if (q) {
            var scored = [];
            items.forEach(function (item) {
                var sc = scoreIcon(item.name, item.keywords, q);
                if (sc > 0) scored.push({ item: item, score: sc });
            });
            scored.sort(function (a, b) { return b.score - a.score; });
            items = scored.map(function (s) { return s.item; });
        }

        // Update count
        var totalAll = 0;
        data.forEach(function (g) { totalAll += g.items.length; });
        iconCount.textContent = q ? items.length + ' / ' + totalAll + ' icons' : totalAll + ' icons';

        if (items.length === 0) {
            iconsGrid.innerHTML = '<div class="text-center text-muted py-5"><i class="bi bi-search" style="font-size:2rem;"></i><p class="mt-2">No icons found' + (q ? ' for "' + escapeHtml(q) + '"' : '') + '</p></div>';
            return;
        }

        // Render in batches for large sets
        var BATCH = 500;
        iconsGrid.innerHTML = '';

        function renderBatch(start) {
            var end = Math.min(start + BATCH, items.length);
            var frag = document.createDocumentFragment();
            for (var i = start; i < end; i++) {
                var item = items[i];
                var cls = CLASS_PREFIX[activeLib](item.name, item.cat);
                var tile = document.createElement('div');
                tile.className = 'icon-tile';
                tile.dataset.name = item.name;
                tile.dataset.cat = item.cat;
                tile.title = item.name;
                tile.innerHTML = '<i class="' + cls + '"></i>';
                frag.appendChild(tile);
            }
            iconsGrid.appendChild(frag);

            if (end < items.length) {
                requestAnimationFrame(function () { renderBatch(end); });
            }
        }
        renderBatch(0);

        // Event delegation on grid
        // (handled via gridWrap click listener)
    }

    // ── Grid click handler (event delegation) ──
    gridWrap.addEventListener('click', function (e) {
        var tile = e.target.closest('.icon-tile');
        if (!tile) return;
        var name = tile.dataset.name;
        var cat = tile.dataset.cat;
        showDetail(name, cat);
        addRecent(name, cat);

        // Mark active
        iconsGrid.querySelectorAll('.icon-tile.active').forEach(function (el) { el.classList.remove('active'); });
        tile.classList.add('active');
    });

    // Also handle recent grid clicks
    recentGrid.addEventListener('click', function (e) {
        var tile = e.target.closest('.icon-tile');
        if (!tile) return;
        var name = tile.dataset.name;
        var cat = tile.dataset.cat;
        showDetail(name, cat);
    });

    // ── Show detail panel ──
    function showDetail(name, cat) {
        selectedIcon = { name: name, cat: cat };
        detailEmpty.classList.add('d-none');
        detailContent.classList.remove('d-none');

        var cls = CLASS_PREFIX[activeLib](name, cat);
        var htmlTag = '<i class="' + cls + '"></i>';
        var jsxTag = '<i className="' + cls + '" />';

        detailIcon.innerHTML = '<i class="' + cls + '"></i>';
        detailName.textContent = name;
        detailClass.textContent = cls;
        detailHTML.textContent = htmlTag;
        detailJSX.textContent = jsxTag;
    }

    // ── Copy helpers ──
    function copyText(text) {
        navigator.clipboard.writeText(text).then(function () {
            showCopyToast('Copied: ' + text);
        });
    }

    function showCopyToast(msg) {
        var existing = document.querySelector('.copy-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 1500);
    }

    // Detail row clicks → copy
    detailClass.addEventListener('click', function () { copyText(this.textContent); });
    detailHTML.addEventListener('click', function () { copyText(this.textContent); });
    detailJSX.addEventListener('click', function () { copyText(this.textContent); });
    copyClassBtn.addEventListener('click', function () {
        if (selectedIcon) copyText(CLASS_PREFIX[activeLib](selectedIcon.name, selectedIcon.cat));
    });
    copyHTMLBtn.addEventListener('click', function () {
        if (selectedIcon) {
            var cls = CLASS_PREFIX[activeLib](selectedIcon.name, selectedIcon.cat);
            copyText('<i class="' + cls + '"></i>');
        }
    });

    // ── Recently used (localStorage) ──
    function getRecent() {
        try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch (e) { return []; }
    }

    function addRecent(name, cat) {
        var recent = getRecent();
        // Remove duplicate
        recent = recent.filter(function (r) { return !(r.name === name && r.lib === activeLib); });
        recent.unshift({ name: name, cat: cat, lib: activeLib });
        if (recent.length > MAX_RECENT) recent = recent.slice(0, MAX_RECENT);
        localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
        renderRecent();
    }

    function renderRecent() {
        var recent = getRecent().filter(function (r) { return r.lib === activeLib; });
        if (recent.length === 0) {
            recentSection.classList.add('d-none');
            return;
        }
        recentSection.classList.remove('d-none');
        recentGrid.innerHTML = recent.slice(0, 15).map(function (r) {
            var cls = CLASS_PREFIX[r.lib](r.name, r.cat);
            return '<div class="icon-tile" data-name="' + escapeHtml(r.name) + '" data-cat="' + escapeHtml(r.cat) + '" title="' + escapeHtml(r.name) + '"><i class="' + cls + '"></i></div>';
        }).join('');
    }

    // ── Tab switching ──
    iconTabs.addEventListener('click', function (e) {
        var tab = e.target.closest('.icons-tab');
        if (!tab || tab.classList.contains('active')) return;

        iconTabs.querySelectorAll('.icons-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');

        activeLib = tab.dataset.lib;
        activeCategory = 'all';
        selectedIcon = null;
        detailEmpty.classList.remove('d-none');
        detailContent.classList.add('d-none');

        loadLibCSS(activeLib);
        loadLibData(activeLib, function () {
            renderCategories();
            renderGrid();
            renderRecent();
        });
    });

    // ── Search ──
    var searchDebounce;
    iconSearch.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function () {
            searchQuery = iconSearch.value;
            renderGrid();
        }, 200);
    });

    // ── Escape HTML ──
    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    // ── Init: load Bootstrap Icons (default tab) ──
    loadLibData('bootstrap', function () {
        renderCategories();
        renderGrid();
        renderRecent();
    });
});
