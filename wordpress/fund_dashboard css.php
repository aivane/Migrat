add_shortcode('fund_dashboard', function() {
ob_start();
?>
<style>
.page-id-612{background:#f1f5f9!important}
#fd-app{margin-top:0}
.fd *{box-sizing:border-box}
.fd{max-width:100%;margin:0 auto;padding:24px;font-family:'Noto Sans Thai','DM Sans',sans-serif;color:#0f1729;background:#fff;border:1px solid #e2e8f0;border-radius:16px;font-size:16px}
.fd h1{font-size:26px;font-weight:900;margin:0}
.fd-panel{border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .2s;display:flex;flex-direction:column}
.fd-panel-active{background:#1E40AF;border:2px solid #60a5fa}
.fd-panel-inactive{background:#f8fafc;border:2px solid #e2e8f0}
.fd-panel-title{padding:16px 20px 14px;display:flex;align-items:center;gap:10px}
.fd-panel-active .fd-panel-title *{color:#fff!important}
.fd-panel-inactive .fd-panel-title *{color:#0f172a!important}
.fd-stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin:0 12px 12px;border-radius:10px;overflow:hidden}
.fd-panel-active .fd-stat-row{background:rgba(255,255,255,.12)}
.fd-panel-inactive .fd-stat-row{background:#e2e8f0}
.fd-stat-cell{padding:14px 16px}
.fd-panel-active .fd-stat-cell{background:rgba(241,245,249,.95)}
.fd-panel-inactive .fd-stat-cell{background:#fff}
.fd-stat-label{font-size:11px;color:#64748b;font-weight:600;margin-bottom:4px}
.fd-stat-val{font-size:17px;font-weight:900;color:#0f172a;line-height:1.3}
.fd-stat-sub{font-size:13px;color:#64748b;font-weight:600}
.fd-bar-section{display:grid;gap:1px;margin:0 12px 12px;border-radius:10px;overflow:hidden;flex:1}
.fd-panel-active .fd-bar-section{background:rgba(255,255,255,.12)}
.fd-panel-inactive .fd-bar-section{background:#e2e8f0}
.fd-bar-col{padding:16px 18px;display:flex;flex-direction:column}
.fd-panel-active .fd-bar-col{background:rgba(241,245,249,.95)}
.fd-panel-inactive .fd-bar-col{background:#fff}
.fd-bar-col-title{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;color:#475569}
.fd-bar-row{display:flex;align-items:center;gap:8px;padding:4px 6px;font-size:13px;border-radius:6px;transition:background .15s}
.fd-bar-name{width:125px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;color:#1e293b}
.fd-bar-track{flex:1;height:10px;border-radius:5px;overflow:hidden;background:rgba(148,163,184,.25)}
.fd-bar-fill{height:100%;border-radius:5px}
.fd-bar-pct{width:45px;text-align:right;font-weight:800;flex-shrink:0;font-size:13px;color:#0f172a}
.fd-clickable-bar:hover { background: rgba(0,0,0,0.06); cursor: pointer; }
.fd-total-box { margin-bottom: 24px; padding: 20px 24px; background: #fff; border-radius: 14px; border: 1px solid #e2e8f0; }
.fd-tbl-box{background:#fff;border-radius:14px;padding:20px 22px;border:1px solid #e8edf2}
.fd-srch{position:relative}
.fd-srch span{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none}
.fd-srch input{padding:9px 14px 9px 36px;border-radius:20px;border:1.5px solid #e0e0e0;font-size:15px;width:260px;outline:0;background:#f9fafb;font-family:inherit}
.fd-srch input:focus{border-color:#0ea5e9}
.fd-filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;align-items:center}
.fd-sec-dd{position:relative;display:inline-block}
.fd-sec-btn{padding:6px 14px;border-radius:20px;border:1px solid #ddd;background:#fff;color:#6b7280;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px}
.fd-sec-btn.on{border-color:#0ea5e9;background:#e0f2fe;color:#0369a1}
.fd-sec-list{position:absolute;top:calc(100% + 4px);left:0;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.1);z-index:99;min-width:230px;padding:6px 0;display:none;max-height:320px;overflow-y:auto}
.fd-sec-list.show{display:block}
.fd-sec-list label{display:flex;align-items:center;gap:8px;padding:6px 14px;font-size:14px;cursor:pointer;white-space:nowrap}
.fd-sec-list label:hover{background:#f0f7ff}
table.fd-t{width:100%;border-collapse:collapse; table-layout: fixed;}
.fd-t thead{background:#f8fafc;position:sticky;top:0;z-index:1}
.fd-t th{padding:12px 10px;font-size:14px;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;white-space:nowrap;}
.fd-t td{padding:11px 10px;border-bottom:1px solid #f0f0f0;font-size:15px;white-space:nowrap;}
.fd-t th.c, .fd-t td.c, .fd-val { text-align: center !important; }
.fd-t th.l, .fd-t td.l { text-align: left !important; }
.fd-t th:nth-child(1), .fd-t td:nth-child(1) { width: 36%; white-space: normal; overflow: hidden; text-overflow: ellipsis; }
.fd-t th:nth-child(2), .fd-t td:nth-child(2) { width: 16%; }
.fd-t th:nth-child(3), .fd-t td:nth-child(3) { width: 16%; }
.fd-t th:nth-child(4), .fd-t td:nth-child(4) { width: 16%; }
.fd-t th:nth-child(5), .fd-t td:nth-child(5) { width: 16%; }
.fd-t th.sort{cursor:pointer;user-select:none}
.fd-t tbody tr{cursor:pointer;transition:background .1s}.fd-t tbody tr:hover{background:#f8fbff}
.fd-scroll{overflow-y:auto;max-height:620px;overflow-x:auto}
.fd-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:13px;font-weight:700}
.fd-r-low{background:#dcfce7;color:#166534}.fd-r-med{background:#fef9c3;color:#854d0e}.fd-r-high{background:#fee2e2;color:#991b1b}
.fd-m-d{background:#dcfce7;color:#166534}.fd-m-f{background:#dbeafe;color:#1e40af}.fd-m-o{background:#f3e8ff;color:#6b21a8}
.fd-rank{font-weight:800;font-size:17px}.fd-rank-t{color:#0ea5e9}.fd-rank-o{color:#c0c7d0}
.fd-val{font-weight:700;}
.fd-exp{padding:16px 22px;background:#f9fafb;border-bottom:2px solid #e8edf2}
.fd-exp-inner{display:flex;align-items:flex-start;gap:24px}
.fd-exp-leg{flex:1}
.fd-exp-row{display:flex;justify-content:space-between;padding:6px 0;font-size:15px;border-bottom:1px solid #f0f0f0;align-items:center}
.fd-exp-row:last-child{border:0}
.fd-view-btn{background:0;border:1px solid #ddd;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:13px;color:#6b7280;font-family:inherit}
.fd-view-btn.on{background:#e0f2fe;border-color:#0ea5e9;color:#0369a1}
.fd-loading{text-align:center;padding:40px;color:#64748b;font-size:17px}
@keyframes fd-spin{to{transform:rotate(360deg)}}
.fd-pg{padding:6px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer;font-size:14px;font-weight:600;color:#475569;font-family:inherit;transition:all .15s}
.fd-pg:hover:not(:disabled){border-color:#0ea5e9;color:#0ea5e9;background:#f0f9ff}
.fd-pg:disabled{opacity:.4;cursor:default}
.fd-pg-on{background:#2563eb!important;color:#fff!important;border-color:#2563eb!important}
.fd-chip{padding:6px 14px;border-radius:20px;border:1px solid #ddd;background:#fff;color:#6b7280;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;display:inline-block;transition:all .15s}
.fd-chip:hover{border-color:#0ea5e9;color:#0ea5e9}
.fd-chip.on{border-color:#0ea5e9;background:#e0f2fe;color:#0369a1}
</style>
<div class="fd" id="fd-app"><div class="fd-loading">Loading Dashboard...</div></div>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<script>var FD_AJAX='<?php echo admin_url("admin-ajax.php"); ?>';</script>
<?php
return ob_get_clean();
});