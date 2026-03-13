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
        prompts.forEach(p => { counts[p.folderId] = (counts[p.folderId] || 0) + 1; });

        let html = `<div class="folder-item ${activeFolder === 'all' ? 'active' : ''}" data-folder="all">
            <span><i class="bi bi-journal-text"></i> All Prompts</span>
            <span class="folder-count">${prompts.length}</span>
        </div>`;

        folders.sort((a, b) => a.order - b.order).forEach(f => {
            html += `<div class="folder-item ${activeFolder === f.id ? 'active' : ''}" data-folder="${f.id}">
                <span><i class="bi bi-folder2"></i> ${esc(f.name)}</span>
                <div class="d-flex gap-1 align-items-center">
                    <span class="folder-count">${counts[f.id] || 0}</span>
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

    // ── Render Prompts ──
    function renderPrompts() {
        const filtered = activeFolder === 'all'
            ? prompts
            : prompts.filter(p => p.folderId === activeFolder);

        filtered.sort((a, b) => a.order - b.order);
        document.getElementById('promptCount').textContent = filtered.length;

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

            const collapsedClass = p._collapsed ? ' collapsed' : '';

            return `<div class="prompt-card${polishingClass}${collapsedClass}" data-id="${p.id}" draggable="true">
                <div class="prompt-header" onclick="toggleCollapse(${p.id}, event)">
                    <div class="d-flex align-items-center gap-2 flex-grow-1">
                        <i class="bi bi-chevron-down collapse-icon"></i>
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
