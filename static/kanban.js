// ── Kanban Board ──
document.addEventListener('DOMContentLoaded', function () {
    const STORAGE_KEY = 'devhelper_kanban';
    let tasks = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    let nextId = tasks.length > 0 ? Math.max(...tasks.map(t => t.id)) + 1 : 1;
    let draggedId = null;

    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    }

    function render() {
        ['todo', 'progress', 'done'].forEach(col => {
            const body = document.querySelector(`.kanban-col-body[data-col="${col}"]`);
            const colTasks = tasks.filter(t => t.col === col);
            document.getElementById('count' + col.charAt(0).toUpperCase() + col.slice(1).replace('progress', 'Progress')).textContent = colTasks.length;

            body.innerHTML = colTasks.map(t => {
                let meta = '';
                if (t.label) meta += `<span class="label label-${t.label}">${t.label}</span>`;
                if (t.due) {
                    const overdue = new Date(t.due) < new Date() && t.col !== 'done';
                    meta += `<span class="label" style="background:${overdue ? 'rgba(220,53,69,0.15);color:#dc3545' : 'rgba(108,117,125,0.15);color:var(--bs-secondary-color)'}"><i class="bi bi-calendar"></i> ${t.due}</span>`;
                }
                return `<div class="kanban-card" draggable="true" data-id="${t.id}">
                    <div class="d-flex justify-content-between">
                        <div class="card-title">${esc(t.title)}</div>
                        <div class="dropdown">
                            <i class="bi bi-three-dots" style="cursor:pointer; font-size:0.8rem;" data-bs-toggle="dropdown"></i>
                            <ul class="dropdown-menu dropdown-menu-end" style="font-size:0.8rem;">
                                <li><a class="dropdown-item" href="#" onclick="editTask(${t.id})"><i class="bi bi-pencil"></i> Edit</a></li>
                                <li><a class="dropdown-item text-danger" href="#" onclick="deleteTask(${t.id})"><i class="bi bi-trash"></i> Delete</a></li>
                            </ul>
                        </div>
                    </div>
                    ${t.desc ? `<div class="card-desc">${esc(t.desc)}</div>` : ''}
                    ${meta ? `<div class="card-meta">${meta}</div>` : ''}
                </div>`;
            }).join('');
        });
        // Fix count for "progress"
        document.getElementById('countProgress').textContent = tasks.filter(t => t.col === 'progress').length;

        bindDrag();
    }

    // Drag & drop
    function bindDrag() {
        document.querySelectorAll('.kanban-card').forEach(card => {
            card.addEventListener('dragstart', function (e) {
                draggedId = parseInt(this.dataset.id);
                this.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', function () {
                this.classList.remove('dragging');
                draggedId = null;
            });
        });

        document.querySelectorAll('.kanban-col-body').forEach(body => {
            body.addEventListener('dragover', function (e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            body.addEventListener('drop', function (e) {
                e.preventDefault();
                if (draggedId === null) return;
                const col = this.dataset.col;
                const task = tasks.find(t => t.id === draggedId);
                if (task) {
                    task.col = col;
                    save();
                    render();
                }
            });
        });
    }

    // Add task
    window.quickAdd = function (col) {
        document.getElementById('editId').value = '';
        document.getElementById('taskTitle').value = '';
        document.getElementById('taskDesc').value = '';
        document.getElementById('taskLabel').value = '';
        document.getElementById('taskDue').value = '';
        document.getElementById('modalTitle').textContent = 'Add Task';
        document.getElementById('editId').dataset.col = col;
        new bootstrap.Modal(document.getElementById('taskModal')).show();
        setTimeout(() => document.getElementById('taskTitle').focus(), 200);
    };

    document.getElementById('addTaskBtn').addEventListener('click', () => quickAdd('todo'));

    document.getElementById('saveTaskBtn').addEventListener('click', function () {
        const title = document.getElementById('taskTitle').value.trim();
        if (!title) return;
        const editId = document.getElementById('editId').value;
        const desc = document.getElementById('taskDesc').value.trim();
        const label = document.getElementById('taskLabel').value;
        const due = document.getElementById('taskDue').value;

        if (editId) {
            const task = tasks.find(t => t.id === parseInt(editId));
            if (task) { task.title = title; task.desc = desc; task.label = label; task.due = due; }
        } else {
            const col = document.getElementById('editId').dataset.col || 'todo';
            tasks.push({ id: nextId++, title, desc, label, due, col });
        }
        save();
        render();
        bootstrap.Modal.getInstance(document.getElementById('taskModal')).hide();
    });

    // Enter to save
    document.getElementById('taskTitle').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') document.getElementById('saveTaskBtn').click();
    });

    window.editTask = function (id) {
        const task = tasks.find(t => t.id === id);
        if (!task) return;
        document.getElementById('editId').value = id;
        document.getElementById('taskTitle').value = task.title;
        document.getElementById('taskDesc').value = task.desc || '';
        document.getElementById('taskLabel').value = task.label || '';
        document.getElementById('taskDue').value = task.due || '';
        document.getElementById('modalTitle').textContent = 'Edit Task';
        new bootstrap.Modal(document.getElementById('taskModal')).show();
    };

    window.deleteTask = function (id) {
        tasks = tasks.filter(t => t.id !== id);
        save();
        render();
    };

    document.getElementById('clearDoneBtn').addEventListener('click', function () {
        tasks = tasks.filter(t => t.col !== 'done');
        save();
        render();
    });

    document.getElementById('exportBtn').addEventListener('click', function () {
        const blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.download = 'kanban-tasks.json';
        a.href = URL.createObjectURL(blob);
        a.click();
        URL.revokeObjectURL(a.href);
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    render();
});
