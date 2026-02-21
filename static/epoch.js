document.addEventListener('DOMContentLoaded', function () {
    // ── Elements ──
    var liveClock = document.getElementById('liveClock');
    var liveDate = document.getElementById('liveDate');
    var liveUnit = document.getElementById('liveUnit');
    var toggleLiveUnit = document.getElementById('toggleLiveUnit');
    var epochInput = document.getElementById('epochInput');
    var epochToDateBtn = document.getElementById('epochToDateBtn');
    var epochResult = document.getElementById('epochResult');
    var epochResultBody = document.getElementById('epochResultBody');
    var dateInput = document.getElementById('dateInput');
    var timeInput = document.getElementById('timeInput');
    var dateToEpochBtn = document.getElementById('dateToEpochBtn');
    var dateStringInput = document.getElementById('dateStringInput');
    var dateResult = document.getElementById('dateResult');
    var dateResultBody = document.getElementById('dateResultBody');
    var diffFrom = document.getElementById('diffFrom');
    var diffTo = document.getElementById('diffTo');
    var diffCalcBtn = document.getElementById('diffCalcBtn');
    var diffResult = document.getElementById('diffResult');
    var diffResultText = document.getElementById('diffResultText');

    var showMs = false;

    // ── Format helpers ──
    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function pad(n, len) {
        var s = String(n);
        while (s.length < (len || 2)) s = '0' + s;
        return s;
    }

    function formatFull(d) {
        return DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear()
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
            + ' (UTC' + formatTZOffset(d) + ')';
    }

    function formatTZOffset(d) {
        var off = -d.getTimezoneOffset();
        var sign = off >= 0 ? '+' : '-';
        off = Math.abs(off);
        return sign + pad(Math.floor(off / 60)) + ':' + pad(off % 60);
    }

    // ── Live clock ──
    function updateLiveClock() {
        var now = new Date();
        var ts = showMs ? now.getTime() : Math.floor(now.getTime() / 1000);
        liveClock.textContent = ts;
        liveDate.textContent = formatFull(now);
        liveUnit.textContent = showMs ? 'milliseconds' : 'seconds';
        toggleLiveUnit.textContent = showMs ? 'switch to seconds' : 'switch to ms';
    }
    setInterval(updateLiveClock, 100);
    updateLiveClock();

    toggleLiveUnit.addEventListener('click', function () {
        showMs = !showMs;
        updateLiveClock();
    });

    liveClock.addEventListener('click', function () {
        copyText(liveClock.textContent);
    });

    function formatISO(d) {
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
            + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
            + formatTZOffset(d);
    }

    function formatISOUTC(d) {
        return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
            + 'T' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds())
            + 'Z';
    }

    function formatRFC2822(d) {
        return DAYS[d.getDay()] + ', ' + pad(d.getDate()) + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear()
            + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
            + ' ' + formatTZOffset(d).replace(':', '');
    }

    function formatRelative(d) {
        var now = new Date();
        var diffMs = now.getTime() - d.getTime();
        var future = diffMs < 0;
        var abs = Math.abs(diffMs);
        var seconds = Math.floor(abs / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);
        var months = Math.floor(days / 30.44);
        var years = Math.floor(days / 365.25);

        var str;
        if (seconds < 5) str = 'just now';
        else if (seconds < 60) str = seconds + ' seconds';
        else if (minutes < 60) str = minutes + ' minute' + (minutes > 1 ? 's' : '');
        else if (hours < 24) str = hours + ' hour' + (hours > 1 ? 's' : '');
        else if (days < 30) str = days + ' day' + (days > 1 ? 's' : '');
        else if (months < 12) str = months + ' month' + (months > 1 ? 's' : '');
        else str = years + ' year' + (years > 1 ? 's' : '');

        if (str === 'just now') return str;
        return future ? 'in ' + str : str + ' ago';
    }

    function getDayOfYear(d) {
        var start = new Date(d.getFullYear(), 0, 0);
        var diff = d - start;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }

    function getWeekNumber(d) {
        var target = new Date(d.valueOf());
        var dayNr = (d.getDay() + 6) % 7;
        target.setDate(target.getDate() - dayNr + 3);
        var firstThursday = target.valueOf();
        target.setMonth(0, 1);
        if (target.getDay() !== 4) {
            target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
        }
        return 1 + Math.ceil((firstThursday - target) / (7 * 24 * 60 * 60 * 1000));
    }

    // ── Parse epoch input (auto-detect seconds vs ms) ──
    function parseEpochInput(val) {
        val = val.trim();
        if (!val) return null;

        var num = Number(val);
        if (isNaN(num)) return null;

        // If > 1e12, treat as milliseconds; otherwise seconds
        if (Math.abs(num) > 1e12) {
            return new Date(num);
        }
        return new Date(num * 1000);
    }

    // ── Parse flexible date string ──
    function parseDateString(val) {
        val = val.trim();
        if (!val) return null;

        // Try as epoch first
        var asNum = Number(val);
        if (!isNaN(asNum) && val.match(/^\-?\d+$/)) {
            return parseEpochInput(val);
        }

        // Try native Date.parse
        var ts = Date.parse(val);
        if (!isNaN(ts)) return new Date(ts);

        return null;
    }

    // ── Render epoch → date result ──
    function renderEpochResult(d) {
        if (!d || isNaN(d.getTime())) {
            epochResult.classList.add('d-none');
            return;
        }
        var epochSec = Math.floor(d.getTime() / 1000);
        var epochMs = d.getTime();

        var rows = [
            ['Local', formatFull(d)],
            ['ISO 8601', formatISO(d)],
            ['UTC / ISO', formatISOUTC(d)],
            ['RFC 2822', formatRFC2822(d)],
            ['Epoch (sec)', String(epochSec)],
            ['Epoch (ms)', String(epochMs)],
            ['Relative', formatRelative(d)],
            ['Day of year', getDayOfYear(d) + ' / 365'],
            ['Week number', 'W' + pad(getWeekNumber(d))],
            ['Unix date', DAYS[d.getDay()] + ' ' + MONTHS[d.getMonth()] + ' ' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' UTC' + formatTZOffset(d) + ' ' + d.getFullYear()],
        ];

        epochResultBody.innerHTML = rows.map(function (r) {
            return '<tr><td class="result-label">' + r[0] + '</td><td class="result-value">' + escapeHtml(r[1])
                + ' <button class="copy-btn" title="Copy" onclick="copyText(\'' + escapeAttr(r[1]) + '\')"><i class="bi bi-clipboard"></i></button></td></tr>';
        }).join('');
        epochResult.classList.remove('d-none');
    }

    // ── Render date → epoch result ──
    function renderDateResult(d) {
        if (!d || isNaN(d.getTime())) {
            dateResult.classList.add('d-none');
            return;
        }
        var epochSec = Math.floor(d.getTime() / 1000);
        var epochMs = d.getTime();

        var rows = [
            ['Epoch (seconds)', String(epochSec)],
            ['Epoch (milliseconds)', String(epochMs)],
            ['ISO 8601', formatISO(d)],
            ['UTC / ISO', formatISOUTC(d)],
            ['RFC 2822', formatRFC2822(d)],
            ['Relative', formatRelative(d)],
        ];

        dateResultBody.innerHTML = rows.map(function (r) {
            return '<tr><td class="result-label">' + r[0] + '</td><td class="result-value">' + escapeHtml(r[1])
                + ' <button class="copy-btn" title="Copy" onclick="copyText(\'' + escapeAttr(r[1]) + '\')"><i class="bi bi-clipboard"></i></button></td></tr>';
        }).join('');
        dateResult.classList.remove('d-none');
    }

    // ── Epoch → Date ──
    epochToDateBtn.addEventListener('click', function () {
        var d = parseEpochInput(epochInput.value);
        if (!d || isNaN(d.getTime())) {
            epochResult.classList.add('d-none');
            alert('Invalid epoch value');
            return;
        }
        renderEpochResult(d);
    });

    epochInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') epochToDateBtn.click();
    });

    // ── Presets ──
    document.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var now = new Date();
            var ts;
            switch (btn.dataset.preset) {
                case 'now':
                    ts = Math.floor(now.getTime() / 1000);
                    break;
                case 'today':
                    ts = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
                    break;
                case 'yesterday':
                    ts = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime() / 1000);
                    break;
                case 'week':
                    ts = Math.floor((now.getTime() - 7 * 24 * 60 * 60 * 1000) / 1000);
                    break;
                case 'month':
                    var m = new Date(now);
                    m.setMonth(m.getMonth() - 1);
                    ts = Math.floor(m.getTime() / 1000);
                    break;
                case 'year':
                    ts = Math.floor(new Date(now.getFullYear(), 0, 1).getTime() / 1000);
                    break;
            }
            epochInput.value = ts;
            renderEpochResult(new Date(ts * 1000));
        });
    });

    // ── Date → Epoch ──
    dateToEpochBtn.addEventListener('click', function () {
        // Try date string input first
        if (dateStringInput.value.trim()) {
            var d = parseDateString(dateStringInput.value);
            if (!d || isNaN(d.getTime())) {
                dateResult.classList.add('d-none');
                alert('Invalid date string');
                return;
            }
            renderDateResult(d);
            return;
        }

        // Use date + time pickers
        if (!dateInput.value) {
            alert('Please select a date or enter a date string');
            return;
        }
        var parts = dateInput.value.split('-');
        var timeParts = (timeInput.value || '00:00:00').split(':');
        var d = new Date(
            parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]),
            parseInt(timeParts[0]) || 0, parseInt(timeParts[1]) || 0, parseInt(timeParts[2]) || 0
        );
        renderDateResult(d);
    });

    dateStringInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') dateToEpochBtn.click();
    });

    // Set default date/time to now
    var now = new Date();
    dateInput.value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    timeInput.value = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

    // ── Time Difference ──
    diffCalcBtn.addEventListener('click', function () {
        var fromStr = diffFrom.value.trim();
        if (!fromStr) {
            alert('Please enter a "From" value');
            return;
        }

        var from = parseDateString(fromStr);
        if (!from || isNaN(from.getTime())) {
            alert('Invalid "From" date/epoch');
            return;
        }

        var to;
        var toStr = diffTo.value.trim();
        if (toStr) {
            to = parseDateString(toStr);
            if (!to || isNaN(to.getTime())) {
                alert('Invalid "To" date/epoch');
                return;
            }
        } else {
            to = new Date();
        }

        var diffMs = Math.abs(to.getTime() - from.getTime());
        var totalSec = Math.floor(diffMs / 1000);
        var totalMin = Math.floor(totalSec / 60);
        var totalHours = Math.floor(totalMin / 60);
        var totalDays = Math.floor(totalHours / 24);

        var years = Math.floor(totalDays / 365.25);
        var remDays = totalDays - Math.floor(years * 365.25);
        var months = Math.floor(remDays / 30.44);
        remDays = remDays - Math.floor(months * 30.44);
        var hours = totalHours % 24;
        var mins = totalMin % 60;
        var secs = totalSec % 60;

        var direction = to.getTime() >= from.getTime() ? '' : ' (reversed)';

        var lines = [
            '<strong>' + totalDays.toLocaleString() + ' days, ' + hours + 'h ' + mins + 'm ' + secs + 's</strong>' + direction,
            '',
            '≈ ' + years + ' year' + (years !== 1 ? 's' : '') + ', ' + months + ' month' + (months !== 1 ? 's' : '') + ', ' + remDays + ' day' + (remDays !== 1 ? 's' : ''),
            totalHours.toLocaleString() + ' hours | ' + totalMin.toLocaleString() + ' minutes | ' + totalSec.toLocaleString() + ' seconds',
            diffMs.toLocaleString() + ' milliseconds',
        ];

        diffResultText.innerHTML = lines.join('<br>');
        diffResult.classList.remove('d-none');
    });

    diffFrom.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') diffCalcBtn.click();
    });
    diffTo.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') diffCalcBtn.click();
    });

    // ── Utilities ──
    function escapeHtml(str) {
        var d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    window.copyText = function (text) {
        navigator.clipboard.writeText(text).then(function () {
            var toast = document.getElementById('copyToast');
            toast.textContent = 'Copied: ' + text;
            toast.classList.add('show');
            setTimeout(function () { toast.classList.remove('show'); }, 1500);
        });
    };
});
