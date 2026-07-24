// Snippet: Insights JS — API v2.7.0 (Correct UI Buttons & Logic)
// Type: Run Everywhere
add_action('wp_footer', function() {
?>
<script>
  if (document.getElementById('fi-app')) (function () {
    'use strict';
    var A = window.FD_AJAX || '/wp-admin/admin-ajax.php';

    function ajax(action, params, cb) {
      params = Object.assign(params || {}, { _t: Date.now() });
      jQuery.ajax({
        url: A, data: Object.assign({ action: action }, params), timeout: 60000,
        success: function (r) { cb(r, null); }, error: function (x, st) { cb(null, st); }
      });
    }

    function ok(r) { return r && !r.error && !(r.status && r.client_ip); }
    function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
    function fmt(n) { n = Number(n || 0); if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'; if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M'; if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(0) + 'K'; return n.toFixed(0); }
    function fmtD(n) { n = Number(n || 0); if (Math.abs(n) >= 1e9) return '$' + (Math.abs(n) / 1e9).toFixed(2) + 'B'; if (Math.abs(n) >= 1e6) return '$' + (Math.abs(n) / 1e6).toFixed(1) + 'M'; return '$' + Math.abs(n).toFixed(0); }
    function on(s, e, f) { document.querySelectorAll(s).forEach(function (el) { el.addEventListener(e, f); }); }
    function rc(v) { return v >= 0 ? '#059669' : '#dc2626'; }
    function rv(v) { return v !== 0 ? ((v >= 0 ? '+' : '') + Number(v).toFixed(2) + '%') : '0.00%'; }

    function spark(d, c, w, h) { if (!d || !d.length) return '<span style="color:#cbd5e1;font-size:11px">—</span>'; w = w || 100; h = h || 30; c = c || '#22c55e'; var p = 2, iw = w - 4, ih = h - 4, mx = Math.max.apply(null, d), mn = Math.min.apply(null, d), rng = mx - mn || 1; var pts = d.map(function (v, i) { return { x: p + (i / (d.length - 1)) * iw, y: p + ih - (((v - mn) / rng) * ih) }; }); var path = 'M' + pts[0].x + ',' + pts[0].y; for (var i = 0; i < pts.length - 1; i++) { var cx = (pts[i].x + pts[i + 1].x) / 2; path += ' C' + cx + ',' + pts[i].y + ' ' + cx + ',' + pts[i + 1].y + ' ' + pts[i + 1].x + ',' + pts[i + 1].y; } return '<svg width="' + w + '" height="' + h + '" class="fi-spark"><path d="' + path + '" fill="none" stroke="' + c + '" stroke-width="2" stroke-linecap="round"/></svg>'; }

    function sigB(sig) { var m = { 'strong_up': 'fi-sig-su', 'up': 'fi-sig-u', 'UP': 'fi-sig-u', 'sideways': 'fi-sig-s', 'HOLD': 'fi-sig-s', 'NEUTRAL': 'fi-sig-s', 'neutral': 'fi-sig-s', 'down': 'fi-sig-d', 'DOWN': 'fi-sig-d' }; var l = { 'strong_up': '🔥 มาแรง', 'up': '📈 ขาขึ้น', 'UP': '📈 UP', 'sideways': '➡️ ทรงตัว', 'HOLD': '➡️ ทรงตัว', 'NEUTRAL': '➡️ ทรงตัว', 'neutral': '➡️ ทรงตัว', 'down': '📉 ขาลง', 'DOWN': '📉 DOWN' }; return '<span class="fi-sig ' + (m[sig] || 'fi-sig-s') + '">' + (l[sig] || '➡️') + '</span>'; }
    function riskB(r) { return '<span class="fi-risk-badge fi-risk-' + r + '">' + r + '</span>'; }
    function zoneB(z) { var m = { 'deep_value': ['fi-zone-dv', '💎 ถูกมาก'], 'value': ['fi-zone-dv', '💎 Value'], 'under_value': ['fi-zone-uv', '🔵 ต่ำกว่าเฉลี่ย'], 'fair': ['fi-zone-f', '🟡 เหมาะสม'], 'over_value': ['fi-zone-ov', '🔴 แพง'], 'expensive': ['fi-zone-ov', '🔴 แพง'] }; var s = m[z] || m.fair; return '<span class="fi-zone ' + s[0] + '">' + s[1] + '</span>'; }
    function peBar(cur, avg) { if (!cur || !avg) return '—'; var mx = avg * 2, cp = Math.min(cur / mx * 100, 98), ap = Math.min(avg / mx * 100, 98), zc = cur < avg * 0.7 ? '#059669' : cur < avg ? '#0ea5e9' : cur < avg * 1.3 ? '#f59e0b' : '#ef4444'; return '<div class="fi-pe-bar"><div class="fi-pe-avg" style="left:' + ap + '%"></div><div class="fi-pe-dot" style="left:' + cp + '%;background:' + zc + '"></div></div>'; }
    function srcB(s) { return s === 'api' ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-left:6px">✅ API</span>' : (s === 'empty' ? '<span style="background:#f1f5f9;color:#64748b;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-left:6px">⚪ NO DATA</span>' : '<span style="background:#fef2f2;color:#ef4444;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;margin-left:6px">⚠️ ERROR</span>'); }

    // ── helpers สำหรับ response โครงสร้างใหม่ ──
    // BE ตอบ theme_funds[name] = { theme_name, theme_sector_breakdown, funds: [...] }
    function getThemeFunds(tf, name) {
      var themeObj = tf[name];
      if (!themeObj) return [];
      // รองรับทั้ง format เก่า (array) และใหม่ (object with .funds)
      return Array.isArray(themeObj) ? themeObj : (themeObj.funds || []);
    }
    function getThemeSectorBreakdown(tf, name) {
      var themeObj = tf[name];
      if (!themeObj || Array.isArray(themeObj)) return null;
      return themeObj.theme_sector_breakdown || null;
    }

    var urlTab = window.location.hash.replace('#', '');
    var initialTab = ['flow', 'trend', 'value'].indexOf(urlTab) >= 0 ? urlTab : 'flow';

    var S = {
      tab: initialTab, expanded: {},
      fundList: null, fundDetails: {}, fundTrends: {}, src1: 'loading',
      gfPeriod: '1M', gfSearch: '', gfSelected: [], globalFlows: [], gfSummary: {}, themeFunds: {},
      flowTrends: {}, loadingTrends: {}, src2: 'loading', valFunds: null, src3: 'loading',
      fundsUpdatedAt: ''
    };
    var app = document.getElementById('fi-app');

    function loadAll() {
      render(); loadFlowData();
      ajax('fund_insights_trend', { type: 'TH', limit: 20 }, function (r, err) {
        if (err || !r || r.error) { S.src1 = 'error'; render(); return; }
        var d = r.data ? r.data : r; S.fundList = d.funds || []; S.src1 = S.fundList.length > 0 ? 'api' : 'empty'; render();
      });
      ajax('fund_insights_valuation', { type: 'TH', limit: 20, sort_by: 'pe' }, function (r, err) {
        if (err || !r || r.error) { S.src3 = 'error'; render(); return; }
        var d = r.data ? r.data : r; S.valFunds = d.funds || []; S.src3 = 'api'; render();
      });
    }

    function loadFlowData() {
      S.src2 = 'loading'; render();
      ajax('fund_insights_global_flow', { period: S.gfPeriod }, function (r, err) {
        if (err || !r || r.error) { S.src2 = 'error'; S.globalFlows = []; S.gfSummary = {}; render(); return; }
        var d = r && r.data ? r.data : r; S.globalFlows = d.flows || []; S.gfSummary = d.summary || {};
        if (S.gfSelected.length === 0 && S.globalFlows.length > 0) { S.gfSelected = S.globalFlows.slice(0, 2).map(function (f) { return f.name; }); }
        S.src2 = 'api'; render(); loadThemeFunds();
      });
    }

    function loadThemeFunds() {
      if (!S.gfSelected.length) return;
      ajax('fund_insights_theme_funds', { themes: S.gfSelected.join(','), limit: 10, period: S.gfPeriod }, function (r, err) {
        if (err || !r || r.error) return;
        var d = r && r.data ? r.data : r;
        if (d.theme_funds) { S.themeFunds = d.theme_funds; }
        if (d.updated_at) { S.fundsUpdatedAt = d.updated_at; }

        loadTrend();
        render();
      });
    }

    function loadTrend() {
      var p = S.gfPeriod;
      if (S.flowTrends[p] || S.loadingTrends[p]) return;
      S.loadingTrends[p] = true;

      ajax('fund_insights_flow_trend', { type: 'FOREIGN', period: p }, function (r, err) {
        S.loadingTrends[p] = false;
        if (!err && r) { S.flowTrends[p] = r.data || r; render(); }
      });
    }

    function render() {
      var h = '<div class="fi-hdr"><div style="position:relative;z-index:1"><div style="display:flex;align-items:center;gap:10px;margin-bottom:4px"><span style="font-size:28px">🧭</span><h1>Fund Insights</h1></div><p class="fi-sub">วิเคราะห์โอกาสลงทุนผ่านกองทุนรวมไทย</p><div class="fi-tabs">';
      [{ id: 'flow', icon: '🌍', l: 'Global Fund Flow', s: 'เงินไหลเข้า/ออก' }, { id: 'trend', icon: '📈', l: 'Uptrend', s: 'กองทุนขาขึ้น' }, { id: 'value', icon: '💎', l: 'Valuation', s: 'PE ถูกหรือแพง' }].forEach(function (t) {
        h += '<button class="fi-tab' + (S.tab === t.id ? ' on' : '') + '" data-t="' + t.id + '"><span class="fi-tab-icon">' + t.icon + '</span><span class="fi-tab-text"><span class="fi-tab-label">' + t.l + '</span><span class="fi-tab-desc">' + t.s + '</span></span></button>';
      });
      h += '</div></div></div>';
      if (S.tab === 'trend') h += renderTrend(); else if (S.tab === 'flow') h += renderFlow(); else h += renderVal();
      h += '<div class="fi-footer"><span>⚠️ ข้อมูลเพื่อการศึกษาเท่านั้น ไม่ใช่คำแนะนำการลงทุน</span></div>';
      app.innerHTML = h; bindEvents();

      setTimeout(function () {
        document.querySelectorAll('.fi-inner-scroll').forEach(function (elScroll) {
          elScroll.scrollLeft = elScroll.scrollWidth;
        });
      }, 50);
    }

    function renderFlow() {
      var flows = S.globalFlows || [], tf = S.themeFunds || {}, sum = S.gfSummary || {};

      var updateAT = '';
      if (S.fundsUpdatedAt) {
        var dUp = new Date(S.fundsUpdatedAt);
        if (!isNaN(dUp.getTime())) {
          var pad = function (n) { return n < 10 ? '0' + n : n; };
          var formattedDate = dUp.getFullYear() + '-' + pad(dUp.getMonth() + 1) + '-' + pad(dUp.getDate()) + ' ' + pad(dUp.getHours()) + ':' + pad(dUp.getMinutes()) + ':' + pad(dUp.getSeconds());
          updateAT = ' <span style="font-size:13px; color:#64748b; font-weight:700; margin-left:6px;"> ข้อมูลอัพเดตล่าสุด ' + formattedDate + ' </span>';
        }
      }

      var h = '<div style="background:#f8fafc; padding-bottom:40px;">';
      h += '<div class="gf-title-row" style="padding: 16px 20px 0; display: flex; justify-content: flex-start; align-items: center; gap: 16px; flex-wrap: wrap;">';
      h += '<div class="gf-title" style="display: flex; align-items: center; gap: 8px; margin: 0;"><span style="font-size:20px">📊</span><h3 style="margin: 0;">Global Equity Fund Flow' + (S.src2 === 'loading' ? '' : srcB(S.src2)) + updateAT + '</h3></div>';
      h += '<div class="gf-period-btns" style="margin: 0;">';
      ['1D', '1W', '1M', '3M', 'YTD'].forEach(function (p) { h += '<button class="gf-period-btn' + (S.gfPeriod === p ? ' on' : '') + '" data-p="' + p + '">' + p + '</button>'; });
      h += '</div></div>';
      if (S.src2 === 'loading') return h + '<div style="text-align:center;padding:50px;color:#94a3b8">⏳ กำลังดึงข้อมูลกระแสเงินไหลเข้า...</div></div>';
      if (S.src2 === 'error') return h + '<div style="text-align:center;padding:50px;color:#ef4444">⚠️ เกิดข้อผิดพลาด ไม่สามารถดึงข้อมูลจาก API ได้</div></div>';
      h += '<div class="gf-summary-wrap"><div class="gf-summary"><div class="gf-summary-card"><div class="gf-summary-label">NET FLOW</div><div class="gf-summary-value" style="color:#2563eb">' + ((sum.net_flow_usd || 0) >= 0 ? '+' : '') + fmtD(sum.net_flow_usd || 0) + '</div></div><div class="gf-summary-card"><div class="gf-summary-label">INFLOW</div><div class="gf-summary-value" style="color:#059669">+' + fmtD(sum.total_inflow_usd || 0) + '</div></div><div class="gf-summary-card"><div class="gf-summary-label">OUTFLOW</div><div class="gf-summary-value" style="color:#ef4444">-' + fmtD(Math.abs(sum.total_outflow_usd || 0)) + '</div></div><div class="gf-summary-card"><div class="gf-summary-label">INFLOW ธีม</div><div class="gf-summary-value" style="color:#059669">' + (sum.inflow_themes || 0) + '</div></div><div class="gf-summary-card"><div class="gf-summary-label">OUTFLOW ธีม</div><div class="gf-summary-value" style="color:#ef4444">' + (sum.outflow_themes || 0) + '</div></div></div></div>';

      var sorted = flows.slice().sort(function (a, b) { return b.flow_usd - a.flow_usd; });
      var maxA = Math.max.apply(null, sorted.map(function (f) { return Math.abs(f.flow_usd); })) || 1;

      h += '<div style="background:#fff; border:1px solid #e2e8f0; border-radius:14px; padding:20px; margin:20px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;"><h3 style="font-size:18px; font-weight:800; margin:0;">Fund Flow รายธีม' + updateAT + '</h3><div style="display:flex; gap:8px;"><input type="text" placeholder="🔍 ค้นหาธีม..." style="padding:6px 14px; border:1px solid #cbd5e1; border-radius:20px; font-size:13px; outline:none;"><button style="background:#3b82f6; color:#fff; border:none; border-radius:20px; padding:6px 14px; font-size:13px; font-weight:600; cursor:pointer;">มูลค่า ↓</button></div></div><div style="column-count: 3; column-gap: 20px;">';

      sorted.forEach(function (f, i) {
        var pct = Math.abs(f.flow_usd) / maxA * 100, isP = f.flow_usd >= 0; var c = isP ? '#22c55e' : '#ef4444'; var isSel = S.gfSelected.indexOf(f.name) >= 0;
        var isDropOpen = !!S.expanded['sector_drop_' + f.name];

        h += '<div style="break-inside: avoid; margin-bottom: 14px; background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:10px; box-sizing: border-box; display: inline-flex; width: 100%; flex-direction:column; gap:8px; ' + (isSel ? 'background:#f0fdf4; border-color:#bbf7d0;' : '') + '">';
        h += '<div style="display:flex; align-items:center; justify-content:space-between; width:100%; gap:4px;">';
        h += '<div class="gf-flow-row" data-name="' + esc(f.name) + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; flex:1; min-width:0;"><span style="font-size:13px; font-weight:600; color:#334155; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:130px;"><span style="color:#94a3b8; font-size:11px; margin-right:4px;">' + (i + 1) + '.</span>' + esc(f.name) + '</span><div style="flex:1; height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden; display:flex; justify-content:' + (isP ? 'flex-start' : 'flex-end') + '"><div style="width:' + pct + '%; height:100%; background:' + c + '; border-radius:3px;"></div></div><span style="font-size:12px; font-weight:800; color:' + c + '; white-space:nowrap; margin-left:4px;">' + (isP ? '+' : '') + fmtD(f.flow_usd) + '</span></div>';
        h += '<button class="fi-sector-dropdown-trigger" data-name="' + esc(f.name) + '" style="background:transparent; border:none; color:#94a3b8; cursor:pointer; font-size:11px; padding:2px 4px; transition:transform 0.2s; ' + (isDropOpen ? 'transform:rotate(180deg); color:#475569;' : '') + '">▼</button>';
        h += '</div>';

        if (isDropOpen) {
          // ── FIX: BE ส่ง object {theme_name, theme_sector_breakdown, funds:[]} ──
          // ใช้ theme_sector_breakdown โดยตรงแทนคำนวณเอง (แม่นยำกว่า)
          var sectorBreakdown = getThemeSectorBreakdown(tf, f.name);
          var themeMappedFunds = getThemeFunds(tf, f.name);

          h += '<div style="border-top:1px dashed #e2e8f0; padding-top:8px; margin-top:2px; display:flex; flex-direction:column; gap:6px;">';

          if (sectorBreakdown && Object.keys(sectorBreakdown).length > 0) {
            // ✅ ใช้ theme_sector_breakdown จาก BE โดยตรง
            var sectorEntries = [];
            for (var sKey in sectorBreakdown) {
              sectorEntries.push({ name: sKey, value: Number(sectorBreakdown[sKey]) });
            }
            sectorEntries.sort(function (a, b) { return b.value - a.value; });

            sectorEntries.forEach(function (secItem, idx) {
              var barColor = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'][idx % 6];
              h += '<div style="display:flex; flex-direction:column; gap:3px;">' +
                '<div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700;">' +
                '<span style="color:#64748b; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:130px;">' + esc(secItem.name) + '</span>' +
                '<span style="color:' + barColor + ';">' + secItem.value.toFixed(1) + '%</span>' +
                '</div>' +
                '<div style="height:4px; background:#e2e8f0; border-radius:2px; overflow:hidden;">' +
                '<div style="width:' + Math.min(secItem.value, 100) + '%; height:100%; background:' + barColor + ';"></div>' +
                '</div>' +
                '</div>';
            });
          } else if (!themeMappedFunds.length) {
            h += '<div style="font-size:11px; color:#94a3b8; text-align:center; padding:4px 0;">⏳ คลิกเลือกธีมเพื่อดึงข้อมูล...</div>';
          } else {
            // fallback: คำนวณจาก fund flows หากไม่มี theme_sector_breakdown
            var sectorFlows = {};
            var totalThemeFlow = 0;
            themeMappedFunds.forEach(function (fundObj) {
              var secName = fundObj.sector || 'Uncategorized';
              var flowVal = Math.abs(Number(fundObj.flow_net_thb || fundObj.flow_in_thb || 0));
              if (!sectorFlows[secName]) sectorFlows[secName] = 0;
              sectorFlows[secName] += flowVal;
              totalThemeFlow += flowVal;
            });
            var sortedSectors = [];
            for (var sName in sectorFlows) { sortedSectors.push({ name: sName, value: sectorFlows[sName] }); }
            sortedSectors.sort(function (a, b) { return b.value - a.value; });
            sortedSectors.forEach(function (secItem, idx) {
              var secPct = totalThemeFlow > 0 ? (secItem.value / totalThemeFlow * 100) : 0;
              var barColor = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'][idx % 4];
              h += '<div style="display:flex; flex-direction:column; gap:3px;">' +
                '<div style="display:flex; justify-content:space-between; font-size:10px; font-weight:700;">' +
                '<span style="color:#64748b; text-overflow:ellipsis; overflow:hidden; white-space:nowrap; max-width:130px;">' + esc(secItem.name) + '</span>' +
                '<span style="color:' + barColor + ';">' + secPct.toFixed(1) + '%</span>' +
                '</div>' +
                '<div style="height:4px; background:#e2e8f0; border-radius:2px; overflow:hidden;">' +
                '<div style="width:' + secPct + '%; height:100%; background:' + barColor + ';"></div>' +
                '</div>' +
                '</div>';
            });
          }
          h += '</div>';
        }
        h += '</div>';
      });
      h += '</div></div><div style="margin: 0 20px 16px;"><div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">';
      if (S.gfSelected.length) h += '<button class="gf-tag-clear" style="background:#fef2f2; color:#ef4444; border:1px solid #fca5a5; padding:4px 12px; border-radius:20px; font-size:12px; cursor:pointer;">ยกเลิกทั้งหมด ✕</button>';
      S.gfSelected.forEach(function (n) { h += '<span class="gf-tag" data-name="' + esc(n) + '" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:600; cursor:pointer;">' + esc(n) + ' ✕</span>'; });
      h += '</div></div>';

      S.gfSelected.forEach(function (name) {
        // ── FIX: ดึง funds array จาก object ใหม่ ──
        var funds = getThemeFunds(tf, name);

        h += '<div style="margin: 0 20px 30px;"><div style="display:flex; align-items:center; gap:8px; margin-bottom:16px;"><h3 style="font-size:20px; font-weight:800; margin:0; color:#0f172a;">' + esc(name) + updateAT + '</h3></div>';
        if (!funds.length) { h += '<div style="color:#64748b;font-size:14px;padding:20px; background:#fff; border-radius:10px;">⏳ กำลังโหลดกองทุน...</div></div>'; return; }

        h += '<div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:12px;">';
        funds.forEach(function (f) {
          var borderColor = f.return_1y >= 0 ? '#22c55e' : '#ef4444';
          h += '<div style="min-width:270px; background:#fff; border:1px solid #e2e8f0; border-top:4px solid ' + borderColor + '; border-radius:10px; padding:16px;">' +
            '<div style="color:#94a3b8; font-size:12px; font-weight:700;">#' + f.rank + '</div>' +
            '<div style="font-size:16px; font-weight:800; color:#0f172a; margin-top:2px;">' + esc(f.code) + '</div>' +
            '<div style="font-size:11px; color:#64748b; margin-bottom:4px;">' + esc(f.amc) + '</div>' +
            '<div style="font-size:11px; color:#94a3b8; margin-bottom:8px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="' + esc(f.name) + '">' + esc(f.name) + '</div>' +
            '<div style="display:flex; gap:16px; align-items:flex-end;">' +
            '<div><div style="font-size:10px; color:#94a3b8; font-weight:700; margin-bottom:2px;">1Y RETURN</div><div style="font-size:22px; font-weight:800; color:' + (f.return_1y >= 0 ? '#22c55e' : '#ef4444') + ';">' + (f.return_1y >= 0 ? '+' : '') + Number(f.return_1y).toFixed(1) + '%</div></div>' +
            '<div><div style="font-size:10px; color:#94a3b8; font-weight:700; margin-bottom:2px;">1M RETURN</div><div style="font-size:14px; font-weight:700; color:' + (f.return_1m >= 0 ? '#22c55e' : '#ef4444') + ';">' + (f.return_1m >= 0 ? '+' : '') + Number(f.return_1m).toFixed(2) + '%</div></div>' +
            '</div>' +
            '</div>';
        });
        h += '</div>';

        var periodTitle = (S.gfPeriod === '1D') ? 'รายวัน (1-Day Flow)' : (S.gfPeriod === '1W') ? 'รายสัปดาห์ (1-Week Flow)' : (S.gfPeriod === '1M') ? 'รายเดือน (1-Month Flow)' : (S.gfPeriod === '3M') ? 'ราย 3 เดือน (3-Month Flow)' : (S.gfPeriod === 'YTD') ? 'ตั้งแต่ต้นปี (YTD)' : 'รายปี (5 ปีล่าสุด)';

        h += '<div style="margin-top:24px;">' +
          '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">' +
          '<span style="font-size:18px;">📊</span>' +
          '<h4 style="font-size:16px; font-weight:800; margin:0;">' +
          'Inflow / Outflow (' + esc(name) + ') ' + periodTitle +
          '</h4>' +
          '</div>' +
          '<div style="color:#64748b; font-size:13px; margin:6px 0 16px;">' + updateAT + '</div>' +
          '</div>';

        h += '<div style="display:flex; gap:16px; overflow-x:auto; padding-bottom:12px;">';
        funds.forEach(function (f) {
          var toShow = (f.flows && f.flows[S.gfPeriod]) ? f.flows[S.gfPeriod] : [];

          h += '<div style="min-width:270px; background:#fff; border:1px solid #e2e8f0; border-radius:10px; padding:16px; display:flex; flex-direction:column;"><div style="font-size:14px; font-weight:800; color:#0f172a; margin-bottom:20px;">' + esc(f.code) + '</div>';

          if (!toShow.length) {
            h += '<div style="position:relative; height:130px; border-bottom:1px solid #cbd5e1; display:flex; align-items:center; justify-content:center; color:#ef4444; font-size:10px;">⚠️ ไม่มีข้อมูล / Backend Error</div>';
          } else {
            h += '<div class="fi-inner-scroll" style="overflow-x:auto; padding-bottom:6px; width:100%; scrollbar-width: thin;">' +
              '<div style="display:flex; flex-direction:column; min-width:max-content;">' +
              '<div style="position:relative; height:130px; border-bottom:1px solid #cbd5e1; display:flex;">';

            var maxV = Math.max.apply(null, toShow.map(function (t) { return Math.abs(t.net !== undefined ? t.net : (t.net_flow || 0)); })) || 1;
            toShow.forEach(function (ch) {
              var netVal = ch.net !== undefined ? ch.net : (ch.net_flow || 0);
              var isPos = netVal >= 0;
              var hBar = Math.min((Math.abs(netVal) / maxV) * 100, 100);

              h += '<div style="min-width:45px; flex:1; display:flex; justify-content:center; position:relative; z-index:1;">';
              if (isPos) h += '<div style="position:absolute; bottom:50%; width:16px; background:#22c55e; height:' + (hBar / 2) + '%; border-radius:3px 3px 0 0;"></div>';
              else h += '<div style="position:absolute; top:50%; width:16px; background:#ef4444; height:' + (hBar / 2) + '%; border-radius:0 0 3px 3px;"></div>';
              h += '</div>';
            });

            h += '</div><div style="display:flex; margin-top:8px;">';

            toShow.forEach(function (ch) {
              var dStr = String(ch.date || ch.year || '');
              var label = dStr;
              if (dStr) {
                var d = new Date(dStr);
                if (!isNaN(d.getTime())) {
                  var mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  if (S.gfPeriod === '1D' || S.gfPeriod === '1W' || S.gfPeriod === '1M') {
                    label = mons[d.getMonth()] + ' ' + d.getDate();
                  } else {
                    label = mons[d.getMonth()] + " " + d.getFullYear();
                  }
                } else if (dStr.length === 4) {
                  label = dStr;
                }
              }
              h += '<div style="min-width:45px; flex:1; text-align:center; font-size:9px; color:#64748b; white-space:nowrap;">' + label + '</div>';
            });

            h += '</div></div></div>';
          }
          h += '</div>';
        });
        h += '</div></div></div>';
      });
      if (!S.gfSelected.length) h += '<div style="text-align:center;padding:40px;color:#64748b">👆 เลือกธีมเพื่อดูข้อมูล</div>';
      h += '</div>'; return h;
    }

    function renderTrend() {
      var h = '<div class="fi-body"><div class="fi-section-hdr"><div><h3>📈 Uptrend — กองทุนขาขึ้น' + (S.src1 === 'loading' ? '' : srcB(S.src1)) + '</h3><p>ดึงข้อมูลจาก API /insights/trend</p></div></div>';
      if (S.src1 === 'loading') return h + '<div class="fi-loading">⏳ กำลังโหลด...</div></div>';
      h += '<div style="padding:0 16px"><div class="fi-tbl-wrap"><table class="fi-tbl"><thead><tr><th class="l" style="padding-left:16px; width:30%;">กองทุน</th><th class="c" style="width:12%;">TREND</th><th class="c" style="width:10%;">SIGNAL</th><th class="c" style="width:10%;">RISK</th><th class="c" style="width:9%;">1Y</th><th class="c" style="width:11%;">NAV</th><th class="c" style="width:9%;">หุ้นถือ</th></tr></thead><tbody>';
      S.fundList.forEach(function (f) {
        var sc = (f.signal || '').toLowerCase().indexOf('down') >= 0 ? '#dc2626' : '#059669';
        h += '<tr><td class="l" style="padding-left:16px"><b>' + esc(f.code) + '</b><div style="font-size:11px;color:#64748b">' + esc(f.name) + '</div></td><td class="c">' + spark(f.sparkline, sc, 80, 24) + '</td><td class="c">' + sigB(f.signal) + '</td><td class="c">' + riskB(f.risk) + '</td><td class="c" style="font-weight:700;color:' + rc(f.return_1y) + '">' + rv(f.return_1y) + '</td><td class="c" style="font-weight:700;">฿' + fmt(f.nav) + '</td><td class="c"><button class="fi-expand-btn" data-c="f_' + esc(f.code) + '">▼</button></td></tr>';
      }); h += '</tbody></table></div></div></div>'; return h;
    }

    function renderVal() {
      var h = '<div class="fi-body"><div class="fi-section-hdr"><div><h3>💎 Valuation' + (S.src3 === 'loading' ? '' : srcB(S.src3)) + '</h3><p>API /insights/valuation</p></div></div>';
      if (S.src3 === 'loading') return h + '<div class="fi-loading">⏳ กำลังโหลด...</div></div>';
      h += '<div style="padding:0 16px"><div class="fi-tbl-wrap"><table class="fi-tbl"><thead><tr><th class="l" style="padding-left:16px">กองทุน</th><th class="c">PE Zone</th><th class="c">Upside</th><th class="r">AUM</th></tr></thead><tbody>';
      S.valFunds.forEach(function (f) {
        h += '<tr><td class="l" style="padding-left:16px"><b>' + esc(f.code) + '</b></td><td class="c">' + zoneB(f.pe_zone) + '</td><td class="c" style="font-weight:700;color:' + rc(f.upside_to_avg) + '">' + (f.upside_to_avg || 0).toFixed(1) + '%</td><td class="r">฿' + fmt(f.aum) + '</td></tr>';
      }); h += '</tbody></table></div></div></div>'; return h;
    }

    function bindEvents() {
      on('.fi-tab', 'click', function () { S.tab = this.dataset.t; S.expanded = {}; render(); });
      on('.fi-expand-btn', 'click', function (e) { e.stopPropagation(); var key = this.dataset.c; S.expanded[key] = !S.expanded[key]; render(); });
      on('.gf-flow-row', 'click', function () { var n = this.dataset.name; var i = S.gfSelected.indexOf(n); if (i >= 0) S.gfSelected.splice(i, 1); else S.gfSelected.push(n); render(); loadThemeFunds(); });
      on('.gf-tag-clear', 'click', function () { S.gfSelected = []; render(); });
      on('.gf-period-btn', 'click', function () { S.gfPeriod = this.dataset.p; S.flowTrends = {}; loadFlowData(); });

      on('.fi-sector-dropdown-trigger', 'click', function (e) {
        e.stopPropagation();
        var themeName = this.dataset.name;
        var dropKey = 'sector_drop_' + themeName;
        S.expanded[dropKey] = !S.expanded[dropKey];

        if (S.expanded[dropKey] && S.gfSelected.indexOf(themeName) < 0) {
          S.gfSelected.push(themeName);
          loadThemeFunds();
        } else {
          render();
        }
      });
    }

    function init() { if (typeof jQuery === 'undefined') { setTimeout(init, 300); return; } loadAll(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  })();

</script>
<?php
}, 99);
