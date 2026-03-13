// ── Bookmark Manager ──
document.addEventListener('DOMContentLoaded', function () {
    const STORAGE_KEY = 'devhelper_bookmarks';
    let bookmarks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let nextId = bookmarks.length > 0 ? Math.max(...bookmarks.map(b => b.id)) + 1 : 1;
    let activeCategory = 'all';
    let activeTag = '';

    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks)); }

    function render() {
        const q = document.getElementById('searchInput').value.toLowerCase().trim();
        const filtered = bookmarks.filter(b => {
            if (activeCategory !== 'all' && b.category !== activeCategory) return false;
            if (activeTag && !(b.tags || []).includes(activeTag)) return false;
            if (q && !b.title.toLowerCase().includes(q) && !b.url.toLowerCase().includes(q) && !(b.desc || '').toLowerCase().includes(q) && !(b.tags || []).some(t => t.includes(q))) return false;
            return true;
        });

        // Categories
        const cats = ['all', ...new Set(bookmarks.map(b => b.category || 'General'))];
        document.getElementById('categoryBar').innerHTML = cats.map(c =>
            `<span class="badge category-badge ${c === activeCategory ? 'bg-primary' : 'bg-secondary'}" onclick="window._setCat('${esc(c)}')">${c === 'all' ? 'All' : esc(c)} (${c === 'all' ? bookmarks.length : bookmarks.filter(b => (b.category || 'General') === c).length})</span>`
        ).join('');

        // List
        if (filtered.length === 0) {
            document.getElementById('bookmarkList').innerHTML = '<div class="text-center text-muted py-4">No bookmarks found. Click "Add" to create one.</div>';
            return;
        }

        document.getElementById('bookmarkList').innerHTML = filtered.map(b => {
            const tags = (b.tags || []).map(t => `<span class="bm-tag" onclick="window._setTag('${esc(t)}')">${esc(t)}</span>`).join(' ');
            return `<div class="bm-card">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <div class="bm-title">${esc(b.title)}</div>
                        <a class="bm-url" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.url)}</a>
                        ${b.desc ? `<div class="bm-desc">${esc(b.desc)}</div>` : ''}
                        <div class="mt-1 d-flex gap-1 flex-wrap">${tags}</div>
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="window._editBm(${b.id})" title="Edit"><i class="bi bi-pencil"></i></button>
                        <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="window._delBm(${b.id})" title="Delete"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    window._setCat = function (c) { activeCategory = c; activeTag = ''; render(); };
    window._setTag = function (t) { activeTag = activeTag === t ? '' : t; render(); };

    window._editBm = function (id) {
        const b = bookmarks.find(x => x.id === id);
        if (!b) return;
        document.getElementById('editId').value = id;
        document.getElementById('bmTitle').value = b.title;
        document.getElementById('bmUrl').value = b.url;
        document.getElementById('bmDesc').value = b.desc || '';
        document.getElementById('bmCategory').value = b.category || '';
        document.getElementById('bmTags').value = (b.tags || []).join(', ');
        document.getElementById('modalTitle').textContent = 'Edit Bookmark';
        new bootstrap.Modal(document.getElementById('bmModal')).show();
    };

    window._delBm = function (id) {
        bookmarks = bookmarks.filter(b => b.id !== id);
        save(); render();
    };

    document.getElementById('addBtn').addEventListener('click', function () {
        document.getElementById('editId').value = '';
        document.getElementById('bmTitle').value = '';
        document.getElementById('bmUrl').value = '';
        document.getElementById('bmDesc').value = '';
        document.getElementById('bmCategory').value = '';
        document.getElementById('bmTags').value = '';
        document.getElementById('modalTitle').textContent = 'Add Bookmark';
        new bootstrap.Modal(document.getElementById('bmModal')).show();
        setTimeout(() => document.getElementById('bmTitle').focus(), 200);
    });

    document.getElementById('saveBmBtn').addEventListener('click', function () {
        const title = document.getElementById('bmTitle').value.trim();
        const url = document.getElementById('bmUrl').value.trim();
        if (!title || !url) return;
        const editId = document.getElementById('editId').value;
        const data = {
            title, url,
            desc: document.getElementById('bmDesc').value.trim(),
            category: document.getElementById('bmCategory').value.trim() || 'General',
            tags: document.getElementById('bmTags').value.split(',').map(t => t.trim()).filter(Boolean),
        };
        if (editId) {
            const b = bookmarks.find(x => x.id === parseInt(editId));
            if (b) Object.assign(b, data);
        } else {
            bookmarks.push({ id: nextId++, ...data });
        }
        save(); render();
        bootstrap.Modal.getInstance(document.getElementById('bmModal')).hide();
    });

    document.getElementById('searchInput').addEventListener('input', render);

    document.getElementById('exportBtn').addEventListener('click', function () {
        const blob = new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.download = 'bookmarks.json'; a.href = URL.createObjectURL(blob); a.click();
    });

    document.getElementById('importFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    imported.forEach(b => { b.id = nextId++; bookmarks.push(b); });
                    save(); render();
                }
            } catch {}
        };
        reader.readAsText(f); this.value = '';
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    render();
});
