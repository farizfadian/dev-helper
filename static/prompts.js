// ── Prompt Notebook ──
document.addEventListener('DOMContentLoaded', function () {
    const STORAGE_KEY = 'devhelper_prompts';
    const SETTINGS_KEY = 'devhelper_prompts_settings';

    // ── State ──
    let folders = [];       // [{ id, name, order }]
    let prompts = [];       // [{ id, folderId, title, body, order, polished, createdAt }]
    let activeFolder = 'all';
    let nextId = 1;
    let draggedPromptId = null;

    // ── Settings ──
    let settings = {
        ollamaUrl: localStorage.getItem('devhelper_ollama_url') || 'http://localhost:11434',
        model: '',
        systemPrompt: `You are a prompt engineering expert. Your task is to improve the following prompt to make it clearer, more specific, and more effective for an AI assistant (Claude).

Rules:
- Keep the original intent and all technical details
- Improve clarity, structure, and specificity
- Add context or constraints if helpful
- Keep the same language as the original (if Indonesian, respond in Indonesian)
- Output ONLY the improved prompt, no explanations

Original prompt to improve:
{prompt}`,
    };

    async function loadData() {
        // Load from server (disk) first, fallback to localStorage for migration
        try {
            const resp = await fetch('/api/prompts');
            const saved = await resp.json();
            if (saved.folders && saved.folders.length > 0) {
                folders = saved.folders;
                prompts = saved.prompts || [];
                nextId = saved.nextId || Math.max(1, ...folders.map(f => f.id), ...prompts.map(p => p.id)) + 1;
            } else {
                // Try localStorage migration
                const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
                folders = local.folders || [{ id: 1, name: 'General', order: 0 }];
                prompts = local.prompts || [];
                nextId = local.nextId || Math.max(1, ...folders.map(f => f.id), ...prompts.map(p => p.id)) + 1;
                if (folders.length > 0) save(); // migrate to disk
            }
        } catch {
            folders = [{ id: 1, name: 'General', order: 0 }];
            prompts = [];
        }
        const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
        if (s.ollamaUrl) settings.ollamaUrl = s.ollamaUrl;
        if (s.model) settings.model = s.model;
        if (s.systemPrompt) settings.systemPrompt = s.systemPrompt;
    }

    function save() {
        const data = JSON.stringify({ folders, prompts, nextId });
        // Save to disk via API
        fetch('/api/prompts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: data,
        });
        // Also keep localStorage as backup
        localStorage.setItem(STORAGE_KEY, data);
    }

    function saveSettings() {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }

    // ── Render Folders ──
    function renderFolders() {
        const counts = {};
        const doneCounts = {};
        prompts.forEach(p => {
            counts[p.folderId] = (counts[p.folderId] || 0) + 1;
            if (p.done) doneCounts[p.folderId] = (doneCounts[p.folderId] || 0) + 1;
        });
        const totalDone = prompts.filter(p => p.done).length;

        let html = `<div class="folder-item ${activeFolder === 'all' ? 'active' : ''}" data-folder="all">
            <span><i class="bi bi-journal-text"></i> All Prompts</span>
            <span class="folder-count">${totalDone}/${prompts.length}</span>
        </div>`;

        folders.sort((a, b) => a.order - b.order).forEach(f => {
            const total = counts[f.id] || 0;
            const done = doneCounts[f.id] || 0;
            html += `<div class="folder-item ${activeFolder === f.id ? 'active' : ''}" data-folder="${f.id}">
                <span><i class="bi bi-folder2"></i> ${esc(f.name)}</span>
                <div class="d-flex gap-1 align-items-center">
                    <span class="folder-count">${done}/${total}</span>
                    <i class="bi bi-pencil" style="font-size:0.7rem; cursor:pointer; opacity:0.5;" onclick="event.stopPropagation(); renameFolder(${f.id})"></i>
                    <i class="bi bi-trash" style="font-size:0.7rem; cursor:pointer; opacity:0.5; color:var(--bs-danger);" onclick="event.stopPropagation(); deleteFolder(${f.id})"></i>
                </div>
            </div>`;
        });

        document.getElementById('folderList').innerHTML = html;
        document.querySelectorAll('.folder-item').forEach(el => {
            el.addEventListener('click', function () {
                activeFolder = this.dataset.folder === 'all' ? 'all' : parseInt(this.dataset.folder);
                renderFolders();
                renderPrompts();
            });
        });

        // Update header
        if (activeFolder === 'all') {
            document.getElementById('currentFolderName').textContent = 'All Prompts';
        } else {
            const f = folders.find(f => f.id === activeFolder);
            document.getElementById('currentFolderName').textContent = f ? f.name : 'All Prompts';
        }
    }

    // ── Render Progress ──
    function renderProgress() {
        const filtered = activeFolder === 'all'
            ? prompts
            : prompts.filter(p => p.folderId === activeFolder);
        const total = filtered.length;
        const doneCount = filtered.filter(p => p.done).length;
        const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        const bar = document.getElementById('progressBar');

        if (total === 0) {
            bar.classList.add('d-none');
            return;
        }

        bar.classList.remove('d-none');
        bar.innerHTML = `
            <i class="bi bi-check2-circle" style="color: var(--bs-success); font-size: 0.85rem;"></i>
            <div class="progress-bar-wrapper">
                <div class="progress-bar-fill" style="width: ${pct}%"></div>
            </div>
            <span class="progress-info">${doneCount}/${total} done (${pct}%)</span>`;
    }

    // ── Render Prompts ──
    function renderPrompts() {
        const filtered = activeFolder === 'all'
            ? prompts
            : prompts.filter(p => p.folderId === activeFolder);

        filtered.sort((a, b) => a.order - b.order);
        document.getElementById('promptCount').textContent = filtered.length;
        renderProgress();

        if (filtered.length === 0) {
            document.getElementById('promptList').innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-journal-code" style="font-size:3rem;"></i>
                    <p class="mt-2 mb-0">No prompts yet. Click <strong>Add Prompt</strong> to start.</p>
                    <p class="mt-1" style="font-size:0.82rem;">Write your sequential prompts here, then copy them to Claude CLI tomorrow.</p>
                </div>`;
            return;
        }

        document.getElementById('promptList').innerHTML = filtered.map((p, idx) => {
            const charCount = (p.body || '').length;
            const folderName = folders.find(f => f.id === p.folderId)?.name || '';
            const polishingClass = p._polishing ? ' polishing' : '';
            const doneClass = p.done ? ' done' : '';
            const collapsedClass = p._collapsed ? ' collapsed' : '';
            const checkIcon = p.done ? 'bi-check-circle-fill checked' : 'bi-circle unchecked';

            return `<div class="prompt-card${polishingClass}${doneClass}${collapsedClass}" data-id="${p.id}" draggable="true">
                <div class="prompt-header" onclick="toggleCollapse(${p.id}, event)">
                    <div class="d-flex align-items-center gap-2 flex-grow-1">
                        <i class="bi bi-chevron-down collapse-icon"></i>
                        <i class="bi ${checkIcon} done-check" onclick="event.stopPropagation(); toggleDone(${p.id})" title="${p.done ? 'Mark as undone' : 'Mark as done'}"></i>
                        <i class="bi bi-grip-vertical drag-handle" onclick="event.stopPropagation()"></i>
                        <span class="prompt-num">#${idx + 1}</span>
                        <input type="text" class="prompt-title-input" value="${esc(p.title || '')}" placeholder="Prompt title..." data-id="${p.id}" data-field="title" onclick="event.stopPropagation()">
                        ${activeFolder === 'all' && folderName ? `<span class="badge bg-secondary me-2" style="font-size:0.65rem;">${esc(folderName)}</span>` : ''}
                    </div>
                    <div class="d-flex gap-1">
                        <button class="btn btn-outline-warning btn-sm" onclick="polishPrompt(${p.id})" title="Polish via Ollama (Meta-Prompting)"><i class="bi bi-stars"></i></button>
                        <button class="btn btn-outline-success btn-sm" onclick="copyPrompt(${p.id})" title="Copy to clipboard"><i class="bi bi-clipboard"></i></button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="movePrompt(${p.id}, -1)" title="Move up"><i class="bi bi-arrow-up"></i></button>
                        <button class="btn btn-outline-secondary btn-sm" onclick="movePrompt(${p.id}, 1)" title="Move down"><i class="bi bi-arrow-down"></i></button>
                        <button class="btn btn-outline-danger btn-sm" onclick="deletePrompt(${p.id})" title="Delete"><i class="bi bi-trash"></i></button>
                    </div>
                </div>
                <div class="prompt-body">
                    <textarea class="prompt-textarea" data-id="${p.id}" data-field="body" placeholder="Write your prompt here...&#10;&#10;Tip: Write detailed, specific prompts. Use Polish ✨ to improve them via Ollama.">${esc(p.body || '')}</textarea>
                </div>
                ${p.polished ? `
                <div class="polish-result" id="polish-${p.id}"><div class="d-flex justify-content-between align-items-center" style="margin-top:7px; margin-bottom:12px;"><span style="font-size:0.72rem; font-weight:600; color:var(--bs-warning);"><i class="bi bi-stars"></i> Polished Version</span><div class="d-flex gap-1"><button class="btn btn-sm btn-outline-warning py-0 px-1" onclick="rePolish(${p.id})" title="Re-polish this result"><i class="bi bi-arrow-repeat"></i> Re-polish</button><button class="btn btn-sm btn-outline-success py-0 px-1" onclick="acceptPolish(${p.id})" title="Accept — replace original"><i class="bi bi-check-lg"></i> Accept</button><button class="btn btn-sm btn-outline-secondary py-0 px-1" onclick="copyPolished(${p.id})" title="Copy polished"><i class="bi bi-clipboard"></i></button><button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="dismissPolish(${p.id})" title="Dismiss"><i class="bi bi-x-lg"></i></button></div></div><div class="polish-content">${esc(p.polished.trim())}</div></div>` : `<div id="polish-${p.id}"></div>`}
                <div class="prompt-footer">
                    <span class="char-count">${charCount.toLocaleString()} chars</span>
                    <div class="d-flex gap-1 align-items-center">
                        ${activeFolder === 'all' ? `
                        <select class="form-select form-select-sm py-0" style="font-size:0.72rem; width:auto;" data-id="${p.id}" data-field="folder">
                            ${folders.map(f => `<option value="${f.id}" ${f.id === p.folderId ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
                        </select>` : ''}
                    </div>
                </div>
            </div>`;
        }).join('');

        bindPromptEvents();
    }

    function bindPromptEvents() {
        // Auto-save on input
        document.querySelectorAll('.prompt-title-input, .prompt-textarea').forEach(el => {
            el.addEventListener('input', function () {
                const p = prompts.find(p => p.id === parseInt(this.dataset.id));
                if (p) {
                    p[this.dataset.field] = this.value;
                    save();
                    // Update char count
                    if (this.dataset.field === 'body') {
                        const footer = this.closest('.prompt-card').querySelector('.char-count');
                        if (footer) footer.textContent = this.value.length.toLocaleString() + ' chars';
                    }
                }
            });
        });

        // Folder change
        document.querySelectorAll('select[data-field="folder"]').forEach(el => {
            el.addEventListener('change', function () {
                const p = prompts.find(p => p.id === parseInt(this.dataset.id));
                if (p) {
                    p.folderId = parseInt(this.value);
                    save();
                    renderFolders();
                }
            });
        });

        // Drag and drop for reorder
        document.querySelectorAll('.prompt-card[draggable]').forEach(card => {
            card.addEventListener('dragstart', function (e) {
                draggedPromptId = parseInt(this.dataset.id);
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', function () {
                this.classList.remove('dragging');
                draggedPromptId = null;
            });
            card.addEventListener('dragover', function (e) {
                e.preventDefault();
                if (draggedPromptId === null) return;
                const targetId = parseInt(this.dataset.id);
                if (targetId === draggedPromptId) return;
                this.style.borderTop = '2px solid var(--bs-primary)';
            });
            card.addEventListener('dragleave', function () {
                this.style.borderTop = '';
            });
            card.addEventListener('drop', function (e) {
                e.preventDefault();
                this.style.borderTop = '';
                if (draggedPromptId === null) return;
                const targetId = parseInt(this.dataset.id);
                reorderPrompt(draggedPromptId, targetId);
            });
        });

        // Auto-resize textareas
        document.querySelectorAll('.prompt-textarea').forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = Math.max(120, ta.scrollHeight) + 'px';
            ta.addEventListener('input', function () {
                this.style.height = 'auto';
                this.style.height = Math.max(120, this.scrollHeight) + 'px';
            });
        });
    }

    function reorderPrompt(draggedId, targetId) {
        const filtered = activeFolder === 'all' ? prompts : prompts.filter(p => p.folderId === activeFolder);
        const dragIdx = filtered.findIndex(p => p.id === draggedId);
        const targetIdx = filtered.findIndex(p => p.id === targetId);
        if (dragIdx === -1 || targetIdx === -1) return;

        // Reorder
        filtered.forEach((p, i) => p.order = i);
        const dragged = filtered[dragIdx];
        filtered.splice(dragIdx, 1);
        filtered.splice(targetIdx, 0, dragged);
        filtered.forEach((p, i) => p.order = i);
        save();
        renderPrompts();
    }

    // ── CRUD ──
    document.getElementById('addPromptBtn').addEventListener('click', function () {
        const folderId = activeFolder === 'all' ? (folders[0]?.id || 1) : activeFolder;
        const maxOrder = prompts.filter(p => p.folderId === folderId).reduce((m, p) => Math.max(m, p.order), -1);
        prompts.push({
            id: nextId++,
            folderId,
            title: '',
            body: '',
            polished: '',
            done: false,
            order: maxOrder + 1,
            createdAt: new Date().toISOString(),
        });
        save();
        renderPrompts();
        renderFolders();
        // Focus new prompt
        setTimeout(() => {
            const cards = document.querySelectorAll('.prompt-textarea');
            if (cards.length > 0) {
                const last = cards[cards.length - 1];
                last.focus();
                last.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    });

    window.toggleCollapse = function (id, event) {
        // Don't collapse when clicking buttons inside header
        if (event.target.closest('button') || event.target.closest('input')) return;
        const p = prompts.find(p => p.id === id);
        if (p) {
            p._collapsed = !p._collapsed;
            const card = document.querySelector(`.prompt-card[data-id="${id}"]`);
            if (card) card.classList.toggle('collapsed');
        }
    };

    window.toggleDone = function (id) {
        const p = prompts.find(p => p.id === id);
        if (!p) return;
        p.done = !p.done;
        save();
        renderPrompts();
        renderFolders();
    };

    window.deletePrompt = function (id) {
        prompts = prompts.filter(p => p.id !== id);
        save();
        renderPrompts();
        renderFolders();
    };

    window.movePrompt = function (id, dir) {
        const filtered = activeFolder === 'all' ? [...prompts] : prompts.filter(p => p.folderId === activeFolder);
        filtered.sort((a, b) => a.order - b.order);
        const idx = filtered.findIndex(p => p.id === id);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= filtered.length) return;
        // Swap orders
        const tmp = filtered[idx].order;
        filtered[idx].order = filtered[newIdx].order;
        filtered[newIdx].order = tmp;
        save();
        renderPrompts();
    };

    // ── Copy ──
    window.copyPrompt = function (id) {
        const p = prompts.find(p => p.id === id);
        if (!p) return;
        const text = p.body || '';
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector(`.prompt-card[data-id="${id}"] .btn-outline-success`);
            if (btn) {
                btn.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
                setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
            }
        });
    };

    window.copyPolished = function (id) {
        const p = prompts.find(p => p.id === id);
        if (p?.polished) navigator.clipboard.writeText(p.polished);
    };

    document.getElementById('copyAllBtn').addEventListener('click', function () {
        const filtered = activeFolder === 'all' ? prompts : prompts.filter(p => p.folderId === activeFolder);
        filtered.sort((a, b) => a.order - b.order);

        const text = filtered.map((p, i) => {
            const title = p.title ? ` — ${p.title}` : '';
            const body = p.polished || p.body || '';
            return `### Prompt #${i + 1}${title}\n\n${body}`;
        }).join('\n\n---\n\n');

        navigator.clipboard.writeText(text).then(() => {
            const btn = this;
            btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied!';
            setTimeout(() => { btn.innerHTML = '<i class="bi bi-clipboard2-check"></i> Copy All'; }, 2000);
        });
    });

    // ── Polish via Ollama (Meta-Prompting) ──
    window.polishPrompt = async function (id) {
        const p = prompts.find(p => p.id === id);
        if (!p || !p.body.trim()) return;

        const polishDiv = document.getElementById('polish-' + id);
        const card = document.querySelector(`.prompt-card[data-id="${id}"]`);
        if (!polishDiv || !card) return;

        card.classList.add('polishing');
        polishDiv.innerHTML = '<div class="polish-result polish-streaming"><span style="font-size:0.72rem; font-weight:600; color:var(--bs-warning);"><i class="bi bi-stars"></i> Polishing via Ollama...</span><div class="polish-content" id="polish-stream-' + id + '"></div></div>';

        const systemPrompt = settings.systemPrompt.replace('{prompt}', p.body);

        try {
            const response = await fetch('/api/aichat/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ollamaUrl: settings.ollamaUrl,
                    model: settings.model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: p.body },
                    ],
                }),
            });

            if (!response.ok) {
                polishDiv.innerHTML = `<div class="polish-result text-danger"><i class="bi bi-exclamation-triangle"></i> Failed: ${response.statusText}. Check Ollama settings.</div>`;
                card.classList.remove('polishing');
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let result = '';
            const streamEl = document.getElementById('polish-stream-' + id);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.message?.content || data.content || '';
                            if (content) {
                                result += content;
                                if (streamEl) streamEl.textContent = result;
                            }
                        } catch {}
                    }
                }
            }

            // Save polished result
            p.polished = result.trim();
            save();
            card.classList.remove('polishing');
            renderPrompts();

        } catch (err) {
            polishDiv.innerHTML = `<div class="polish-result text-danger"><i class="bi bi-exclamation-triangle"></i> Error: ${esc(err.message)}. Is Ollama running?</div>`;
            card.classList.remove('polishing');
        }
    };

    window.acceptPolish = function (id) {
        const p = prompts.find(p => p.id === id);
        if (p && p.polished) {
            p.body = p.polished;
            p.polished = '';
            save();
            renderPrompts();
        }
    };

    window.rePolish = function (id) {
        const p = prompts.find(p => p.id === id);
        if (p && p.polished) {
            // Use the polished version as input for another round
            const originalBody = p.body;
            p.body = p.polished;
            p.polished = '';
            save();
            polishPrompt(id).then(() => {
                // Restore original body (polished is now the re-polished version)
                p.body = originalBody;
                save();
                renderPrompts();
            });
        }
    };

    window.dismissPolish = function (id) {
        const p = prompts.find(p => p.id === id);
        if (p) {
            p.polished = '';
            save();
            renderPrompts();
        }
    };

    // Polish All
    document.getElementById('polishAllBtn').addEventListener('click', async function () {
        const filtered = activeFolder === 'all' ? prompts : prompts.filter(p => p.folderId === activeFolder);
        for (const p of filtered) {
            if (p.body.trim()) {
                await polishPrompt(p.id);
            }
        }
    });

    // Delete All
    document.getElementById('deleteAllBtn').addEventListener('click', function () {
        const folderName = activeFolder === 'all' ? 'all folders' : (folders.find(f => f.id === activeFolder)?.name || 'this folder');
        const count = activeFolder === 'all' ? prompts.length : prompts.filter(p => p.folderId === activeFolder).length;
        if (count === 0) return;
        if (!confirm(`Delete all ${count} prompt(s) in "${folderName}"?`)) return;
        if (activeFolder === 'all') {
            prompts = [];
        } else {
            prompts = prompts.filter(p => p.folderId !== activeFolder);
        }
        save();
        renderFolders();
        renderPrompts();
    });

    // ── Folders ──
    document.getElementById('addFolderBtn').addEventListener('click', function () {
        const name = prompt('Folder name:');
        if (!name || !name.trim()) return;
        folders.push({ id: nextId++, name: name.trim(), order: folders.length });
        save();
        renderFolders();
    });

    window.renameFolder = function (id) {
        const f = folders.find(f => f.id === id);
        if (!f) return;
        const name = prompt('Rename folder:', f.name);
        if (!name || !name.trim()) return;
        f.name = name.trim();
        save();
        renderFolders();
    };

    window.deleteFolder = function (id) {
        if (folders.length <= 1) return;
        if (!confirm('Delete this folder? Prompts inside will be moved to the first folder.')) return;
        const targetFolder = folders.find(f => f.id !== id)?.id;
        prompts.filter(p => p.folderId === id).forEach(p => p.folderId = targetFolder);
        folders = folders.filter(f => f.id !== id);
        if (activeFolder === id) activeFolder = 'all';
        save();
        renderFolders();
        renderPrompts();
    };

    // ── Ollama Status & Settings ──
    async function checkOllama() {
        try {
            const resp = await fetch(`/api/aichat/version?url=${encodeURIComponent(settings.ollamaUrl)}`);
            if (resp.ok) {
                document.getElementById('ollamaDot').classList.replace('offline', 'online');
                loadModels();
            }
        } catch {
            document.getElementById('ollamaDot').classList.replace('online', 'offline');
        }
    }

    async function loadModels() {
        try {
            const resp = await fetch(`/api/aichat/models?url=${encodeURIComponent(settings.ollamaUrl)}`);
            const data = await resp.json();
            const models = data.models || [];
            const sel = document.getElementById('ollamaModel');
            sel.innerHTML = models.map(m => `<option value="${m.name}" ${m.name === settings.model ? 'selected' : ''}>${m.name}</option>`).join('');
            if (!settings.model && models.length > 0) {
                settings.model = models[0].name;
                saveSettings();
            }
        } catch {}
    }

    document.getElementById('ollamaSettings').addEventListener('click', function () {
        document.getElementById('ollamaUrl').value = settings.ollamaUrl;
        document.getElementById('polishSystemPrompt').value = settings.systemPrompt;
        loadModels();
        new bootstrap.Modal(document.getElementById('ollamaModal')).show();
    });

    document.getElementById('saveOllamaSettings').addEventListener('click', function () {
        settings.ollamaUrl = document.getElementById('ollamaUrl').value.trim() || 'http://localhost:11434';
        settings.model = document.getElementById('ollamaModel').value;
        settings.systemPrompt = document.getElementById('polishSystemPrompt').value;
        saveSettings();
        checkOllama();
        bootstrap.Modal.getInstance(document.getElementById('ollamaModal')).hide();
    });

    // ── Export / Import ──
    document.getElementById('exportBtn').addEventListener('click', function () {
        const data = { folders, prompts, exportedAt: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.download = 'prompt-notebook.json';
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
    });

    document.getElementById('importFile').addEventListener('change', function () {
        const f = this.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (data.folders) data.folders.forEach(f => { f.id = nextId++; folders.push(f); });
                if (data.prompts) data.prompts.forEach(p => { p.id = nextId++; prompts.push(p); });
                save();
                renderFolders();
                renderPrompts();
            } catch (err) {
                alert('Invalid JSON file: ' + err.message);
            }
        };
        reader.readAsText(f); this.value = '';
    });

    // ── Sample Data ──
    const sampleSets = {
        ecommerce: {
            folder: 'E-Commerce App',
            prompts: [
                { title: 'Step 1 — Project Setup', body: 'I want to create a new React project for an E-Commerce storefront.\n\nRequirements:\n- React 19 with TypeScript\n- Next.js App Router for SSR\n- Tailwind CSS for styling\n- Zustand for state management\n- Folder structure following best practices (feature-based)\n- Setup ESLint, Prettier, and Husky pre-commit hooks\n\nPlease create the project structure and initial setup.' },
                { title: 'Step 2 — Product Catalog', body: 'Now create the Product Catalog feature:\n\n- product.types.ts — interface Product (id, name, slug, description, price, images, category, stock, rating)\n- Product listing page with grid/list toggle\n- Product detail page with image gallery\n- Category sidebar with filter\n- Search bar with debounce\n- Pagination (infinite scroll)\n\nUse server components where possible. Fetch from API: GET /api/products' },
                { title: 'Step 3 — Shopping Cart', body: 'Create Shopping Cart functionality:\n\n- Cart context/store using Zustand (add, remove, update quantity, clear)\n- Cart drawer/sidebar that slides in from right\n- Cart icon in navbar with item count badge\n- Cart page with full item list, quantity controls, subtotal\n- Persist cart in localStorage\n- Apply coupon code feature (validate via POST /api/coupons/validate)\n\nCalculate: subtotal, discount, shipping (free above $50), tax (10%), total.' },
                { title: 'Step 4 — Checkout Flow', body: 'Create a multi-step Checkout flow:\n\nStep 1: Shipping address form (name, address, city, zip, country)\nStep 2: Shipping method selection (Standard $5, Express $15, Free above $50)\nStep 3: Payment method (Credit Card form with validation, or PayPal button)\nStep 4: Order review and confirm\n\nRequirements:\n- React Hook Form with Zod validation\n- Progress indicator showing current step\n- Save shipping address for returning customers\n- Order confirmation page with order number\n- POST /api/orders to create order' },
                { title: 'Step 5 — User Dashboard', body: 'Create User Dashboard with these pages:\n\n- Order History — list of past orders with status (Pending, Shipped, Delivered, Cancelled)\n- Order Detail — timeline view of order status, items, shipping tracking\n- Profile Settings — edit name, email, password, avatar\n- Address Book — manage multiple shipping addresses (CRUD)\n- Wishlist — save products for later, move to cart\n\nUse Next.js layouts for shared sidebar navigation. All pages require authentication — redirect to /login if not authenticated.' },
            ]
        },
        restapi: {
            folder: 'REST API Backend',
            prompts: [
                { title: 'Step 1 — Project Init', body: 'Create a Node.js REST API project with the following setup:\n\n- Express.js with TypeScript\n- PostgreSQL with Prisma ORM\n- JWT authentication (access + refresh tokens)\n- Folder structure: src/routes, src/controllers, src/services, src/middleware, src/prisma\n- Environment config with dotenv\n- Error handling middleware\n- Request validation with Zod\n- Logger with Pino\n\nGenerate the project skeleton with package.json, tsconfig.json, and Prisma schema.' },
                { title: 'Step 2 — Auth Module', body: 'Build the Authentication module:\n\n- POST /api/auth/register — email, password, name. Hash password with bcrypt.\n- POST /api/auth/login — return access token (15min) + refresh token (7d)\n- POST /api/auth/refresh — rotate refresh token\n- POST /api/auth/logout — invalidate refresh token\n- GET /api/auth/me — return current user profile\n\nMiddleware: authGuard that verifies JWT and attaches user to req.\nStore refresh tokens in database with device info.' },
                { title: 'Step 3 — CRUD Resources', body: 'Create a generic CRUD pattern, then implement for these resources:\n\n1. Products — name, description, price, category, images[], stock\n2. Categories — name, slug, parentId (nested categories)\n3. Orders — userId, items[], total, status (pending/paid/shipped/delivered)\n\nEach resource needs:\n- Full CRUD endpoints (GET list with pagination/filter/sort, GET by ID, POST, PUT, DELETE)\n- Input validation with Zod schemas\n- Service layer (business logic separated from controllers)\n- Proper error responses (400, 404, 409, 500)' },
                { title: 'Step 4 — Advanced Features', body: 'Add these advanced features to the API:\n\n1. File Upload — multer + S3 (or local storage), image resize with Sharp\n2. Email Service — nodemailer with templates (welcome, order confirmation, password reset)\n3. Rate Limiting — express-rate-limit, stricter on auth routes\n4. Caching — Redis for frequently accessed data (product listings, categories)\n5. Search — full-text search on products using PostgreSQL tsvector\n6. Webhooks — POST /api/webhooks/payment for payment provider callbacks\n\nKeep everything modular and testable.' },
                { title: 'Step 5 — Testing & Docs', body: 'Add comprehensive testing and documentation:\n\n1. Unit tests with Vitest for services and utils\n2. Integration tests for API endpoints using supertest\n3. Test database setup (separate .env.test, auto-migrate before tests)\n4. API documentation with Swagger/OpenAPI using @asteasolutions/zod-to-openapi\n5. Seed script to populate database with sample data\n6. Docker Compose file for local development (app, postgres, redis)\n7. CI pipeline config (GitHub Actions: lint, test, build)\n\nAim for >80% code coverage on services.' },
            ]
        },
        mobile: {
            folder: 'Mobile App (Flutter)',
            prompts: [
                { title: 'Step 1 — Flutter Setup', body: 'Create a new Flutter project for a Task Management app:\n\n- Flutter 3.x with Dart\n- State management: Riverpod 2.0\n- Navigation: GoRouter\n- Local storage: Hive or Isar\n- HTTP client: Dio with interceptors\n- Folder structure: lib/features/, lib/core/, lib/shared/\n- Theme: Material 3 with custom color scheme (light + dark)\n\nSetup the project with proper folder structure and initial dependencies.' },
                { title: 'Step 2 — Auth Screens', body: 'Create Authentication screens:\n\n- Splash screen with app logo (check saved token)\n- Login screen — email + password, "Remember me", forgot password link\n- Register screen — name, email, password, confirm password\n- Forgot Password — email input, send reset link\n- Form validation with real-time feedback\n- Biometric login option (fingerprint/face ID) using local_auth\n- Save auth token securely with flutter_secure_storage\n\nUse clean architecture pattern: presentation → domain → data layers.' },
                { title: 'Step 3 — Task Board', body: 'Create the main Task Board screen:\n\n- Kanban view with 3 columns: To Do, In Progress, Done\n- Drag and drop tasks between columns\n- Task card shows: title, priority color, assignee avatar, due date\n- Pull to refresh\n- FAB to create new task\n- Bottom sheet for quick task creation (title + priority only)\n- Swipe actions: swipe right = complete, swipe left = delete\n\nSync with REST API but also work offline (queue changes, sync when online).' },
                { title: 'Step 4 — Task Detail & Notifications', body: 'Create Task Detail screen and Push Notifications:\n\nTask Detail:\n- Edit title, description (rich text with markdown)\n- Set priority (Low, Medium, High, Urgent) with color coding\n- Assign to team members (avatar picker)\n- Due date/time picker\n- Subtasks checklist (add, toggle, delete)\n- Comments section with timestamps\n- Activity log (who changed what)\n\nNotifications:\n- Firebase Cloud Messaging setup\n- Local notifications for due date reminders\n- Notification settings screen (toggle per type)' },
                { title: 'Step 5 — Polish & Release', body: 'Final polish and release preparation:\n\n1. App icon and splash screen (flutter_native_splash, flutter_launcher_icons)\n2. Onboarding screens (3 pages with illustrations, skip button)\n3. Settings page — theme toggle, language, notification preferences, logout\n4. Performance optimization — lazy loading, image caching, list optimization\n5. Error handling — global error boundary, offline mode indicator, retry buttons\n6. Analytics — Firebase Analytics events for key user actions\n7. Build configs — separate flavors for dev/staging/production\n8. Generate signed APK and App Bundle for Play Store' },
            ]
        },
        devops: {
            folder: 'DevOps Pipeline',
            prompts: [
                { title: 'Step 1 — Dockerize App', body: 'Create Docker setup for a full-stack app (React frontend + Node.js API + PostgreSQL):\n\n- Dockerfile for frontend (multi-stage: build with Node, serve with Nginx)\n- Dockerfile for backend (multi-stage: build TypeScript, run with Node slim)\n- docker-compose.yml for local development (hot reload for both)\n- docker-compose.prod.yml for production\n- .dockerignore files\n- Health check endpoints\n- Environment variable handling (no secrets in images)\n\nOptimize for small image size and fast builds.' },
                { title: 'Step 2 — CI/CD Pipeline', body: 'Create GitHub Actions CI/CD pipeline:\n\nOn Pull Request:\n- Lint (ESLint + Prettier check)\n- Unit tests with coverage report\n- Build check (TypeScript compile)\n- Security scan (npm audit, Snyk or Trivy)\n- Comment PR with test coverage diff\n\nOn merge to main:\n- Build Docker images\n- Push to GitHub Container Registry (ghcr.io)\n- Tag with git SHA and "latest"\n- Deploy to staging automatically\n\nOn release tag (v*):\n- Build production images\n- Deploy to production with approval gate' },
                { title: 'Step 3 — Kubernetes Manifests', body: 'Create Kubernetes deployment manifests:\n\n- Namespace: myapp-staging, myapp-production\n- Deployments: frontend (2 replicas), backend (3 replicas), worker (1 replica)\n- Services: ClusterIP for internal, LoadBalancer for frontend\n- Ingress with TLS (cert-manager + Let\'s Encrypt)\n- ConfigMaps for non-sensitive config\n- Secrets (reference from external secrets operator)\n- HPA (Horizontal Pod Autoscaler) for backend: min 3, max 10, target CPU 70%\n- PDB (Pod Disruption Budget): minAvailable 1\n- Resource requests and limits for all containers\n\nUse Kustomize for environment overlays (staging vs production).' },
                { title: 'Step 4 — Monitoring & Alerting', body: 'Set up monitoring and alerting stack:\n\n1. Prometheus — scrape metrics from app (/metrics endpoint) and K8s\n2. Grafana dashboards:\n   - Application: request rate, latency (p50/p95/p99), error rate, active users\n   - Infrastructure: CPU, memory, disk, network per pod\n   - Database: query duration, connections, cache hit ratio\n3. Alert rules:\n   - Error rate > 5% for 5 minutes\n   - P99 latency > 2 seconds\n   - Pod restart count > 3 in 10 minutes\n   - Disk usage > 80%\n4. Alert routing: Slack for warnings, PagerDuty for critical\n5. Loki for centralized logging (ship with Promtail)\n\nProvide Helm values files and Grafana dashboard JSON.' },
            ]
        },
        refactor: {
            folder: 'Code Refactoring',
            prompts: [
                { title: 'Step 1 — Analyze Current Code', body: 'Please analyze this codebase and identify areas that need refactoring:\n\n1. Code smells — duplicated logic, god classes, long methods, deep nesting\n2. Architecture issues — circular dependencies, tight coupling, missing abstraction layers\n3. Performance concerns — N+1 queries, unnecessary re-renders, missing indexes\n4. Security issues — SQL injection risks, XSS, hardcoded secrets, missing input validation\n5. Test coverage gaps — untested critical paths, missing edge cases\n\nFor each issue found, rate severity (High/Medium/Low) and estimate effort to fix.\nPresent as a prioritized table with: Issue, Location, Severity, Effort, Recommendation.' },
                { title: 'Step 2 — Extract Shared Logic', body: 'Refactor duplicated code into shared utilities:\n\n1. Identify all duplicated patterns across the codebase\n2. Create shared utility functions/classes with proper typing\n3. Replace all duplicate instances with the shared version\n4. Ensure backward compatibility — existing behavior must not change\n5. Add unit tests for each new shared utility\n\nPrinciples:\n- DRY but don\'t over-abstract (Rule of Three)\n- Each utility should have a single responsibility\n- Use generics where it makes sense for flexibility\n- Document with JSDoc comments including examples' },
                { title: 'Step 3 — Improve Error Handling', body: 'Refactor error handling across the application:\n\n1. Create a custom error hierarchy (AppError → ValidationError, NotFoundError, AuthError, etc.)\n2. Implement global error handler middleware that maps errors to HTTP responses\n3. Replace all try/catch blocks with consistent patterns\n4. Add proper error logging with context (request ID, user ID, stack trace)\n5. User-facing errors should be friendly messages, not stack traces\n6. Add error boundary components on the frontend\n7. Implement retry logic for transient failures (network, database timeouts)\n\nMake sure no sensitive information leaks in error responses (production mode).' },
                { title: 'Step 4 — Optimize Performance', body: 'Optimize application performance:\n\nBackend:\n- Add database query optimization (indexes, eager loading, query analysis)\n- Implement caching layer (Redis) for hot paths\n- Add pagination to all list endpoints\n- Optimize file uploads (streaming, compression)\n- Add database connection pooling\n\nFrontend:\n- Code splitting and lazy loading for routes\n- Image optimization (lazy load, WebP, srcset)\n- Memoization of expensive computations\n- Virtual scrolling for long lists\n- Bundle size analysis and tree shaking\n\nMeasure before and after with benchmarks.' },
            ]
        },
        bugfix: {
            folder: 'Bug Investigation',
            prompts: [
                { title: 'Step 1 — Reproduce & Analyze', body: 'I have a bug report:\n\n[Paste bug description here]\n\nPlease help me:\n1. Identify possible root causes based on the symptoms\n2. List the files/functions most likely involved\n3. Suggest specific debug steps (console logs, breakpoints, network inspection)\n4. What edge cases could trigger this behavior?\n5. Is this a regression? What recent changes could have caused it?\n\nThink through this systematically — don\'t jump to conclusions.' },
                { title: 'Step 2 — Implement Fix', body: 'Based on our analysis, the root cause is:\n\n[Paste findings here]\n\nPlease implement the fix with these constraints:\n1. Minimal changes — only fix the bug, don\'t refactor surrounding code\n2. Add a comment explaining WHY this fix works (not what it does)\n3. Consider backward compatibility\n4. Handle the edge case that caused this bug\n5. Make sure the fix doesn\'t introduce new issues\n\nShow me the diff of what needs to change.' },
                { title: 'Step 3 — Write Tests', body: 'Write tests to prevent this bug from recurring:\n\n1. Test that reproduces the exact bug scenario (should have failed before fix)\n2. Test for the edge case that triggered the bug\n3. Test for related edge cases that might have similar issues\n4. If applicable, add integration test for the full user flow\n\nTest naming convention: "should [expected behavior] when [condition]"\nMake sure all tests pass with the fix applied.' },
            ]
        },
        landingpage: {
            folder: 'Landing Page (Next.js)',
            prompts: [
                { title: 'Step 1 — Project Setup & Layout', body: 'Create a modern Landing Page project with Next.js:\n\n- Next.js 15 with App Router and TypeScript\n- Tailwind CSS v4 + shadcn/ui components\n- Folder structure: app/, components/sections/, components/ui/, lib/, public/\n- Layout: sticky navbar (logo + nav links + CTA button), footer with columns\n- Mobile-responsive hamburger menu\n- Smooth scroll to sections\n- SEO: metadata, Open Graph tags, sitemap.xml, robots.txt\n\nCreate the project skeleton with all config files.' },
                { title: 'Step 2 — Hero & Features Section', body: 'Create the Hero section and Features section:\n\nHero:\n- Big headline with gradient text animation\n- Subheadline (1-2 sentences)\n- Two CTA buttons: primary "Get Started" + secondary "Watch Demo"\n- Hero image or illustration on the right (use placeholder)\n- Trust badges row below (e.g., "Trusted by 10,000+ developers")\n- Subtle background animation (gradient mesh or particles)\n\nFeatures:\n- Section heading + subtitle\n- 6 feature cards in 3x2 grid\n- Each card: icon, title, description\n- Hover effect with subtle elevation\n- Animate on scroll using Intersection Observer or Framer Motion' },
                { title: 'Step 3 — Social Proof & Pricing', body: 'Create Social Proof and Pricing sections:\n\nTestimonials:\n- Carousel/slider with 6 testimonials\n- Each: avatar, name, role, company, quote, star rating\n- Auto-play with pause on hover\n- Logos bar: "Used by teams at" + company logo grid (grayscale, color on hover)\n\nPricing:\n- 3-tier pricing cards: Free, Pro ($19/mo), Enterprise (Custom)\n- Monthly/Annual toggle (annual = 20% discount, show savings badge)\n- Feature comparison checklist per tier\n- Highlight "Most Popular" tier\n- CTA button per tier\n- FAQ accordion below (6-8 common questions)' },
                { title: 'Step 4 — CTA, Newsletter & Footer', body: 'Create the final sections:\n\nCTA Section:\n- Full-width gradient background\n- Big heading: "Ready to get started?"\n- Subtext + primary CTA button\n- Optional: show a mini product screenshot\n\nNewsletter:\n- Email input + subscribe button\n- "Join 5,000+ subscribers" social proof\n- Success/error state handling\n- Connect to API route: POST /api/subscribe\n\nFooter:\n- 4 columns: Product, Company, Resources, Legal\n- Social media icons row\n- Copyright + language selector\n- Back to top button\n\nAlso add:\n- Cookie consent banner\n- Analytics setup (Google Analytics or Plausible)' },
                { title: 'Step 5 — Animations & Performance', body: 'Polish the landing page for production:\n\nAnimations:\n- Scroll-triggered fade-in/slide-up for each section (Framer Motion or CSS)\n- Navbar: transparent → solid background on scroll\n- Number counter animation for stats (e.g., "10,000+" counts up)\n- Smooth page transitions\n- Micro-interactions on buttons and cards\n\nPerformance:\n- Optimize images: next/image with WebP, lazy loading, blur placeholder\n- Font optimization: next/font with display swap\n- Lighthouse audit — aim for 95+ on all metrics\n- Preload critical assets\n- Bundle analysis with @next/bundle-analyzer\n\nAccessibility:\n- ARIA labels on interactive elements\n- Keyboard navigation for all sections\n- Color contrast ratio check (WCAG AA)\n- Screen reader testing' },
            ]
        },
        clitool: {
            folder: 'CLI Tool (Go)',
            prompts: [
                { title: 'Step 1 — Project Scaffold', body: 'Create a CLI tool in Go for managing developer environment configs (dotfiles, tool versions, shell aliases):\n\n- Go 1.22+ with modules\n- CLI framework: cobra (commands + subcommands + flags)\n- Config file: YAML (~/.devenv/config.yaml) parsed with viper\n- Folder structure: cmd/ (commands), internal/ (business logic), pkg/ (reusable)\n- Makefile with build, test, lint, install targets\n- goreleaser config for cross-platform releases\n\nCommands to implement:\n- devenv init — initialize config\n- devenv status — show current environment\n- devenv sync — sync configs\n- devenv --version, --help\n\nCreate the project skeleton.' },
                { title: 'Step 2 — Core Commands', body: 'Implement the core commands:\n\n`devenv init`:\n- Interactive prompts (survey library) asking: shell type, preferred editor, Git config\n- Generate ~/.devenv/config.yaml with answers\n- Create backup of existing dotfiles before overwriting\n\n`devenv status`:\n- Display table (tablewriter) showing: tool name, current version, latest version, status (up to date / outdated)\n- Check: Go, Node.js, Python, Docker, Git versions\n- Color-coded output: green = current, yellow = outdated, red = missing\n- Show shell: bash/zsh/fish, OS, architecture\n\n`devenv list`:\n- List all managed configs and their sync status\n- Show last sync timestamp\n- Flag conflicts (local changes vs remote)' },
                { title: 'Step 3 — Sync & Backup', body: 'Implement sync and backup functionality:\n\n`devenv sync`:\n- Read config.yaml for list of dotfiles to manage\n- Symlink strategy: original files backed up, symlinks point to ~/.devenv/files/\n- Detect changes: compare checksums (SHA256) of local vs managed versions\n- Interactive conflict resolution: show diff, ask keep local/keep managed/merge\n- Support .gitignore-style exclude patterns\n\n`devenv backup`:\n- Create timestamped tar.gz of all managed dotfiles\n- Store in ~/.devenv/backups/ (keep last 10)\n- `devenv backup restore [timestamp]` to restore specific backup\n\n`devenv diff [file]`:\n- Show colored diff between local and managed version\n- If no file specified, show all changed files\n\nAll operations should be atomic — use temp files and rename.' },
                { title: 'Step 4 — Git Integration & Templates', body: 'Add Git sync and template features:\n\n`devenv git init`:\n- Initialize ~/.devenv/ as a Git repo\n- Auto-generate .gitignore (exclude backups, secrets)\n- Setup remote: prompt for GitHub repo URL\n\n`devenv git push` / `devenv git pull`:\n- Push/pull managed dotfiles to/from remote\n- Auto-commit with message: "sync: [timestamp] [hostname]"\n- Handle merge conflicts gracefully\n\n`devenv template [name]`:\n- Built-in templates: minimal, full-stack, devops, data-science\n- Each template includes curated set of aliases, configs, tool versions\n- `devenv template list` — show available templates\n- `devenv template apply [name]` — apply template (merge with existing config)\n- Custom templates: `devenv template save [name]` — save current config as template\n\nStore templates as embedded Go files (embed.FS).' },
                { title: 'Step 5 — Testing & Release', body: 'Add tests, documentation, and release pipeline:\n\nTesting:\n- Unit tests for all internal packages (>80% coverage)\n- Integration tests using testscript (txtar format)\n- Test fixtures for different OS/shell combinations\n- Mock filesystem for backup/restore tests\n- `make test` runs all tests with race detector\n\nDocumentation:\n- README.md with installation, quick start, full command reference\n- Man page generation from cobra commands\n- `devenv help [command]` with examples for each command\n- Shell completion scripts: bash, zsh, fish (cobra built-in)\n\nRelease:\n- goreleaser config: build for linux/mac/windows (amd64 + arm64)\n- GitHub Actions: test on PR, release on tag\n- Homebrew formula generation\n- Checksums + signing\n- CHANGELOG.md generation from conventional commits' },
            ]
        },
        chromeext: {
            folder: 'Chrome Extension',
            prompts: [
                { title: 'Step 1 — Extension Scaffold', body: 'Create a Chrome Extension (Manifest V3) for a "Dev Productivity Toolkit":\n\n- Manifest V3 with TypeScript\n- Build tool: Vite + CRXJS plugin (hot reload in dev)\n- Structure: src/popup/, src/content/, src/background/, src/options/, src/utils/\n- UI framework: React 19 + Tailwind CSS for popup and options page\n- Storage: chrome.storage.sync for settings, chrome.storage.local for data\n- Permissions: activeTab, storage, contextMenus, notifications\n\nFeatures overview:\n- Popup with quick tools (JSON format, Base64, UUID, color picker)\n- Context menu: right-click selected text for quick actions\n- Options page for customization\n\nCreate the project with all config files and build scripts.' },
                { title: 'Step 2 — Popup UI & Quick Tools', body: 'Build the popup interface with quick developer tools:\n\nPopup (400x500px):\n- Tab bar: Tools | History | Settings\n- Tools tab:\n  - JSON Formatter: paste JSON → pretty print with syntax highlighting\n  - Base64: encode/decode text\n  - UUID Generator: click to generate, auto-copy\n  - Color Picker: eyedropper tool (EyeDropper API) + HEX/RGB/HSL\n  - Timestamp: current Unix timestamp + converter\n  - Lorem Ipsum: generate placeholder text\n  - Hash: quick MD5/SHA256 of input text\n- Each tool: input → output → copy button\n- History tab: last 20 operations with re-use\n- Keyboard shortcut: Alt+D to open popup\n\nUse compact design — every pixel matters in a popup.' },
                { title: 'Step 3 — Content Script & Context Menu', body: 'Build content script and context menu integrations:\n\nContext Menu (right-click on selected text):\n- "Format as JSON" — format and show in overlay\n- "Encode Base64" / "Decode Base64"\n- "Generate QR Code" — show QR code overlay for selected text/URL\n- "Copy as Markdown Link" — if text is a URL\n- "Look up on MDN" — open MDN search for selected text\n- "Color Preview" — if selected text is a color code, show preview\n\nContent Script:\n- Floating toolbar: appears when text is selected on any page\n- Mini buttons: Copy, Base64, JSON format, Search\n- Inject CSS carefully — use Shadow DOM to avoid conflicts with page styles\n- Page analysis: detect JSON responses, offer to pretty-print\n- Auto-detect: if page is a raw JSON response, auto-format it\n\nAll overlays should be draggable and dismissible.' },
                { title: 'Step 4 — Options & Sync', body: 'Build the options page and cross-device sync:\n\nOptions Page (full page, opens in new tab):\n- Theme: light/dark/auto\n- Tool toggles: enable/disable individual tools\n- Context menu customization: choose which items appear\n- Keyboard shortcuts editor\n- Custom snippets: save frequently used text snippets\n- Blocked sites: disable extension on specific domains\n- Export/Import settings as JSON\n\nSync:\n- Use chrome.storage.sync for settings (auto-syncs across Chrome instances)\n- Use chrome.storage.local for history/data (device-specific)\n- Storage quota management: warn when approaching 100KB sync limit\n- Migration: handle schema changes between versions\n\nNotifications:\n- Badge text on extension icon (e.g., show count of queued items)\n- Desktop notifications for background operations\n- Notification preferences in options' },
                { title: 'Step 5 — Build, Test & Publish', body: 'Prepare for Chrome Web Store publication:\n\nTesting:\n- Unit tests with Vitest for utility functions\n- Integration tests with Puppeteer or Playwright for extension\n- Test popup, content script, and background script interactions\n- Test on multiple sites (GitHub, Stack Overflow, MDN)\n- Memory leak testing — extension should not slow down pages\n\nBuild:\n- Production build: minified, tree-shaken, source maps separate\n- Bundle size analysis — aim for <500KB total\n- Content Security Policy compliance\n- Generate ZIP for Chrome Web Store upload\n\nStore Listing:\n- Screenshots (1280x800): popup, context menu, content script in action\n- Promotional images: small (440x280), large (920x680)\n- Privacy policy page (what data is collected — ideally none)\n- Description with features, bullet points, changelog\n\nCI/CD:\n- GitHub Actions: lint, test, build on PR\n- Auto-version bump from conventional commits\n- Auto-generate ZIP artifact on release tag' },
            ]
        },
        datapipeline: {
            folder: 'Data Pipeline (Python)',
            prompts: [
                { title: 'Step 1 — Project Setup', body: 'Create a Python data pipeline project for ETL (Extract, Transform, Load) processing:\n\n- Python 3.12+ with type hints everywhere\n- Package manager: uv (or Poetry)\n- Framework: Prefect 3.x for orchestration (or Dagster as alternative)\n- Database: PostgreSQL with SQLAlchemy 2.0 + Alembic migrations\n- Structure: src/pipeline/, src/extractors/, src/transformers/, src/loaders/, src/models/, src/utils/\n- Config: pydantic-settings for typed configuration\n- Logging: structlog for structured JSON logging\n- Testing: pytest + pytest-asyncio + factory_boy\n\nCreate project skeleton with pyproject.toml, Dockerfile, and docker-compose.yml (app + postgres + redis).' },
                { title: 'Step 2 — Extractors', body: 'Build the data extraction layer:\n\nExtractors (each as a class with common interface):\n1. REST API Extractor — configurable URL, auth (API key, OAuth2, Bearer), pagination handling (cursor, page-based, offset), rate limiting, retry with exponential backoff\n2. CSV/Excel Extractor — read from local files or S3, handle encoding detection, large file streaming (chunked reading)\n3. Database Extractor — connect to source PostgreSQL/MySQL, incremental extraction (WHERE updated_at > last_run), configurable batch size\n4. Web Scraper — BeautifulSoup + httpx async, respect robots.txt, configurable selectors\n\nCommon interface:\n```python\nclass BaseExtractor(ABC):\n    async def extract(self) -> AsyncIterator[dict]\n    def validate_config(self) -> None\n    def get_schema(self) -> dict\n```\n\nAdd connection pooling, timeout handling, and detailed logging for each extractor.' },
                { title: 'Step 3 — Transformers', body: 'Build the data transformation layer:\n\nTransformation framework:\n- Chain of transformers pattern (each transformer is a step)\n- Use Polars (not Pandas) for performance on large datasets\n- Schema validation at each step with Pandera or custom validators\n\nBuilt-in transformers:\n1. CleanTransformer — handle nulls, trim strings, remove duplicates, normalize unicode\n2. TypeCastTransformer — convert types, parse dates (multiple formats), handle currency strings\n3. EnrichTransformer — lookup/join with reference data, geocoding, currency conversion\n4. AggregateTransformer — group by, pivot, window functions, running totals\n5. FilterTransformer — configurable rules (include/exclude, date ranges, regex patterns)\n6. DeriveTransformer — computed columns, conditional logic, string extraction\n\nData quality checks at each step:\n- Row count validation (expected range)\n- Null percentage thresholds\n- Value distribution anomaly detection\n- Schema drift detection (new/missing columns)' },
                { title: 'Step 4 — Loaders & Orchestration', body: 'Build the loading layer and pipeline orchestration:\n\nLoaders:\n1. PostgreSQL Loader — upsert (INSERT ON CONFLICT), bulk insert with COPY, partitioned tables\n2. S3/MinIO Loader — Parquet format with partitioning (by date/category), compression (snappy)\n3. Elasticsearch Loader — bulk index, index template management, alias rotation\n4. File Loader — CSV/JSON/Parquet output, partitioned by date\n\nOrchestration (Prefect):\n- Define pipeline as a Flow with typed parameters\n- Schedule: cron-based (daily at 2 AM, hourly for hot data)\n- Retry policies: 3 retries with exponential backoff per task\n- Concurrency limits: max 5 parallel extractions\n- Notifications: Slack alerts on failure, daily summary on success\n- Artifacts: save row counts, data quality reports as Prefect artifacts\n\nState management:\n- Track last successful run timestamp per pipeline\n- Checkpointing: resume from last successful step on failure\n- Idempotency: re-running same pipeline produces same result' },
                { title: 'Step 5 — Monitoring & Production', body: 'Production-ready monitoring and deployment:\n\nMonitoring:\n- Prometheus metrics: rows_processed, extraction_duration, error_count, pipeline_status\n- Grafana dashboard: pipeline health, throughput, data freshness, error rates\n- Data quality dashboard: completeness, accuracy, freshness per dataset\n- Alerting: PagerDuty for pipeline failures, Slack for warnings\n- SLA tracking: data must be available by 6 AM daily\n\nTesting:\n- Unit tests for each transformer with sample data fixtures\n- Integration tests with test database (auto-cleanup)\n- Data contract tests: verify schema between services\n- Performance benchmarks: process 1M rows in <5 minutes\n\nDeployment:\n- Docker Compose for local development\n- Kubernetes CronJob for scheduled pipelines\n- Helm chart with configurable values\n- GitHub Actions: test → build → deploy to staging → promote to prod\n- Database migrations run automatically before pipeline start\n\nDocumentation:\n- Data catalog: list all datasets, schemas, freshness, owners\n- Pipeline DAG visualization\n- Runbook: common issues and how to fix them' },
            ]
        },
        authsystem: {
            folder: 'Auth System (Full-Stack)',
            prompts: [
                { title: 'Step 1 — Architecture & Database', body: 'Design a comprehensive authentication and authorization system:\n\nArchitecture:\n- Backend: Node.js + Express + TypeScript (or NestJS)\n- Database: PostgreSQL with Prisma ORM\n- Cache: Redis for sessions, rate limiting, token blacklist\n- Frontend: React/Next.js for auth pages\n\nDatabase schema:\n- users: id, email, password_hash, name, avatar_url, email_verified, mfa_enabled, status (active/suspended/deleted), created_at, updated_at\n- sessions: id, user_id, token_hash, device_info, ip_address, expires_at, created_at\n- roles: id, name, description\n- permissions: id, name, resource, action (create/read/update/delete)\n- role_permissions: role_id, permission_id\n- user_roles: user_id, role_id\n- oauth_accounts: id, user_id, provider (google/github/microsoft), provider_id, access_token, refresh_token\n- mfa_secrets: id, user_id, type (totp/sms/backup_codes), secret, verified\n- audit_log: id, user_id, action, resource, ip_address, user_agent, metadata, created_at\n\nCreate Prisma schema + seed script with default roles (admin, user, moderator).' },
                { title: 'Step 2 — Core Auth (Register/Login/Logout)', body: 'Implement core authentication flows:\n\nRegistration:\n- POST /api/auth/register — email, password, name\n- Password requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special\n- Hash with Argon2id (not bcrypt — more resistant to GPU attacks)\n- Send verification email with signed token (valid 24h)\n- GET /api/auth/verify-email?token=xxx — activate account\n- Rate limit: max 5 registrations per IP per hour\n\nLogin:\n- POST /api/auth/login — email, password, device_info\n- Compare password hash, check account status\n- Generate access token (JWT, 15min) + refresh token (opaque, 30 days)\n- Store refresh token hash in sessions table with device info\n- Set refresh token as HttpOnly, Secure, SameSite=Strict cookie\n- Return access token in response body\n\nLogout:\n- POST /api/auth/logout — invalidate current session\n- POST /api/auth/logout-all — invalidate all sessions for user\n- Add access token to Redis blacklist (TTL = token expiry)\n\nToken Refresh:\n- POST /api/auth/refresh — rotate refresh token (old one invalidated)\n- Detect token reuse: if old refresh token is used, invalidate ALL sessions (potential theft)' },
                { title: 'Step 3 — OAuth2 & MFA', body: 'Add OAuth2 social login and Multi-Factor Authentication:\n\nOAuth2:\n- GET /api/auth/oauth/:provider — redirect to provider\n- GET /api/auth/oauth/:provider/callback — handle callback\n- Providers: Google, GitHub, Microsoft\n- Use Passport.js or custom implementation with PKCE flow\n- Link/unlink social accounts to existing user\n- Auto-register if email not found (skip email verification for OAuth)\n- Profile picture sync from provider\n\nMFA (Two-Factor Authentication):\n- POST /api/auth/mfa/setup — generate TOTP secret, return QR code (otpauth:// URI)\n- POST /api/auth/mfa/verify — verify TOTP code, enable MFA\n- POST /api/auth/mfa/disable — require password + TOTP to disable\n- Login flow with MFA: first verify password → return interim token → POST /api/auth/mfa/challenge with TOTP code → return real tokens\n- Backup codes: generate 10 one-time codes on MFA setup, store hashed\n- POST /api/auth/mfa/backup — use backup code (each code works once)\n- Recovery: admin can disable MFA for user (logged in audit trail)' },
                { title: 'Step 4 — RBAC & Authorization', body: 'Implement Role-Based Access Control:\n\nRBAC middleware:\n```typescript\n// Usage: router.get("/admin/users", authorize("users", "read"), handler)\nfunction authorize(resource: string, action: string)\n```\n\n- Check user roles → role permissions → match resource + action\n- Cache permissions in Redis (invalidate on role change)\n- Super admin role: bypasses all permission checks\n\nDefault roles:\n- admin: full access to everything\n- moderator: read/update users, manage content\n- user: read own profile, update own data\n\nAPI endpoints:\n- GET/POST/PUT/DELETE /api/admin/roles — CRUD roles\n- POST /api/admin/roles/:id/permissions — assign permissions to role\n- POST /api/admin/users/:id/roles — assign roles to user\n- GET /api/admin/audit-log — search audit log (filter by user, action, date range)\n\nFrontend:\n- useAuth() hook: user, isAuthenticated, hasPermission(resource, action), hasRole(role)\n- ProtectedRoute component: redirect to login or show 403\n- Permission-based UI rendering: hide buttons/menu items user cannot access\n\nAudit logging:\n- Log every auth event: login, logout, password change, role change, permission change\n- Include: user_id, action, IP, user agent, timestamp, metadata (what changed)' },
                { title: 'Step 5 — Security Hardening & Frontend', body: 'Harden security and build auth UI pages:\n\nSecurity:\n- Rate limiting: login (5/min per IP), register (3/hour per IP), password reset (3/hour per email)\n- Account lockout: 5 failed login attempts → lock for 15 minutes\n- Password reset: POST /api/auth/forgot-password → send email with signed token (1h expiry)\n- CSRF protection: double-submit cookie pattern\n- CORS: whitelist specific origins\n- Security headers: Helmet.js (HSTS, CSP, X-Frame-Options, etc.)\n- Input sanitization: prevent NoSQL injection, XSS\n- Dependency audit: automated npm audit in CI\n\nFrontend Pages (React/Next.js):\n- /login — email + password, social login buttons, remember me\n- /register — registration form with real-time validation\n- /forgot-password — email input, success message\n- /reset-password?token=xxx — new password form\n- /verify-email?token=xxx — auto-verify, show result\n- /settings/security — change password, manage MFA, view active sessions, revoke sessions\n- /admin/users — user management table with role assignment\n\nAll forms: loading states, error messages, success feedback, accessible (ARIA).' },
            ]
        },
        llmapp: {
            folder: 'AI/LLM Application',
            prompts: [
                { title: 'Step 1 — Project Setup', body: 'Create an AI-powered application — a "Smart Document Q&A" tool where users upload documents and ask questions:\n\n- Backend: Python FastAPI\n- LLM: Claude API (Anthropic SDK) with fallback to OpenAI\n- Vector DB: ChromaDB (local) or Pinecone (production)\n- Embeddings: OpenAI text-embedding-3-small or Cohere\n- Frontend: Next.js 15 + Tailwind CSS\n- File processing: PyPDF2, python-docx, Unstructured\n\nProject structure:\n```\nbackend/\n  app/main.py          — FastAPI app\n  app/routers/         — API routes\n  app/services/        — LLM, embedding, vector store services\n  app/models/          — Pydantic models\n  app/processing/      — Document parsers\nfrontend/\n  app/                 — Next.js pages\n  components/          — React components\n```\n\nCreate project skeleton with requirements.txt, .env.example, Docker Compose (app + chromadb).' },
                { title: 'Step 2 — Document Processing & Embedding', body: 'Build the document ingestion pipeline:\n\nUpload & Parse:\n- POST /api/documents/upload — accept PDF, DOCX, TXT, MD (max 50MB)\n- Extract text from each format (PyPDF2 for PDF, python-docx for DOCX)\n- Handle multi-page PDFs, tables, headers/footers\n- Store original file in S3/local storage\n\nChunking Strategy:\n- Split documents into chunks (500 tokens with 50 token overlap)\n- Preserve paragraph boundaries — don\'t split mid-sentence\n- Add metadata to each chunk: document_id, page_number, section_title, chunk_index\n- RecursiveCharacterTextSplitter from LangChain (or custom implementation)\n\nEmbedding & Storage:\n- Generate embeddings for each chunk (batch processing)\n- Store in ChromaDB with metadata filters\n- Create collection per user (multi-tenancy)\n- Track processing status: uploading → processing → ready → error\n\nBackground processing with asyncio task queue (or Celery for production).' },
                { title: 'Step 3 — RAG Query Engine', body: 'Build the Retrieval-Augmented Generation (RAG) query engine:\n\nRetrieval:\n- Convert user question to embedding\n- Search vector DB: top-k=5 chunks, with metadata filtering (by document, date range)\n- Hybrid search: combine semantic similarity + keyword matching (BM25)\n- Re-ranking: use cross-encoder to re-rank retrieved chunks by relevance\n\nGeneration:\n- System prompt template:\n  "You are a helpful assistant that answers questions based on the provided context. If the answer is not in the context, say so. Always cite which document and page the information comes from."\n- Include retrieved chunks as context in the prompt\n- Stream response via SSE (Server-Sent Events)\n- Token counting: ensure prompt fits within context window (track usage)\n\nAdvanced features:\n- Conversation memory: include last 5 Q&A turns for follow-up questions\n- Multi-document queries: search across all user documents\n- Source highlighting: return exact text spans that support the answer\n- Confidence score: LLM self-rates confidence (high/medium/low)\n\nAPI: POST /api/chat — { question, document_ids[], conversation_id }' },
                { title: 'Step 4 — Frontend Chat UI', body: 'Build the frontend chat interface:\n\nDocument Management Page (/documents):\n- Upload area: drag & drop with progress bar\n- Document list: name, type, pages, size, status (processing/ready), upload date\n- Delete document (also remove embeddings)\n- Document preview: show first page or text excerpt\n\nChat Page (/chat):\n- Sidebar: conversation history list, new chat button, document filter\n- Chat area: message bubbles (user = right, AI = left)\n- Streaming response: show text appearing word by word\n- Source citations: clickable references that expand to show source chunk\n- "Based on: Document X, Page Y" badges below AI response\n- Copy response button, thumbs up/down feedback\n- Input: textarea with Shift+Enter for newline, Enter to send, file attachment button\n- Suggested questions: show 3 starter questions based on uploaded documents\n\nState management:\n- React context for auth + active conversation\n- Optimistic updates for message sending\n- Persist conversation list (API: GET/POST/DELETE /api/conversations)' },
                { title: 'Step 5 — Optimization & Production', body: 'Optimize and prepare for production:\n\nPerformance:\n- Embedding cache: don\'t re-embed identical chunks\n- Query cache: cache frequent questions + answers (Redis, TTL 1 hour)\n- Streaming: use SSE for real-time response streaming\n- Batch embedding: process multiple chunks in single API call\n- Async processing: document parsing in background worker\n\nCost optimization:\n- Token usage tracking per user (daily/monthly limits)\n- Smaller model for simple questions, larger for complex (routing)\n- Embedding model comparison: cost vs quality tradeoff\n- Cache hit rate monitoring\n\nEvaluation:\n- Build evaluation dataset: 50 question-answer pairs from test documents\n- Metrics: answer relevance (LLM-as-judge), faithfulness, retrieval precision\n- A/B test different chunk sizes, retrieval top-k values, prompts\n- Log all queries + retrieved chunks + responses for analysis\n\nDeployment:\n- Docker Compose: app + chromadb + redis + nginx\n- Environment configs: dev, staging, production\n- Health checks: /health endpoint (check DB, vector store, LLM API)\n- Rate limiting: 10 queries/minute per user\n- Error handling: graceful fallback if LLM API is down' },
            ]
        },
        gamedev: {
            folder: 'Game Dev (JavaScript)',
            prompts: [
                { title: 'Step 1 — Game Engine Setup', body: 'Create a 2D platformer game using vanilla JavaScript + HTML5 Canvas:\n\n- No game framework — build from scratch for learning\n- HTML5 Canvas for rendering\n- Structure: src/engine/ (core), src/game/ (game-specific), src/assets/\n- Game loop: requestAnimationFrame with fixed timestep (60 FPS)\n- Canvas: 800x600 viewport, pixel-perfect rendering\n\nEngine components to build:\n1. Game Loop — update(dt) + render(ctx) cycle with delta time\n2. Input Manager — keyboard state tracking (keydown/keyup map)\n3. Asset Loader — load images/audio with progress callback\n4. Sprite class — image, position, size, animation frames\n5. Camera — follow player with smooth lerp, world bounds\n6. Debug overlay — FPS counter, entity count, collision boxes\n\nCreate the engine skeleton with a simple colored rectangle that moves with arrow keys.' },
                { title: 'Step 2 — Physics & Collision', body: 'Implement physics and collision detection:\n\nPhysics:\n- Gravity: constant downward acceleration (adjustable)\n- Velocity + acceleration model for player movement\n- Friction: ground friction (deceleration when not pressing move)\n- Jump: initial velocity impulse, variable jump height (release early = lower jump)\n- Coyote time: 100ms grace period to jump after leaving platform edge\n- Jump buffer: 100ms buffer — press jump slightly before landing\n- Terminal velocity: cap falling speed\n\nCollision:\n- AABB (Axis-Aligned Bounding Box) collision detection\n- Tilemap collision: check tiles around player (not all tiles)\n- Collision response: separate axis resolution (resolve X and Y independently)\n- One-way platforms: can jump through from below, land on top\n- Slopes: optional but nice — smooth walking on angled surfaces\n\nTilemap:\n- JSON tilemap format: 2D array of tile IDs\n- Tile types: solid, platform (one-way), spike (damage), coin (collectible)\n- Tile size: 32x32 pixels\n- Render only visible tiles (camera frustum culling)' },
                { title: 'Step 3 — Player & Enemies', body: 'Build player character and enemy AI:\n\nPlayer:\n- Sprite animation: idle (4 frames), run (6 frames), jump (2 frames), fall (2 frames)\n- State machine: idle → running → jumping → falling → landing\n- Flip sprite based on facing direction\n- Health system: 3 hearts, invincibility frames after damage (flash effect)\n- Particle effects: dust on land, trail on run\n- Death: fall off screen or lose all hearts → respawn at checkpoint\n\nEnemies:\n1. Walker — patrol left/right between walls, reverse on edge or wall\n2. Jumper — hops towards player when in range\n3. Flyer — sine wave movement, follows player horizontally\n4. Shooter — stationary, fires projectile towards player every 2 seconds\n\nEnemy base class:\n- update(dt, player) — AI behavior\n- takeDamage() — flash + destroy\n- Drops: coins or hearts with probability\n\nPlayer can defeat enemies by jumping on top (Mario-style).\nEnemies damage player on side/bottom contact.' },
                { title: 'Step 4 — Levels & UI', body: 'Create levels, HUD, and menu system:\n\nLevel System:\n- Level data: JSON files with tilemap, enemy placements, coin positions, start/end position\n- Level editor approach: design 3 levels with increasing difficulty\n- Level 1: tutorial (flat, few enemies, lots of coins)\n- Level 2: platforming challenge (moving platforms, gaps, more enemies)\n- Level 3: vertical climb + boss fight (large enemy with patterns)\n- Transition: reach flag/door → fade out → load next level\n- Checkpoints: save progress at checkpoint flags\n\nHUD (Head-Up Display):\n- Hearts (top-left): sprite-based, animate on damage\n- Coin counter (top-right): icon + count with pop animation\n- Level timer (top-center): counting up, display as MM:SS\n- Score: coins * 100 + time bonus\n\nMenus:\n- Title screen: game logo, "Press Enter to Start", animated background\n- Pause menu (Escape): Resume, Restart Level, Quit to Title\n- Game Over screen: score, retry button\n- Victory screen: total score, time, coin count, star rating (1-3 stars)\n\nAll menus: keyboard navigation (arrow keys + Enter), smooth transitions.' },
                { title: 'Step 5 — Audio, Effects & Polish', body: 'Add audio, visual effects, and final polish:\n\nAudio:\n- Web Audio API for sound effects (not just <audio> elements)\n- Sound effects: jump, land, coin collect, enemy defeat, damage, death, checkpoint\n- Background music: looping per level (different tracks)\n- Volume control: separate SFX and music sliders\n- Mute button (M key toggle)\n\nVisual Effects:\n- Particle system class: emit particles with lifetime, velocity, gravity, fade\n- Effects: coin sparkle, enemy poof on death, dust on land/run, damage flash\n- Screen shake on damage\n- Parallax background: 3 layers scrolling at different speeds\n- Smooth camera: ease towards player, look-ahead in movement direction\n\nPolish:\n- Responsive canvas: scale to fit window while maintaining aspect ratio\n- Touch controls: on-screen buttons for mobile (left, right, jump)\n- Save system: localStorage for best scores per level, unlocked levels\n- Performance: object pooling for particles and projectiles (avoid GC spikes)\n- Sprite sheet atlas: pack all sprites into one image for fewer draw calls\n\nOptional:\n- Gamepad support (Gamepad API)\n- Screen recording: MediaRecorder API to save gameplay clips' },
            ]
        },
        designsystem: {
            folder: 'Design System (React)',
            prompts: [
                { title: 'Step 1 — Foundation & Setup', body: 'Create a Design System / Component Library project:\n\n- React 19 + TypeScript (strict mode)\n- Build: Vite library mode (outputs ESM + CJS)\n- Styling: CSS Modules + CSS custom properties (design tokens)\n- Documentation: Storybook 8\n- Testing: Vitest + React Testing Library\n- Structure:\n  ```\n  src/\n    tokens/        — design tokens (colors, spacing, typography, shadows)\n    components/    — UI components\n    hooks/         — shared hooks\n    utils/         — helpers\n  ```\n\nDesign Tokens (CSS custom properties):\n- Colors: primary, secondary, success, warning, danger, neutral (10 shades each)\n- Typography: font family (sans, mono), sizes (xs to 3xl), weights, line heights\n- Spacing: 4px base unit scale (0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24)\n- Border radius: none, sm, md, lg, full\n- Shadows: sm, md, lg, xl\n- Breakpoints: sm (640), md (768), lg (1024), xl (1280)\n- Dark mode: automatic via prefers-color-scheme + manual toggle\n\nCreate token files, ThemeProvider component, and Storybook config.' },
                { title: 'Step 2 — Primitive Components', body: 'Build the primitive (atomic) components:\n\n1. **Button** — variants (primary, secondary, outline, ghost, danger), sizes (sm, md, lg), loading state, disabled, icon-only, left/right icon slots\n2. **Input** — text, email, password (show/hide toggle), number, search. States: default, focus, error, disabled. Label, helper text, error message, left/right addon slots\n3. **Textarea** — auto-resize option, character count, max length\n4. **Select** — native select wrapper, custom dropdown with search (combobox)\n5. **Checkbox** — single + group, indeterminate state\n6. **Radio** — group with horizontal/vertical layout\n7. **Toggle/Switch** — with label, sizes\n8. **Badge** — variants (solid, outline, soft), sizes, dot indicator, removable\n9. **Avatar** — image, initials fallback, sizes, status indicator (online/offline), group (stacked)\n10. **Spinner** — sizes, colors, inline or overlay\n\nEach component:\n- Fully typed props with TypeScript (no `any`)\n- Forward ref support\n- Accessible (ARIA attributes, keyboard navigation)\n- Storybook story with all variants\n- Unit test for key behaviors' },
                { title: 'Step 3 — Composite Components', body: 'Build composite (molecule) components:\n\n1. **Card** — header, body, footer slots, variants (elevated, outlined, filled), clickable option\n2. **Modal/Dialog** — sizes (sm, md, lg, full), close on overlay click, close on Escape, focus trap, scroll lock, animation (fade + scale)\n3. **Dropdown Menu** — trigger element, menu items, dividers, icons, keyboard navigation, submenus, disabled items\n4. **Toast/Notification** — variants (info, success, warning, error), auto-dismiss timer, stack position (top-right, bottom-center, etc.), action button, dismiss button, useToast() hook\n5. **Tooltip** — trigger on hover/focus, positions (top, bottom, left, right), arrow, delay, max width\n6. **Tabs** — horizontal/vertical, variants (underline, pills, enclosed), lazy rendering, controlled/uncontrolled\n7. **Accordion** — single/multiple expand, default expanded, animated collapse\n8. **Table** — sortable columns, sticky header, row selection, pagination footer, loading skeleton, empty state, responsive (horizontal scroll on mobile)\n9. **Breadcrumb** — separator (slash, chevron), truncate with dropdown for long paths\n10. **Pagination** — page numbers, prev/next, first/last, page size selector, total count display\n\nAll components: compound component pattern where applicable (e.g., Tabs.Root, Tabs.List, Tabs.Panel).' },
                { title: 'Step 4 — Form & Layout Components', body: 'Build form handling and layout components:\n\nForm Components:\n1. **FormField** — wraps any input with label, helper text, error message, required indicator\n2. **FormGroup** — groups related fields with legend\n3. **Form** — integrates with React Hook Form, provides form context, auto error display\n4. **DatePicker** — calendar popup, range selection, min/max dates, format customization\n5. **FileUpload** — drag & drop zone, file list, preview (images), size limit, accept filter\n6. **Combobox/Autocomplete** — async search, multi-select, tags display, create new option\n\nLayout Components:\n1. **Container** — max-width with responsive padding\n2. **Stack** — vertical/horizontal, gap, align, justify, wrap, dividers\n3. **Grid** — responsive columns, gap, span\n4. **Sidebar Layout** — collapsible sidebar + main content, responsive (drawer on mobile)\n5. **Divider** — horizontal/vertical, with label\n6. **AspectRatio** — maintain ratio for responsive media\n\nUtility Hooks:\n- useMediaQuery(breakpoint) — responsive design\n- useClickOutside(ref, callback) — dropdown/modal dismissal\n- useFocusTrap(ref) — modal focus management\n- useLocalStorage(key, initial) — persistent state\n- useDebounce(value, delay) — search input debouncing' },
                { title: 'Step 5 — Documentation & Publishing', body: 'Complete documentation and prepare for npm publish:\n\nStorybook Enhancement:\n- Organize stories by: Tokens, Primitives, Composites, Forms, Layout\n- Add "Docs" page for each component: description, props table, usage examples, do/don\'t guidelines\n- Interactive playground: knobs/controls for all props\n- Accessibility tab: show a11y audit results per story\n- Theme switcher addon: preview components in light/dark mode\n- Figma designs link per component (if available)\n\nDocumentation Site:\n- Getting started guide: install, setup ThemeProvider, import first component\n- Design principles page\n- Token reference with visual swatches\n- Changelog (auto-generated from conventional commits)\n\nPublish Setup:\n- Package.json: name, version, peerDependencies (react, react-dom)\n- Exports map: ESM + CJS + types\n- Bundle: Vite library mode, externalize React\n- CSS: ship as separate importable stylesheet\n- Tree-shakeable: each component individually importable\n- semantic-release for automated versioning\n- CI: GitHub Actions → lint + test + build + visual regression (Chromatic) + publish to npm\n\nVisual Regression Testing:\n- Chromatic or Percy integration\n- Screenshot every Storybook story\n- PR check: flag visual changes for review' },
            ]
        },
        microservices: {
            folder: 'Microservices Architecture',
            prompts: [
                { title: 'Step 1 — Architecture Design', body: 'Design a microservices architecture for an e-commerce platform:\n\nServices:\n1. **API Gateway** — Kong or custom (Node.js). Routes requests, rate limiting, auth verification\n2. **Auth Service** — user registration, login, JWT tokens, OAuth2\n3. **User Service** — user profiles, preferences, addresses\n4. **Product Service** — product catalog, categories, search, inventory\n5. **Order Service** — order lifecycle (create, pay, ship, deliver, cancel)\n6. **Payment Service** — payment processing, refunds, webhooks\n7. **Notification Service** — email, push, SMS via event-driven triggers\n\nCommunication:\n- Synchronous: REST/gRPC for queries (product catalog, user profile)\n- Asynchronous: RabbitMQ/Kafka for events (order.created, payment.completed, stock.updated)\n\nShared infrastructure:\n- PostgreSQL per service (database per service pattern)\n- Redis for caching + session store\n- RabbitMQ for message broker\n- MinIO for file storage (product images)\n\nCreate architecture diagram (Mermaid), define API contracts (OpenAPI), and list all events.' },
                { title: 'Step 2 — Shared Infrastructure', body: 'Set up shared infrastructure and common libraries:\n\nDocker Compose (local development):\n- All 7 services + PostgreSQL (separate DB per service) + Redis + RabbitMQ + MinIO\n- Hot reload for each service (nodemon/air/watchdog depending on language)\n- Shared network, service discovery via Docker DNS\n\nCommon Library (@platform/common):\n- Logger: structured JSON logging with correlation ID\n- Error classes: AppError, ValidationError, NotFoundError, UnauthorizedError\n- HTTP client: axios/got wrapper with retry, timeout, circuit breaker\n- Event bus interface: publish(event) + subscribe(eventType, handler)\n- Auth middleware: verify JWT, extract user context\n- Request validation: Zod schemas\n- Health check endpoint: /health (check DB, message broker, dependencies)\n\nMessage Broker Setup:\n- RabbitMQ exchanges: events (topic), commands (direct), dlx (dead letter)\n- Event envelope: { id, type, source, timestamp, correlationId, data }\n- Retry policy: 3 retries with exponential backoff, then dead letter queue\n- Idempotency: consumers track processed event IDs\n\nCreate the monorepo structure (Turborepo or Nx) with shared packages.' },
                { title: 'Step 3 — Core Services Implementation', body: 'Implement the core business services:\n\nProduct Service (Node.js + Express):\n- CRUD products with categories\n- Full-text search with PostgreSQL tsvector\n- Image upload to MinIO\n- Inventory tracking: stock count, reserve on order, release on cancel\n- Events published: product.created, product.updated, stock.low\n- Cache: product listings in Redis (invalidate on update)\n\nOrder Service (Node.js + Express):\n- Saga pattern for order workflow:\n  1. Create order (status: pending) → publish order.created\n  2. Reserve inventory → listen stock.reserved / stock.insufficient\n  3. Process payment → listen payment.completed / payment.failed\n  4. Confirm order → publish order.confirmed\n  5. If any step fails → compensating transactions (release stock, refund)\n- Order status: pending → confirmed → shipping → delivered / cancelled\n- Events: order.created, order.confirmed, order.cancelled, order.shipped\n\nPayment Service (Node.js + Express):\n- Process payment (mock payment gateway for dev)\n- Listen: order.created → attempt payment\n- Publish: payment.completed, payment.failed\n- Refund on order cancellation\n- Webhook endpoint for real payment provider callbacks\n- Idempotency key per payment attempt\n\nEach service: Dockerfile, database migrations, seed data, health check.' },
                { title: 'Step 4 — API Gateway & Communication', body: 'Build the API Gateway and inter-service communication:\n\nAPI Gateway (Node.js + Express or Kong):\n- Route mapping: /api/products/* → Product Service, /api/orders/* → Order Service, etc.\n- Authentication: verify JWT on all routes, attach user context\n- Rate limiting: 100 req/min for authenticated, 20 req/min for anonymous\n- Request/response transformation: aggregate data from multiple services\n- Example: GET /api/orders/:id → fetch order from Order Service + user from User Service + products from Product Service → combined response\n- Circuit breaker: if downstream service is down, return cached/fallback response\n- Request logging: correlation ID propagation across all services\n\nService-to-Service Communication:\n- HTTP: for synchronous queries with circuit breaker (opossum library)\n- Events: RabbitMQ for async events with guaranteed delivery\n- Service registry: environment-based URLs (docker-compose DNS for dev, K8s service discovery for prod)\n\nEvent-Driven Patterns:\n- Notification Service listens to:\n  - order.confirmed → send confirmation email\n  - order.shipped → send shipping notification\n  - payment.failed → send payment failure alert\n  - stock.low → alert admin\n- Use dead letter queue for failed events\n- Event sourcing for Order Service: store all state changes as events\n\nAdd distributed tracing: OpenTelemetry → Jaeger (trace requests across services).' },
                { title: 'Step 5 — Testing & Deployment', body: 'Comprehensive testing and Kubernetes deployment:\n\nTesting Strategy:\n- Unit tests per service: business logic, event handlers (>80% coverage)\n- Integration tests: service + its database + message broker\n- Contract tests: Pact — verify API contracts between services\n- End-to-end tests: full order flow (create → pay → ship → deliver)\n- Chaos testing: kill services randomly, verify system recovers (resilience)\n- Load testing: k6 scripts for key workflows\n\nKubernetes Deployment:\n- Helm chart per service with shared templates\n- Environments: dev (minikube), staging, production\n- Per service: Deployment, Service, HPA, PDB, ConfigMap, Secret\n- Ingress: Nginx Ingress Controller with TLS\n- Database: managed PostgreSQL (or StatefulSet for dev)\n- RabbitMQ: Bitnami Helm chart (or CloudAMQP for production)\n- Redis: Bitnami Helm chart (or ElastiCache for production)\n\nCI/CD (GitHub Actions):\n- PR: lint + unit tests + contract tests + build Docker image\n- Merge to main: build + push to GHCR + deploy to staging + run E2E tests\n- Release tag: promote staging image to production (approval gate)\n- Canary deployment: 10% traffic → monitor errors → full rollout\n\nMonitoring:\n- Prometheus + Grafana: per-service dashboards\n- Jaeger: distributed tracing\n- ELK/Loki: centralized logging\n- PagerDuty: critical alerts (service down, error rate > 5%, saga failures)' },
            ]
        },
        testing: {
            folder: 'Testing Strategy',
            prompts: [
                { title: 'Step 1 — Test Architecture & Setup', body: 'Design a comprehensive testing strategy for our application:\n\nTesting Pyramid:\n1. Unit Tests (70%) — fast, isolated, test business logic\n2. Integration Tests (20%) — test component interactions, API + database\n3. E2E Tests (10%) — critical user journeys only\n\nSetup:\n- Test runner: Vitest (fast, ESM-native, Jest-compatible API)\n- Assertion: Vitest built-in (expect, toBe, toEqual, etc.)\n- Mocking: Vitest mocks (vi.fn, vi.spyOn, vi.mock)\n- HTTP mocking: MSW (Mock Service Worker) v2 for API mocking\n- Component testing: React Testing Library\n- E2E: Playwright (Chrome, Firefox, WebKit)\n- Coverage: v8 (not istanbul) for accuracy\n- CI: run tests in parallel, fail fast\n\nConfiguration:\n- vitest.config.ts: setup files, coverage thresholds (80% overall, 90% for services)\n- Separate configs: vitest.unit.ts, vitest.integration.ts\n- Test database: Docker container spun up before integration tests, torn down after\n- Environment variables: .env.test\n- Global setup: database migrations, seed test data\n\nCreate all config files and example test for each layer.' },
                { title: 'Step 2 — Unit Testing Patterns', body: 'Write unit tests for critical business logic:\n\nWhat to unit test:\n- Pure functions and utility functions\n- Service layer (business logic) with mocked dependencies\n- Data transformations and validators\n- State management (Redux reducers, Zustand stores)\n- Custom hooks (with renderHook from Testing Library)\n- Error handling paths\n\nPatterns:\n- Arrange-Act-Assert (AAA) structure\n- Test naming: describe("ServiceName") > describe("methodName") > it("should ... when ...")\n- Factory functions for test data (avoid copy-paste fixtures)\n- Test each edge case: null, undefined, empty string, boundary values, max/min\n- Parameterized tests: test.each for multiple input/output combinations\n- Snapshot tests: ONLY for serializable output (not UI components)\n\nExample areas to test:\n1. Order total calculation (subtotal, tax, discount, shipping)\n2. Input validation functions (email, phone, credit card)\n3. Date utility functions (format, parse, diff, timezone conversion)\n4. Permission checker (user + role + resource → allow/deny)\n5. Pagination logic (total pages, offset calculation, boundary handling)\n\nAnti-patterns to avoid:\n- Testing implementation details (don\'t test private methods)\n- Brittle tests coupled to UI structure (use accessible queries)\n- Mock everything (only mock external boundaries)\n- Testing framework behavior (don\'t test that React renders)' },
                { title: 'Step 3 — Integration Testing', body: 'Write integration tests for API endpoints and database interactions:\n\nAPI Integration Tests:\n- Use supertest to make real HTTP requests to Express/Fastify app\n- Real database: PostgreSQL in Docker (testcontainers or docker-compose)\n- Before all: run migrations, seed base data\n- Before each: start transaction, after each: rollback (fast cleanup)\n- Test full request cycle: HTTP request → middleware → controller → service → database → response\n\nTest scenarios per endpoint:\n1. Happy path: valid request → expected response (status, body, headers)\n2. Validation: invalid input → 400 with specific error messages\n3. Auth: no token → 401, invalid token → 401, forbidden role → 403\n4. Not found: invalid ID → 404\n5. Conflict: duplicate email → 409\n6. Pagination: test page, limit, sort, filter parameters\n7. Side effects: verify email sent, event published, cache invalidated\n\nDatabase Integration:\n- Test Prisma/TypeORM repositories with real database\n- Test migrations: up and down\n- Test transactions: rollback on error\n- Test unique constraints, foreign keys, cascading deletes\n\nExternal Service Mocking:\n- MSW for HTTP APIs (payment provider, email service)\n- Custom mock for message broker (verify events published)\n- Time mocking: vi.useFakeTimers() for time-dependent logic\n\nPerformance assertions:\n- Response time < 200ms for simple queries\n- Bulk operations < 1 second for 100 items' },
                { title: 'Step 4 — E2E & Component Testing', body: 'Write E2E tests and React component tests:\n\nPlaywright E2E Tests:\nTest critical user journeys only (not every feature):\n1. Registration → email verification → first login\n2. Browse products → add to cart → checkout → payment → order confirmation\n3. Admin: login → create product → verify on storefront\n4. Password reset flow\n5. Search → filter → sort → paginate products\n\nPlaywright setup:\n- Page Object Model pattern: each page = class with selectors + actions\n- fixtures: authenticated user, seeded products, etc.\n- Visual regression: screenshot comparison for key pages\n- Parallel execution: 4 workers\n- Retry: 2 retries for flaky tests\n- Video recording on failure\n- CI: run against staging environment\n\nReact Component Tests (Testing Library):\n- Test behavior, not implementation\n- Use accessible queries: getByRole, getByLabelText, getByText (not getByTestId)\n- User events: @testing-library/user-event (not fireEvent)\n- Async operations: waitFor, findBy queries\n\nComponents to test:\n1. Form submission: fill fields → submit → verify API call → verify success state\n2. Data table: verify sorting, filtering, pagination interactions\n3. Modal: open → interact → close → verify focus return\n4. Error boundaries: trigger error → verify fallback UI\n5. Loading states: verify skeleton/spinner during async operation' },
                { title: 'Step 5 — CI Pipeline & Quality Gates', body: 'Set up CI testing pipeline and quality enforcement:\n\nGitHub Actions Pipeline:\n```\nPR opened/updated:\n  1. Lint (ESLint + Prettier) — 30s\n  2. Type check (tsc --noEmit) — 30s\n  3. Unit tests (parallel, with coverage) — 1min\n  4. Integration tests (with test DB) — 2min\n  5. Build check — 1min\n  6. Bundle size check (size-limit) — 30s\n  [if all pass]\n  7. Deploy to preview environment\n  8. E2E tests against preview — 5min\n  9. Visual regression (Chromatic) — 3min\n```\n\nQuality Gates (PR cannot merge unless):\n- All checks pass (green)\n- Coverage > 80% overall, no decrease from base branch\n- No new ESLint warnings\n- Bundle size increase < 10KB\n- No TypeScript errors\n- At least 1 approval\n\nCoverage Reporting:\n- Upload to Codecov/Coveralls\n- PR comment: coverage diff (what increased/decreased)\n- Per-file coverage: flag files with <50% coverage\n- Enforce coverage for new files: 80% minimum\n\nTest Maintenance:\n- Quarantine flaky tests: auto-retry 3x, if still flaky → move to quarantine suite\n- Weekly flaky test report: top 10 most retried tests\n- Test execution time tracking: flag tests >5 seconds\n- Dead test detection: find tests that haven\'t failed in 6 months (may be testing nothing)\n\nDeveloper Experience:\n- Pre-commit hook: lint-staged (lint + format changed files only)\n- Pre-push hook: run affected unit tests only (vitest --changed)\n- IDE integration: Vitest VSCode extension for inline test results' },
            ]
        },
    };

    function loadSample(key) {
        const sample = sampleSets[key];
        if (!sample) return;

        const sampleFolderId = nextId++;
        folders.push({ id: sampleFolderId, name: sample.folder, order: folders.length });

        sample.prompts.forEach((sp, i) => {
            prompts.push({
                id: nextId++,
                folderId: sampleFolderId,
                title: sp.title,
                body: sp.body,
                polished: '',
                order: i,
                createdAt: new Date().toISOString(),
            });
        });

        save();
        activeFolder = sampleFolderId;
        renderFolders();
        renderPrompts();
    }

    document.getElementById('samplesMenu').addEventListener('click', function (e) {
        const item = e.target.closest('[data-sample]');
        if (!item) return;
        e.preventDefault();
        loadSample(item.dataset.sample);
    });

    // ── Tell AI — Generate Sequential Prompts ──
    const TELL_AI_SYSTEM_PROMPT = `You are an expert prompt engineer and project planner. The user will describe what they want to build or accomplish. Your job is to generate a structured sequential prompt plan that they can use with an AI coding assistant (like Claude).

IMPORTANT RULES:
1. Analyze the user's expertise level from their writing:
   - Non-technical users (casual language, no tech terms): Generate simple, beginner-friendly prompts with clear explanations. Suggest specific frameworks/tools for them. 4-5 steps.
   - Technical users (use tech jargon, mention specific tools): Generate advanced, detailed prompts with specific architecture decisions, best practices, edge cases. 5-7 steps.
2. Each prompt should be a complete, self-contained instruction that builds on the previous step.
3. Folder name should be a concise summary of the project (2-5 words).
4. Keep the same language as the user's input (if they write in Indonesian, respond in Indonesian).
5. Each prompt body should be detailed (at least 150 words) with specific requirements, not vague instructions.

You MUST respond with ONLY valid JSON in this exact format (no markdown, no explanation, no code blocks):
{"folder":"Project Name","prompts":[{"title":"Step 1 — Title","body":"Detailed prompt content..."},{"title":"Step 2 — Title","body":"Detailed prompt content..."}]}`;

    const TELL_AI_SUGGESTIONS = [
        // Non-IT / Beginner — Bahasa Indonesia, deskriptif
        { icon: 'bi-shop', text: 'Buatkan website toko online untuk jualan baju, lengkap dengan galeri produk, keranjang belanja, checkout, dan integrasi pembayaran' },
        { icon: 'bi-cup-hot', text: 'Landing page untuk kafe saya dengan menu makanan & minuman, galeri foto interior, lokasi Google Maps, jam buka, dan form reservasi online' },
        { icon: 'bi-person-badge', text: 'Website portfolio untuk freelancer desain grafis dengan galeri proyek, halaman about me, testimoni klien, dan form kontak WhatsApp' },
        { icon: 'bi-clipboard-check', text: 'Aplikasi to-do list dengan kategori, prioritas, deadline, notifikasi pengingat, dan progress tracking per project' },
        { icon: 'bi-calendar-event', text: 'Sistem booking appointment untuk salon kecantikan dengan pilih layanan, pilih stylist, kalender ketersediaan, dan konfirmasi via WhatsApp' },
        { icon: 'bi-journal-text', text: 'Blog pribadi dengan kategori artikel, tag, komentar pembaca, fitur pencarian, dan halaman arsip bulanan' },
        { icon: 'bi-building', text: 'Website company profile perusahaan dengan halaman visi misi, layanan, tim, klien, berita, dan formulir kontak' },
        { icon: 'bi-mortarboard', text: 'Platform e-learning sederhana dengan daftar kursus, video pembelajaran, kuis interaktif, sertifikat, dan progress belajar siswa' },
        { icon: 'bi-hospital', text: 'Sistem pendaftaran pasien klinik online dengan pilih dokter, jadwal praktik, antrian, riwayat kunjungan, dan resep digital' },
        { icon: 'bi-truck', text: 'Aplikasi tracking pengiriman barang dengan input resi, status real-time, estimasi tiba, notifikasi update, dan riwayat pengiriman' },
        { icon: 'bi-camera', text: 'Website fotografer profesional dengan galeri kategori (wedding, prewedding, product), booking sesi foto, paket harga, dan testimoni' },
        { icon: 'bi-house-heart', text: 'Website listing properti/kost dengan pencarian lokasi, filter harga, foto 360, detail fasilitas, peta, dan kontak pemilik' },
        // IT / Advanced — English, technical & detailed
        { icon: 'bi-diagram-3', text: 'Microservices e-commerce platform with API Gateway, event-driven saga orchestration, gRPC inter-service communication, and distributed tracing' },
        { icon: 'bi-shield-lock', text: 'Full-stack auth system with OAuth2 PKCE, JWT rotation, RBAC + ABAC permissions, TOTP/WebAuthn MFA, and comprehensive audit logging' },
        { icon: 'bi-cloud-arrow-up', text: 'Production CI/CD pipeline with multi-stage Docker builds, Kubernetes Helm deployments, canary releases, Prometheus monitoring, and Grafana dashboards' },
        { icon: 'bi-robot', text: 'RAG-powered document Q&A application with hybrid vector search, re-ranking, streaming responses, conversation memory, and source citation' },
        { icon: 'bi-phone', text: 'Cross-platform mobile app (Flutter/React Native) with offline-first architecture, background sync, push notifications, biometric auth, and deep linking' },
        { icon: 'bi-speedometer2', text: 'Real-time analytics dashboard with WebSocket streaming, interactive D3.js/Chart.js visualizations, date range filters, CSV/PDF export, and role-based views' },
        { icon: 'bi-braces', text: 'Production REST API with OpenAPI spec, request validation, rate limiting, Redis caching, pagination, full test coverage, and automated API documentation' },
        { icon: 'bi-controller', text: 'Multiplayer browser game with HTML5 Canvas rendering, physics engine, WebSocket game server, matchmaking, leaderboards, and replay system' },
        { icon: 'bi-cpu', text: 'Developer CLI tool in Go with cobra commands, YAML config management, interactive prompts, auto-update mechanism, shell completions, and cross-platform releases' },
        { icon: 'bi-palette', text: 'React design system with design tokens, 30+ accessible components, Storybook documentation, visual regression testing, and automated npm publishing' },
        { icon: 'bi-database-gear', text: 'ETL data pipeline with configurable extractors (API/DB/files), Polars transformations, data quality checks, Prefect orchestration, and observability' },
        { icon: 'bi-chat-dots', text: 'Real-time chat application with WebSocket, typing indicators, read receipts, file sharing, message search, E2E encryption, and push notifications' },
        { icon: 'bi-puzzle', text: 'Chrome extension with popup quick tools, content script injection (Shadow DOM), context menu actions, cross-device sync, and Chrome Web Store publishing' },
        { icon: 'bi-kanban', text: 'Project management app (Trello/Jira clone) with drag-drop kanban, sprint planning, time tracking, team collaboration, activity feed, and Gantt chart' },
        { icon: 'bi-graph-up-arrow', text: 'SaaS boilerplate with Stripe subscriptions, team workspaces, usage metering, admin dashboard, email transactionals, and multi-tenant database isolation' },
        { icon: 'bi-globe', text: 'Headless CMS with content modeling, rich text editor, media library, REST + GraphQL APIs, webhooks, role-based access, and multi-language content' },
    ];

    // ── Fuzzy search with Levenshtein ──
    function levenshtein(a, b) {
        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;
        const matrix = [];
        for (let i = 0; i <= b.length; i++) matrix[i] = [i];
        for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                const cost = b[i - 1] === a[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }
        return matrix[b.length][a.length];
    }

    function fuzzyScore(query, text) {
        const q = query.toLowerCase();
        const t = text.toLowerCase();

        // Exact contains — highest priority
        if (t.includes(q)) return 100;

        // Word-level matching
        const qWords = q.split(/\s+/).filter(w => w.length > 1);
        const tWords = t.split(/\s+/);
        if (qWords.length === 0) return 0;

        let wordMatches = 0;
        let partialMatches = 0;
        let fuzzyMatches = 0;

        for (const qw of qWords) {
            let bestWordScore = 0;
            for (const tw of tWords) {
                // Exact word match
                if (tw === qw) { bestWordScore = Math.max(bestWordScore, 3); continue; }
                // Word starts with query word
                if (tw.startsWith(qw) || qw.startsWith(tw)) { bestWordScore = Math.max(bestWordScore, 2.5); continue; }
                // Contains
                if (tw.includes(qw) || qw.includes(tw)) { bestWordScore = Math.max(bestWordScore, 2); continue; }
                // Levenshtein fuzzy (for typos)
                const maxLen = Math.max(qw.length, tw.length);
                if (maxLen <= 2) continue; // skip very short words
                const dist = levenshtein(qw, tw);
                const ratio = 1 - (dist / maxLen);
                if (ratio >= 0.6) { bestWordScore = Math.max(bestWordScore, ratio * 1.5); }
            }
            if (bestWordScore >= 3) wordMatches++;
            else if (bestWordScore >= 2) partialMatches++;
            else if (bestWordScore > 0) fuzzyMatches++;
        }

        const totalScore = (wordMatches * 30) + (partialMatches * 20) + (fuzzyMatches * 10);
        return Math.min(99, totalScore / qWords.length);
    }

    function renderTellAiSuggestions(filter) {
        const container = document.getElementById('tellAiSuggestions');
        const query = (filter || '').trim();

        let results;
        if (!query) {
            results = TELL_AI_SUGGESTIONS.map((s, i) => ({ ...s, origIdx: i }));
        } else {
            results = TELL_AI_SUGGESTIONS
                .map((s, i) => ({ ...s, origIdx: i, score: fuzzyScore(query, s.text) }))
                .filter(s => s.score > 5)
                .sort((a, b) => b.score - a.score);
        }

        if (query && results.length === 0) {
            container.innerHTML = '<span class="tell-ai-chips-empty"><i class="bi bi-info-circle"></i> No matching suggestions — type freely and hit Generate</span>';
            return;
        }

        container.innerHTML = results.map(s =>
            `<span class="tell-ai-chip" title="${esc(s.text)}" data-idx="${s.origIdx}"><i class="bi ${s.icon}"></i> ${esc(s.text)}</span>`
        ).join('');
        container.querySelectorAll('.tell-ai-chip').forEach(chip => {
            chip.addEventListener('click', function () {
                const idx = parseInt(this.dataset.idx);
                document.getElementById('tellAiInput').value = TELL_AI_SUGGESTIONS[idx].text;
                document.getElementById('tellAiInput').focus();
                renderTellAiSuggestions('');
            });
        });
    }

    let tellAiFilterTimeout;
    document.getElementById('tellAiInput').addEventListener('input', function () {
        clearTimeout(tellAiFilterTimeout);
        const val = this.value;
        tellAiFilterTimeout = setTimeout(() => renderTellAiSuggestions(val), 200);
    });

    let tellAiResult = null;

    function openTellAiModal() {
        document.getElementById('tellAiInput').value = '';
        renderTellAiSuggestions();
        document.getElementById('tellAiStatus').classList.add('d-none');
        document.getElementById('tellAiPreview').classList.add('d-none');
        document.getElementById('tellAiActions').classList.add('d-none');
        document.getElementById('tellAiModelName').textContent = settings.model || '—';
        tellAiResult = null;
        new bootstrap.Modal(document.getElementById('tellAiModal')).show();
        setTimeout(() => document.getElementById('tellAiInput').focus(), 300);
    }

    document.getElementById('tellAiBtn').addEventListener('click', function (e) {
        e.preventDefault();
        openTellAiModal();
    });

    document.getElementById('tellAiBtnTop').addEventListener('click', function () {
        openTellAiModal();
    });

    document.getElementById('tellAiInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('tellAiSubmit').click();
        }
    });

    document.getElementById('tellAiSubmit').addEventListener('click', async function () {
        const input = document.getElementById('tellAiInput').value.trim();
        if (!input) return;

        const btn = this;
        const statusEl = document.getElementById('tellAiStatus');
        const previewEl = document.getElementById('tellAiPreview');
        const actionsEl = document.getElementById('tellAiActions');

        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Generating...';
        statusEl.classList.remove('d-none');
        statusEl.innerHTML = '<div class="d-flex align-items-center gap-2"><span class="spinner-border spinner-border-sm text-primary"></span><span class="text-muted" style="font-size:0.82rem;">AI is analyzing your request and generating sequential prompts...</span></div>';
        previewEl.classList.add('d-none');
        actionsEl.classList.add('d-none');
        tellAiResult = null;

        try {
            const response = await fetch('/api/aichat/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ollamaUrl: settings.ollamaUrl,
                    model: settings.model,
                    messages: [
                        { role: 'system', content: TELL_AI_SYSTEM_PROMPT },
                        { role: 'user', content: input },
                    ],
                }),
            });

            if (!response.ok) {
                throw new Error(response.statusText + '. Is Ollama running?');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const text = decoder.decode(value);
                const lines = text.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.message?.content || data.content || '';
                            if (content) fullText += content;
                        } catch {}
                    }
                }
            }

            // Parse JSON from response (handle possible markdown code blocks)
            let jsonStr = fullText.trim();
            const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim();

            const parsed = JSON.parse(jsonStr);
            if (!parsed.folder || !parsed.prompts || !Array.isArray(parsed.prompts)) {
                throw new Error('Invalid response format from AI');
            }

            tellAiResult = parsed;

            // Show preview
            statusEl.innerHTML = '<span class="text-success" style="font-size:0.82rem;"><i class="bi bi-check-circle"></i> Generated ' + parsed.prompts.length + ' prompts!</span>';
            previewEl.classList.remove('d-none');
            previewEl.innerHTML = `
                <div class="fw-semibold mb-2"><i class="bi bi-folder2"></i> ${esc(parsed.folder)}</div>
                ${parsed.prompts.map((p, i) => `
                    <div class="mb-2 pb-2" style="border-bottom:1px solid var(--bs-border-color);">
                        <div class="fw-semibold" style="font-size:0.78rem; color:var(--bs-primary);">${esc(p.title)}</div>
                        <div class="text-muted mt-1" style="font-size:0.75rem; white-space:pre-wrap; max-height:80px; overflow:hidden;">${esc((p.body || '').substring(0, 200))}${(p.body || '').length > 200 ? '...' : ''}</div>
                    </div>
                `).join('')}
            `;
            actionsEl.classList.remove('d-none');

        } catch (err) {
            statusEl.innerHTML = '<span class="text-danger" style="font-size:0.82rem;"><i class="bi bi-exclamation-triangle"></i> Error: ' + esc(err.message || String(err)) + '</span>';
            previewEl.classList.add('d-none');
            actionsEl.classList.add('d-none');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-stars"></i> Generate Prompts';
        }
    });

    document.getElementById('tellAiRetry').addEventListener('click', function () {
        document.getElementById('tellAiSubmit').click();
    });

    document.getElementById('tellAiAccept').addEventListener('click', function () {
        if (!tellAiResult) return;

        const folderId = nextId++;
        folders.push({ id: folderId, name: tellAiResult.folder, order: folders.length });

        tellAiResult.prompts.forEach((sp, i) => {
            prompts.push({
                id: nextId++,
                folderId: folderId,
                title: sp.title || '',
                body: sp.body || '',
                polished: '',
                done: false,
                order: i,
                createdAt: new Date().toISOString(),
            });
        });

        save();
        activeFolder = folderId;
        renderFolders();
        renderPrompts();

        bootstrap.Modal.getInstance(document.getElementById('tellAiModal')).hide();
        tellAiResult = null;
    });

    // ── Keyboard shortcuts ──
    document.addEventListener('keydown', function (e) {
        // Ctrl+N: new prompt
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('addPromptBtn').click();
        }
    });

    // ── Helpers ──
    function esc(s) {
        if (!s) return '';
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // ── Init ──
    loadData().then(() => {
        renderFolders();
        renderPrompts();
    });
    checkOllama();
});
