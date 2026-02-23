// ── Network Inspector ──
document.addEventListener('DOMContentLoaded', function () {

    // ── Helpers ──
    function escapeHtml(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    function copyText(text) {
        navigator.clipboard.writeText(text).then(function () {
            showToast('Copied to clipboard');
        });
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.className = 'position-fixed bottom-0 end-0 m-3 alert alert-dark py-2 px-3 small shadow-sm';
        toast.style.zIndex = '9999';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function () { toast.remove(); }, 1500);
    }

    function showLoading(container, msg) {
        container.innerHTML = '<div class="tab-loading">' +
            '<div class="spinner-border text-primary" role="status"></div>' +
            '<div class="mt-2">' + escapeHtml(msg || 'Loading...') + '</div></div>';
    }

    function showError(container, msg) {
        container.innerHTML = '<div class="alert alert-danger"><i class="bi bi-exclamation-triangle"></i> ' + escapeHtml(msg) + '</div>';
    }

    function countryFlag(code) {
        if (!code || code.length !== 2) return '';
        return String.fromCodePoint(...[...code.toUpperCase()].map(function (c) { return 0x1F1E6 - 65 + c.charCodeAt(0); }));
    }

    function copyIcon(text) {
        return ' <i class="bi bi-clipboard copy-btn" title="Copy" onclick="navigator.clipboard.writeText(\'' +
            text.replace(/'/g, "\\'").replace(/\\/g, '\\\\') + '\')"></i>';
    }

    // ── Tab 1: My IP ──
    const myIPResult = document.getElementById('myIPResult');

    function fetchMyIP() {
        showLoading(myIPResult, 'Detecting your public IP...');
        fetch('/api/netinspect/myip')
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.status === 'fail') {
                    showError(myIPResult, data.message || 'Failed to detect IP');
                    return;
                }
                renderIPData(myIPResult, data, true);
            })
            .catch(function (err) { showError(myIPResult, err.message); });
    }

    function renderIPData(container, data, isMyIP) {
        const flag = countryFlag(data.countryCode);
        var html = '<div class="row g-3">';

        // IP address (large)
        html += '<div class="col-12">';
        html += '<div class="result-card text-center">';
        html += '<div class="result-label">' + (isMyIP ? 'Your Public IP' : 'IP Address') + '</div>';
        html += '<div class="result-value-lg">' + escapeHtml(data.query || data.ip || '') + copyIcon(data.query || data.ip || '') + '</div>';
        html += '</div></div>';

        // Grid of info
        var fields = [
            { label: 'Country', value: flag + ' ' + (data.country || 'N/A') },
            { label: 'Region', value: data.regionName || data.region || 'N/A' },
            { label: 'City', value: data.city || 'N/A' },
            { label: 'ZIP', value: data.zip || 'N/A' },
            { label: 'Timezone', value: data.timezone || 'N/A' },
            { label: 'ISP', value: data.isp || 'N/A' },
            { label: 'Organization', value: data.org || 'N/A' },
            { label: 'AS', value: data.as || 'N/A' },
            { label: 'Latitude', value: data.lat != null ? String(data.lat) : 'N/A' },
            { label: 'Longitude', value: data.lon != null ? String(data.lon) : 'N/A' },
        ];

        fields.forEach(function (f) {
            html += '<div class="col-sm-6 col-md-4">';
            html += '<div class="result-card">';
            html += '<div class="result-label">' + escapeHtml(f.label) + '</div>';
            html += '<div class="result-value">' + escapeHtml(f.value) + '</div>';
            html += '</div></div>';
        });

        // Map link
        if (data.lat != null && data.lon != null) {
            html += '<div class="col-12">';
            html += '<a href="https://maps.google.com/maps?q=' + data.lat + ',' + data.lon + '" target="_blank" class="btn btn-sm btn-outline-primary">';
            html += '<i class="bi bi-map"></i> View on Map</a>';
            html += '</div>';
        }

        html += '</div>';
        container.innerHTML = html;
    }

    document.getElementById('refreshMyIP').addEventListener('click', fetchMyIP);
    fetchMyIP(); // Auto-fetch on load

    // ── Tab 2: IP Lookup ──
    const ipLookupInput = document.getElementById('ipLookupInput');
    const ipLookupResult = document.getElementById('ipLookupResult');

    function doIPLookup() {
        var ip = ipLookupInput.value.trim();
        if (!ip) { ipLookupInput.focus(); return; }
        showLoading(ipLookupResult, 'Looking up ' + ip + '...');
        fetch('/api/netinspect/iplookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip: ip })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.error) {
                    showError(ipLookupResult, data.error);
                    return;
                }
                if (data.status === 'fail') {
                    showError(ipLookupResult, data.message || 'Lookup failed');
                    return;
                }
                renderIPData(ipLookupResult, data, false);
            })
            .catch(function (err) { showError(ipLookupResult, err.message); });
    }

    document.getElementById('ipLookupBtn').addEventListener('click', doIPLookup);
    ipLookupInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doIPLookup();
    });
    document.querySelectorAll('.ip-preset').forEach(function (btn) {
        btn.addEventListener('click', function () {
            ipLookupInput.value = this.dataset.ip;
            doIPLookup();
        });
    });

    // ── Tab 3: DNS Lookup ──
    const dnsInput = document.getElementById('dnsInput');
    const dnsType = document.getElementById('dnsType');
    const dnsResult = document.getElementById('dnsResult');

    function doDNSLookup() {
        var domain = dnsInput.value.trim();
        if (!domain) { dnsInput.focus(); return; }
        var type = dnsType.value;
        showLoading(dnsResult, 'Looking up ' + type + ' records for ' + domain + '...');
        fetch('/api/netinspect/dns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ domain: domain, type: type })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.error) {
                    showError(dnsResult, data.error);
                    return;
                }
                renderDNSResults(data);
            })
            .catch(function (err) { showError(dnsResult, err.message); });
    }

    function renderDNSResults(data) {
        var html = '';

        // Elapsed time badge
        if (data.elapsed_ms != null) {
            html += '<div class="mb-3"><span class="badge bg-secondary"><i class="bi bi-clock"></i> ' + data.elapsed_ms + 'ms</span></div>';
        }

        var records = data.records || {};
        var hasAny = false;

        // For ALL type, records is an object with type keys
        // For single type, records is an object with one key
        var types = Object.keys(records);
        types.forEach(function (rtype) {
            var recs = records[rtype];
            if (!recs || recs.length === 0) return;
            hasAny = true;

            html += '<div class="card mb-3">';
            html += '<div class="card-header py-2 d-flex justify-content-between align-items-center">';
            html += '<span class="fw-semibold"><i class="bi bi-signpost-2"></i> ' + escapeHtml(rtype) + ' Records</span>';
            html += '<span class="badge bg-primary">' + recs.length + '</span>';
            html += '</div>';
            html += '<div class="card-body p-0">';
            html += '<table class="table table-sm table-hover mb-0 dns-table">';

            if (rtype === 'MX') {
                html += '<thead><tr><th>Priority</th><th>Host</th></tr></thead><tbody>';
                recs.forEach(function (r) {
                    html += '<tr><td>' + escapeHtml(String(r.priority || '')) + '</td><td>' + escapeHtml(r.host || r.value || '') + '</td></tr>';
                });
            } else {
                html += '<thead><tr><th>Value</th></tr></thead><tbody>';
                recs.forEach(function (r) {
                    var val = typeof r === 'string' ? r : (r.value || r.host || JSON.stringify(r));
                    html += '<tr><td>' + escapeHtml(val) + '</td></tr>';
                });
            }

            html += '</tbody></table></div></div>';
        });

        if (!hasAny) {
            html += '<div class="alert alert-warning"><i class="bi bi-info-circle"></i> No records found.</div>';
        }

        dnsResult.innerHTML = html;
    }

    document.getElementById('dnsLookupBtn').addEventListener('click', doDNSLookup);
    dnsInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doDNSLookup();
    });
    document.querySelectorAll('.dns-preset').forEach(function (btn) {
        btn.addEventListener('click', function () {
            dnsInput.value = this.dataset.domain;
            doDNSLookup();
        });
    });

    // ── Tab 4: HTTP Headers ──
    const headersInput = document.getElementById('headersInput');
    const headersResult = document.getElementById('headersResult');

    const SECURITY_HEADERS = [
        { name: 'Strict-Transport-Security', desc: 'HSTS — forces HTTPS' },
        { name: 'Content-Security-Policy', desc: 'CSP — prevents XSS' },
        { name: 'X-Content-Type-Options', desc: 'Prevents MIME sniffing' },
        { name: 'X-Frame-Options', desc: 'Prevents clickjacking' },
        { name: 'X-XSS-Protection', desc: 'XSS filter' },
        { name: 'Referrer-Policy', desc: 'Controls referrer info' },
        { name: 'Permissions-Policy', desc: 'Controls browser features' },
    ];

    function doHeadersCheck() {
        var url = headersInput.value.trim();
        if (!url) { headersInput.focus(); return; }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        headersInput.value = url;
        showLoading(headersResult, 'Fetching headers from ' + url + '...');
        fetch('/api/netinspect/headers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.error) {
                    showError(headersResult, data.error);
                    return;
                }
                renderHeadersResult(data);
            })
            .catch(function (err) { showError(headersResult, err.message); });
    }

    function renderHeadersResult(data) {
        var html = '';

        // Status
        var statusClass = data.status < 300 ? 'success' : data.status < 400 ? 'info' : data.status < 500 ? 'warning' : 'danger';
        html += '<div class="mb-3">';
        html += '<span class="badge bg-' + statusClass + ' fs-6">' + escapeHtml(data.statusText || String(data.status)) + '</span>';
        if (data.elapsed_ms != null) {
            html += ' <span class="badge bg-secondary"><i class="bi bi-clock"></i> ' + data.elapsed_ms + 'ms</span>';
        }
        html += '</div>';

        // Security Analysis
        html += '<div class="card mb-3">';
        html += '<div class="card-header py-2"><span class="fw-semibold"><i class="bi bi-shield-check"></i> Security Headers</span></div>';
        html += '<div class="card-body"><div class="security-grid">';

        var headers = data.headers || {};
        // Normalize header keys to lowercase map
        var headerMap = {};
        Object.keys(headers).forEach(function (k) { headerMap[k.toLowerCase()] = headers[k]; });

        SECURITY_HEADERS.forEach(function (sh) {
            var val = headerMap[sh.name.toLowerCase()];
            var badge, badgeClass;
            if (val) {
                badge = 'SET';
                badgeClass = 'badge-pass';
            } else {
                badge = 'MISSING';
                badgeClass = 'badge-fail';
            }
            html += '<div class="security-item">';
            html += '<span class="badge ' + badgeClass + '">' + badge + '</span>';
            html += '<span>' + escapeHtml(sh.name) + '</span>';
            html += '</div>';
        });

        // Count pass/fail
        var passCount = SECURITY_HEADERS.filter(function (sh) { return headerMap[sh.name.toLowerCase()]; }).length;
        html += '</div>';
        html += '<div class="mt-2 small text-muted"><i class="bi bi-info-circle"></i> Score: ' + passCount + '/' + SECURITY_HEADERS.length + ' security headers present</div>';
        html += '</div></div>';

        // All Response Headers
        html += '<div class="card">';
        html += '<div class="card-header py-2 d-flex justify-content-between align-items-center">';
        html += '<span class="fw-semibold"><i class="bi bi-list-check"></i> All Response Headers</span>';
        html += '<span class="badge bg-secondary">' + Object.keys(headers).length + '</span>';
        html += '</div>';
        html += '<div class="card-body p-0">';

        var sortedKeys = Object.keys(headers).sort();
        sortedKeys.forEach(function (k) {
            html += '<div class="header-row">';
            html += '<span class="header-name">' + escapeHtml(k) + '</span>';
            html += '<span class="header-value">' + escapeHtml(headers[k]) + '</span>';
            html += '</div>';
        });

        html += '</div></div>';
        headersResult.innerHTML = html;
    }

    document.getElementById('headersCheckBtn').addEventListener('click', doHeadersCheck);
    headersInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doHeadersCheck();
    });
    document.querySelectorAll('.headers-preset').forEach(function (btn) {
        btn.addEventListener('click', function () {
            headersInput.value = this.dataset.url;
            doHeadersCheck();
        });
    });

    // ── Tab 5: SSL Check ──
    const sslInput = document.getElementById('sslInput');
    const sslResult = document.getElementById('sslResult');

    function doSSLCheck() {
        var host = sslInput.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:.*$/, '');
        if (!host) { sslInput.focus(); return; }
        sslInput.value = host;
        showLoading(sslResult, 'Checking SSL certificate for ' + host + '...');
        fetch('/api/netinspect/ssl', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host: host })
        })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.error) {
                    showError(sslResult, data.error);
                    return;
                }
                renderSSLResult(data);
            })
            .catch(function (err) { showError(sslResult, err.message); });
    }

    function renderSSLResult(data) {
        var html = '';

        // Validity badge
        var validClass, validIcon, validText;
        if (data.validity === 'valid') {
            validClass = 'success';
            validIcon = 'bi-shield-fill-check';
            validText = 'Valid Certificate';
        } else if (data.validity === 'expiring') {
            validClass = 'warning';
            validIcon = 'bi-shield-fill-exclamation';
            validText = 'Expiring Soon';
        } else {
            validClass = 'danger';
            validIcon = 'bi-shield-fill-x';
            validText = 'Expired';
        }

        html += '<div class="alert alert-' + validClass + ' d-flex align-items-center gap-2 mb-3">';
        html += '<i class="bi ' + validIcon + ' fs-4"></i>';
        html += '<div>';
        html += '<strong>' + validText + '</strong>';
        if (data.days_until_expiry != null) {
            html += ' &mdash; ' + (data.days_until_expiry >= 0 ? data.days_until_expiry + ' days remaining' : 'Expired ' + Math.abs(data.days_until_expiry) + ' days ago');
        }
        html += '</div></div>';

        // Certificate details
        html += '<div class="row g-3 mb-3">';

        var fields = [
            { label: 'Subject (CN)', value: data.subject_cn || 'N/A' },
            { label: 'Subject (O)', value: data.subject_org || 'N/A' },
            { label: 'Issuer (CN)', value: data.issuer_cn || 'N/A' },
            { label: 'Issuer (O)', value: data.issuer_org || 'N/A' },
            { label: 'Not Before', value: data.not_before || 'N/A' },
            { label: 'Not After', value: data.not_after || 'N/A' },
            { label: 'Serial Number', value: data.serial || 'N/A' },
            { label: 'Signature Algorithm', value: data.signature_algorithm || 'N/A' },
            { label: 'TLS Version', value: data.tls_version || 'N/A' },
        ];

        fields.forEach(function (f) {
            html += '<div class="col-sm-6 col-md-4">';
            html += '<div class="result-card">';
            html += '<div class="result-label">' + escapeHtml(f.label) + '</div>';
            html += '<div class="result-value">' + escapeHtml(f.value) + '</div>';
            html += '</div></div>';
        });

        html += '</div>';

        // SANs
        if (data.dns_names && data.dns_names.length > 0) {
            html += '<div class="card mb-3">';
            html += '<div class="card-header py-2 d-flex justify-content-between align-items-center">';
            html += '<span class="fw-semibold"><i class="bi bi-globe2"></i> Subject Alternative Names (SANs)</span>';
            html += '<span class="badge bg-primary">' + data.dns_names.length + '</span>';
            html += '</div>';
            html += '<div class="card-body">';
            html += '<div class="d-flex flex-wrap gap-1">';
            data.dns_names.forEach(function (name) {
                html += '<span class="badge bg-secondary">' + escapeHtml(name) + '</span>';
            });
            html += '</div></div></div>';
        }

        // Certificate chain
        if (data.chain && data.chain.length > 0) {
            html += '<div class="card">';
            html += '<div class="card-header py-2"><span class="fw-semibold"><i class="bi bi-link-45deg"></i> Certificate Chain</span></div>';
            html += '<div class="card-body">';
            data.chain.forEach(function (cert, i) {
                html += '<div class="cert-chain-item">';
                html += '<div class="small fw-semibold">' + (i === 0 ? 'Leaf' : i === data.chain.length - 1 ? 'Root' : 'Intermediate') + '</div>';
                html += '<div class="result-value small">' + escapeHtml(cert.subject || '') + '</div>';
                html += '<div class="small text-muted">Issuer: ' + escapeHtml(cert.issuer || '') + '</div>';
                html += '</div>';
            });
            html += '</div></div>';
        }

        sslResult.innerHTML = html;
    }

    document.getElementById('sslCheckBtn').addEventListener('click', doSSLCheck);
    sslInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') doSSLCheck();
    });
    document.querySelectorAll('.ssl-preset').forEach(function (btn) {
        btn.addEventListener('click', function () {
            sslInput.value = this.dataset.host;
            doSSLCheck();
        });
    });

});
