// ── Text Diff (word-level) ──
document.addEventListener('DOMContentLoaded', function () {
    const textA = document.getElementById('textA');
    const textB = document.getElementById('textB');
    const diffResult = document.getElementById('diffResult');
    const diffStat = document.getElementById('diffStat');

    function diff() {
        const a = textA.value;
        const b = textB.value;
        if (!a && !b) { diffResult.innerHTML = 'Enter text in both fields.'; diffStat.textContent = ''; return; }

        const wordsA = tokenize(a);
        const wordsB = tokenize(b);
        const lcs = computeLCS(wordsA, wordsB);

        let html = '';
        let adds = 0, dels = 0;
        let ia = 0, ib = 0, il = 0;

        while (ia < wordsA.length || ib < wordsB.length) {
            if (il < lcs.length && ia < wordsA.length && ib < wordsB.length && wordsA[ia] === lcs[il] && wordsB[ib] === lcs[il]) {
                html += esc(wordsA[ia]);
                ia++; ib++; il++;
            } else {
                // Deletions from A
                while (ia < wordsA.length && (il >= lcs.length || wordsA[ia] !== lcs[il])) {
                    html += `<span class="diff-del">${esc(wordsA[ia])}</span>`;
                    dels++;
                    ia++;
                }
                // Additions from B
                while (ib < wordsB.length && (il >= lcs.length || wordsB[ib] !== lcs[il])) {
                    html += `<span class="diff-add">${esc(wordsB[ib])}</span>`;
                    adds++;
                    ib++;
                }
            }
        }

        diffResult.innerHTML = html || '<span class="text-success">Texts are identical!</span>';
        diffStat.innerHTML = `<span class="text-success">+${adds}</span> <span class="text-danger">-${dels}</span> changes`;
    }

    function tokenize(text) {
        // Split into words and whitespace tokens to preserve formatting
        return text.match(/\S+|\s+/g) || [];
    }

    function computeLCS(a, b) {
        const m = a.length, n = b.length;
        // Use space-optimized LCS for large texts
        if (m > 5000 || n > 5000) {
            // Simplified: just return common words in order
            return simpleLCS(a, b);
        }

        const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
            }
        }

        const lcs = [];
        let i = m, j = n;
        while (i > 0 && j > 0) {
            if (a[i-1] === b[j-1]) { lcs.unshift(a[i-1]); i--; j--; }
            else if (dp[i-1][j] > dp[i][j-1]) i--;
            else j--;
        }
        return lcs;
    }

    function simpleLCS(a, b) {
        // Greedy match for large texts
        const result = [];
        let j = 0;
        for (let i = 0; i < a.length && j < b.length; i++) {
            if (a[i] === b[j]) { result.push(a[i]); j++; }
        }
        return result;
    }

    document.getElementById('diffBtn').addEventListener('click', diff);
    document.getElementById('swapBtn').addEventListener('click', function () {
        const tmp = textA.value; textA.value = textB.value; textB.value = tmp;
        diff();
    });
    document.getElementById('clearBtn').addEventListener('click', function () {
        textA.value = ''; textB.value = '';
        diffResult.innerHTML = 'Compare two text blocks to see word-level differences.';
        diffStat.textContent = '';
    });
    document.getElementById('copyDiff').addEventListener('click', function () {
        navigator.clipboard.writeText(diffResult.textContent).then(() => {
            this.innerHTML = '<i class="bi bi-check-lg text-success"></i>';
            setTimeout(() => { this.innerHTML = '<i class="bi bi-clipboard"></i>'; }, 1500);
        });
    });

    // Auto-diff on input
    let timer;
    [textA, textB].forEach(el => el.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(diff, 500);
    }));

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
});
