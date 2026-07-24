// Snippet 5: Insights shortcode css
// Type: Run Shortcode
// แทนที่ snippet "Insights shortcode css" เดิม
// เหมือนเดิมทุกอย่าง แค่เพิ่ม FD_AJAX ให้ JS ใช้

add_shortcode('fund_insights', function(){
    ob_start(); ?>
<style>
.page-id-658 .wp-site-blocks,.page-id-658 .wp-block-post-content,.page-id-658 .wp-block-group,.page-id-658 .wp-block-group__inner-container,.page-id-658 .entry-content,.page-id-658 .site-content,.page-id-658 .content-area,.page-id-658 .container,.page-id-658 .post-inner,.page-id-658 .page-content,.page-id-658 main,.page-id-658 article{padding:0!important;margin:0!important;max-width:100%!important;width:100%!important}
.page-id-658 .entry-content>*:first-child,.page-id-658 .wp-block-post-content>*:first-child{margin-top:0!important}

#fi-app{width:100%;margin:0;padding:0;font-family:'Noto Sans Thai','Segoe UI',sans-serif;color:#1e293b;font-size:15px;line-height:1.6}
#fi-app *{box-sizing:border-box}
#fi-app h1{font-size:28px;margin:0;font-weight:900;color:#fff}
#fi-app h3{font-size:20px;margin:0 0 2px;font-weight:800;color:#0f172a}

.fi-hdr{background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0c4a6e 100%);padding:28px 40px 20px;position:relative;overflow:hidden}
.fi-hdr::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;background:radial-gradient(circle,rgba(14,165,233,.15),transparent 70%);border-radius:50%}
.fi-sub{font-size:14px;color:rgba(255,255,255,.65);margin:4px 0 18px}

.fi-tabs{display:flex;gap:8px;position:relative;z-index:1}
.fi-tab{padding:14px 28px;border-radius:14px;border:none;cursor:pointer;font-family:inherit;font-size:16px;font-weight:600;color:rgba(255,255,255,.45);background:transparent;transition:all .2s;display:flex;align-items:center;gap:12px}
.fi-tab.on{color:#1e293b;font-weight:700;background:#fff;box-shadow:0 4px 12px rgba(0,0,0,.12)}
.fi-tab .fi-tab-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.fi-tab.on .fi-tab-icon{background:#1e3a5f;color:#fff}
.fi-tab:not(.on) .fi-tab-icon{background:rgba(255,255,255,.08)}
.fi-tab .fi-tab-text{display:flex;flex-direction:column;text-align:left;line-height:1.35}
.fi-tab .fi-tab-label{font-size:16px;font-weight:700}
.fi-tab .fi-tab-desc{font-size:12px;opacity:.5;font-weight:500}
.fi-tab.on .fi-tab-label{color:#0f172a}
.fi-tab.on .fi-tab-desc{opacity:1;color:#1e293b;font-weight:600}

.fi-themes{padding:16px 40px;display:flex;gap:8px;flex-wrap:wrap;background:#fff;border-bottom:1px solid #f1f5f9}
.fi-theme{padding:7px 18px;border-radius:20px;border:1.5px solid #e2e8f0;background:#fff;color:#64748b;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all .15s}
.fi-theme.on{border-color:#1e3a5f;background:#1e3a5f;color:#fff}

.fi-body{padding:24px 0 28px;background:#fff}
.fi-section-hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding:0 40px}
.fi-section-hdr p{margin:3px 0 0;font-size:14px;color:#64748b;line-height:1.6}

.fi-tbl-wrap{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin:0 16px}
.fi-tbl{width:100%;border-collapse:collapse;font-size:15px;font-weight:600}
.fi-tbl thead tr{border-bottom:2px solid #e2e8f0;background:#f8fafc}
.fi-tbl th{padding:14px 16px;color:#1e293b;font-weight:900;font-size:15px;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap}
.fi-tbl td{padding:16px 16px;border-bottom:1px solid #f1f5f9;vertical-align:middle;white-space:nowrap;font-weight:700;font-size:15px}
.fi-tbl tbody tr:last-child td{border-bottom:none}
.fi-tbl tbody tr{cursor:pointer;transition:background .1s}
.fi-tbl tbody tr:hover{background:#f8fafc}
.fi-tbl .l{text-align:left}.fi-tbl .c{text-align:center}.fi-tbl .r{text-align:right}

.fi-sig{padding:5px 16px;border-radius:20px;font-size:13px;font-weight:700;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}
.fi-sig-su{background:rgba(255,141,40,.12);color:#c2410c;border:1.5px solid rgba(255,141,40,.5)}
.fi-sig-u{background:rgba(34,197,94,.12);color:#15803d;border:1.5px solid rgba(34,197,94,.5)}
.fi-sig-s{background:rgba(255,204,0,.12);color:#a16207;border:1.5px solid rgba(255,204,0,.5)}
.fi-sig-d{background:rgba(255,56,60,.12);color:#dc2626;border:1.5px solid rgba(255,56,60,.5)}

.fi-risk-badge{display:inline-flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;font-size:16px;font-weight:800;color:#0f172a;border:2px solid}
.fi-risk-1,.fi-risk-2,.fi-risk-3,.fi-risk-4{background:rgba(34,197,94,.45);border-color:#22C55E}
.fi-risk-5{background:rgba(255,204,0,.45);border-color:#FFCC00}
.fi-risk-6{background:rgba(255,141,40,.45);border-color:#FF8D28}
.fi-risk-7,.fi-risk-8{background:rgba(255,56,60,.45);border-color:#FF383C}

.fi-zone{padding:4px 14px;border-radius:20px;font-size:12px;font-weight:700;display:inline-block}
.fi-zone-dv{background:#d1fae5;color:#059669}
.fi-zone-uv{background:#dbeafe;color:#2563eb}
.fi-zone-f{background:#fef3c7;color:#d97706}
.fi-zone-ov{background:#fee2e2;color:#dc2626}

.fi-pe-bar{position:relative;height:18px;background:linear-gradient(to right,#059669 0%,#22c55e 25%,#f59e0b 50%,#ef4444 75%,#dc2626 100%);border-radius:9px;overflow:visible;width:120px;display:inline-block}
.fi-pe-avg{position:absolute;top:0;bottom:0;width:2px;background:#fff;opacity:.7}
.fi-pe-dot{position:absolute;top:-1px;width:14px;height:20px;border-radius:7px;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.3);transform:translateX(-50%)}

.fi-spark{display:inline-block;vertical-align:middle}
.fi-legend{display:flex;gap:16px;font-size:15px;color:#475569;font-weight:700;align-items:center;white-space:nowrap}
.fi-legend span{display:flex;align-items:center;gap:6px}
.fi-legend-dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.fi-loading{text-align:center;padding:60px 20px;color:#94a3b8;font-size:15px}
.fi-footer{padding:16px 40px;border-top:1px solid #e2e8f0;background:#fafafa;display:flex;justify-content:space-between;font-size:12px;color:#94a3b8}
.fi-mock{display:inline-block;background:#fef3c7;color:#92400e;padding:3px 12px;border-radius:10px;font-size:11px;font-weight:700;margin-left:10px}
.fi-expand-btn{background:#fff;border:1.5px solid #e2e8f0;border-radius:8px;padding:7px 16px;cursor:pointer;font-size:12px;font-weight:700;color:#64748b;white-space:nowrap;transition:all .15s;font-family:inherit}
.fi-expand-btn:hover{border-color:#0ea5e9;color:#0ea5e9}

.gf-title-row{display:flex;justify-content:space-between;align-items:center;padding:20px 40px 16px;background:#fff;border-radius:0 0 12px 12px}
.gf-title{display:flex;align-items:center;gap:10px}
.gf-title h3{font-size:20px;font-weight:800;color:#0f172a;margin:0}
.gf-title .gf-date{font-size:14px;color:#475569;font-weight:500}
.gf-period-btns{display:flex;gap:2px;background:#f1f5f9;border-radius:8px;padding:3px}
.gf-period-btn{padding:6px 14px;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;background:transparent;color:#64748b;transition:all .15s}
.gf-period-btn.on{background:#fff;color:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.gf-summary-wrap{padding:16px 40px 0}
.gf-summary{display:grid;grid-template-columns:repeat(5,1fr);background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden}
.gf-summary-card{padding:22px 24px;border-right:1px solid #e2e8f0}
.gf-summary-card:last-child{border-right:none}
.gf-summary-label{font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:.3px;margin-bottom:6px}
.gf-summary-value{font-size:26px;font-weight:800;font-family:'SF Mono','Fira Code',monospace;letter-spacing:-.5px}
.gf-summary-track{height:5px;border-radius:3px;margin-top:8px;background:#e2e8f0;width:100%;position:relative}
.gf-summary-fill{height:100%;border-radius:3px;position:absolute;top:0;left:0}
.gf-summary-sub{font-size:13px;color:#475569;font-weight:600;margin-top:5px}
.gf-flow-section{margin:16px 40px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px 28px;overflow:hidden}
.gf-flow-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}
.gf-flow-title{font-size:17px;font-weight:800;color:#0f172a}
.gf-search-wrap{display:flex;align-items:center;gap:10px}
.gf-search{padding:9px 16px;border:1.5px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;width:180px;outline:none;color:#1e293b}
.gf-search:focus{border-color:#0ea5e9}
.gf-legend-wrap{display:flex;align-items:center;gap:16px;font-size:13px;font-weight:600;color:#475569}
.gf-legend-item{display:flex;align-items:center;gap:5px}
.gf-legend-dot{width:8px;height:8px;border-radius:50%}
.gf-flow-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 40px}
.gf-flow-row{display:flex;align-items:center;gap:8px;padding:4px 4px;cursor:pointer;transition:background .1s;border-radius:4px}
.gf-flow-row:hover{background:#f8fafc}
.gf-flow-name{width:130px;font-size:13px;font-weight:600;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
.gf-flow-bar-wrap{flex:1;height:12px;border-radius:6px;overflow:hidden;background:transparent;display:block}
.gf-flow-bar{height:100%;border-radius:6px;display:block}
.gf-flow-bar-wrap.out{display:flex;justify-content:flex-end}
.gf-flow-amount{width:60px;font-size:13px;font-weight:700;text-align:right;flex-shrink:0}
.gf-flow-note{font-size:13px;color:#475569;padding:14px 0 0;display:block;font-weight:500}
.gf-thai-section{padding:24px 40px;background:#f3f4f6}
.gf-thai-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px}
.gf-thai-tags{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gf-tag{display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.gf-tag.on{background:#FEF2F2;color:#2563eb;border:1.5px solid #BFDBFE}
.gf-tag .gf-tag-x{font-size:11px;opacity:.6;margin-left:2px}
.gf-tag-clear{display:inline-flex;align-items:center;gap:4px;font-size:13px;color:#1e293b;cursor:pointer;font-weight:600;border:1px solid rgba(0,0,0,.12);background:#fff;font-family:inherit;padding:6px 16px;border-radius:20px}
.gf-stats-bar{display:flex;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:20px}
.gf-stats-bar .gf-stat-cell{flex:1;padding:18px 24px;border-right:1px solid #e2e8f0}
.gf-stats-bar .gf-stat-cell:last-child{border-right:none}
.gf-stat-label{font-size:14px;color:#475569;font-weight:700;margin-bottom:4px}
.gf-stat-value{font-size:24px;font-weight:800}
.gf-stat-sub{font-size:13px;color:#475569;font-weight:600;margin-top:3px}
.gf-theme-group{margin-bottom:24px}
.gf-theme-group-title{font-size:16px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.gf-fund-cards{display:flex;gap:12px}
.gf-fund-card{flex:1;min-width:0;border:1px solid #e2e8f0;border-left:4px solid #16a34a;border-radius:10px;padding:14px 16px;background:#fff;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;line-height:1.35}
.gf-fund-card:hover{border-color:#0ea5e9;box-shadow:0 2px 8px rgba(14,165,233,.1)}
.gf-fund-rank{font-size:12px;font-weight:800;color:#94a3b8;margin-bottom:2px}
.gf-fund-code{font-size:16px;font-weight:800;color:#0f172a;margin-bottom:0}
.gf-fund-amc{font-size:12px;color:#64748b;font-weight:600;margin-bottom:4px}
.gf-fund-ret{font-size:20px;font-weight:800;margin-bottom:2px}
.gf-fund-meta{font-size:12px;color:#475569;font-weight:500;margin-top:1px;line-height:1.4}
.gf-fund-master{font-size:11px;color:#64748b;font-weight:500;margin-top:auto;border-top:1px solid #f1f5f9;padding-top:6px}
@media(max-width:768px){
  .fi-hdr{padding:16px 16px 12px}.fi-tab{padding:8px 14px;font-size:13px}.fi-themes{padding:12px 16px}.fi-section-hdr{padding:0 16px}.fi-tbl-wrap{margin:0 12px}.fi-footer{padding:14px 16px}
  .gf-title-row{padding:16px;flex-wrap:wrap;gap:10px}.gf-summary-wrap{padding:12px 16px 0}.gf-summary{grid-template-columns:repeat(2,1fr)}.gf-summary-card:nth-child(2){border-right:none}.gf-flow-section{margin:12px 16px;padding:16px}.gf-flow-cols{grid-template-columns:1fr}.gf-thai-section{padding:16px}.gf-stats-bar{flex-direction:column}.gf-stats-bar .gf-stat-cell{border-right:none;border-bottom:1px solid #e2e8f0}.gf-fund-cards{flex-direction:column}
}
</style>
<div id="fi-app"><div class="fi-loading">Loading...</div></div>
<script>var FD_AJAX='<?php echo admin_url("admin-ajax.php"); ?>';</script>
<?php return ob_get_clean();
});