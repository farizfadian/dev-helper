// ── Git Cheat Sheet ──
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('searchInput');
    const categories = document.getElementById('categories');
    const commandList = document.getElementById('commandList');
    let activeCategory = 'all';

    const commands = [
        { cat: 'Setup', name: 'Init repo', cmd: 'git init', desc: 'Initialize a new Git repository' },
        { cat: 'Setup', name: 'Clone repo', cmd: 'git clone <url>', desc: 'Clone a remote repository' },
        { cat: 'Setup', name: 'Set user name', cmd: 'git config --global user.name "Your Name"', desc: 'Set global username' },
        { cat: 'Setup', name: 'Set user email', cmd: 'git config --global user.email "you@example.com"', desc: 'Set global email' },
        { cat: 'Setup', name: 'List config', cmd: 'git config --list', desc: 'Show all Git configuration' },

        { cat: 'Basics', name: 'Status', cmd: 'git status', desc: 'Show working tree status' },
        { cat: 'Basics', name: 'Add file', cmd: 'git add <file>', desc: 'Stage a specific file' },
        { cat: 'Basics', name: 'Add all', cmd: 'git add .', desc: 'Stage all changes' },
        { cat: 'Basics', name: 'Commit', cmd: 'git commit -m "message"', desc: 'Commit staged changes' },
        { cat: 'Basics', name: 'Amend commit', cmd: 'git commit --amend', desc: 'Modify the last commit' },
        { cat: 'Basics', name: 'Diff', cmd: 'git diff', desc: 'Show unstaged changes' },
        { cat: 'Basics', name: 'Diff staged', cmd: 'git diff --staged', desc: 'Show staged changes' },
        { cat: 'Basics', name: 'Log', cmd: 'git log --oneline --graph', desc: 'Show commit history (compact)' },
        { cat: 'Basics', name: 'Show commit', cmd: 'git show <commit>', desc: 'Show commit details' },

        { cat: 'Branches', name: 'List branches', cmd: 'git branch', desc: 'List local branches' },
        { cat: 'Branches', name: 'Create branch', cmd: 'git branch <name>', desc: 'Create a new branch' },
        { cat: 'Branches', name: 'Switch branch', cmd: 'git checkout <branch>', desc: 'Switch to a branch' },
        { cat: 'Branches', name: 'Create & switch', cmd: 'git checkout -b <name>', desc: 'Create and switch to new branch' },
        { cat: 'Branches', name: 'Delete branch', cmd: 'git branch -d <name>', desc: 'Delete a merged branch' },
        { cat: 'Branches', name: 'Force delete', cmd: 'git branch -D <name>', desc: 'Force delete a branch' },
        { cat: 'Branches', name: 'Rename branch', cmd: 'git branch -m <old> <new>', desc: 'Rename a branch' },
        { cat: 'Branches', name: 'List remote', cmd: 'git branch -r', desc: 'List remote branches' },

        { cat: 'Merge & Rebase', name: 'Merge', cmd: 'git merge <branch>', desc: 'Merge branch into current' },
        { cat: 'Merge & Rebase', name: 'Merge no-ff', cmd: 'git merge --no-ff <branch>', desc: 'Merge with merge commit' },
        { cat: 'Merge & Rebase', name: 'Abort merge', cmd: 'git merge --abort', desc: 'Abort a merge in progress' },
        { cat: 'Merge & Rebase', name: 'Rebase', cmd: 'git rebase <branch>', desc: 'Rebase current onto branch' },
        { cat: 'Merge & Rebase', name: 'Cherry-pick', cmd: 'git cherry-pick <commit>', desc: 'Apply a specific commit' },

        { cat: 'Remote', name: 'List remotes', cmd: 'git remote -v', desc: 'Show remote URLs' },
        { cat: 'Remote', name: 'Add remote', cmd: 'git remote add <name> <url>', desc: 'Add a remote' },
        { cat: 'Remote', name: 'Fetch', cmd: 'git fetch origin', desc: 'Download remote changes' },
        { cat: 'Remote', name: 'Pull', cmd: 'git pull origin <branch>', desc: 'Fetch and merge remote' },
        { cat: 'Remote', name: 'Push', cmd: 'git push origin <branch>', desc: 'Push commits to remote' },
        { cat: 'Remote', name: 'Push new branch', cmd: 'git push -u origin <branch>', desc: 'Push and set upstream' },
        { cat: 'Remote', name: 'Force push', cmd: 'git push --force-with-lease', desc: 'Force push (safer)' },

        { cat: 'Stash', name: 'Stash changes', cmd: 'git stash', desc: 'Stash working changes' },
        { cat: 'Stash', name: 'Stash with name', cmd: 'git stash push -m "name"', desc: 'Stash with description' },
        { cat: 'Stash', name: 'List stashes', cmd: 'git stash list', desc: 'Show all stashes' },
        { cat: 'Stash', name: 'Apply stash', cmd: 'git stash pop', desc: 'Apply and remove latest stash' },
        { cat: 'Stash', name: 'Apply specific', cmd: 'git stash apply stash@{n}', desc: 'Apply specific stash' },
        { cat: 'Stash', name: 'Drop stash', cmd: 'git stash drop stash@{n}', desc: 'Delete a specific stash' },

        { cat: 'Undo', name: 'Unstage file', cmd: 'git restore --staged <file>', desc: 'Unstage a file' },
        { cat: 'Undo', name: 'Discard changes', cmd: 'git restore <file>', desc: 'Discard working changes' },
        { cat: 'Undo', name: 'Reset soft', cmd: 'git reset --soft HEAD~1', desc: 'Undo commit, keep staged' },
        { cat: 'Undo', name: 'Reset mixed', cmd: 'git reset HEAD~1', desc: 'Undo commit, keep unstaged' },
        { cat: 'Undo', name: 'Reset hard', cmd: 'git reset --hard HEAD~1', desc: 'Undo commit, discard all' },
        { cat: 'Undo', name: 'Revert commit', cmd: 'git revert <commit>', desc: 'Create reverse commit' },
        { cat: 'Undo', name: 'Reflog', cmd: 'git reflog', desc: 'Show all HEAD movements' },

        { cat: 'Tags', name: 'List tags', cmd: 'git tag', desc: 'List all tags' },
        { cat: 'Tags', name: 'Create tag', cmd: 'git tag v1.0.0', desc: 'Create lightweight tag' },
        { cat: 'Tags', name: 'Annotated tag', cmd: 'git tag -a v1.0.0 -m "message"', desc: 'Create annotated tag' },
        { cat: 'Tags', name: 'Push tag', cmd: 'git push origin v1.0.0', desc: 'Push a tag to remote' },
        { cat: 'Tags', name: 'Push all tags', cmd: 'git push --tags', desc: 'Push all tags' },
        { cat: 'Tags', name: 'Delete tag', cmd: 'git tag -d v1.0.0', desc: 'Delete local tag' },

        { cat: 'Inspect', name: 'Blame', cmd: 'git blame <file>', desc: 'Show who changed each line' },
        { cat: 'Inspect', name: 'Log file', cmd: 'git log --follow <file>', desc: 'Show file history' },
        { cat: 'Inspect', name: 'Shortlog', cmd: 'git shortlog -sn', desc: 'Commit count by author' },
        { cat: 'Inspect', name: 'Search commits', cmd: 'git log --grep="keyword"', desc: 'Search commit messages' },
        { cat: 'Inspect', name: 'Search code', cmd: 'git log -S "string"', desc: 'Find commits that add/remove string' },
    ];

    const cats = ['all', ...new Set(commands.map(c => c.cat))];
    categories.innerHTML = cats.map(c =>
        `<button class="btn btn-sm btn-outline-secondary category-btn ${c === 'all' ? 'active' : ''}" data-cat="${c}">${c === 'all' ? 'All' : c}</button>`
    ).join('');

    categories.addEventListener('click', function (e) {
        const btn = e.target.closest('.category-btn');
        if (!btn) return;
        activeCategory = btn.dataset.cat;
        categories.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
    });

    searchInput.addEventListener('input', render);

    function render() {
        const q = searchInput.value.toLowerCase().trim();
        const filtered = commands.filter(c => {
            if (activeCategory !== 'all' && c.cat !== activeCategory) return false;
            if (q && !c.name.toLowerCase().includes(q) && !c.cmd.toLowerCase().includes(q) && !c.desc.toLowerCase().includes(q)) return false;
            return true;
        });

        // Group by category
        const groups = {};
        filtered.forEach(c => {
            if (!groups[c.cat]) groups[c.cat] = [];
            groups[c.cat].push(c);
        });

        let html = '';
        for (const [cat, cmds] of Object.entries(groups)) {
            html += `<h6 class="mt-3 mb-2 text-muted" style="font-size:0.82rem;"><i class="bi bi-folder"></i> ${cat}</h6>`;
            html += '<div class="row g-2">';
            cmds.forEach(c => {
                html += `<div class="col-md-6 col-lg-4">
                    <div class="cmd-card">
                        <div class="fw-semibold" style="font-size:0.85rem;">${esc(c.name)}</div>
                        <div class="cmd-desc">${esc(c.desc)}</div>
                        <code class="cmd-code" onclick="navigator.clipboard.writeText(this.textContent.trim());this.style.color='var(--bs-success)';setTimeout(()=>this.style.color='',600)">${esc(c.cmd)}</code>
                    </div>
                </div>`;
            });
            html += '</div>';
        }

        commandList.innerHTML = html || '<div class="text-center text-muted py-4">No commands found</div>';
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    render();
});
