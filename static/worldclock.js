// World Clock — Multi-Timezone Clock Tool
// Uses native Intl.DateTimeFormat for timezone support (400+ IANA zones, auto DST)

var CITIES = [
    // Asia-Pacific
    { id:'Asia/Jakarta', name:'Jakarta', country:'Indonesia', flag:'\u{1F1EE}\u{1F1E9}', region:'Asia-Pacific' },
    { id:'Asia/Singapore', name:'Singapore', country:'Singapore', flag:'\u{1F1F8}\u{1F1EC}', region:'Asia-Pacific' },
    { id:'Asia/Shanghai', name:'Shanghai', country:'China', flag:'\u{1F1E8}\u{1F1F3}', region:'Asia-Pacific' },
    { id:'Asia/Hong_Kong', name:'Hong Kong', country:'China', flag:'\u{1F1ED}\u{1F1F0}', region:'Asia-Pacific' },
    { id:'Asia/Kolkata', name:'New Delhi', country:'India', flag:'\u{1F1EE}\u{1F1F3}', region:'Asia-Pacific' },
    { id:'Asia/Mumbai', name:'Mumbai', country:'India', flag:'\u{1F1EE}\u{1F1F3}', region:'Asia-Pacific' },
    { id:'Asia/Tokyo', name:'Tokyo', country:'Japan', flag:'\u{1F1EF}\u{1F1F5}', region:'Asia-Pacific' },
    { id:'Asia/Seoul', name:'Seoul', country:'South Korea', flag:'\u{1F1F0}\u{1F1F7}', region:'Asia-Pacific' },
    { id:'Asia/Taipei', name:'Taipei', country:'Taiwan', flag:'\u{1F1F9}\u{1F1FC}', region:'Asia-Pacific' },
    { id:'Asia/Bangkok', name:'Bangkok', country:'Thailand', flag:'\u{1F1F9}\u{1F1ED}', region:'Asia-Pacific' },
    { id:'Asia/Ho_Chi_Minh', name:'Ho Chi Minh', country:'Vietnam', flag:'\u{1F1FB}\u{1F1F3}', region:'Asia-Pacific' },
    { id:'Asia/Manila', name:'Manila', country:'Philippines', flag:'\u{1F1F5}\u{1F1ED}', region:'Asia-Pacific' },
    { id:'Asia/Kuala_Lumpur', name:'Kuala Lumpur', country:'Malaysia', flag:'\u{1F1F2}\u{1F1FE}', region:'Asia-Pacific' },
    { id:'Asia/Dhaka', name:'Dhaka', country:'Bangladesh', flag:'\u{1F1E7}\u{1F1E9}', region:'Asia-Pacific' },
    { id:'Asia/Karachi', name:'Karachi', country:'Pakistan', flag:'\u{1F1F5}\u{1F1F0}', region:'Asia-Pacific' },
    { id:'Asia/Colombo', name:'Colombo', country:'Sri Lanka', flag:'\u{1F1F1}\u{1F1F0}', region:'Asia-Pacific' },
    { id:'Asia/Kathmandu', name:'Kathmandu', country:'Nepal', flag:'\u{1F1F3}\u{1F1F5}', region:'Asia-Pacific' },
    { id:'Asia/Yangon', name:'Yangon', country:'Myanmar', flag:'\u{1F1F2}\u{1F1F2}', region:'Asia-Pacific' },
    { id:'Australia/Sydney', name:'Sydney', country:'Australia', flag:'\u{1F1E6}\u{1F1FA}', region:'Asia-Pacific' },
    { id:'Australia/Melbourne', name:'Melbourne', country:'Australia', flag:'\u{1F1E6}\u{1F1FA}', region:'Asia-Pacific' },
    { id:'Australia/Perth', name:'Perth', country:'Australia', flag:'\u{1F1E6}\u{1F1FA}', region:'Asia-Pacific' },
    { id:'Pacific/Auckland', name:'Auckland', country:'New Zealand', flag:'\u{1F1F3}\u{1F1FF}', region:'Asia-Pacific' },
    { id:'Pacific/Fiji', name:'Fiji', country:'Fiji', flag:'\u{1F1EB}\u{1F1EF}', region:'Asia-Pacific' },
    { id:'Pacific/Honolulu', name:'Honolulu', country:'USA', flag:'\u{1F1FA}\u{1F1F8}', region:'Asia-Pacific' },
    { id:'Pacific/Guam', name:'Guam', country:'USA', flag:'\u{1F1EC}\u{1F1FA}', region:'Asia-Pacific' },

    // Europe
    { id:'Europe/London', name:'London', country:'UK', flag:'\u{1F1EC}\u{1F1E7}', region:'Europe' },
    { id:'Europe/Paris', name:'Paris', country:'France', flag:'\u{1F1EB}\u{1F1F7}', region:'Europe' },
    { id:'Europe/Berlin', name:'Berlin', country:'Germany', flag:'\u{1F1E9}\u{1F1EA}', region:'Europe' },
    { id:'Europe/Madrid', name:'Madrid', country:'Spain', flag:'\u{1F1EA}\u{1F1F8}', region:'Europe' },
    { id:'Europe/Madrid', name:'Barcelona', country:'Spain', flag:'\u{1F1EA}\u{1F1F8}', region:'Europe' },
    { id:'Europe/Rome', name:'Rome', country:'Italy', flag:'\u{1F1EE}\u{1F1F9}', region:'Europe' },
    { id:'Europe/Amsterdam', name:'Amsterdam', country:'Netherlands', flag:'\u{1F1F3}\u{1F1F1}', region:'Europe' },
    { id:'Europe/Brussels', name:'Brussels', country:'Belgium', flag:'\u{1F1E7}\u{1F1EA}', region:'Europe' },
    { id:'Europe/Zurich', name:'Zurich', country:'Switzerland', flag:'\u{1F1E8}\u{1F1ED}', region:'Europe' },
    { id:'Europe/Vienna', name:'Vienna', country:'Austria', flag:'\u{1F1E6}\u{1F1F9}', region:'Europe' },
    { id:'Europe/Stockholm', name:'Stockholm', country:'Sweden', flag:'\u{1F1F8}\u{1F1EA}', region:'Europe' },
    { id:'Europe/Oslo', name:'Oslo', country:'Norway', flag:'\u{1F1F3}\u{1F1F4}', region:'Europe' },
    { id:'Europe/Copenhagen', name:'Copenhagen', country:'Denmark', flag:'\u{1F1E9}\u{1F1F0}', region:'Europe' },
    { id:'Europe/Helsinki', name:'Helsinki', country:'Finland', flag:'\u{1F1EB}\u{1F1EE}', region:'Europe' },
    { id:'Europe/Warsaw', name:'Warsaw', country:'Poland', flag:'\u{1F1F5}\u{1F1F1}', region:'Europe' },
    { id:'Europe/Prague', name:'Prague', country:'Czech Republic', flag:'\u{1F1E8}\u{1F1FF}', region:'Europe' },
    { id:'Europe/Budapest', name:'Budapest', country:'Hungary', flag:'\u{1F1ED}\u{1F1FA}', region:'Europe' },
    { id:'Europe/Bucharest', name:'Bucharest', country:'Romania', flag:'\u{1F1F7}\u{1F1F4}', region:'Europe' },
    { id:'Europe/Athens', name:'Athens', country:'Greece', flag:'\u{1F1EC}\u{1F1F7}', region:'Europe' },
    { id:'Europe/Istanbul', name:'Istanbul', country:'Turkey', flag:'\u{1F1F9}\u{1F1F7}', region:'Europe' },
    { id:'Europe/Moscow', name:'Moscow', country:'Russia', flag:'\u{1F1F7}\u{1F1FA}', region:'Europe' },
    { id:'Europe/Kiev', name:'Kyiv', country:'Ukraine', flag:'\u{1F1FA}\u{1F1E6}', region:'Europe' },
    { id:'Europe/Lisbon', name:'Lisbon', country:'Portugal', flag:'\u{1F1F5}\u{1F1F9}', region:'Europe' },
    { id:'Europe/Dublin', name:'Dublin', country:'Ireland', flag:'\u{1F1EE}\u{1F1EA}', region:'Europe' },
    { id:'Atlantic/Reykjavik', name:'Reykjavik', country:'Iceland', flag:'\u{1F1EE}\u{1F1F8}', region:'Europe' },

    // Americas
    { id:'America/New_York', name:'New York', country:'USA', flag:'\u{1F1FA}\u{1F1F8}', region:'Americas' },
    { id:'America/Chicago', name:'Chicago', country:'USA', flag:'\u{1F1FA}\u{1F1F8}', region:'Americas' },
    { id:'America/Denver', name:'Denver', country:'USA', flag:'\u{1F1FA}\u{1F1F8}', region:'Americas' },
    { id:'America/Los_Angeles', name:'Los Angeles', country:'USA', flag:'\u{1F1FA}\u{1F1F8}', region:'Americas' },
    { id:'America/Anchorage', name:'Anchorage', country:'USA', flag:'\u{1F1FA}\u{1F1F8}', region:'Americas' },
    { id:'America/Toronto', name:'Toronto', country:'Canada', flag:'\u{1F1E8}\u{1F1E6}', region:'Americas' },
    { id:'America/Vancouver', name:'Vancouver', country:'Canada', flag:'\u{1F1E8}\u{1F1E6}', region:'Americas' },
    { id:'America/Mexico_City', name:'Mexico City', country:'Mexico', flag:'\u{1F1F2}\u{1F1FD}', region:'Americas' },
    { id:'America/Sao_Paulo', name:'São Paulo', country:'Brazil', flag:'\u{1F1E7}\u{1F1F7}', region:'Americas' },
    { id:'America/Argentina/Buenos_Aires', name:'Buenos Aires', country:'Argentina', flag:'\u{1F1E6}\u{1F1F7}', region:'Americas' },
    { id:'America/Santiago', name:'Santiago', country:'Chile', flag:'\u{1F1E8}\u{1F1F1}', region:'Americas' },
    { id:'America/Lima', name:'Lima', country:'Peru', flag:'\u{1F1F5}\u{1F1EA}', region:'Americas' },
    { id:'America/Bogota', name:'Bogotá', country:'Colombia', flag:'\u{1F1E8}\u{1F1F4}', region:'Americas' },
    { id:'America/Caracas', name:'Caracas', country:'Venezuela', flag:'\u{1F1FB}\u{1F1EA}', region:'Americas' },
    { id:'America/Havana', name:'Havana', country:'Cuba', flag:'\u{1F1E8}\u{1F1FA}', region:'Americas' },
    { id:'America/Panama', name:'Panama City', country:'Panama', flag:'\u{1F1F5}\u{1F1E6}', region:'Americas' },
    { id:'America/Jamaica', name:'Kingston', country:'Jamaica', flag:'\u{1F1EF}\u{1F1F2}', region:'Americas' },
    { id:'America/Costa_Rica', name:'San José', country:'Costa Rica', flag:'\u{1F1E8}\u{1F1F7}', region:'Americas' },

    // Middle East & Africa
    { id:'Asia/Dubai', name:'Dubai', country:'UAE', flag:'\u{1F1E6}\u{1F1EA}', region:'Middle East & Africa' },
    { id:'Asia/Riyadh', name:'Riyadh', country:'Saudi Arabia', flag:'\u{1F1F8}\u{1F1E6}', region:'Middle East & Africa' },
    { id:'Asia/Qatar', name:'Doha', country:'Qatar', flag:'\u{1F1F6}\u{1F1E6}', region:'Middle East & Africa' },
    { id:'Asia/Tehran', name:'Tehran', country:'Iran', flag:'\u{1F1EE}\u{1F1F7}', region:'Middle East & Africa' },
    { id:'Asia/Baghdad', name:'Baghdad', country:'Iraq', flag:'\u{1F1EE}\u{1F1F6}', region:'Middle East & Africa' },
    { id:'Asia/Jerusalem', name:'Jerusalem', country:'Israel', flag:'\u{1F1EE}\u{1F1F1}', region:'Middle East & Africa' },
    { id:'Asia/Beirut', name:'Beirut', country:'Lebanon', flag:'\u{1F1F1}\u{1F1E7}', region:'Middle East & Africa' },
    { id:'Africa/Cairo', name:'Cairo', country:'Egypt', flag:'\u{1F1EA}\u{1F1EC}', region:'Middle East & Africa' },
    { id:'Africa/Lagos', name:'Lagos', country:'Nigeria', flag:'\u{1F1F3}\u{1F1EC}', region:'Middle East & Africa' },
    { id:'Africa/Nairobi', name:'Nairobi', country:'Kenya', flag:'\u{1F1F0}\u{1F1EA}', region:'Middle East & Africa' },
    { id:'Africa/Johannesburg', name:'Johannesburg', country:'South Africa', flag:'\u{1F1FF}\u{1F1E6}', region:'Middle East & Africa' },
    { id:'Africa/Casablanca', name:'Casablanca', country:'Morocco', flag:'\u{1F1F2}\u{1F1E6}', region:'Middle East & Africa' },
    { id:'Africa/Accra', name:'Accra', country:'Ghana', flag:'\u{1F1EC}\u{1F1ED}', region:'Middle East & Africa' },
    { id:'Africa/Addis_Ababa', name:'Addis Ababa', country:'Ethiopia', flag:'\u{1F1EA}\u{1F1F9}', region:'Middle East & Africa' },
    { id:'Africa/Dar_es_Salaam', name:'Dar es Salaam', country:'Tanzania', flag:'\u{1F1F9}\u{1F1FF}', region:'Middle East & Africa' },
    { id:'Indian/Mauritius', name:'Mauritius', country:'Mauritius', flag:'\u{1F1F2}\u{1F1FA}', region:'Middle East & Africa' },
];

var LS_CITIES = 'devhelper_worldclock_cities';
var LS_FORMAT = 'devhelper_worldclock_format';
var DEFAULT_CITIES = ['Asia/Jakarta','Europe/Madrid','Asia/Kolkata','Asia/Singapore','Asia/Shanghai'];

document.addEventListener('DOMContentLoaded', function() {
    var clockGrid = document.getElementById('clockGrid');
    var btnAddCity = document.getElementById('btnAddCity');
    var citySearch = document.getElementById('citySearch');
    var cityList = document.getElementById('cityList');
    var timeSlider = document.getElementById('timeSlider');
    var sliderTimeDisplay = document.getElementById('sliderTimeDisplay');
    var refTimezone = document.getElementById('refTimezone');
    var plannerRows = document.getElementById('plannerRows');
    var bestTimeBox = document.getElementById('bestTimeBox');
    var formatBtns = document.querySelectorAll('.wc-format-toggle .btn');
    var addCityModal;
    var tickInterval;

    // State
    var activeCities = loadCities();
    var timeFormat = localStorage.getItem(LS_FORMAT) || '24h';
    var dragSrcIndex = null;

    // Init
    initFormatToggle();
    render();
    startTick();

    // Bootstrap modal
    var modalEl = document.getElementById('addCityModal');
    if (window.bootstrap) {
        addCityModal = new bootstrap.Modal(modalEl);
    }

    btnAddCity.addEventListener('click', function() {
        citySearch.value = '';
        renderCityList('');
        addCityModal.show();
        setTimeout(function() { citySearch.focus(); }, 300);
    });

    citySearch.addEventListener('input', function() {
        renderCityList(this.value.trim().toLowerCase());
    });

    // Format toggle
    function initFormatToggle() {
        formatBtns.forEach(function(btn) {
            btn.classList.toggle('active', btn.dataset.format === timeFormat);
            btn.addEventListener('click', function() {
                timeFormat = this.dataset.format;
                localStorage.setItem(LS_FORMAT, timeFormat);
                formatBtns.forEach(function(b) { b.classList.toggle('active', b.dataset.format === timeFormat); });
                render();
            });
        });
    }

    // localStorage
    function loadCities() {
        try {
            var saved = JSON.parse(localStorage.getItem(LS_CITIES));
            if (saved && saved.length) return saved;
        } catch(e) {}
        return DEFAULT_CITIES.slice();
    }

    function saveCities() {
        localStorage.setItem(LS_CITIES, JSON.stringify(activeCities));
    }

    function findCity(tzId) {
        for (var i = 0; i < CITIES.length; i++) {
            if (CITIES[i].id === tzId) return CITIES[i];
        }
        // Fallback for unknown timezone
        return { id: tzId, name: tzId.split('/').pop().replace(/_/g,' '), country:'', flag:'🌍', region:'Other' };
    }

    // ── Timezone Helpers ──
    function getTimeParts(tz, date) {
        var d = date || new Date();
        var fmt = new Intl.DateTimeFormat('en-US', {
            timeZone: tz, hour:'numeric', minute:'numeric', second:'numeric',
            hour12: false, year:'numeric', month:'short', day:'numeric', weekday:'short'
        });
        var parts = {};
        fmt.formatToParts(d).forEach(function(p) { parts[p.type] = p.value; });
        return parts;
    }

    function getOffsetMinutes(tz, date) {
        var d = date || new Date();
        // Get the UTC time string in the target timezone
        var tzStr = d.toLocaleString('en-US', { timeZone: tz, hour12: false,
            year:'numeric', month:'2-digit', day:'2-digit',
            hour:'2-digit', minute:'2-digit', second:'2-digit' });
        // Parse "MM/DD/YYYY, HH:MM:SS"
        var m = tzStr.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/);
        if (!m) return 0;
        var tzDate = new Date(+m[3], +m[1]-1, +m[2], +m[4], +m[5], +m[6]);
        var utcStr = d.toLocaleString('en-US', { timeZone: 'UTC', hour12: false,
            year:'numeric', month:'2-digit', day:'2-digit',
            hour:'2-digit', minute:'2-digit', second:'2-digit' });
        var u = utcStr.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/);
        if (!u) return 0;
        var utcDate = new Date(+u[3], +u[1]-1, +u[2], +u[4], +u[5], +u[6]);
        return Math.round((tzDate - utcDate) / 60000);
    }

    function formatOffset(minutes) {
        var sign = minutes >= 0 ? '+' : '-';
        var abs = Math.abs(minutes);
        var h = Math.floor(abs / 60);
        var m = abs % 60;
        return 'UTC' + sign + h + (m ? ':' + (m < 10 ? '0':'') + m : '');
    }

    function formatTime(parts) {
        var h = parseInt(parts.hour);
        var min = parts.minute;
        var sec = parts.second;
        if (timeFormat === '12h') {
            var ampm = h >= 12 ? 'PM' : 'AM';
            var h12 = h % 12 || 12;
            return (h12 < 10 ? '0':'') + h12 + ':' + min + ':' + sec + ' ' + ampm;
        }
        return (h < 10 ? '0':'') + h + ':' + min + ':' + sec;
    }

    function formatTimeShort(h, m) {
        if (timeFormat === '12h') {
            var ampm = h >= 12 ? 'PM' : 'AM';
            var h12 = h % 12 || 12;
            return (h12 < 10 ? '0':'') + h12 + ':' + (m < 10 ? '0':'') + m + ' ' + ampm;
        }
        return (h < 10 ? '0':'') + h + ':' + (m < 10 ? '0':'') + m;
    }

    function isDaytime(hour) {
        return hour >= 6 && hour <= 17;
    }

    function getRelativeDiff(localOffset, cityOffset) {
        var diff = cityOffset - localOffset;
        if (diff === 0) return 'Same as you';
        var abs = Math.abs(diff);
        var h = Math.floor(abs / 60);
        var m = abs % 60;
        var str = '';
        if (h) str += h + 'h';
        if (m) str += (h ? ' ':'') + m + 'm';
        return str + (diff > 0 ? ' ahead' : ' behind');
    }

    // ── SVG Analog Clock ──
    function createAnalogSVG(h, m, s) {
        var hourAngle = ((h % 12) + m / 60) * 30;
        var minAngle = (m + s / 60) * 6;
        var secAngle = s * 6;

        var ticks = '';
        for (var i = 0; i < 60; i++) {
            var angle = i * 6;
            var isMajor = i % 5 === 0;
            var r1 = isMajor ? 35 : 38;
            var r2 = 40;
            var cls = isMajor ? 'wc-tick-major' : 'wc-tick';
            var rad = angle * Math.PI / 180;
            ticks += '<line class="' + cls + '" x1="' + (50 + r1 * Math.sin(rad)) +
                '" y1="' + (50 - r1 * Math.cos(rad)) +
                '" x2="' + (50 + r2 * Math.sin(rad)) +
                '" y2="' + (50 - r2 * Math.cos(rad)) + '"/>';
        }

        return '<svg class="wc-analog" viewBox="0 0 100 100">' +
            '<circle class="wc-clock-face" cx="50" cy="50" r="45"/>' +
            ticks +
            '<line class="wc-hand-hour" x1="50" y1="50" ' +
                'x2="' + (50 + 22 * Math.sin(hourAngle * Math.PI / 180)) +
                '" y2="' + (50 - 22 * Math.cos(hourAngle * Math.PI / 180)) + '"/>' +
            '<line class="wc-hand-minute" x1="50" y1="50" ' +
                'x2="' + (50 + 32 * Math.sin(minAngle * Math.PI / 180)) +
                '" y2="' + (50 - 32 * Math.cos(minAngle * Math.PI / 180)) + '"/>' +
            '<line class="wc-hand-second" x1="50" y1="50" ' +
                'x2="' + (50 + 34 * Math.sin(secAngle * Math.PI / 180)) +
                '" y2="' + (50 - 34 * Math.cos(secAngle * Math.PI / 180)) + '"/>' +
            '<circle class="wc-center-dot" cx="50" cy="50" r="2.5"/>' +
            '</svg>';
    }

    // ── Render Clock Cards ──
    function render() {
        var localOffset = getOffsetMinutes(Intl.DateTimeFormat().resolvedOptions().timeZone);
        var now = new Date();

        clockGrid.innerHTML = '';
        activeCities.forEach(function(tzId, idx) {
            var city = findCity(tzId);
            var parts = getTimeParts(tzId, now);
            var h = parseInt(parts.hour);
            var m = parseInt(parts.minute);
            var s = parseInt(parts.second);
            var offset = getOffsetMinutes(tzId, now);
            var daytime = isDaytime(h);

            var col = document.createElement('div');
            col.className = 'col-6 col-md-4 col-lg-3 col-xl-2';

            var card = document.createElement('div');
            card.className = 'wc-card';
            card.draggable = true;
            card.dataset.index = idx;
            card.dataset.tz = tzId;

            card.innerHTML =
                '<button class="wc-remove" title="Remove">&times;</button>' +
                '<div class="wc-card-header">' +
                    '<span class="wc-flag">' + city.flag + '</span>' +
                    '<span>' + city.name + '</span>' +
                '</div>' +
                '<div class="wc-country">' + city.country + '</div>' +
                createAnalogSVG(h, m, s) +
                '<div class="wc-digital">' + formatTime(parts) + '</div>' +
                '<div class="wc-date">' + parts.weekday + ', ' + parts.month + ' ' + parts.day + ', ' + parts.year + '</div>' +
                '<div class="wc-offset">' +
                    formatOffset(offset) + ' ' +
                    '<span class="wc-daynight">' + (daytime ? '\u2600\uFE0F' : '\uD83C\uDF19') + '</span>' +
                    '<br><small>' + getRelativeDiff(localOffset, offset) + '</small>' +
                '</div>';

            // Remove button
            card.querySelector('.wc-remove').addEventListener('click', function(e) {
                e.stopPropagation();
                activeCities.splice(idx, 1);
                saveCities();
                render();
            });

            // Drag events
            card.addEventListener('dragstart', function(e) {
                dragSrcIndex = idx;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', idx);
            });
            card.addEventListener('dragend', function() {
                card.classList.remove('dragging');
                document.querySelectorAll('.wc-card').forEach(function(c) { c.classList.remove('drag-over'); });
            });
            card.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                card.classList.add('drag-over');
            });
            card.addEventListener('dragleave', function() {
                card.classList.remove('drag-over');
            });
            card.addEventListener('drop', function(e) {
                e.preventDefault();
                card.classList.remove('drag-over');
                var fromIdx = dragSrcIndex;
                var toIdx = idx;
                if (fromIdx !== null && fromIdx !== toIdx) {
                    var item = activeCities.splice(fromIdx, 1)[0];
                    activeCities.splice(toIdx, 0, item);
                    saveCities();
                    render();
                }
            });

            col.appendChild(card);
            clockGrid.appendChild(col);
        });

        // Add city card
        if (activeCities.length < 20) {
            var addCol = document.createElement('div');
            addCol.className = 'col-6 col-md-4 col-lg-3 col-xl-2';
            addCol.innerHTML = '<div class="wc-empty" id="addCityCard"><i class="bi bi-plus-circle"></i>Add City</div>';
            clockGrid.appendChild(addCol);
            document.getElementById('addCityCard').addEventListener('click', function() {
                btnAddCity.click();
            });
        }

        updatePlanner();
    }

    // ── Tick (update every second) ──
    function startTick() {
        if (tickInterval) clearInterval(tickInterval);
        tickInterval = setInterval(function() {
            var now = new Date();
            var localOffset = getOffsetMinutes(Intl.DateTimeFormat().resolvedOptions().timeZone);
            var cards = clockGrid.querySelectorAll('.wc-card');
            cards.forEach(function(card) {
                var tzId = card.dataset.tz;
                if (!tzId) return;
                var parts = getTimeParts(tzId, now);
                var h = parseInt(parts.hour);
                var m = parseInt(parts.minute);
                var s = parseInt(parts.second);

                var analogEl = card.querySelector('.wc-analog');
                if (analogEl) {
                    analogEl.outerHTML = createAnalogSVG(h, m, s);
                }
                var digitalEl = card.querySelector('.wc-digital');
                if (digitalEl) digitalEl.textContent = formatTime(parts);
                var dateEl = card.querySelector('.wc-date');
                if (dateEl) dateEl.textContent = parts.weekday + ', ' + parts.month + ' ' + parts.day + ', ' + parts.year;
            });
        }, 1000);
    }

    // ── Add City Modal ──
    function renderCityList(query) {
        var regions = ['Asia-Pacific', 'Europe', 'Americas', 'Middle East & Africa'];
        var html = '';
        regions.forEach(function(region) {
            var cities = CITIES.filter(function(c) {
                if (c.region !== region) return false;
                if (!query) return true;
                return c.name.toLowerCase().indexOf(query) !== -1 ||
                       c.country.toLowerCase().indexOf(query) !== -1 ||
                       c.id.toLowerCase().indexOf(query) !== -1;
            });
            if (!cities.length) return;
            html += '<div class="wc-region-title">' + region + '</div>';
            cities.forEach(function(c) {
                var isAdded = activeCities.indexOf(c.id) !== -1;
                html += '<div class="wc-city-item' + (isAdded ? ' added' : '') + '" data-tz="' + c.id + '">' +
                    '<span class="wc-city-flag">' + c.flag + '</span>' +
                    '<span class="wc-city-name">' + c.name + '</span>' +
                    '<span class="wc-city-tz">' + c.id.replace(/_/g,' ') + '</span>' +
                    '</div>';
            });
        });
        if (!html) html = '<div class="text-center text-muted py-4">No cities found</div>';
        cityList.innerHTML = html;

        // Click handlers
        cityList.querySelectorAll('.wc-city-item:not(.added)').forEach(function(el) {
            el.addEventListener('click', function() {
                var tz = this.dataset.tz;
                if (activeCities.indexOf(tz) === -1) {
                    activeCities.push(tz);
                    saveCities();
                    render();
                    renderCityList(citySearch.value.trim().toLowerCase());
                }
            });
        });
    }

    // ── Meeting Planner ──
    function updatePlanner() {
        // Update ref timezone dropdown
        var currentRef = refTimezone.value;
        refTimezone.innerHTML = '';
        activeCities.forEach(function(tzId) {
            var city = findCity(tzId);
            var opt = document.createElement('option');
            opt.value = tzId;
            opt.textContent = city.flag + ' ' + city.name;
            refTimezone.appendChild(opt);
        });
        if (currentRef && activeCities.indexOf(currentRef) !== -1) {
            refTimezone.value = currentRef;
        } else if (activeCities.length) {
            refTimezone.value = activeCities[0];
        }

        renderPlannerBars();
    }

    function renderPlannerBars() {
        if (!activeCities.length) {
            plannerRows.innerHTML = '<div class="text-muted text-center py-3">Add cities to use the meeting planner</div>';
            bestTimeBox.style.display = 'none';
            return;
        }

        var refTz = refTimezone.value || activeCities[0];
        var sliderVal = parseInt(timeSlider.value);
        var refHour = Math.floor(sliderVal / 60);
        var refMin = sliderVal % 60;
        sliderTimeDisplay.textContent = formatTimeShort(refHour, refMin);

        // Calculate reference offset
        var refOffset = getOffsetMinutes(refTz);

        var html = '';
        activeCities.forEach(function(tzId) {
            var city = findCity(tzId);
            var cityOffset = getOffsetMinutes(tzId);
            var diffMin = cityOffset - refOffset;
            var cityTotalMin = (sliderVal + diffMin + 1440) % 1440;
            var cityH = Math.floor(cityTotalMin / 60);
            var cityM = cityTotalMin % 60;
            var daytime = isDaytime(cityH);

            // Build 24 segments (1 per hour)
            var segments = '';
            for (var hr = 0; hr < 24; hr++) {
                var cls;
                if (hr >= 9 && hr < 18) cls = 'wc-seg-work';
                else if (hr >= 18 && hr < 22) cls = 'wc-seg-evening';
                else cls = 'wc-seg-night';
                segments += '<div class="wc-planner-segment ' + cls + '" style="width:' + (100/24) + '%"></div>';
            }

            // Marker position (percentage of 24h)
            var markerPct = (cityTotalMin / 1440) * 100;

            html += '<div class="wc-planner-row">' +
                '<div class="wc-planner-label">' + city.flag + ' ' + city.name + '</div>' +
                '<div class="wc-planner-bar-wrap">' +
                    '<div class="wc-planner-bar">' + segments + '</div>' +
                    '<div class="wc-planner-marker" style="left:' + markerPct + '%"></div>' +
                '</div>' +
                '<div class="wc-planner-time">' +
                    formatTimeShort(cityH, cityM) + ' ' + (daytime ? '\u2600\uFE0F' : '\uD83C\uDF19') +
                '</div>' +
            '</div>';
        });
        plannerRows.innerHTML = html;

        // Best meeting time
        findBestTime(refTz);
    }

    function findBestTime(refTz) {
        if (activeCities.length < 2) {
            bestTimeBox.style.display = 'none';
            return;
        }

        var refOffset = getOffsetMinutes(refTz);
        var offsets = activeCities.map(function(tz) { return getOffsetMinutes(tz); });

        // Find hours where ALL cities are in working hours (9-18)
        var bestSlots = [];
        for (var refH = 0; refH < 24; refH++) {
            var allWork = true;
            for (var i = 0; i < offsets.length; i++) {
                var diff = offsets[i] - refOffset;
                var cityH = ((refH * 60 + diff + 1440) % 1440) / 60;
                cityH = Math.floor(cityH);
                if (cityH < 9 || cityH >= 18) { allWork = false; break; }
            }
            if (allWork) bestSlots.push(refH);
        }

        bestTimeBox.style.display = '';
        var refCity = findCity(refTz);
        if (bestSlots.length) {
            var rangeStart = formatTimeShort(bestSlots[0], 0);
            var rangeEnd = formatTimeShort(bestSlots[bestSlots.length - 1], 59);
            bestTimeBox.className = 'wc-best-time';
            bestTimeBox.innerHTML = '\u2705 <strong>Best meeting window</strong> (' + refCity.name + ' time): ' +
                '<strong>' + rangeStart + ' \u2013 ' + rangeEnd + '</strong> — all cities within working hours (09:00\u201318:00)';
        } else {
            // Find best partial overlap
            var maxOverlap = 0;
            var bestH = 9;
            for (var rh = 0; rh < 24; rh++) {
                var count = 0;
                for (var j = 0; j < offsets.length; j++) {
                    var d = offsets[j] - refOffset;
                    var ch = ((rh * 60 + d + 1440) % 1440) / 60;
                    ch = Math.floor(ch);
                    if (ch >= 9 && ch < 18) count++;
                }
                if (count > maxOverlap) { maxOverlap = count; bestH = rh; }
            }
            bestTimeBox.className = 'wc-best-time no-overlap';
            bestTimeBox.innerHTML = '\u26A0\uFE0F <strong>No full overlap</strong> — best compromise at <strong>' +
                formatTimeShort(bestH, 0) + '</strong> (' + refCity.name + ' time), ' +
                maxOverlap + ' of ' + offsets.length + ' cities in working hours';
        }
    }

    timeSlider.addEventListener('input', renderPlannerBars);
    refTimezone.addEventListener('change', renderPlannerBars);

    // Pin star
    document.querySelectorAll('.pin-star').forEach(function(btn) {
        var toolId = btn.dataset.tool;
        var pinned = JSON.parse(localStorage.getItem('devhelper_pinned_tools') || '[]');
        var icon = btn.querySelector('i');
        if (pinned.indexOf(toolId) !== -1) {
            icon.className = 'bi bi-star-fill text-warning';
        }
        btn.addEventListener('click', function() {
            var pinned = JSON.parse(localStorage.getItem('devhelper_pinned_tools') || '[]');
            var idx = pinned.indexOf(toolId);
            if (idx !== -1) {
                pinned.splice(idx, 1);
                icon.className = 'bi bi-star';
            } else {
                pinned.push(toolId);
                icon.className = 'bi bi-star-fill text-warning';
            }
            localStorage.setItem('devhelper_pinned_tools', JSON.stringify(pinned));
        });
    });
});
