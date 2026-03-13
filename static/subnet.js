// ── IP Subnet Calculator ──
document.addEventListener('DOMContentLoaded', function () {
    const ipInput = document.getElementById('ipInput');
    const cidrInput = document.getElementById('cidrInput');
    const maskInput = document.getElementById('maskInput');
    const results = document.getElementById('results');
    const splitCidr = document.getElementById('splitCidr');
    const splitBody = document.getElementById('splitBody');

    function ipToInt(ip) {
        const parts = ip.split('.').map(Number);
        return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
    }

    function intToIp(n) {
        return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    }

    function cidrToMask(cidr) {
        if (cidr === 0) return 0;
        return (~0 << (32 - cidr)) >>> 0;
    }

    function maskToCidr(mask) {
        let n = mask;
        let bits = 0;
        while (n) { bits += n & 1; n >>>= 1; }
        return bits;
    }

    function isValidIp(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        return parts.every(p => { const n = parseInt(p); return !isNaN(n) && n >= 0 && n <= 255 && String(n) === p.trim(); });
    }

    function isValidMask(mask) {
        const n = ipToInt(mask);
        if (n === 0) return true;
        // Must be contiguous 1s followed by 0s
        const inv = ~n >>> 0;
        return (inv & (inv + 1)) === 0;
    }

    function getIpClass(firstOctet) {
        if (firstOctet < 128) return 'A';
        if (firstOctet < 192) return 'B';
        if (firstOctet < 224) return 'C';
        if (firstOctet < 240) return 'D (Multicast)';
        return 'E (Reserved)';
    }

    function calculate() {
        const ip = ipInput.value.trim();
        const cidr = parseInt(cidrInput.value);

        if (!isValidIp(ip) || isNaN(cidr) || cidr < 0 || cidr > 32) {
            results.style.display = 'none';
            return;
        }

        const ipInt = ipToInt(ip);
        const mask = cidrToMask(cidr);
        const wildcard = ~mask >>> 0;
        const network = (ipInt & mask) >>> 0;
        const broadcast = (network | wildcard) >>> 0;
        const totalHosts = Math.pow(2, 32 - cidr);
        const usable = cidr >= 31 ? totalHosts : totalHosts - 2;
        const firstHost = cidr >= 31 ? network : network + 1;
        const lastHost = cidr >= 31 ? broadcast : broadcast - 1;

        document.getElementById('netAddr').textContent = intToIp(network);
        document.getElementById('bcastAddr').textContent = intToIp(broadcast);
        document.getElementById('subnetMask').textContent = intToIp(mask);
        document.getElementById('wildcardMask').textContent = intToIp(wildcard);
        document.getElementById('firstHost').textContent = intToIp(firstHost);
        document.getElementById('lastHost').textContent = intToIp(lastHost);
        document.getElementById('totalHosts').textContent = totalHosts.toLocaleString();
        document.getElementById('usableHosts').textContent = usable.toLocaleString();
        document.getElementById('cidrNotation').textContent = intToIp(network) + '/' + cidr;
        document.getElementById('ipClass').textContent = 'Class ' + getIpClass(ipInt >>> 24);
        document.getElementById('ipRange').textContent = intToIp(firstHost) + ' — ' + intToIp(lastHost);

        // Binary
        const bin = ipInt.toString(2).padStart(32, '0');
        document.getElementById('ipBinary').textContent =
            bin.slice(0, 8) + '.' + bin.slice(8, 16) + '.' + bin.slice(16, 24) + '.' + bin.slice(24, 32);

        // Bit visualization
        let bitHtml = '';
        for (let oct = 0; oct < 4; oct++) {
            bitHtml += '<div class="octet">';
            for (let bit = 0; bit < 8; bit++) {
                const pos = oct * 8 + bit;
                const isNet = pos < cidr;
                const val = (ipInt >>> (31 - pos)) & 1;
                bitHtml += `<div class="bit ${isNet ? 'net' : 'host'}">${val}</div>`;
            }
            bitHtml += '</div>';
        }
        document.getElementById('bitVis').innerHTML = bitHtml;

        // Subnet split options
        splitCidr.innerHTML = '';
        for (let c = cidr + 1; c <= Math.min(cidr + 8, 32); c++) {
            const subnets = Math.pow(2, c - cidr);
            const hosts = Math.pow(2, 32 - c);
            splitCidr.innerHTML += `<option value="${c}">/${c} (${subnets} subnets, ${hosts} hosts)</option>`;
        }
        renderSplit();

        results.style.display = '';
        maskInput.value = intToIp(mask);
    }

    function renderSplit() {
        const ip = ipInput.value.trim();
        const baseCidr = parseInt(cidrInput.value);
        const newCidr = parseInt(splitCidr.value);
        if (!isValidIp(ip) || isNaN(baseCidr) || isNaN(newCidr)) return;

        const ipInt = ipToInt(ip);
        const baseMask = cidrToMask(baseCidr);
        const baseNet = (ipInt & baseMask) >>> 0;
        const newMask = cidrToMask(newCidr);
        const subnetSize = Math.pow(2, 32 - newCidr);
        const numSubnets = Math.pow(2, newCidr - baseCidr);
        const maxShow = Math.min(numSubnets, 64);

        let html = '';
        for (let i = 0; i < maxShow; i++) {
            const net = (baseNet + i * subnetSize) >>> 0;
            const bcast = (net + subnetSize - 1) >>> 0;
            const first = newCidr >= 31 ? net : net + 1;
            const last = newCidr >= 31 ? bcast : bcast - 1;
            html += `<tr>
                <td>${i + 1}</td>
                <td>${intToIp(net)}/${newCidr}</td>
                <td>${intToIp(first)} — ${intToIp(last)}</td>
                <td>${intToIp(bcast)}</td>
            </tr>`;
        }
        if (numSubnets > maxShow) {
            html += `<tr><td colspan="4" class="text-center text-muted">... and ${numSubnets - maxShow} more subnets</td></tr>`;
        }
        splitBody.innerHTML = html;
    }

    // Events
    ipInput.addEventListener('input', calculate);
    cidrInput.addEventListener('input', function () {
        const cidr = parseInt(this.value);
        if (!isNaN(cidr) && cidr >= 0 && cidr <= 32) {
            maskInput.value = intToIp(cidrToMask(cidr));
        }
        calculate();
    });
    maskInput.addEventListener('input', function () {
        const mask = this.value.trim();
        if (isValidIp(mask) && isValidMask(mask)) {
            cidrInput.value = maskToCidr(ipToInt(mask));
            calculate();
        }
    });
    splitCidr.addEventListener('change', renderSplit);

    document.querySelectorAll('.cidr-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            cidrInput.value = this.dataset.cidr;
            document.querySelectorAll('.cidr-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            calculate();
        });
    });

    // Copy on click
    document.getElementById('results').addEventListener('click', function (e) {
        const val = e.target.closest('.result-value');
        if (val) {
            navigator.clipboard.writeText(val.textContent.trim()).then(() => {
                val.style.color = 'var(--bs-success)';
                setTimeout(() => { val.style.color = ''; }, 600);
            });
        }
    });

    // Initial
    calculate();
});
