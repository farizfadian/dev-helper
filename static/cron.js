document.addEventListener('DOMContentLoaded', function () {
    const cronInput = document.getElementById('cronInput');
    const cronText = document.getElementById('cronText');
    const cronDisplay = document.getElementById('cronDisplay');
    const humanText = document.getElementById('humanText');
    const humanReadable = document.getElementById('humanReadable');
    const errorMsg = document.getElementById('errorMsg');
    const errorText = document.getElementById('errorText');
    const nextRunsList = document.getElementById('nextRunsList');
    const presetsContainer = document.getElementById('presetsContainer');

    const fieldMinute = document.getElementById('fieldMinute');
    const fieldHour = document.getElementById('fieldHour');
    const fieldDom = document.getElementById('fieldDom');
    const fieldMonth = document.getElementById('fieldMonth');
    const fieldDow = document.getElementById('fieldDow');

    const STORAGE_KEY = 'devhelper_cron_expr';

    // ── Month/Day name mappings ──
    const MONTH_NAMES = ['', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const MONTH_FULL = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    // ── Presets ──
    const PRESETS = [
        { label: 'Every minute', expr: '* * * * *' },
        { label: 'Every 5 min', expr: '*/5 * * * *' },
        { label: 'Every 15 min', expr: '*/15 * * * *' },
        { label: 'Every 30 min', expr: '*/30 * * * *' },
        { label: 'Every hour', expr: '0 * * * *' },
        { label: 'Every 2 hours', expr: '0 */2 * * *' },
        { label: 'Every 6 hours', expr: '0 */6 * * *' },
        { label: 'Daily midnight', expr: '0 0 * * *' },
        { label: 'Daily 6 AM', expr: '0 6 * * *' },
        { label: 'Daily noon', expr: '0 12 * * *' },
        { label: 'Weekly Monday 9AM', expr: '0 9 * * 1' },
        { label: 'Weekly Sunday', expr: '0 0 * * 0' },
        { label: 'Monthly 1st', expr: '0 0 1 * *' },
        { label: 'Monthly 15th', expr: '0 0 15 * *' },
        { label: 'Yearly Jan 1', expr: '0 0 1 1 *' },
        { label: 'Weekdays 9AM', expr: '0 9 * * 1-5' },
        { label: 'Weekends noon', expr: '0 12 * * 0,6' },
        { label: 'Business hours', expr: '0 9-17 * * 1-5' },
    ];

    // Render presets
    presetsContainer.innerHTML = PRESETS.map(function (p) {
        return '<button class="btn btn-sm btn-outline-secondary preset-btn" data-expr="' + p.expr + '" title="' + p.expr + '">' + p.label + '</button>';
    }).join('');

    presetsContainer.querySelectorAll('.preset-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            setCronExpr(this.dataset.expr);
        });
    });

    // ── Normalize name tokens (JAN→1, MON→1, etc.) ──
    function normalizeField(value, type) {
        var v = value.toUpperCase();
        if (type === 'month') {
            MONTH_NAMES.forEach(function (name, i) {
                if (i > 0) v = v.replace(new RegExp('\\b' + name + '\\b', 'g'), String(i));
            });
        }
        if (type === 'dow') {
            DOW_NAMES.forEach(function (name, i) {
                v = v.replace(new RegExp('\\b' + name + '\\b', 'g'), String(i));
            });
        }
        return v;
    }

    // ── Parse a single cron field into a set of values ──
    function parseField(field, min, max, type) {
        var normalized = normalizeField(field.trim(), type);
        var values = new Set();
        var parts = normalized.split(',');

        for (var p = 0; p < parts.length; p++) {
            var part = parts[p].trim();
            if (!part) throw new Error('Empty value in field');

            // Step: */N or range/N
            var stepMatch = part.match(/^(.+)\/(\d+)$/);
            var step = 1;
            if (stepMatch) {
                step = parseInt(stepMatch[2]);
                if (step === 0) throw new Error('Step value cannot be zero');
                part = stepMatch[1];
            }

            if (part === '*') {
                for (var i = min; i <= max; i += step) values.add(i);
            } else if (part.indexOf('-') !== -1) {
                var rangeParts = part.split('-');
                if (rangeParts.length !== 2) throw new Error('Invalid range: ' + part);
                var start = parseInt(rangeParts[0]);
                var end = parseInt(rangeParts[1]);
                if (isNaN(start) || isNaN(end)) throw new Error('Invalid range values');
                if (start < min || start > max || end < min || end > max) throw new Error('Value out of range (' + min + '-' + max + ')');
                if (start <= end) {
                    for (var i = start; i <= end; i += step) values.add(i);
                } else {
                    // Wrap-around (e.g., 5-1 for months)
                    for (var i = start; i <= max; i += step) values.add(i);
                    for (var i = min; i <= end; i += step) values.add(i);
                }
            } else {
                var val = parseInt(part);
                if (isNaN(val)) throw new Error('Invalid value: ' + part);
                if (val < min || val > max) throw new Error('Value ' + val + ' out of range (' + min + '-' + max + ')');
                if (stepMatch) {
                    for (var i = val; i <= max; i += step) values.add(i);
                } else {
                    values.add(val);
                }
            }
        }

        return Array.from(values).sort(function (a, b) { return a - b; });
    }

    // ── Parse full cron expression ──
    function parseCron(expr) {
        var parts = expr.trim().split(/\s+/);
        if (parts.length !== 5) throw new Error('Expected 5 fields (minute hour day-of-month month day-of-week), got ' + parts.length);

        var minutes = parseField(parts[0], 0, 59, 'minute');
        var hours = parseField(parts[1], 0, 23, 'hour');
        var doms = parseField(parts[2], 1, 31, 'dom');
        var months = parseField(parts[3], 1, 12, 'month');
        var dows = parseField(parts[4], 0, 6, 'dow');

        return {
            minutes: minutes,
            hours: hours,
            doms: doms,
            months: months,
            dows: dows,
            raw: parts
        };
    }

    // ── Calculate next N run times ──
    function getNextRuns(parsed, count) {
        var runs = [];
        var now = new Date();
        // Start from next minute
        var cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);

        var maxIterations = 525600; // 1 year of minutes
        var iterations = 0;

        while (runs.length < count && iterations < maxIterations) {
            iterations++;
            var month = cursor.getMonth() + 1;
            var dom = cursor.getDate();
            var dow = cursor.getDay();
            var hour = cursor.getHours();
            var minute = cursor.getMinutes();

            if (parsed.months.indexOf(month) !== -1 &&
                parsed.doms.indexOf(dom) !== -1 &&
                parsed.dows.indexOf(dow) !== -1 &&
                parsed.hours.indexOf(hour) !== -1 &&
                parsed.minutes.indexOf(minute) !== -1) {
                runs.push(new Date(cursor));
            }

            cursor.setMinutes(cursor.getMinutes() + 1);
        }

        return runs;
    }

    // ── Human-readable description ──
    function describeField(values, min, max, names) {
        if (values.length === (max - min + 1)) return null; // wildcard

        if (names) {
            return values.map(function (v) { return names[v] || String(v); }).join(', ');
        }
        return values.join(', ');
    }

    function humanReadableDesc(parsed) {
        var parts = [];
        var raw = parsed.raw;

        // Special common patterns
        var expr = raw.join(' ');
        if (expr === '* * * * *') return 'Every minute';
        if (expr === '0 * * * *') return 'Every hour, at minute 0';
        if (expr === '0 0 * * *') return 'Every day at midnight';
        if (expr === '0 12 * * *') return 'Every day at noon';

        // Minute
        if (raw[0] === '*') {
            parts.push('Every minute');
        } else if (raw[0].indexOf('*/') === 0) {
            parts.push('Every ' + raw[0].split('/')[1] + ' minutes');
        } else {
            parts.push('At minute ' + describeMinutes(parsed.minutes));
        }

        // Hour
        if (raw[1] !== '*') {
            if (raw[1].indexOf('*/') === 0) {
                parts.push('every ' + raw[1].split('/')[1] + ' hours');
            } else if (raw[1].indexOf('-') !== -1 && raw[1].indexOf(',') === -1 && raw[1].indexOf('/') === -1) {
                var hRange = raw[1].split('-');
                parts.push('during hours ' + formatHour(parseInt(hRange[0])) + '-' + formatHour(parseInt(hRange[1])));
            } else {
                parts.push('at ' + parsed.hours.map(formatHour).join(', '));
            }
        }

        // Day of month
        if (raw[2] !== '*') {
            if (raw[2].indexOf('*/') === 0) {
                parts.push('every ' + raw[2].split('/')[1] + ' days');
            } else {
                parts.push('on day ' + parsed.doms.map(ordinal).join(', ') + ' of the month');
            }
        }

        // Month
        if (raw[3] !== '*') {
            var monthDesc = describeField(parsed.months, 1, 12, MONTH_FULL);
            if (monthDesc) parts.push('in ' + monthDesc);
        }

        // Day of week
        if (raw[4] !== '*') {
            var dowDesc = describeField(parsed.dows, 0, 6, DOW_FULL);
            if (dowDesc) parts.push('on ' + dowDesc);
        }

        var result = parts.join(', ');
        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    function describeMinutes(mins) {
        if (mins.length === 1) return String(mins[0]);
        if (mins.length <= 5) return mins.join(', ');
        return mins[0] + ', ' + mins[1] + ', ... (' + mins.length + ' values)';
    }

    function formatHour(h) {
        if (h === 0) return '12:00 AM';
        if (h === 12) return '12:00 PM';
        if (h < 12) return h + ':00 AM';
        return (h - 12) + ':00 PM';
    }

    function ordinal(n) {
        var s = ['th', 'st', 'nd', 'rd'];
        var v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    // ── Format date for display ──
    function formatRunDate(d) {
        var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return days[d.getDay()] + ', ' + months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear() + ' ' +
            pad2(d.getHours()) + ':' + pad2(d.getMinutes());
    }

    function pad2(n) {
        return n < 10 ? '0' + n : String(n);
    }

    // ── Relative time ──
    function relativeTime(from, to) {
        var diff = to.getTime() - from.getTime();
        var seconds = Math.floor(diff / 1000);
        var minutes = Math.floor(seconds / 60);
        var hours = Math.floor(minutes / 60);
        var days = Math.floor(hours / 24);

        if (days > 0) return 'in ' + days + 'd ' + (hours % 24) + 'h';
        if (hours > 0) return 'in ' + hours + 'h ' + (minutes % 60) + 'm';
        if (minutes > 0) return 'in ' + minutes + 'm';
        return 'in <1m';
    }

    // ── Main parse and display ──
    function parseAndDisplay(expr) {
        expr = expr.trim();
        if (!expr) return;

        // Clear error
        errorMsg.classList.add('d-none');
        humanReadable.classList.remove('d-none');

        try {
            var parsed = parseCron(expr);

            // Update display
            cronText.textContent = expr;
            cronInput.value = expr;

            // Update field editors
            var parts = expr.split(/\s+/);
            fieldMinute.value = parts[0] || '*';
            fieldHour.value = parts[1] || '*';
            fieldDom.value = parts[2] || '*';
            fieldMonth.value = parts[3] || '*';
            fieldDow.value = parts[4] || '*';

            // Human-readable
            humanText.textContent = humanReadableDesc(parsed);

            // Next runs
            var now = new Date();
            var runs = getNextRuns(parsed, 10);

            if (runs.length === 0) {
                nextRunsList.innerHTML = '<div class="text-center text-muted py-4 small">No upcoming runs found within the next year</div>';
            } else {
                nextRunsList.innerHTML = runs.map(function (run, i) {
                    return '<div class="next-run-item">' +
                        '<span class="next-run-num">#' + (i + 1) + '</span> ' +
                        '<span class="flex-grow-1">' + formatRunDate(run) + '</span>' +
                        '<span class="next-run-relative">' + relativeTime(now, run) + '</span>' +
                        '</div>';
                }).join('');
            }

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, expr);

        } catch (e) {
            errorMsg.classList.remove('d-none');
            errorText.textContent = e.message;
            humanReadable.classList.add('d-none');
            nextRunsList.innerHTML = '<div class="text-center text-danger py-4 small"><i class="bi bi-exclamation-triangle"></i> Fix the expression to see run times</div>';
        }
    }

    // ── Set cron expression (from preset, URL, etc.) ──
    function setCronExpr(expr) {
        cronInput.value = expr;
        parseAndDisplay(expr);
    }

    // ── Event Listeners ──

    // Parse button
    document.getElementById('parseBtn').addEventListener('click', function () {
        parseAndDisplay(cronInput.value);
    });

    // Enter key on input
    cronInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            parseAndDisplay(cronInput.value);
        }
    });

    // Auto-parse on input change (debounced)
    var parseTimer = null;
    cronInput.addEventListener('input', function () {
        clearTimeout(parseTimer);
        parseTimer = setTimeout(function () {
            parseAndDisplay(cronInput.value);
        }, 400);
    });

    // Field editor changes → rebuild expression
    var fieldEditors = [fieldMinute, fieldHour, fieldDom, fieldMonth, fieldDow];
    fieldEditors.forEach(function (field) {
        field.addEventListener('input', function () {
            var expr = [fieldMinute.value || '*', fieldHour.value || '*', fieldDom.value || '*', fieldMonth.value || '*', fieldDow.value || '*'].join(' ');
            cronInput.value = expr;
            clearTimeout(parseTimer);
            parseTimer = setTimeout(function () {
                parseAndDisplay(expr);
            }, 400);
        });

        field.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') {
                var expr = [fieldMinute.value || '*', fieldHour.value || '*', fieldDom.value || '*', fieldMonth.value || '*', fieldDow.value || '*'].join(' ');
                parseAndDisplay(expr);
            }
        });
    });

    // Click display to copy
    cronDisplay.addEventListener('click', function () {
        var text = cronText.textContent;
        if (text) copyText(text, document.getElementById('copyBtn'));
    });

    // Copy button
    document.getElementById('copyBtn').addEventListener('click', function () {
        var text = cronText.textContent;
        if (text) copyText(text, this);
    });

    // Copy run times
    document.getElementById('copyRunsBtn').addEventListener('click', function () {
        var items = nextRunsList.querySelectorAll('.next-run-item');
        if (items.length === 0) return;
        var text = Array.from(items).map(function (item) {
            return item.querySelector('.flex-grow-1').textContent.trim();
        }).join('\n');
        copyText(text, this);
    });

    // Share button
    document.getElementById('shareBtn').addEventListener('click', function () {
        var expr = cronInput.value.trim();
        if (!expr) return;
        var url = window.location.origin + window.location.pathname + '?expr=' + encodeURIComponent(expr);
        copyText(url, this);
    });

    // Clear button
    document.getElementById('clearBtn').addEventListener('click', function () {
        setCronExpr('* * * * *');
    });

    // ── Copy Helper ──
    function copyText(text, btn) {
        navigator.clipboard.writeText(text).then(function () {
            if (btn) {
                var orig = btn.innerHTML;
                btn.innerHTML = '<i class="bi bi-check-lg"></i> Copied';
                setTimeout(function () { btn.innerHTML = orig; }, 1500);
            }
        });
    }

    // ── Initialize ──

    // Check URL params first
    var params = new URLSearchParams(window.location.search);
    var urlExpr = params.get('expr');

    if (urlExpr) {
        setCronExpr(urlExpr);
    } else {
        // Load from localStorage
        var saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            setCronExpr(saved);
        } else {
            parseAndDisplay('* * * * *');
        }
    }
});
