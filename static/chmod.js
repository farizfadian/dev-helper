// ── Chmod Calculator ──
document.addEventListener('DOMContentLoaded', function () {
    const checkboxes = document.querySelectorAll('.perm-grid input[type="checkbox"]');
    const octalInput = document.getElementById('octalInput');
    const setuid = document.getElementById('setuid');
    const setgid = document.getElementById('setgid');
    const sticky = document.getElementById('sticky');

    const permBits = { read: 4, write: 2, execute: 1 };

    function getOctal() {
        let owner = 0, group = 0, others = 0, special = 0;
        checkboxes.forEach(cb => {
            if (!cb.checked) return;
            const val = permBits[cb.dataset.perm];
            if (cb.dataset.who === 'owner') owner += val;
            else if (cb.dataset.who === 'group') group += val;
            else if (cb.dataset.who === 'others') others += val;
        });
        if (setuid.checked) special += 4;
        if (setgid.checked) special += 2;
        if (sticky.checked) special += 1;
        return { special, owner, group, others };
    }

    function setFromOctal(str) {
        const digits = str.padStart(4, '0').slice(-4).split('').map(Number);
        const special = digits[0];
        const vals = [digits[1], digits[2], digits[3]];
        const whos = ['owner', 'group', 'others'];

        checkboxes.forEach(cb => {
            const whoIdx = whos.indexOf(cb.dataset.who);
            const bit = permBits[cb.dataset.perm];
            cb.checked = (vals[whoIdx] & bit) !== 0;
        });

        setuid.checked = (special & 4) !== 0;
        setgid.checked = (special & 2) !== 0;
        sticky.checked = (special & 1) !== 0;
    }

    function getSymbolic() {
        const { special, owner, group, others } = getOctal();
        const toStr = (val, suid, suidChar) => {
            let r = (val & 4) ? 'r' : '-';
            let w = (val & 2) ? 'w' : '-';
            let x;
            if (suid) {
                x = (val & 1) ? suidChar.toLowerCase() : suidChar.toUpperCase();
            } else {
                x = (val & 1) ? 'x' : '-';
            }
            return r + w + x;
        };

        return toStr(owner, special & 4, 's') +
               toStr(group, special & 2, 's') +
               toStr(others, special & 1, 't');
    }

    function update() {
        const { special, owner, group, others } = getOctal();
        const octalStr = special > 0
            ? `${special}${owner}${group}${others}`
            : `${owner}${group}${others}`;
        const fullOctal = `${special}${owner}${group}${others}`;

        document.getElementById('octalDisplay').textContent = '0' + fullOctal;
        octalInput.value = octalStr;

        const symbolic = getSymbolic();
        const display = document.getElementById('symbolicDisplay');
        display.innerHTML = symbolic.split('').map((ch, i) => {
            const on = ch !== '-';
            return `<span class="perm-char ${on ? 'on' : 'off'}">${ch}</span>`;
        }).join('');

        // Human description
        const descParts = [];
        const descPerm = (val, who) => {
            const perms = [];
            if (val & 4) perms.push('read');
            if (val & 2) perms.push('write');
            if (val & 1) perms.push('execute');
            if (perms.length === 0) return who + ': none';
            return who + ': ' + perms.join(', ');
        };
        descParts.push(descPerm(owner, 'Owner'));
        descParts.push(descPerm(group, 'Group'));
        descParts.push(descPerm(others, 'Others'));
        document.getElementById('humanDesc').textContent = descParts.join(' · ');

        // Commands
        document.getElementById('cmdOctal').textContent = `chmod ${octalStr} filename`;
        document.getElementById('cmdSymbolic').textContent = `chmod u=${symbolicPart(owner)},g=${symbolicPart(group)},o=${symbolicPart(others)} filename`;
        document.getElementById('cmdRecursive').textContent = `chmod -R ${octalStr} directory/`;

        // ls -l output
        const fileType = document.querySelector('input[name="fileType"]:checked').value;
        document.getElementById('lsOutput').textContent = `${fileType}${symbolic} 1 user group 4096 Mar 09 12:00 filename`;
    }

    function symbolicPart(val) {
        let s = '';
        if (val & 4) s += 'r';
        if (val & 2) s += 'w';
        if (val & 1) s += 'x';
        return s || '-';
    }

    // Events
    checkboxes.forEach(cb => cb.addEventListener('change', update));
    [setuid, setgid, sticky].forEach(cb => cb.addEventListener('change', update));
    document.querySelectorAll('input[name="fileType"]').forEach(r => r.addEventListener('change', update));

    octalInput.addEventListener('input', function () {
        const val = this.value.replace(/[^0-7]/g, '');
        if (val.length >= 3 && val.length <= 4) {
            setFromOctal(val);
            update();
        }
    });

    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            setFromOctal(this.dataset.octal);
            update();
        });
    });

    // Initial
    update();
});

function copyText(text) {
    navigator.clipboard.writeText(text).then(() => {
        // Brief visual feedback could be added
    });
}
