add_action('wp_footer', 'fund_search_bar_ui');
function fund_search_bar_ui() {
    ?>
<style>
.fund-search-wrap{position:relative;display:inline-flex;align-items:center;margin-right:12px;vertical-align:middle}
.fund-search-input{width:220px;height:38px;padding:0 36px 0 14px;border:1.5px solid #e0e0e0;border-radius:20px;font-size:13px;outline:none;background:#f9fafb;transition:all .25s;color:#333;font-family:inherit}
.fund-search-input::placeholder{color:#aaa}
.fund-search-input:focus{border-color:#667eea;background:#fff;box-shadow:0 0 0 3px rgba(102,126,234,.12);width:280px}
.fund-search-icon{position:absolute;right:11px;top:50%;transform:translateY(-50%);color:#999;font-size:15px;pointer-events:none;transition:color .2s}
.fund-search-input:focus~.fund-search-icon{color:#667eea}
.fund-search-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.15);z-index:99999;display:none;overflow:hidden;border:1px solid #e5e7eb;max-height:400px;overflow-y:auto;min-width:320px}
.fund-search-dropdown.open{display:block}
.fund-search-dropdown .search-item{display:flex;align-items:center;padding:10px 14px;cursor:pointer;transition:all .12s;text-decoration:none;color:#333;gap:8px;border-bottom:1px solid #f0f0f0}
.fund-search-dropdown .search-item:last-child{border-bottom:none}
.fund-search-dropdown .search-item:hover,.fund-search-dropdown .search-item.active{background:#f5f7ff}
.fund-search-dropdown .search-item .si-symbol{width:100px;flex-shrink:0;font-size:13px;font-weight:700;color:#333;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fund-search-dropdown .search-item .si-name{flex:1;min-width:0;font-size:12px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fund-search-dropdown .search-item .si-type{flex-shrink:0;font-size:10px;padding:3px 10px;border-radius:10px;font-weight:600;text-transform:uppercase}
.fund-search-dropdown .search-item .si-type.type-stock{background:#eef2ff;color:#667eea}
.fund-search-dropdown .search-item .si-type.type-fund{background:#fef2f8;color:#f5576c}
.fund-search-dropdown .search-item .si-type.type-other{background:#f0fdf4;color:#22c55e}
.fund-search-dropdown .search-header-row{display:flex;padding:6px 14px;font-size:10px;font-weight:600;color:#aaa;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #e5e7eb;background:#fafafa}
.fund-search-dropdown .search-header-row .sh-symbol{width:100px;flex-shrink:0}
.fund-search-dropdown .search-header-row .sh-name{flex:1}
.fund-search-dropdown .search-header-row .sh-type{width:60px;flex-shrink:0;text-align:center}
.fund-search-dropdown .search-empty,.fund-search-dropdown .search-loading{padding:20px 14px;text-align:center;color:#999;font-size:13px}
@media(max-width:768px){.fund-search-input{width:160px}.fund-search-input:focus{width:200px}.fund-search-dropdown{min-width:260px;left:auto;right:0}}
</style>

<script>
(function(){
'use strict';
var AJAX='<?php echo admin_url("admin-ajax.php"); ?>';

/*
 * DASHBOARD_PAGE: URL ของหน้าที่มี [fund_dashboard] shortcode
 * เปลี่ยนตรงนี้ให้ตรงกับ slug จริง
 * เช่น /dashboard/ หรือ /กองทุน/ หรือ /fund-dashboard/
 */
var DASHBOARD_PAGE='/demo/';

function initSearchBar(){
    var target=null;
    document.querySelectorAll('a.gspb-buttonbox, a.wp-element-button').forEach(function(a){
        var t=(a.textContent||'').trim();
        var href=decodeURIComponent(a.getAttribute('href')||'');
        if(t==='\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a'&&href.indexOf('\u0e40\u0e02\u0e49\u0e32\u0e2a\u0e39\u0e48\u0e23\u0e30\u0e1a\u0e1a')!==-1){
            target=a.closest('.gspb_button_wrapper')||a.parentElement;
        }
    });
    if(!target){var t=document.getElementById('fund-nav-trigger');if(t)target=t.parentElement;}
    if(!target)return;
    if(document.getElementById('fund-search-wrap'))return;

    var row=document.createElement('div');row.id='fund-search-row';row.style.cssText='display:flex;align-items:center;gap:10px;';
    var wrap=document.createElement('div');wrap.id='fund-search-wrap';wrap.className='fund-search-wrap';
    wrap.innerHTML='<input type="text" class="fund-search-input" id="fund-search-input" placeholder="\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e01\u0e2d\u0e07\u0e17\u0e38\u0e19 / \u0e2b\u0e38\u0e49\u0e19..." autocomplete="off"><span class="fund-search-icon">\ud83d\udd0d</span><div class="fund-search-dropdown" id="fund-search-dd"></div>';
    target.parentNode.insertBefore(row,target);row.appendChild(wrap);row.appendChild(target);

    var input=document.getElementById('fund-search-input');
    var dd=document.getElementById('fund-search-dd');
    var timer=null,lastQ='';

    input.addEventListener('input',function(){var q=this.value.trim();clearTimeout(timer);if(q.length<1){dd.classList.remove('open');dd.innerHTML='';lastQ='';return;}if(q===lastQ)return;dd.innerHTML='<div class="search-loading">\u0e01\u0e33\u0e25\u0e31\u0e07\u0e04\u0e49\u0e19\u0e2b\u0e32...</div>';dd.classList.add('open');timer=setTimeout(function(){doSearch(q);},300);});
    input.addEventListener('focus',function(){if(dd.innerHTML&&this.value.trim().length>0)dd.classList.add('open');});
    document.addEventListener('click',function(e){if(!wrap.contains(e.target))dd.classList.remove('open');});
    input.addEventListener('keydown',function(e){
        if(e.key==='Escape'){dd.classList.remove('open');this.blur();}
        if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();var items=dd.querySelectorAll('.search-item');if(!items.length)return;var cur=dd.querySelector('.search-item.active');var idx=-1;if(cur){idx=Array.prototype.indexOf.call(items,cur);cur.classList.remove('active');}idx=e.key==='ArrowDown'?idx+1:idx-1;if(idx<0)idx=items.length-1;if(idx>=items.length)idx=0;items[idx].classList.add('active');items[idx].scrollIntoView({block:'nearest'});}
        if(e.key==='Enter'){var active=dd.querySelector('.search-item.active');if(active)active.click();}
    });

    function doSearch(q){
        lastQ=q;
        jQuery.ajax({url:AJAX,data:{action:'fund_search_nav',q:q},timeout:8000,
            success:function(res){if(input.value.trim()!==q)return;renderResults(res,q);},
            error:function(){if(input.value.trim()!==q)return;dd.innerHTML='<div class="search-empty">\u0e44\u0e21\u0e48\u0e2a\u0e32\u0e21\u0e32\u0e23\u0e16\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e44\u0e14\u0e49 \u0e25\u0e2d\u0e07\u0e43\u0e2b\u0e21\u0e48</div>';}
        });
    }

    function goTo(type,sym){
        dd.classList.remove('open');input.value='';
        /* ถ้าอยู่หน้า dashboard อยู่แล้ว ใช้ JS navigate ตรง */
        if(window.fdNav&&document.getElementById('fd-app')){
            if(type==='stock')window.fdNav.lSD(sym);
            else window.fdNav.lFD(sym);
            /* Scroll to dashboard */
            var el=document.getElementById('fd-app');if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
            return;
        }
        /* ไม่อยู่หน้า dashboard — redirect ไปพร้อม query params */
        var url=DASHBOARD_PAGE+'?view='+encodeURIComponent(type)+'&'+(type==='stock'?'symbol':'code')+'='+encodeURIComponent(sym);
        window.location.href=url;
    }

    function renderResults(data,q){
        var items=[];
        if(Array.isArray(data))items=data;
        else if(data&&typeof data==='object'){if(data.results)items=data.results;if(data.suggestions)items=data.suggestions;if(Array.isArray(data.data))items=data.data;}
        if(!items||!items.length){dd.innerHTML='<div class="search-empty">\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e1c\u0e25\u0e25\u0e31\u0e1e\u0e18\u0e4c\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a "'+q+'"</div>';dd.classList.add('open');return;}
        var html='<div class="search-header-row"><span class="sh-symbol">Symbol</span><span class="sh-name">Name</span><span class="sh-type">Type</span></div>';
        items.slice(0,8).forEach(function(item){
            var symbol=item.id||item.symbol||item.code||'';
            var name=item.name||item.fund_name||item.stock_name||'';
            var raw=(item.type||'').toUpperCase();
            var tc='type-other',tl=raw||'-',ct='stock';
            if(raw==='STOCK'||raw==='EQUITY'){tc='type-stock';tl='STOCK';ct='stock';}
            else if(raw==='FUND'||raw==='MUTUAL_FUND'||raw==='ETF'){tc='type-fund';tl=raw==='ETF'?'ETF':'FUND';ct='fund';}
            html+='<div class="search-item" data-type="'+ct+'" data-symbol="'+symbol+'"><span class="si-symbol">'+symbol+'</span><span class="si-name">'+name+'</span><span class="si-type '+tc+'">'+tl+'</span></div>';
        });
        dd.innerHTML=html;dd.classList.add('open');
        dd.querySelectorAll('.search-item').forEach(function(el){
            el.addEventListener('click',function(){goTo(this.getAttribute('data-type'),this.getAttribute('data-symbol'));});
        });
    }
}

function tryInit(){if(typeof jQuery==='undefined'){setTimeout(tryInit,300);return;}initSearchBar();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(tryInit,600);});
else setTimeout(tryInit,400);
setTimeout(tryInit,2500);
})();
</script>
    <?php
}