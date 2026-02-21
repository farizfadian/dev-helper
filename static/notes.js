document.addEventListener('DOMContentLoaded', function () {
    // ── State ──
    let notes = [];
    let currentNote = null;
    let editor = null;
    let viewMode = 'edit';
    let activeCategory = 'all';
    let searchQuery = '';
    let saveTimeout = null;
    let colorPickerOpen = false;

    const COLORS = [
        { name: 'None', hex: '' },
        { name: 'Red', hex: '#dc3545' },
        { name: 'Orange', hex: '#fd7e14' },
        { name: 'Yellow', hex: '#ffc107' },
        { name: 'Green', hex: '#198754' },
        { name: 'Blue', hex: '#0d6efd' },
        { name: 'Purple', hex: '#6f42c1' },
        { name: 'Pink', hex: '#d63384' },
    ];

    const CATEGORIES = ['General', 'Work', 'Personal', 'Ideas', 'Code'];

    // ── DOM refs ──
    const noteList = document.getElementById('noteList');
    const noteSearch = document.getElementById('noteSearch');
    const newNoteBtn = document.getElementById('newNoteBtn');
    const newNoteBtn2 = document.getElementById('newNoteBtn2');
    const editorEmpty = document.getElementById('editorEmpty');
    const editorContent = document.getElementById('editorContent');
    const noteTitle = document.getElementById('noteTitle');
    const noteCategory = document.getElementById('noteCategory');
    const pinNoteBtn = document.getElementById('pinNoteBtn');
    const colorBtn = document.getElementById('colorBtn');
    const deleteNoteBtn = document.getElementById('deleteNoteBtn');
    const tagsList = document.getElementById('tagsList');
    const tagInput = document.getElementById('tagInput');
    const previewPane = document.getElementById('previewPane');
    const monacoDiv = document.getElementById('monacoEditor');
    const attachFile = document.getElementById('attachFile');
    const attachmentsList = document.getElementById('attachmentsList');
    const attachmentsSection = document.getElementById('attachmentsSection');
    const categoriesBar = document.getElementById('categoriesBar');
    const saveStatus = document.getElementById('saveStatus');
    const copyMdBtn = document.getElementById('copyMdBtn');
    const editorPanel = document.getElementById('editorPanel');

    // ── API ──
    async function fetchNotes() {
        const resp = await fetch('/api/notes');
        notes = await resp.json();
        return notes;
    }

    async function createNote(note) {
        const resp = await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note),
        });
        return resp.json();
    }

    async function updateNote(note) {
        const resp = await fetch('/api/notes', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note),
        });
        return resp.json();
    }

    async function deleteNoteAPI(id, permanent) {
        var url = '/api/notes?id=' + encodeURIComponent(id);
        if (permanent) url += '&permanent=true';
        await fetch(url, { method: 'DELETE' });
    }

    async function restoreNoteAPI(id) {
        await fetch('/api/notes/restore?id=' + encodeURIComponent(id), { method: 'POST' });
    }

    async function uploadAttachment(noteId, file) {
        var fd = new FormData();
        fd.append('file', file);
        var resp = await fetch('/api/notes/attachment?noteId=' + encodeURIComponent(noteId), {
            method: 'POST',
            body: fd,
        });
        return resp.json();
    }

    // ── Generate unique ID ──
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    // ── Render note list ──
    function renderNoteList() {
        var q = searchQuery.toLowerCase();
        var filtered = notes.filter(function (n) {
            if (activeCategory === 'trash') return !!n.trashedAt;
            if (n.trashedAt) return false;
            if (activeCategory !== 'all' && n.category !== activeCategory) return false;
            if (q) {
                return (n.title || '').toLowerCase().includes(q)
                    || (n.content || '').toLowerCase().includes(q)
                    || (n.tags && n.tags.some(function (t) { return t.toLowerCase().includes(q); }));
            }
            return true;
        });

        // Sort: pinned first, then by updatedAt desc
        filtered.sort(function (a, b) {
            if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
        });

        if (filtered.length === 0) {
            noteList.innerHTML = '<div class="notes-empty">'
                + '<i class="bi bi-journal-text"></i>'
                + '<p class="mt-2 mb-0 small">' + (activeCategory === 'trash' ? 'Trash is empty' : 'No notes yet') + '</p>'
                + '</div>';
            return;
        }

        noteList.innerHTML = filtered.map(function (n) {
            var isActive = currentNote && currentNote.id === n.id;
            var preview = stripMd(n.content).substring(0, 120);
            var timeAgo = formatTimeAgo(n.updatedAt);
            var colorDot = n.color ? '<span class="note-color-dot" style="background:' + n.color + '"></span>' : '';
            var pinIcon = n.pinned ? '<i class="bi bi-pin-fill text-primary" style="font-size:0.6rem"></i>' : '';
            var coverHtml = '';
            if (n.attachments && n.attachments.length > 0) {
                var firstAtt = n.attachments[0];
                if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(firstAtt)) {
                    coverHtml = '<img class="note-card-cover" src="/notes-att/' + n.id + '/' + firstAtt + '" alt="">';
                }
            }
            return '<div class="note-card' + (isActive ? ' active' : '') + '" data-id="' + n.id + '">'
                + coverHtml
                + '<div class="note-card-title">' + escapeHtml(n.title || 'Untitled') + '</div>'
                + '<div class="note-card-preview">' + escapeHtml(preview) + '</div>'
                + '<div class="note-card-meta">'
                + colorDot + pinIcon
                + '<span>' + timeAgo + '</span>'
                + '<span>&middot; ' + escapeHtml(n.category || 'General') + '</span>'
                + '</div></div>';
        }).join('');

        noteList.querySelectorAll('.note-card').forEach(function (card) {
            card.addEventListener('click', function () {
                var id = card.dataset.id;
                var note = notes.find(function (n) { return n.id === id; });
                if (note) selectNote(note);
            });
        });
    }

    // ── Categories ──
    function renderCategories() {
        var cats = new Set();
        notes.forEach(function (n) { if (n.category && !n.trashedAt) cats.add(n.category); });

        var html = '<button class="cat-btn' + (activeCategory === 'all' ? ' active' : '') + '" data-cat="all">All</button>';
        CATEGORIES.forEach(function (c) {
            if (cats.has(c) || c === 'General') {
                html += '<button class="cat-btn' + (activeCategory === c ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>';
            }
        });
        cats.forEach(function (c) {
            if (!CATEGORIES.includes(c)) {
                html += '<button class="cat-btn' + (activeCategory === c ? ' active' : '') + '" data-cat="' + c + '">' + escapeHtml(c) + '</button>';
            }
        });
        var trashCount = notes.filter(function (n) { return !!n.trashedAt; }).length;
        html += '<button class="cat-btn' + (activeCategory === 'trash' ? ' active' : '') + '" data-cat="trash">'
            + '<i class="bi bi-trash3"></i> Trash' + (trashCount ? ' (' + trashCount + ')' : '') + '</button>';

        categoriesBar.innerHTML = html;

        categoriesBar.querySelectorAll('.cat-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeCategory = btn.dataset.cat;
                renderCategories();
                renderNoteList();
            });
        });
    }

    // ── Select note ──
    function selectNote(note) {
        currentNote = note;
        editorEmpty.classList.add('d-none');
        editorContent.classList.remove('d-none');

        noteTitle.value = note.title || '';
        noteCategory.value = note.category || 'General';
        updatePinButton();
        renderTags();
        renderAttachments();
        renderNoteList();

        if (editor) {
            editor.setValue(note.content || '');
        }
        updatePreview();

        // Show restore vs delete button
        if (note.trashedAt) {
            deleteNoteBtn.innerHTML = '<i class="bi bi-arrow-counterclockwise"></i>';
            deleteNoteBtn.title = 'Restore note';
            deleteNoteBtn.className = 'btn btn-sm text-success';
        } else {
            deleteNoteBtn.innerHTML = '<i class="bi bi-trash"></i>';
            deleteNoteBtn.title = 'Delete note';
            deleteNoteBtn.className = 'btn btn-sm text-danger';
        }

        // Disable editing for trashed notes
        noteTitle.readOnly = !!note.trashedAt;
        noteCategory.disabled = !!note.trashedAt;
        tagInput.disabled = !!note.trashedAt;
        if (editor) editor.updateOptions({ readOnly: !!note.trashedAt });
    }

    function deselectNote() {
        currentNote = null;
        editorContent.classList.add('d-none');
        editorEmpty.classList.remove('d-none');
        renderNoteList();
    }

    // ── New note ──
    async function newNote() {
        if (activeCategory === 'trash') {
            activeCategory = 'all';
            renderCategories();
        }
        var note = {
            id: generateId(),
            title: '',
            content: '',
            category: activeCategory !== 'all' ? activeCategory : 'General',
            tags: [],
            color: '',
            pinned: false,
            attachments: [],
        };
        var created = await createNote(note);
        await fetchNotes();
        renderCategories();
        var found = notes.find(function (n) { return n.id === created.id; });
        selectNote(found || created);
        noteTitle.focus();
    }

    // ── Auto-save with debounce ──
    function scheduleSave() {
        if (!currentNote || currentNote.trashedAt) return;
        clearTimeout(saveTimeout);
        showSaveStatus('saving');
        saveTimeout = setTimeout(async function () {
            if (!currentNote) return;
            currentNote.title = noteTitle.value;
            currentNote.content = editor ? editor.getValue() : '';
            currentNote.category = noteCategory.value;
            await updateNote(currentNote);
            await fetchNotes();
            // Re-find current note in refreshed list
            if (currentNote) {
                var found = notes.find(function (n) { return n.id === currentNote.id; });
                if (found) currentNote = found;
            }
            renderNoteList();
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
        if (!currentNote) { tagsList.innerHTML = ''; return; }
        tagsList.innerHTML = (currentNote.tags || []).map(function (t, i) {
            return '<span class="note-tag">' + escapeHtml(t)
                + ' <span class="remove-tag" data-idx="' + i + '">&times;</span></span>';
        }).join('');

        tagsList.querySelectorAll('.remove-tag').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.dataset.idx);
                currentNote.tags.splice(idx, 1);
                renderTags();
                scheduleSave();
            });
        });
    }

    tagInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            var tag = tagInput.value.trim().replace(/,/g, '');
            if (tag && currentNote && !(currentNote.tags || []).includes(tag)) {
                if (!currentNote.tags) currentNote.tags = [];
                currentNote.tags.push(tag);
                renderTags();
                scheduleSave();
            }
            tagInput.value = '';
        }
        if (e.key === 'Backspace' && !tagInput.value && currentNote && currentNote.tags && currentNote.tags.length) {
            currentNote.tags.pop();
            renderTags();
            scheduleSave();
        }
    });

    // ── Pin note ──
    function updatePinButton() {
        if (!currentNote) return;
        var icon = pinNoteBtn.querySelector('i');
        if (currentNote.pinned) {
            icon.className = 'bi bi-pin-fill text-primary';
            pinNoteBtn.title = 'Unpin note';
        } else {
            icon.className = 'bi bi-pin';
            pinNoteBtn.title = 'Pin note';
        }
    }

    pinNoteBtn.addEventListener('click', function () {
        if (!currentNote || currentNote.trashedAt) return;
        currentNote.pinned = !currentNote.pinned;
        updatePinButton();
        scheduleSave();
    });

    // ── Color label ──
    colorBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!currentNote || currentNote.trashedAt) return;
        if (colorPickerOpen) { closeColorPicker(); return; }
        showColorPicker();
    });

    function showColorPicker() {
        closeColorPicker();
        var picker = document.createElement('div');
        picker.className = 'color-picker';
        picker.id = 'colorPicker';
        COLORS.forEach(function (c) {
            var swatch = document.createElement('div');
            swatch.className = 'color-swatch' + (currentNote && currentNote.color === c.hex ? ' active' : '');
            swatch.style.background = c.hex || 'var(--bs-tertiary-bg)';
            if (!c.hex) swatch.innerHTML = '<i class="bi bi-x" style="font-size:0.7rem;line-height:18px;display:block;text-align:center;"></i>';
            swatch.title = c.name;
            swatch.addEventListener('click', function () {
                if (currentNote) {
                    currentNote.color = c.hex;
                    scheduleSave();
                }
                closeColorPicker();
            });
            picker.appendChild(swatch);
        });
        colorBtn.parentElement.appendChild(picker);
        colorPickerOpen = true;
    }

    function closeColorPicker() {
        var existing = document.getElementById('colorPicker');
        if (existing) existing.remove();
        colorPickerOpen = false;
    }

    document.addEventListener('click', function (e) {
        if (colorPickerOpen && !e.target.closest('#colorPicker') && !e.target.closest('#colorBtn')) {
            closeColorPicker();
        }
    });

    // ── Delete / Restore ──
    deleteNoteBtn.addEventListener('click', async function () {
        if (!currentNote) return;
        if (currentNote.trashedAt) {
            await restoreNoteAPI(currentNote.id);
        } else {
            await deleteNoteAPI(currentNote.id, false);
        }
        await fetchNotes();
        deselectNote();
        renderCategories();
    });

    // ── Permanent delete (context menu in trash) ──
    noteList.addEventListener('contextmenu', function (e) {
        var card = e.target.closest('.note-card');
        if (!card) return;
        var id = card.dataset.id;
        var note = notes.find(function (n) { return n.id === id; });
        if (!note || !note.trashedAt) return;

        e.preventDefault();
        if (confirm('Permanently delete "' + (note.title || 'Untitled') + '"? This cannot be undone.')) {
            deleteNoteAPI(id, true).then(function () {
                return fetchNotes();
            }).then(function () {
                if (currentNote && currentNote.id === id) deselectNote();
                renderCategories();
                renderNoteList();
            });
        }
    });

    // ── View mode toggle ──
    document.querySelectorAll('[data-view]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            document.querySelectorAll('[data-view]').forEach(function (b) {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-outline-secondary');
            });
            btn.classList.add('active', 'btn-primary');
            btn.classList.remove('btn-outline-secondary');
            viewMode = btn.dataset.view;
            applyViewMode();
        });
    });

    function applyViewMode() {
        if (viewMode === 'edit') {
            monacoDiv.classList.remove('d-none');
            monacoDiv.style.flex = '1';
            previewPane.classList.add('d-none');
            previewPane.style.flex = '';
        } else if (viewMode === 'preview') {
            monacoDiv.classList.add('d-none');
            monacoDiv.style.flex = '';
            previewPane.classList.remove('d-none');
            previewPane.style.flex = '1';
            updatePreview();
        } else {
            monacoDiv.classList.remove('d-none');
            monacoDiv.style.flex = '1';
            previewPane.classList.remove('d-none');
            previewPane.style.flex = '1';
            updatePreview();
        }
        if (editor) editor.layout();
    }

    // ── Markdown preview ──
    function updatePreview() {
        if (!currentNote) return;
        var content = editor ? editor.getValue() : (currentNote.content || '');
        previewPane.innerHTML = marked.parse(content, { breaks: true, gfm: true });
        // Highlight code blocks
        previewPane.querySelectorAll('pre code').forEach(function (block) {
            hljs.highlightElement(block);
        });
    }

    // ── Attachments ──
    function renderAttachments() {
        if (!currentNote || !currentNote.attachments || currentNote.attachments.length === 0) {
            attachmentsList.innerHTML = '';
            return;
        }
        attachmentsList.innerHTML = currentNote.attachments.map(function (att, i) {
            var isImage = /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(att);
            var url = '/notes-att/' + currentNote.id + '/' + att;
            return '<span class="att-item">'
                + (isImage ? '<img src="' + url + '" alt="">' : '<i class="bi bi-file-earmark"></i>')
                + ' <a href="' + url + '" target="_blank" class="text-decoration-none small">' + escapeHtml(att) + '</a>'
                + (!currentNote.trashedAt ? ' <button class="btn btn-sm p-0 att-remove" data-idx="' + i + '" title="Remove">&times;</button>' : '')
                + (isImage && !currentNote.trashedAt ? ' <button class="btn btn-sm p-0 ms-1 att-insert" title="Insert into note" data-insert="' + url + '" style="font-size:0.6rem;color:var(--bs-primary)"><i class="bi bi-box-arrow-in-down"></i></button>' : '')
                + '</span>';
        }).join('');

        attachmentsList.querySelectorAll('.att-remove').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var idx = parseInt(btn.dataset.idx);
                currentNote.attachments.splice(idx, 1);
                renderAttachments();
                scheduleSave();
            });
        });

        attachmentsList.querySelectorAll('.att-insert').forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (!editor) return;
                var url = btn.dataset.insert;
                var pos = editor.getPosition();
                editor.executeEdits('insert-image', [{
                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                    text: '![image](' + url + ')\n',
                }]);
                editor.focus();
                scheduleSave();
            });
        });
    }

    // File upload via attach button
    attachFile.addEventListener('change', async function () {
        if (!currentNote || !attachFile.files.length) return;
        showSaveStatus('saving');
        for (var i = 0; i < attachFile.files.length; i++) {
            var file = attachFile.files[i];
            var result = await uploadAttachment(currentNote.id, file);
            // Auto-insert image into editor
            if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(result.filename) && editor) {
                var pos = editor.getPosition();
                editor.executeEdits('insert-image', [{
                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                    text: '![image](' + result.url + ')\n',
                }]);
            }
        }
        await fetchNotes();
        var found = notes.find(function (n) { return n.id === currentNote.id; });
        if (found) currentNote = found;
        renderAttachments();
        renderNoteList();
        showSaveStatus('saved');
        attachFile.value = '';
    });

    // ── Ctrl+V paste image ──
    document.addEventListener('paste', async function (e) {
        if (!currentNote || currentNote.trashedAt) return;
        var items = e.clipboardData ? e.clipboardData.items : null;
        if (!items) return;

        for (var i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                e.preventDefault();
                var blob = items[i].getAsFile();
                if (!blob) continue;

                var ext = blob.type.split('/')[1] || 'png';
                if (ext === 'jpeg') ext = 'jpg';
                var file = new File([blob], 'paste-' + Date.now() + '.' + ext, { type: blob.type });

                showSaveStatus('saving');
                var result = await uploadAttachment(currentNote.id, file);

                if (editor) {
                    var pos = editor.getPosition();
                    editor.executeEdits('paste-image', [{
                        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                        text: '![image](' + result.url + ')\n',
                    }]);
                }

                await fetchNotes();
                var found = notes.find(function (n) { return n.id === currentNote.id; });
                if (found) currentNote = found;
                renderAttachments();
                renderNoteList();
                showSaveStatus('saved');
                break;
            }
        }
    });

    // ── Drag & drop files onto editor panel ──
    editorPanel.addEventListener('dragover', function (e) {
        e.preventDefault();
        attachmentsSection.classList.add('drop-active');
    });
    editorPanel.addEventListener('dragleave', function (e) {
        if (!editorPanel.contains(e.relatedTarget)) {
            attachmentsSection.classList.remove('drop-active');
        }
    });
    editorPanel.addEventListener('drop', async function (e) {
        e.preventDefault();
        attachmentsSection.classList.remove('drop-active');
        if (!currentNote || currentNote.trashedAt || !e.dataTransfer.files.length) return;

        showSaveStatus('saving');
        for (var i = 0; i < e.dataTransfer.files.length; i++) {
            var file = e.dataTransfer.files[i];
            var result = await uploadAttachment(currentNote.id, file);
            if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(result.filename) && editor) {
                var pos = editor.getPosition();
                editor.executeEdits('drop-image', [{
                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                    text: '![image](' + result.url + ')\n',
                }]);
            }
        }
        await fetchNotes();
        var found = notes.find(function (n) { return n.id === currentNote.id; });
        if (found) currentNote = found;
        renderAttachments();
        renderNoteList();
        showSaveStatus('saved');
    });

    // ── Copy markdown ──
    copyMdBtn.addEventListener('click', function () {
        if (!editor) return;
        navigator.clipboard.writeText(editor.getValue()).then(function () {
            copyMdBtn.innerHTML = '<i class="bi bi-check2 text-success"></i>';
            setTimeout(function () { copyMdBtn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
        });
    });

    // ── Search ──
    var searchDebounce;
    noteSearch.addEventListener('input', function () {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(function () {
            searchQuery = noteSearch.value;
            renderNoteList();
        }, 200);
    });

    // ── Input events → auto-save ──
    noteTitle.addEventListener('input', scheduleSave);
    noteCategory.addEventListener('change', scheduleSave);

    // ── New note buttons ──
    newNoteBtn.addEventListener('click', newNote);
    newNoteBtn2.addEventListener('click', newNote);

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', function (e) {
        // Ctrl+N — new note (don't intercept if spotlight is open)
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            var spotlight = document.getElementById('spotlightBackdrop');
            if (spotlight && spotlight.classList.contains('show')) return;
            e.preventDefault();
            newNote();
        }
        // Ctrl+Shift+P — toggle preview
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
            e.preventDefault();
            if (viewMode === 'edit') {
                viewMode = 'split';
            } else if (viewMode === 'split') {
                viewMode = 'preview';
            } else {
                viewMode = 'edit';
            }
            document.querySelectorAll('[data-view]').forEach(function (b) {
                b.classList.remove('active', 'btn-primary');
                b.classList.add('btn-outline-secondary');
                if (b.dataset.view === viewMode) {
                    b.classList.add('active', 'btn-primary');
                    b.classList.remove('btn-outline-secondary');
                }
            });
            applyViewMode();
        }
    });

    // ── Helpers ──
    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function stripMd(text) {
        if (!text) return '';
        return text
            .replace(/#{1,6}\s/g, '')
            .replace(/\*\*|__/g, '')
            .replace(/\*|_/g, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
            .replace(/`{1,3}[^`]*`{1,3}/g, '')
            .replace(/\n/g, ' ')
            .trim();
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
            language: 'markdown',
            theme: isDark ? 'vs-dark' : 'vs',
            minimap: { enabled: false },
            wordWrap: 'on',
            lineNumbers: 'on',
            fontSize: 14,
            padding: { top: 8 },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            renderWhitespace: 'none',
            tabSize: 2,
        });

        // ── Markdown formatting shortcuts ──
        // Helper: wrap selection or insert at cursor
        function wrapSelection(prefix, suffix) {
            var sel = editor.getSelection();
            var text = editor.getModel().getValueInRange(sel);
            if (text) {
                // If already wrapped, unwrap
                if (text.startsWith(prefix) && text.endsWith(suffix)) {
                    editor.executeEdits('md-format', [{
                        range: sel,
                        text: text.slice(prefix.length, text.length - suffix.length),
                    }]);
                } else {
                    editor.executeEdits('md-format', [{
                        range: sel,
                        text: prefix + text + suffix,
                    }]);
                }
            } else {
                // No selection — insert and place cursor between
                var pos = editor.getPosition();
                editor.executeEdits('md-format', [{
                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                    text: prefix + suffix,
                }]);
                editor.setPosition({ lineNumber: pos.lineNumber, column: pos.column + prefix.length });
            }
            editor.focus();
        }

        function prefixLine(prefix) {
            var sel = editor.getSelection();
            var startLine = sel.startLineNumber;
            var endLine = sel.endLineNumber;
            var edits = [];
            for (var i = startLine; i <= endLine; i++) {
                var lineContent = editor.getModel().getLineContent(i);
                if (lineContent.startsWith(prefix)) {
                    // Remove prefix (toggle off)
                    edits.push({
                        range: new monaco.Range(i, 1, i, prefix.length + 1),
                        text: '',
                    });
                } else {
                    edits.push({
                        range: new monaco.Range(i, 1, i, 1),
                        text: prefix,
                    });
                }
            }
            editor.executeEdits('md-format', edits);
            editor.focus();
        }

        // Ctrl+B → **bold**
        editor.addAction({
            id: 'md-bold', label: 'Markdown Bold',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB],
            run: function () { wrapSelection('**', '**'); }
        });
        // Ctrl+I → *italic*
        editor.addAction({
            id: 'md-italic', label: 'Markdown Italic',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI],
            run: function () { wrapSelection('*', '*'); }
        });
        // Ctrl+Shift+S → ~~strikethrough~~
        editor.addAction({
            id: 'md-strike', label: 'Markdown Strikethrough',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS],
            run: function () { wrapSelection('~~', '~~'); }
        });
        // Ctrl+E → `inline code`
        editor.addAction({
            id: 'md-code', label: 'Markdown Inline Code',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE],
            run: function () { wrapSelection('`', '`'); }
        });
        // Ctrl+K → [link](url)
        editor.addAction({
            id: 'md-link', label: 'Markdown Link',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
            run: function () {
                var sel = editor.getSelection();
                var text = editor.getModel().getValueInRange(sel);
                if (text) {
                    editor.executeEdits('md-format', [{
                        range: sel,
                        text: '[' + text + '](url)',
                    }]);
                    // Select "url" for easy replacement
                    var endCol = sel.startColumn + text.length + 3;
                    editor.setSelection(new monaco.Range(sel.startLineNumber, endCol, sel.startLineNumber, endCol + 3));
                } else {
                    var pos = editor.getPosition();
                    editor.executeEdits('md-format', [{
                        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                        text: '[text](url)',
                    }]);
                    // Select "text"
                    editor.setSelection(new monaco.Range(pos.lineNumber, pos.column + 1, pos.lineNumber, pos.column + 5));
                }
                editor.focus();
            }
        });
        // Ctrl+Shift+K → ```code block```
        editor.addAction({
            id: 'md-codeblock', label: 'Markdown Code Block',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyK],
            run: function () {
                var sel = editor.getSelection();
                var text = editor.getModel().getValueInRange(sel);
                editor.executeEdits('md-format', [{
                    range: sel,
                    text: '```\n' + (text || '') + '\n```',
                }]);
                if (!text) {
                    editor.setPosition({ lineNumber: sel.startLineNumber + 1, column: 1 });
                }
                editor.focus();
            }
        });
        // Ctrl+Shift+. → > blockquote
        editor.addAction({
            id: 'md-quote', label: 'Markdown Blockquote',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Period],
            run: function () { prefixLine('> '); }
        });
        // Ctrl+Shift+7 → ordered list
        editor.addAction({
            id: 'md-ol', label: 'Markdown Ordered List',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit7],
            run: function () {
                var sel = editor.getSelection();
                var edits = [];
                for (var i = sel.startLineNumber; i <= sel.endLineNumber; i++) {
                    var lineContent = editor.getModel().getLineContent(i);
                    var num = i - sel.startLineNumber + 1;
                    var olPrefix = num + '. ';
                    if (/^\d+\.\s/.test(lineContent)) {
                        edits.push({ range: new monaco.Range(i, 1, i, lineContent.match(/^\d+\.\s/)[0].length + 1), text: '' });
                    } else {
                        edits.push({ range: new monaco.Range(i, 1, i, 1), text: olPrefix });
                    }
                }
                editor.executeEdits('md-format', edits);
                editor.focus();
            }
        });
        // Ctrl+Shift+8 → bullet list
        editor.addAction({
            id: 'md-ul', label: 'Markdown Bullet List',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit8],
            run: function () { prefixLine('- '); }
        });
        // Ctrl+Shift+9 → - [ ] checkbox
        editor.addAction({
            id: 'md-checkbox', label: 'Markdown Checkbox',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Digit9],
            run: function () { prefixLine('- [ ] '); }
        });
        // Ctrl+Shift+1..3 → heading
        [1, 2, 3].forEach(function (level) {
            var hashes = '#'.repeat(level) + ' ';
            var keys = [monaco.KeyCode.Digit1, monaco.KeyCode.Digit2, monaco.KeyCode.Digit3];
            editor.addAction({
                id: 'md-h' + level, label: 'Markdown H' + level,
                keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | keys[level - 1]],
                run: function () { prefixLine(hashes); }
            });
        });
        // Ctrl+Shift+X → horizontal rule
        editor.addAction({
            id: 'md-hr', label: 'Markdown Horizontal Rule',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyX],
            run: function () {
                var pos = editor.getPosition();
                editor.executeEdits('md-format', [{
                    range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
                    text: '\n---\n',
                }]);
                editor.focus();
            }
        });

        // ── Toolbar buttons → trigger Monaco actions ──
        var fmtMap = {
            bold: 'md-bold', italic: 'md-italic', strike: 'md-strike', code: 'md-code',
            link: 'md-link', codeblock: 'md-codeblock', quote: 'md-quote',
            ul: 'md-ul', ol: 'md-ol', checkbox: 'md-checkbox',
            h1: 'md-h1', h2: 'md-h2', h3: 'md-h3', hr: 'md-hr',
        };
        document.querySelectorAll('.md-fmt').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var actionId = fmtMap[btn.dataset.fmt];
                if (actionId) editor.getAction(actionId).run();
            });
        });

        // Content change → auto-save + live preview
        editor.onDidChangeModelContent(function () {
            scheduleSave();
            if (viewMode !== 'edit') updatePreview();
        });

        // Theme sync
        window.addEventListener('devhelper-theme', function (e) {
            monaco.editor.setTheme(e.detail.theme === 'dark' ? 'vs-dark' : 'vs');
        });

        // Load notes after Monaco is ready
        init();
    });

    async function init() {
        await fetchNotes();
        renderCategories();
        renderNoteList();
    }
});
