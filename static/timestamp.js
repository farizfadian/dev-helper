// ── Timestamp Converter ──
document.addEventListener('DOMContentLoaded', function () {
    const tsInput = document.getElementById('tsInput');
    const tzSelect = document.getElementById('timezone');
    const formatList = document.getElementById('formatList');
    const relativeTime = document.getElementById('relativeTime');
    const datePicker = document.getElementById('datePicker');
    const timePicker = document.getElementById('timePicker');

    // Populate timezones
    const zones = Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Jakarta', 'Asia/Kolkata', 'Australia/Sydney'];
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    tzSelect.innerHTML = zones.map(z => `<option value="${z}" ${z === localTz ? 'selected' : ''}>${z}</option>`).join('');

    function parseInput(val) {
        val = val.trim();
        if (!val) return null;
        // Unix timestamp (seconds)
        if (/^\d{10}$/.test(val)) return new Date(parseInt(val) * 1000);
        // Unix timestamp (milliseconds)
        if (/^\d{13}$/.test(val)) return new Date(parseInt(val));
        // Try Date.parse
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d;
        // Try common formats
        const d2 = new Date(val.replace(/-/g, '/'));
        if (!isNaN(d2.getTime())) return d2;
        return null;
    }

    function update() {
        const date = parseInput(tsInput.value);
        if (!date) {
            formatList.innerHTML = '<div class="text-muted text-center py-3">Enter a valid timestamp or date</div>';
            relativeTime.textContent = '—';
            return;
        }

        const tz = tzSelect.value;
        const formats = [
            { label: 'Unix (seconds)', value: Math.floor(date.getTime() / 1000) },
            { label: 'Unix (milliseconds)', value: date.getTime() },
            { label: 'ISO 8601', value: date.toISOString() },
            { label: 'RFC 2822', value: date.toUTCString() },
            { label: 'Local', value: date.toLocaleString('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' }) },
            { label: 'Date only', value: date.toLocaleDateString('en-CA', { timeZone: tz }) },
            { label: 'Time only', value: date.toLocaleTimeString('en-GB', { timeZone: tz, hour12: false }) },
            { label: 'Relative', value: getRelative(date) },
            { label: 'Day of week', value: date.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }) },
            { label: 'Week number', value: 'Week ' + getWeekNumber(date) },
            { label: 'Day of year', value: 'Day ' + getDayOfYear(date) },
            { label: 'UTC offset', value: getUTCOffset(date, tz) },
        ];

        formatList.innerHTML = formats.map(f =>
            `<div class="format-row" onclick="navigator.clipboard.writeText('${esc(String(f.value))}');this.style.color='var(--bs-success)';setTimeout(()=>this.style.color='',600)">
                <span class="format-label">${f.label}</span>
                <span class="format-value">${esc(String(f.value))}</span>
            </div>`
        ).join('');

        relativeTime.innerHTML = `<strong>${getRelative(date)}</strong><br><span class="text-muted" style="font-size:0.8rem;">${Math.abs(Math.floor((Date.now() - date.getTime()) / 1000)).toLocaleString()} seconds ${date < new Date() ? 'ago' : 'from now'}</span>`;

        // Sync date picker
        datePicker.value = date.toLocaleDateString('en-CA', { timeZone: tz });
        timePicker.value = date.toLocaleTimeString('en-GB', { timeZone: tz, hour12: false });
    }

    function getRelative(date) {
        const diff = Date.now() - date.getTime();
        const abs = Math.abs(diff);
        const suffix = diff > 0 ? 'ago' : 'from now';
        if (abs < 60000) return 'just now';
        if (abs < 3600000) return Math.floor(abs / 60000) + ' minutes ' + suffix;
        if (abs < 86400000) return Math.floor(abs / 3600000) + ' hours ' + suffix;
        if (abs < 2592000000) return Math.floor(abs / 86400000) + ' days ' + suffix;
        if (abs < 31536000000) return Math.floor(abs / 2592000000) + ' months ' + suffix;
        return Math.floor(abs / 31536000000) + ' years ' + suffix;
    }

    function getWeekNumber(d) {
        const onejan = new Date(d.getFullYear(), 0, 1);
        return Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
    }

    function getDayOfYear(d) {
        const start = new Date(d.getFullYear(), 0, 0);
        return Math.floor((d - start) / 86400000);
    }

    function getUTCOffset(date, tz) {
        const str = date.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
        const match = str.match(/GMT([+-]\d{2}:\d{2})/);
        return match ? 'UTC' + match[1] : 'UTC+00:00';
    }

    tsInput.addEventListener('input', update);
    tzSelect.addEventListener('change', update);

    datePicker.addEventListener('change', function () {
        if (this.value && timePicker.value) {
            tsInput.value = this.value + 'T' + timePicker.value;
            update();
        }
    });
    timePicker.addEventListener('change', function () {
        if (datePicker.value && this.value) {
            tsInput.value = datePicker.value + 'T' + this.value;
            update();
        }
    });

    document.getElementById('nowBtn').addEventListener('click', function () {
        tsInput.value = Math.floor(Date.now() / 1000);
        update();
    });

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // Init with current time
    tsInput.value = Math.floor(Date.now() / 1000);
    update();
});
