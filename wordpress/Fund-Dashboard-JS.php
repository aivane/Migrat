// ══════════════════════════════════════════════════════════════
// Dashboard JS (Part 1 + Part 2 + ETF Zone) — API v2.7.0
// Type: Run Everywhere
// ══════════════════════════════════════════════════════════════

add_action('wp_footer', function(){
?>
<script>
(function(){
var el=document.getElementById('fd-app');
if(!el) return;

var A=window.FD_AJAX||'/wp-admin/admin-ajax.php';
// ใช้พาเลทสีพาสเทล รูปเเบบที่ 4 ตามที่เอเธนส์เลือกไว้ 
var G = ['#4B543B', '#DCE2AA', '#B57F50', '#8ED081', '#B4D2BA']; 

// ══════════════════════════════════════
// GLOBAL STATE
// ══════════════════════════════════════
window.FD={G:G, pies:{}, S:{
  type:'FOREIGN', sortBy:'aum', sortDir:'desc', expandedSet:{},
  fFundType:[], fAmc:[], sectorF:[], fRisk:[], minRet:null, ddOpen:'', advOpen:false,
  searchSymbols:[], searchMode:false, searchFunds:[], searchInput:'',
  page:1, perPage:10,
  statsForeign:null, statsTH:null, topForeign:[], topTH:[],
  allFundsForeign:[], allFundsTH:[],
  fundDetails:{}, loadedF:false, loadedT:false, isSearching:false, retryCount:0,
  allAmcs:[], allTypes:[], allSectors:[],
  totalFOREIGN:0, totalTH:0,
  masterETFs:[], thaiETFs:[],
  portfolioAlloc: null
}};

var F=window.FD, S=F.S;
var fmt, fN, esc, on;

// ══════════════════════════════════════
// UTILITY FUNCTIONS
// ══════════════════════════════════════
F.fmt=function(n){n=Number(n||0);if(Math.abs(n)>=1e12)return(n/1e12).toFixed(2)+'T';if(Math.abs(n)>=1e9)return(n/1e9).toFixed(2)+'B';if(Math.abs(n)>=1e6)return(n/1e6).toFixed(1)+'M';if(Math.abs(n)>=1e3)return(n/1e3).toFixed(0)+'K';return n.toFixed(0);};
F.fN=function(n){return Number(n||0).toLocaleString('en-US');};
F.esc=function(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML;};
fmt=F.fmt; fN=F.fN; esc=F.esc;

F.tog=function(a,v){var i=a.indexOf(v);if(i===-1)a.push(v);else a.splice(i,1);};
F.on=function(sel,ev,fn){document.querySelectorAll(sel).forEach(function(el2){el2.addEventListener(ev,fn);});};
on=F.on;

F.rCls=function(r){return r<=3?'fd-r-low':r<=5?'fd-r-med':'fd-r-high';};
F.mCls=function(m){return m==='Direct'?'fd-m-d':m==='Feeder Fund'?'fd-m-f':'fd-m-o';};

function rc(v){if(v===null||v===undefined||isNaN(v)||v==='')return'#cbd5e1';return v!==0?(v>=0?'#059669':'#dc2626'):'#cbd5e1';}
function rv(v){if(v===null||v===undefined||isNaN(v)||v==='')return'—';return v!==0?((v>=0?'+':'')+Number(v).toFixed(2)+'%'):'0.00%';}
function chip(l,on2,cls){return'<span class="fd-chip'+(on2?' on':'')+'" data-chip="'+esc(cls)+'">'+esc(l)+'</span>';}

// ══════════════════════════════════════
// CHART (Doughnut Pie)
// ══════════════════════════════════════
F.dpie=function(id,data){
  var c=document.getElementById(id);
  if(!c||typeof Chart==='undefined')return;
  if(F.pies[id])F.pies[id].destroy();

  // ขยายพื้นที่วาดภาพวงกลมขั้นต่ำไว้ที่ 4% เพื่อดึงสีพาสเทลที่สัดส่วนน้อย ๆ ให้โผล่ขึ้นมาเด่นชัด
  var visualData = data.map(function(x){
    return Math.max(Number(x.value || 0), 4);
  });

  F.pies[id]=new Chart(c,{
    type:'doughnut',
    data:{
      labels:data.map(function(x){return x.name;}),
      datasets:[{
        data: visualData, 
        backgroundColor:G.slice(0,data.length),
        borderWidth:2,
        borderColor:'#fff'
      }]
    },
    options:{
      responsive:false,
      maintainAspectRatio:true,
      cutout:'65%',
      plugins:{
        legend:{display:false},
        // 🟢 ปรับปรุง Tooltip ให้แสดงชื่อคู่กับเปอร์เซ็นต์จริงจาก API แบบไม่ซ้ำซ้อนและไม่พัง
        tooltip:{
          callbacks:{
            title:function(){ return ''; }, // ซ่อนตัวหัวข้อด้านบนเพื่อไม่ให้ชื่อกองทุนแสดงซ้ำซ้อน
            label:function(context){
              var index = context.dataIndex;
              var truePercent = data[index].value; // ดึงค่าเปอร์เซ็นต์จริงดั้งเดิมมาแสดงผล (เช่น 0.18%)
              var assetName = data[index].name;
              return ' ' +   Number(truePercent).toFixed(2) + '%' + ' : ' +  assetName;
            }
          }
        }
      }
    }
  });
};

// ══════════════════════════════════════
// AJAX HELPERS
// ══════════════════════════════════════
F.ajax=function(action,params,cb){
  jQuery.ajax({url:A,data:Object.assign({action:action},params||{}),timeout:60000,
    success:function(r){cb(r,null);},error:function(x,st){cb(null,st);}});
};
F.ajaxPost=function(action,params,cb){
  jQuery.ajax({url:A,method:'POST',data:Object.assign({action:action},params||{}),timeout:45000,
    success:function(r){cb(r,null);},error:function(x,st){cb(null,st);}});
};

// ══════════════════════════════════════
// DATA NORMALIZATION
// ══════════════════════════════════════
F.norm=function(f,t){
  return{
    target_type:t||f.target_type||'TH', code:f.code||'', name:f.name_th||f.name||'',
    amc:f.amc||'', risk:Number(f.risk||6), ret:Number(f.return_1y||0),
    r1m:Number(f.return_1m||0), r3m:Number(f.return_3m||0),
    nav:Number(f.nav||0), aum:Number(f.aum||0), method:f.method||'Other',
    sector:f.sector||'', fund_type:f.fund_type||'', feeder:f.feeder_target||null,
    top:(f.top5||[]).map(function(x){return{s:x.symbol||'',n:x.name||'',p:Number(x.percent||0)};})
  };
};

// ══════════════════════════════════════
// RESPONSE EXTRACTORS
// ══════════════════════════════════════
F.exFunds=function(r){
  if(!r)return null;
  var d=r.data?r.data:r;
  if(d.funds&&Array.isArray(d.funds))return{funds:d.funds,total:Number(d.total||d.funds.length)};
  return null;
};
F.exStats=function(r){if(!r)return{};if(r.cards)return r;if(r.data&&r.data.cards)return r.data;return r;};
F.exTop=function(r){if(Array.isArray(r))return r;if(r&&r.data&&Array.isArray(r.data))return r.data;return[];};

F.searchStock=function(syms,cb){
  F.ajaxPost('fund_search',{symbols:JSON.stringify(syms)},function(r){
    var d=r&&r.data?r.data:r;
    cb(d&&d.holders?d.holders:Array.isArray(d)?d:[]);
  });
};

// ══════════════════════════════════════
// UI COMPONENTS
// ══════════════════════════════════════
function mkDD(id,lbl,opts,sel){
  var c=sel.length;
  var h='<div class="fd-sec-dd"><button class="fd-sec-btn'+(c?' on':'')+'" data-dd="'+id+'">'+esc(lbl)+': '+(c?c+' เลือก':'ทั้งหมด')+' &#9660;</button><div class="fd-sec-list'+(S.ddOpen===id?' show':'')+'">';
  h+='<label style="border-bottom:1px solid #e8edf2;padding-bottom:6px;font-weight:700"><input type="checkbox" class="fd-dd-all" data-dd="'+id+'"'+(!c?' checked':'')+'> ทั้งหมด</label>';
  opts.forEach(function(o,idx){
    h+='<label><input type="checkbox" class="fd-dd-cb" data-dd="'+id+'" data-idx="'+idx+'"'+(sel.indexOf(o)>=0?' checked':'')+'>'+esc(o)+'</label>';
  });
  return h+'</div></div>';
}

function barL(d,c,fType){
  return d.map(function(x){
    var bw=Math.max(Math.min(x.value,100),2);
    return'<div class="fd-bar-row '+(fType?'fd-clickable-bar':'')+'" '+(fType?'data-f="'+fType+'" data-v="'+esc(x.name)+'"':'')+' style="display:flex;align-items:center;gap:8px;padding:4px 0;cursor:'+(fType?'pointer':'default')+';">'+
    '<span class="fd-bar-name" title="'+esc(x.name)+'" style="width:110px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex-shrink:0;color:#1e293b;font-size:12px;">'+esc(x.name)+'</span>'+
    '<div class="fd-bar-track" style="flex:1;min-width:40px;height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">'+
    '<div class="fd-bar-fill" style="width:'+bw+'%;height:100%;background:'+c+';border-radius:4px;"></div></div>'+
    '<span class="fd-bar-pct" style="width:40px;text-align:right;font-weight:800;flex-shrink:0;font-size:12px;color:#0f172a;">'+x.value.toFixed(1)+'%</span></div>';
  }).join('');
}

// ══════════════════════════════════════
// FILTER MANAGEMENT
// ══════════════════════════════════════
function updateFilters(fundsArr){
  fundsArr.forEach(function(f){
    if(f.amc&&S.allAmcs.indexOf(f.amc)===-1)S.allAmcs.push(f.amc);
    if(f.fund_type&&S.allTypes.indexOf(f.fund_type)===-1)S.allTypes.push(f.fund_type);
    if(f.sector&&S.allSectors.indexOf(f.sector)===-1)S.allSectors.push(f.sector);
  });
  S.allAmcs.sort(); S.allTypes.sort(); S.allSectors.sort();
}

F.getFiltered=function(targetType){
  var f=[];
  if(S.searchMode) f=S.searchFunds.filter(function(x){return x.target_type===targetType;});
  else f=(targetType==='FOREIGN'?S.allFundsForeign:S.allFundsTH).slice();
  if(S.fAmc.length)f=f.filter(function(x){return S.fAmc.some(function(a){return String(x.amc||'').trim()===String(a).trim();});});
  if(S.fFundType.length)f=f.filter(function(x){return S.fFundType.some(function(t){return String(x.fund_type||'').trim()===String(t).trim();});});
  if(S.sectorF.length)f=f.filter(function(x){return S.sectorF.some(function(s){return String(x.sector||'').trim()===String(s).trim();});});
  if(S.fRisk.length){var rr=S.fRisk;f=f.filter(function(x){return rr.some(function(r2){return r2==='low'?x.risk<=3:r2==='med'?x.risk>=4&&x.risk<=5:x.risk>=6;});});}
  if(S.minRet!==null)f=f.filter(function(x){return x.ret>=S.minRet;});
  f.sort(function(a,b){var k=S.sortBy,va=k==='ret'?a.ret:k==='aum'?a.aum:a.nav,vb=k==='ret'?b.ret:k==='aum'?b.aum:b.nav;return(Number(va)-Number(vb))*(S.sortDir==='desc'?-1:1);});
  return f;
};

// ══════════════════════════════════════
// DATA LOADING (Smart Queue)
// ══════════════════════════════════════
var loadQueue=[], isProcessing=false;

function processQueue(){
  if(loadQueue.length===0){
    isProcessing=false;
    renderTable();
    return;
  }
  isProcessing=true;
  var task=loadQueue.shift();
  F.ajax('fund_fund_list',{type:task.t,sort_by:'aum',sort_dir:'desc',per_page:task.pp,page:task.pg},function(r,err){
    var isFirst=(task.pg===1);
    var ex=(!err&&r&&!r.error)?F.exFunds(r):null;
    if(!ex||!ex.funds){
      loadQueue.unshift(task);S.retryCount++;renderTable();
      setTimeout(processQueue,3000);return;
    }
    S.retryCount=0;
    var mapped=ex.funds.map(function(fx){return F.norm(fx,task.t);});
    if(task.t==='FOREIGN'){
      if(isFirst){S.totalFOREIGN=ex.total||0;S.allFundsForeign=mapped;S.loadedF=true;}
      else S.allFundsForeign=S.allFundsForeign.concat(mapped);
    }else{
      if(isFirst){S.totalTH=ex.total||0;S.allFundsTH=mapped;S.loadedT=true;}
      else S.allFundsTH=S.allFundsTH.concat(mapped);
    }
    updateFilters(mapped);
    if(isFirst){
      var tp=Math.ceil((ex.total||0)/task.pp);
      for(var i=2;i<=tp;i++)loadQueue.push({t:task.t,pg:i,pp:task.pp});
    }
    renderTable();
    setTimeout(processQueue,200);
  });
}

function startSmartLoad(){
  S.loadedF=false;S.loadedT=false;S.retryCount=0;
  renderTable();
  loadQueue=[{t:'FOREIGN',pg:1,pp:100},{t:'TH',pg:1,pp:100}];
  if(!isProcessing)processQueue();
}

// ══════════════════════════════════════
// LOAD ALL (Entry Point)
// ══════════════════════════════════════
function loadAll(){
  el.innerHTML='<div id="fd-panels"><div style="padding:40px;text-align:center;color:#64748b;"><div style="display:inline-block;width:20px;height:20px;border:3px solid #e2e8f0;border-top-color:#3b82f6;border-radius:50%;animation:fd-spin 1s linear infinite;vertical-align:middle;margin-right:10px;"></div>กำลังดึงข้อมูล...</div></div><div id="fd-table"></div>';
  
  F.ajax('fund_dashboard_portfolio_allocation', {}, function(rAlloc){
     S.portfolioAlloc = (rAlloc && rAlloc.data) ? rAlloc.data : rAlloc;
     
     F.ajax('fund_dashboard_stats',{type:'FOREIGN',period:'1M'},function(r1){
       S.statsForeign=F.exStats(r1); 
       F.ajax('fund_dashboard_stats',{type:'TH',period:'1M'},function(r2){
         S.statsTH=F.exStats(r2); 
         renderPanels();
         
         startSmartLoad(); 

         F.ajax('fund_dashboard_master_etfs',{period:'1M'},function(re1){
            S.masterETFs = (re1 && re1.data) ? re1.data : (Array.isArray(re1) ? re1 : []);
            renderPanels();
         });
         F.ajax('fund_dashboard_thai_etfs',{period:'1M'},function(re2){
            S.thaiETFs = (re2 && re2.data) ? re2.data : (Array.isArray(re2) ? re2 : []);
            renderPanels();
         });

         F.ajax('fund_top_stocks',{type:'FOREIGN',limit:20},function(r3){ S.topForeign=F.exTop(r3); renderPanels(); });
         F.ajax('fund_top_stocks',{type:'TH',limit:20},function(r4){ S.topTH=F.exTop(r4); renderPanels(); });
       });
     });
  });
}

// ══════════════════════════════════════
// RENDER PANELS (Header + Cards + ETF Zone)
// ══════════════════════════════════════
function renderPanels(){
  
  function bP(t){
    var st=t==='FOREIGN'?S.statsForeign:S.statsTH, ca=(st&&st.cards)||{}, ch=(st&&st.charts)||{};
    var tops=t==='FOREIGN'?S.topForeign:S.topTH, tH=tops[0]||null;
    var tT=tops.reduce(function(a,b){return a+Number(b.total_thai_fund_value||0);},0);
    var ts=ca.top_sector||null, tif=ca.top_inflow_fund||ca.top_incoming_fund_1m||null;
    var sec=(ch.sector_allocation||[]).slice(0,8), secT=sec.reduce(function(a,b){return a+(b.value||0);},0);
    var cnt=(ch.country_allocation||[]).slice(0,8), cntT=cnt.reduce(function(a,b){return a+(b.value||0);},0);
    return{ca:ca,tH:tH,tT:tT,ts:ts,tif:tif,sec:sec,secT:secT,cnt:cnt,cntT:cntT,tops:tops.slice(0,10),ok:!!ca.total_funds};
  }

  function pan(t,p){
    var bc='#3b82f6', tv=p.tH?Number(p.tH.total_thai_fund_value||0):0, hC=t==='FOREIGN'&&p.cnt.length>0;
    var o='<div class="fd-panel fd-panel-inactive fd-split-card" data-t="'+t+'">';
    o+='<div class="fd-panel-title"><span style="font-size:22px">'+(t==='FOREIGN'?'🌎':'🇹🇭')+'</span><span style="font-size:18px;font-weight:900">'+(t==='FOREIGN'?'กองทุนต่างประเทศ':'กองทุนไทย')+'</span></div>';
    // Stats row
    o+='<div class="fd-stat-row"><div class="fd-stat-cell"><div class="fd-stat-label">Top Holding</div><div class="fd-stat-val">'+esc(p.tH?p.tH.symbol:'-')+'</div><div class="fd-stat-sub">฿'+fmt(tv)+'</div></div>';
    if(p.ok){
      o+='<div class="fd-stat-cell"><div class="fd-stat-label">จำนวนกองทุน</div><div class="fd-stat-val">'+fN(p.ca.total_funds)+'</div></div>';
      o+='<div class="fd-stat-cell"><div class="fd-stat-label">Top Sector</div><div class="fd-stat-val" style="font-size:14px">'+esc(p.ts?p.ts.name:'-')+'</div></div>';
      o+='<div class="fd-stat-cell"><div class="fd-stat-label">Flow เข้าสูงสุด</div>';
      if(p.tif&&p.tif.code)o+='<div class="fd-stat-val" style="font-size:14px">'+esc(p.tif.code)+'</div><div class="fd-stat-sub" style="color:#059669">'+((p.tif.flow||0)>=0?'+':'')+'฿'+fmt(p.tif.flow)+'</div>';
      else o+='<div class="fd-stat-val" style="color:#cbd5e1">-</div>';
      o+='</div>';
    }else{
      o+='<div class="fd-stat-cell" style="grid-column:span 3"><div style="display:flex;align-items:center;gap:8px;color:#94a3b8;font-size:13px"><div style="width:14px;height:14px;border:2px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:fd-spin 0.7s linear infinite"></div>Loading stats...</div></div>';
    }
    o+='</div>';
    // Bar charts
    var cols=hC?'1fr 1fr 1fr':'1fr 1fr';
    if(p.sec.length||p.tops.length){
      o+='<div class="fd-bar-section" style="grid-template-columns:'+cols+'">';
      if(p.sec.length)o+='<div class="fd-bar-col"><div class="fd-bar-col-title">SECTOR</div>'+barL(p.sec.map(function(x){return{name:x.name,value:p.secT?(x.value/p.secT*100):0};}),bc,'sector')+'</div>';
      if(hC)o+='<div class="fd-bar-col"><div class="fd-bar-col-title">COUNTRY</div>'+barL(p.cnt.map(function(x){return{name:x.name,value:p.cntT?(x.value/p.cntT*100):0};}),bc)+'</div>';
      if(p.tops.length)o+='<div class="fd-bar-col"><div class="fd-bar-col-title">TOP HOLDINGS</div>'+barL(p.tops.map(function(x){return{name:x.symbol,value:p.tT?(Number(x.total_thai_fund_value||0)/p.tT*100):0};}),bc,'stock')+'</div>';
      o+='</div>';
    }
    return o+'</div>';
  }

  var el2=document.getElementById('fd-panels');
  if(!el2)return;

  var hBar='<div class="fd-total-box">';

  if (!S.portfolioAlloc) {
    hBar+='<div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:800;color:#1e293b;margin-bottom:12px"><span style="font-size:16px">มูลค่าการถือครองรวม (Total Holdings Value)</span><span style="font-size:24px;color:#94a3b8">⏳ กำลังโหลด...</span></div>';
    hBar+='<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:10px;background:#e2e8f0"></div>';
    hBar+='<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;flex-wrap:wrap;gap:8px;color:#94a3b8">';
    hBar+='<span>🔍 Feeder Fund — %</span>';
    hBar+='<span>🌎 Off Shore — %</span>';
    hBar+='<span>🇹🇭 Thai Fund — %</span>';
    hBar+='<span>🔀 Mixed Fund — %</span>';
    hBar+='</div></div>';
  } else {
    var allocData = S.portfolioAlloc || {};
    var portData = allocData.portfolio_allocation || {};
    
    var totalVal = Number(allocData.total_holdings_value || 0);
    var feederVal = Number(portData.feeder_fund || 0);
    var offshoreVal = Number(portData.off_shore || 0);
    var thaiVal = Number(portData.thai_fund || 0);
    var mixedVal = Number(portData.mixed_fund || 0);

    var pctFeeder = totalVal > 0 ? (feederVal / totalVal) * 100 : 0;
    var pctOffshore = totalVal > 0 ? (offshoreVal / totalVal) * 100 : 0;
    var pctThai = totalVal > 0 ? (thaiVal / totalVal) * 100 : 0;
    var pctMixed = totalVal > 0 ? (mixedVal / totalVal) * 100 : 0;

    var minPct = 100, smallestAsset = '';
    if(pctFeeder > 0 && pctFeeder < minPct) { minPct = pctFeeder; smallestAsset = 'feeder'; }
    if(pctOffshore > 0 && pctOffshore < minPct) { minPct = pctOffshore; smallestAsset = 'offshore'; }
    if(pctThai > 0 && pctThai < minPct) { minPct = pctThai; smallestAsset = 'thai'; }
    if(pctMixed > 0 && pctMixed < minPct) { minPct = pctMixed; smallestAsset = 'mixed'; }

    hBar+='<div style="display:flex;justify-content:space-between;align-items:baseline;font-weight:800;color:#1e293b;margin-bottom:20px"><span style="font-size:16px">มูลค่าการถือครองรวม (Total Holdings Value)</span><span style="font-size:24px;color:#0f172a">฿'+fN(totalVal)+'</span></div>';

    hBar+='<div style="display:flex; width:100%; margin-bottom:4px; font-size:12px; font-weight:800; position:relative; height:36px; align-items:flex-end;">';

    hBar+='<div style="width:'+pctFeeder+'%; text-align:center; color:#FF6633; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">'+
            (pctFeeder > 0 ? '<span>'+pctFeeder.toFixed(1)+'%</span><span style="font-size:10px;margin-top:2px;font-weight:normal;opacity:0.6;">|</span>' : '')+
          '</div>';

    hBar+='<div style="width:'+pctOffshore+'%; text-align:center; color:#06b6d4; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">'+
            (pctOffshore > 0 ? '<span>'+pctOffshore.toFixed(1)+'%</span><span style="font-size:10px;margin-top:2px;font-weight:normal;opacity:0.6;">|</span>' : '')+
          '</div>';

    hBar+='<div style="width:'+pctThai+'%; text-align:center; color:#FF0066; display:flex; flex-direction:column; align-items:center; position:relative; justify-content:flex-end;">';
    if(pctThai > 0) {
        if(smallestAsset === 'thai') {
            hBar+='<span style="background:#fff1f2; border:1px solid #ffe4e6; color:#FF0066; padding:1px 6px; border-radius:4px; font-size:11px; box-shadow:0 1px 2px rgba(0,0,0,0.03); z-index:2; position:absolute; bottom:14px;">'+pctThai.toFixed(1)+'%</span>'+
                  '<span style="font-size:12px; font-weight:normal; color:#FF0066; margin-bottom:-1px; opacity:0.7; transform:scaleX(1.5);">⋮</span>';
        } else {
            hBar+='<span>'+pctThai.toFixed(1)+'%</span><span style="font-size:10px;margin-top:2px;font-weight:normal;opacity:0.6;">|</span>';
        }
    }
    hBar+='</div>';

    hBar+='<div style="width:'+pctMixed+'%; text-align:center; color:#f59e0b; display:flex; flex-direction:column; align-items:center; justify-content:flex-end;">'+
            (pctMixed > 0 ? '<span>'+pctMixed.toFixed(1)+'%</span><span style="font-size:10px;margin-top:2px;font-weight:normal;opacity:0.6;">|</span>' : '')+
          '</div>';
    hBar+='</div>';

    hBar+='<div style="display:flex;height:12px;border-radius:6px;overflow:hidden;margin-bottom:24px">';
    hBar+='<div style="width:'+pctFeeder+'%;background:#FF6633" title="Feeder Fund"></div>';
    hBar+='<div style="width:'+pctOffshore+'%;background:#06b6d4" title="Off Shore"></div>';
    hBar+='<div style="width:'+pctThai+'%;background:#FF0066" title="Thai Fund"></div>';
    hBar+='<div style="width:'+pctMixed+'%;background:#f59e0b" title="Mixed Fund"></div>';
    hBar+='</div>';

    hBar+='<div style="display:flex; gap:14px; flex-wrap:wrap; width:100%; align-items:stretch;">';

    // การ์ด 1: Feeder Fund
    hBar+='<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; background:#fff; border:1px solid #f1f5f9; flex:1; min-width:220px; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">'+
            '<div style="width:38px; height:38px; border-radius:8px; background:#fff7ed; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">🔍</div>'+
            '<div style="display:flex; flex-direction:column; line-height:1.3;">'+
              '<span style="font-size:14px; font-weight:800; color:#FF6633;">Feeder Fund ('+pctFeeder.toFixed(1)+'%)</span>'+
            '</div>'+
          '</div>';

    // การ์ด 2: Off Shore
    hBar+='<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; background:#fff; border:1px solid #f1f5f9; flex:1; min-width:220px; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">'+
            '<div style="width:38px; height:38px; border-radius:8px; background:#ecfeff; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">🌎</div>'+
            '<div style="display:flex; flex-direction:column; line-height:1.3;">'+
              '<span style="font-size:14px; font-weight:800; color:#06b6d4;">Off Shore ('+pctOffshore.toFixed(1)+'%)</span>'+
            '</div>'+
          '</div>';

    // การ์ด 3: Thai Fund
    hBar+='<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; background:#fff; border:1px solid #f1f5f9; flex:1; min-width:220px; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">'+
            '<div style="width:38px; height:38px; border-radius:8px; background:#ffe4e6; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; color:#FF0066; flex-shrink:0;">TH</div>'+
            '<div style="display:flex; flex-direction:column; line-height:1.3;">'+
              '<span style="font-size:14px; font-weight:800; color:#FF0066;">Thai Fund ('+pctThai.toFixed(1)+'%)</span>'+
            '</div>'+
          '</div>';

    // การ์ด 4: Mixed Fund
    hBar+='<div style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; background:#fff; border:1px solid #f1f5f9; flex:1; min-width:220px; box-shadow: 0 1px 3px rgba(0,0,0,0.01);">'+
            '<div style="width:38px; height:38px; border-radius:8px; background:#fef3c7; display:flex; align-items:center; justify-content:center; font-size:18px; flex-shrink:0;">📊</div>'+
            '<div style="display:flex; flex-direction:column; line-height:1.3;">'+
              '<span style="font-size:14px; font-weight:800; color:#f59e0b;">Mixed Fund ('+pctMixed.toFixed(1)+'%)</span>'+
            '</div>'+
          '</div>';

    hBar+='</div></div>';
  }

  var h='<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px"><span style="font-size:28px">📊</span><h1 style="font-size:26px;font-weight:900;margin:0;">วิเคราะห์การถือครองหุ้นผ่านกองทุนรวม</h1></div>';
  h+=hBar;
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;align-items:stretch">'+pan('FOREIGN',bP('FOREIGN'))+pan('TH',bP('TH'))+'</div>';

  h+=renderETFZone();
  el2.innerHTML=h;

  el2.querySelectorAll('.fd-clickable-bar').forEach(function(bar){
    bar.addEventListener('click',function(e){
      e.stopPropagation();
      var fType=this.dataset.f, fVal=this.dataset.v;
      if(!fType)return;
      if(fType==='sector'){
        S.sectorF=[fVal.trim()];S.page=1;renderTable();
        var tbl=document.getElementById('fd-table');if(tbl)tbl.scrollIntoView({behavior:'smooth',block:'start'});
      }else if(fType==='stock'){
        var sym=fVal.trim().toUpperCase();
        if(S.searchSymbols.indexOf(sym)<0)S.searchSymbols.push(sym);
        S.searchMode=true;S.isSearching=true;S.page=1;renderTable();
        F.searchStock(S.searchSymbols,function(holders){
          S.searchFunds=mapSearchFunds(holders);S.isSearching=false;renderTable();
          var tbl=document.getElementById('fd-table');if(tbl)tbl.scrollIntoView({behavior:'smooth',block:'start'});
        });
      }
    });
  });
}

// ══════════════════════════════════════
// ETF ZONE (Mock Data)
// ══════════════════════════════════════
function renderETFZone(){
  var mockMasterETFs = S.masterETFs || [];
  var mockThaiETFs = S.thaiETFs || [];

  if(!mockMasterETFs.length) return '<div style="padding:20px;text-align:center;color:#94a3b8;">⏳ กำลังโหลด ETF ZONE...</div>';

  var h='<div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(480px, 1fr));gap:24px;margin-bottom:30px;">';

  // ── Master ETFs (ฝั่งซ้าย) ──
  h+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:24px;">';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;"><span style="background:#1e293b;color:#fff;font-size:12px;font-weight:800;padding:4px 8px;border-radius:6px;">ETF ZONE</span><span style="font-size:16px;color:#475569;font-weight:600;">Master ETFs</span></div>';
  h+='<div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #cbd5e1;">Top Master ETFs — Flow (Unit Change)</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
  
  mockMasterETFs.slice(0,6).forEach(function(m){
    var flowVal = m.flow_net_usd || m.flow_net_thb || m.flow || 0; 
    var wPct = Math.min((Math.abs(flowVal)/10000000)*100, 100); 
    
    var thC = m.thai_fund_count || 0;
    var foC = m.foreign_fund_count || 0;
    var totC = thC + foC;

    h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 14px 0;display:flex;flex-direction:column;position:relative;overflow:hidden;">';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;"><div style="font-size:15px;font-weight:800;color:#2563eb;">'+esc(m.symbol)+'</div><div style="background:#f1f5f9;color:#64748b;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;">'+esc(m.tag||'Global')+'</div></div>';
    h+='<div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:10px;">'+esc(m.name)+'</div>';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;">';
    h+='<div style="font-size:16px;font-weight:900;color:'+rc(flowVal)+';">'+(flowVal>=0?'▲ ':'▼ ')+fmt(flowVal)+'</div>';
    
    h+='<div style="text-align:right;line-height:1.3;">';
    h+='<div style="font-size:9px;color:#64748b;font-weight:700;"> '+totC+' กองทุน</div>';
    h+='</div>';

    h+='</div>';
    h+='<div style="position:absolute;bottom:0;left:0;width:100%;height:2px;background:#f1f5f9;"><div style="width:'+wPct+'%;height:100%;background:'+rc(flowVal)+';"></div></div>';
    h+='</div>';
  });
  h+='</div></div>';

  // ── Thai ETFs (ฝั่งขวา) ──
  h+='<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;padding:24px;">';
  h+='<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;"><span style="background:#1e293b;color:#fff;font-size:12px;font-weight:800;padding:4px 8px;border-radius:6px;">ETF ZONE</span><span style="font-size:16px;color:#475569;font-weight:600;">Thai ETFs</span></div>';
  h+='<div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #cbd5e1;">Top Traded Thai ETFs — Flow (฿)</div>';
  h+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">';
  
  mockThaiETFs.slice(0,6).forEach(function(t){
    var flow = t.flow_net_thb || t.flow || 0; 
    var wPct = Math.min((Math.abs(flow)/500000000)*100, 100);
    h+='<div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 14px 0;display:flex;flex-direction:column;position:relative;overflow:hidden;">';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px;"><div style="font-size:15px;font-weight:800;color:#2563eb;">'+esc(t.symbol)+'</div><div style="background:#f1f5f9;color:#64748b;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;">'+esc(t.tag||'ETF')+'</div></div>';
    h+='<div style="font-size:10px;color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:10px;">'+esc(t.name)+'</div>';
    h+='<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:10px;">';
    h+='<div style="font-size:16px;font-weight:900;color:'+rc(flow)+';">'+(flow>=0?'▲ ':'▼ ')+'฿'+fmt(flow)+'</div>';
    h+='<div style="font-size:9px;color:#94a3b8;">NAV ฿'+fmt(t.nav)+'</div>';
    h+='</div>';
    h+='<div style="position:absolute;bottom:0;left:0;width:100%;height:2px;background:#f1f5f9;"><div style="width:'+wPct+'%;height:100%;background:'+rc(flow)+';"></div></div>';
    h+='</div>';
  });
  h+='</div></div></div>';
  return h;
}

// ══════════════════════════════════════
// RENDER TABLE (Dual: Foreign + Thai)
// ══════════════════════════════════════
function renderTable(){
  var el2=document.getElementById('fd-table');
  if(!el2)return;

  var scrolls=[];
  document.querySelectorAll('.fd-scroll').forEach(function(sc){scrolls.push(sc.scrollTop);});

  var filF=F.getFiltered('FOREIGN'), filT=F.getFiltered('TH');
  var maxLen, tP, s2, fundsF, fundsT, allSearchFil, searchPage;

  if(S.searchMode){
    allSearchFil=filF.concat(filT);
    allSearchFil.sort(function(a,b){var k=S.sortBy,va=k==='ret'?a.ret:k==='aum'?a.aum:a.nav,vb=k==='ret'?b.ret:k==='aum'?b.aum:b.nav;return(Number(va)-Number(vb))*(S.sortDir==='desc'?-1:1);});
    maxLen=allSearchFil.length;
  }else{
    maxLen=Math.max(filF.length,filT.length);
  }

  tP=Math.max(1,Math.ceil(maxLen/S.perPage));
  if(S.page>tP)S.page=tP;
  s2=(S.page-1)*S.perPage;

  if(S.searchMode){searchPage=allSearchFil.slice(s2,s2+S.perPage);}
  else{fundsF=filF.slice(s2,s2+S.perPage);fundsT=filT.slice(s2,s2+S.perPage);}

  function ar(k){return S.sortBy===k?(S.sortDir==='desc'?' ▾':' ▴'):'';}
  var isDone=(S.loadedF&&S.loadedT&&loadQueue.length===0&&!isProcessing);
  var isInit=(!S.loadedF||!S.loadedT);

  var h='<div class="fd-tbl-box" style="margin-top:24px;">';

  if(S.retryCount>0){
    h+='<div style="font-size:12px;color:#dc2626;margin-bottom:12px;display:flex;align-items:center;gap:6px;font-weight:700;">⚠️ เซิร์ฟเวอร์ตอบสนองช้า กำลังเชื่อมต่อใหม่รอบที่ '+S.retryCount+'...</div>';
  }else if(isInit){
    h+='<div style="font-size:11px;color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;border:1.5px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:fd-spin 0.7s linear infinite"></div>กำลังประมวลผลตารางกองทุน...</div>';
  }else if(!isDone){
    h+='<div style="font-size:11px;color:#94a3b8;margin-bottom:12px;display:flex;align-items:center;gap:6px;"><div style="width:12px;height:12px;border:1.5px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:fd-spin 0.7s linear infinite"></div>ทยอยโหลดข้อมูลเบื้องหลัง ('+fN(S.allFundsForeign.length+S.allFundsTH.length)+' จาก '+fN(S.totalFOREIGN+S.totalTH)+')</div>';
  }

  h+='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">';
  h+='<h3 style="font-size:20px;font-weight:800;margin:0;">กองทุนรวมทั้งหมด '+fN(S.totalFOREIGN+S.totalTH)+' กองทุน</h3>';
  h+='<div style="display:flex;gap:6px;align-items:center;"><div class="fd-srch"><span>🔍</span><input id="fd-si" placeholder="พิมพ์ชื่อหุ้น เช่น AAPL" value="'+esc(S.searchInput)+'" style="width:240px;padding:8px 14px 8px 36px;border-radius:20px;border:1.5px solid #e0e0e0;outline:none;background:#f9fafb;"></div>';
  h+='<button class="fd-sec-btn" id="fd-add-btn" style="background:#10b981;border-color:#10b981;color:#fff;padding:8px 16px;border-radius:20px;font-weight:600;">+ เพิ่ม</button>';
  h+='<button class="fd-sec-btn" id="fd-search-btn" style="background:#3b82f6;border-color:#3b82f6;color:#fff;padding:8px 20px;border-radius:20px;font-weight:600;">ค้นหา</button></div></div>';

  h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;flex-wrap:wrap;gap:12px;">';
  h+='<div class="fd-filters" style="display:flex;gap:8px;">'+mkDD('fft','ประเภทกองทุน',S.allTypes,S.fFundType)+mkDD('fam','บลจ.',S.allAmcs,S.fAmc)+mkDD('sec','Sector',S.allSectors,S.sectorF)+'<button class="fd-sec-btn" id="fd-adv-btn" style="padding:6px 14px;border-radius:20px;border:1px solid #ddd;cursor:pointer;font-weight:600;'+(S.advOpen?'background:#e0f2fe;border-color:#0ea5e9;color:#0369a1':'background:#fff;color:#6b7280')+'">▲ Advanced</button></div>';
  h+='<div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">';
  if(S.searchSymbols.length){
    h+='<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;"><span style="font-size:13px;font-weight:700;color:#475569;">หุ้นค้นหา:</span>';
    S.searchSymbols.forEach(function(sym,idx){h+='<span style="background:#e0f2fe;color:#0369a1;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px">'+esc(sym)+' <span class="fd-sym-x" data-idx="'+idx+'" style="cursor:pointer;opacity:.6">✕</span></span>';});
    h+='<button class="fd-sec-btn" id="fd-search-clear" style="color:#dc2626;border:1px solid #fca5a5;background:#fef2f2;font-size:12px;padding:4px 12px;border-radius:20px;font-weight:600;">ล้างค้นหา</button></div>';
  }
  h+='</div></div>';

  if(S.advOpen){
    h+='<div style="padding:12px 16px;margin-bottom:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px">';
    h+='<div style="margin-bottom:10px"><span style="font-size:13px;font-weight:700;color:#475569">ระดับความเสี่ยง</span><div style="display:flex;gap:6px;margin-top:6px">'+chip('1-3 ต่ำ',S.fRisk.indexOf('low')>=0,'risk-low')+chip('4-5 กลาง',S.fRisk.indexOf('med')>=0,'risk-med')+chip('6-8 สูง',S.fRisk.indexOf('high')>=0,'risk-high')+'</div></div>';
    h+='<div style="margin-bottom:10px"><span style="font-size:13px;font-weight:700;color:#475569">ผลตอบแทน</span><div style="display:flex;gap:6px;margin-top:6px">'+chip('ทั้งหมด',S.minRet===null,'ret-all')+chip('> 0%',S.minRet===0,'ret-0')+chip('> 5%',S.minRet===5,'ret-5')+chip('> 10%',S.minRet===10,'ret-10')+chip('> 20%',S.minRet===20,'ret-20')+'</div></div>';
    h+='<div><span style="font-size:13px;font-weight:700;color:#475569">เรียงตาม</span><div style="display:flex;gap:6px;margin-top:6px">'+chip('มูลค่า/AUM',S.sortBy==='nav','sort-nav')+chip('ผลตอบแทน',S.sortBy==='ret','sort-ret')+'</div></div></div>';
  }

  var tags=[];
  if(S.fFundType.length)tags.push('ประเภท: '+S.fFundType.join(', '));
  if(S.fAmc.length)tags.push('บลจ.: '+S.fAmc.join(', '));
  if(S.sectorF.length)tags.push('SECTOR: '+S.sectorF.join(', '));
  if(tags.length){
    h+='<div style="display:flex;gap:8px;margin-bottom:20px;align-items:center;flex-wrap:wrap"><span style="font-size:13px;font-weight:700;color:#475569">ตัวกรอง :</span>';
    tags.forEach(function(t2){h+='<span style="background:#f1f5f9;color:#475569;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600">'+esc(t2)+'</span>';});
    h+='<button class="fd-sec-btn" id="fd-clear" style="color:#dc2626;border:1px solid #fca5a5;background:transparent;font-size:12px;padding:4px 10px;border-radius:20px;">ล้างตัวกรอง</button></div>';
  }

  h+='<div style="display:grid;grid-template-columns:'+(S.searchMode?'1fr':'1fr 1fr')+';gap:24px;align-items:start;">';
  if(S.searchMode){
    h+=genTable('ผลการค้นหาหุ้น: '+S.searchSymbols.join(', '),searchPage,allSearchFil.length,true);
  }else{
    h+=genTable('กองทุนต่างประเทศทั้งหมด',fundsF,S.totalFOREIGN,S.loadedF);
    h+=genTable('กองทุนไทยทั้งหมด',fundsT,S.totalTH,S.loadedT);
  }
  h+='</div>';

  if(tP>1){
    h+='<div style="display:flex;justify-content:center;align-items:center;gap:6px;padding:24px 0 0;font-size:14px;flex-wrap:wrap">';
    h+='<button class="fd-pg" data-p="'+(S.page-1)+'" '+(S.page<=1?'disabled':'')+'>‹ ก่อนหน้า</button>';
    for(var p=Math.max(1,S.page-2);p<=Math.min(tP,S.page+2);p++)h+='<button class="fd-pg'+(p===S.page?' fd-pg-on':'')+'" data-p="'+p+'">'+p+'</button>';
    h+='<button class="fd-pg" data-p="'+(S.page+1)+'" '+(S.page>=tP?'disabled':'')+'>ถัดไป ›</button></div>';
  }

  h+='</div>';
  el2.innerHTML=h;
  document.querySelectorAll('.fd-scroll').forEach(function(sc,i){if(scrolls[i]!==undefined)sc.scrollTop=scrolls[i];});
  bindEv();
}

// ══════════════════════════════════════
// TABLE GENERATOR
// ══════════════════════════════════════
function genTable(title,fundsArr,totalCount,isLoaded){
  var colCount=S.searchMode?5+S.searchSymbols.length:5;
  var o='<div><h3 style="font-size:18px;font-weight:800;margin-bottom:12px;color:#0f172a;">'+title+' '+fN(totalCount)+' กองทุน</h3>';
  o+='<div class="fd-scroll" style="border:1px solid #f0f0f0;border-radius:10px;overflow-y:auto;overflow-x:auto;max-height:600px;"><table class="fd-t" style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:500px;">';

  o+='<thead style="background:#f8fafc;position:sticky;top:0;z-index:10;"><tr>';
  o+='<th class="l" style="width:40%;padding:12px 10px 12px 16px;font-size:13px;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">กองทุน</th>';
  if(S.searchMode&&S.searchSymbols.length){
    S.searchSymbols.forEach(function(sym){
      o+='<th class="c" style="width:12%;padding:12px 10px;font-size:13px;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">'+esc(sym)+'(%)</th>';
    });
  }
  var ar2=function(k){return S.sortBy===k?(S.sortDir==='desc'?' ▾':' ▴'):'';};
  o+='<th class="c" style="width:15%;padding:12px 10px;font-size:13px;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">RISK</th>';
  o+='<th class="c sort" data-s="ret" style="width:15%;padding:12px 10px;font-size:13px;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">1Y'+ar2('ret')+'</th>';
  o+='<th class="c sort" data-s="nav" style="width:15%;padding:12px 10px;font-size:13px;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">NAV'+ar2('nav')+'</th>';
  o+='<th class="c sort" data-s="aum" style="width:15%;padding:12px 10px;font-size:13px;font-weight:700;color:#475569;border-bottom:2px solid #e2e8f0;">AUM'+ar2('aum')+'</th>';
  o+='</tr></thead><tbody>';

  if(!isLoaded&&fundsArr.length===0){
    o+='<tr><td colspan="'+colCount+'" style="text-align:center;padding:50px;color:#94a3b8"><div style="width:18px;height:18px;border:2px solid #e5e7eb;border-top-color:#2563eb;border-radius:50%;animation:fd-spin 0.7s linear infinite;display:inline-block;"></div></td></tr>';
  }else if(S.isSearching){
    o+='<tr><td colspan="'+colCount+'" style="text-align:center;padding:40px;color:#0ea5e9;font-weight:600;">🔍 กำลังค้นหาข้อมูล...</td></tr>';
  }else if(!fundsArr.length){
    o+='<tr><td colspan="'+colCount+'" style="text-align:center;padding:40px;color:#94a3b8">ไม่พบข้อมูล</td></tr>';
  }else{
    fundsArr.forEach(function(f){
      var isE=!!S.expandedSet[f.code];
      var mTag='';
      if(S.searchMode){
        mTag=f.target_type==='FOREIGN'?'<span style="font-size:10px;font-weight:700;color:#3b82f6;background:#eff6ff;padding:2px 6px;border-radius:4px;margin-left:6px;">🌎 FOREIGN</span>':'<span style="font-size:10px;font-weight:700;color:#10b981;background:#ecfdf5;padding:2px 6px;border-radius:4px;margin-left:6px;">🇹🇭 TH</span>';
      }

      o+='<tr class="fd-fr" data-c="'+esc(f.code)+'" style="cursor:'+(S.searchMode?'default':'pointer')+';"><td class="l" style="padding:12px 10px 12px 16px;border-bottom:1px solid #f0f0f0;"><div style="font-weight:800;font-size:14px;color:#0f172a;white-space:normal;">'+esc(f.code)+mTag+'</div><div style="font-size:11px;color:#64748b;white-space:normal;">'+esc(f.name)+' · '+esc(f.amc)+'</div></td>';

      if(S.searchMode&&S.searchSymbols.length){
        S.searchSymbols.forEach(function(sym){
          var sData=f.pct_nav_breakdown?f.pct_nav_breakdown.find(function(x){return x.symbol===sym;}):null;
          o+=sData?'<td class="c" style="border-bottom:1px solid #f0f0f0;font-weight:800;color:#2563eb;">'+Number(sData.pct_nav).toFixed(2)+'%</td>':'<td class="c" style="border-bottom:1px solid #f0f0f0;font-weight:700;color:#cbd5e1;">-</td>';
        });
      }

      var formatNAV='—';
      if(Number(f.nav)>=1000000)formatNAV=fmt(f.nav);
      else if(Number(f.nav)>0)formatNAV=fN(Number(f.nav).toFixed(2));

      o+='<td class="c" style="border-bottom:1px solid #f0f0f0;"><span class="fd-badge '+F.rCls(f.risk)+'">'+f.risk+'</span></td>';
      o+='<td class="c" style="border-bottom:1px solid #f0f0f0;font-weight:800;color:'+rc(f.ret)+'">'+rv(f.ret)+'</td>';
      o+='<td class="c" style="border-bottom:1px solid #f0f0f0;font-weight:700;">฿'+formatNAV+'</td>';
      o+='<td class="c" style="border-bottom:1px solid #f0f0f0;font-weight:800;color:#64748b">฿'+fmt(f.aum)+'</td></tr>';

      if(isE&&!S.searchMode){
        o+='<tr style="background:#f9fafb;"><td colspan="5" class="fd-exp" style="padding:16px 24px;border-bottom:2px solid #e8edf2;"><div class="fd-exp-inner" style="display:flex;align-items:center;gap:32px;">';
        var pl=f.top.slice(0,5);
        if(!pl.length){o+='ไม่พบข้อมูลสัดส่วนหุ้น';}
        else{
          var listH='<div style="flex:1;">'+pl.map(function(t3,j){
            return'<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:12px;"><div style="display:flex;align-items:center;gap:8px"><div style="width:10px;height:10px;border-radius:2px;background:'+G[j%G.length]+'"></div><span style="color:#0f172a;font-weight:700;font-size:14px;">'+esc(t3.s)+'</span><span style="color:#6b7280;font-size:11px">'+esc(t3.n)+'</span></div><span style="font-weight:700;">'+Number(t3.p).toFixed(2)+'%</span></div>';
          }).join('')+'</div>';
          o+='<div style="text-align:center;width:120px;flex-shrink:0;"><div style="font-size:12px;font-weight:700;margin-bottom:8px;color:#475569;">Top 5 Holdings</div><canvas id="fd-pe-'+esc(f.code)+'" width="120" height="120"></canvas></div>'+listH;
          var pd=pl.map(function(t3){return{name:t3.s,value:t3.p};});
          setTimeout(function(){F.dpie('fd-pe-'+f.code,pd);},10);
        }
        o+='</div></td></tr>';
      }
    });
  }
  o+='</tbody></table></div></div>';
  return o;
}

// ══════════════════════════════════════
// SEARCH FUND MAPPING
// ══════════════════════════════════════
function mapSearchFunds(holders){
  var allF=S.allFundsForeign.concat(S.allFundsTH);
  return holders.map(function(h2){
    var m=allF.find(function(x){return x.code===(h2.code||'');});
    var r1y=null;
    if(h2.return_1y!==undefined&&h2.return_1y!==null&&h2.return_1y!=='')r1y=Number(h2.return_1y);
    else if(m&&m.ret!==undefined&&m.ret!==null&&m.ret!=='')r1y=m.ret;
    return{
      target_type:h2.target_type||'TH', code:h2.code||'',
      name:h2.name_th||h2.name||h2.code, amc:h2.amc||(m?m.amc:''),
      risk:Number(h2.risk||(m?m.risk:6)), ret:r1y,
      nav:m?m.nav:Number(h2.nav||0), aum:m?m.aum:Number(h2.total_value||0),
      top:m?m.top:[], pct_nav_breakdown:h2.pct_nav_breakdown||[]
    };
  });
}

// ══════════════════════════════════════
// EVENT BINDINGS
// ══════════════════════════════════════
function bindEv(){
  var advBtn=document.getElementById('fd-adv-btn');
  if(advBtn)advBtn.addEventListener('click',function(e){e.stopPropagation();S.advOpen=!S.advOpen;renderTable();});

  on('.fd-fr','click',function(e){
    if(S.searchMode)return;
    var c=this.dataset.c;if(!c)return;
    if(S.expandedSet[c])delete S.expandedSet[c];else S.expandedSet[c]=true;
    renderTable();
  });

  on('.fd-pg','click',function(){var pg=Number(this.dataset.p);if(!pg||pg<1||pg===S.page)return;S.expandedSet={};S.page=pg;renderTable();});
  on('.fd-t th.sort','click',function(){var k=this.dataset.s;if(S.sortBy===k)S.sortDir=S.sortDir==='desc'?'asc':'desc';else{S.sortBy=k;S.sortDir='desc';}S.page=1;renderTable();});
  on('.fd-sec-btn[data-dd]','click',function(e){e.stopPropagation();S.ddOpen=S.ddOpen===this.dataset.dd?'':this.dataset.dd;renderTable();});
  if(!window._fdD){window._fdD=true;document.addEventListener('click',function(e){if(S.ddOpen&&!e.target.closest('.fd-sec-dd')){S.ddOpen='';renderTable();}});}
  on('.fd-dd-all','change',function(e){e.stopPropagation();var d=this.dataset.dd;if(d==='fft')S.fFundType=[];else if(d==='fam')S.fAmc=[];else S.sectorF=[];S.page=1;renderTable();});
  on('.fd-dd-cb','change',function(e){
    e.stopPropagation();var d=this.dataset.dd,idx=Number(this.dataset.idx);
    var opts=d==='fft'?S.allTypes:(d==='fam'?S.allAmcs:S.allSectors);
    F.tog(d==='fft'?S.fFundType:(d==='fam'?S.fAmc:S.sectorF),opts[idx]);
    S.page=1;renderTable();
  });

  var clr=document.getElementById('fd-clear');
  if(clr)clr.addEventListener('click',function(){S.fFundType=[];S.fAmc=[];S.sectorF=[];S.fRisk=[];S.minRet=null;S.page=1;renderTable();});

  on('.fd-chip','click',function(){
    var c=this.dataset.chip;
    if(c==='risk-low')F.tog(S.fRisk,'low');else if(c==='risk-med')F.tog(S.fRisk,'med');else if(c==='risk-high')F.tog(S.fRisk,'high');
    else if(c==='ret-all')S.minRet=null;else if(c.indexOf('ret-')===0){var v=Number(c.replace('ret-',''));S.minRet=S.minRet===v?null:v;}
    else if(c==='sort-nav'){S.sortBy='nav';S.sortDir='desc';}else if(c==='sort-ret'){S.sortBy='ret';S.sortDir='desc';}
    S.page=1;renderTable();
  });

  var si=document.getElementById('fd-si');
  function addSym(){var v=si?si.value.trim().toUpperCase():'';if(!v)return false;if(S.searchSymbols.indexOf(v)<0)S.searchSymbols.push(v);S.searchInput='';if(si)si.value='';return true;}
  function doSearch(e){
    if(e)e.preventDefault();addSym();if(!S.searchSymbols.length)return;
    S.searchMode=true;S.isSearching=true;S.page=1;renderTable();
    F.searchStock(S.searchSymbols,function(holders){S.searchFunds=mapSearchFunds(holders);S.isSearching=false;renderTable();});
  }
  if(si){si.addEventListener('input',function(){S.searchInput=this.value;});si.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();if(addSym())doSearch();}});}
  var ab=document.getElementById('fd-add-btn');if(ab)ab.addEventListener('click',function(e){e.preventDefault();if(addSym())doSearch();});
  var sb=document.getElementById('fd-search-btn');if(sb)sb.addEventListener('click',doSearch);
  var sc=document.getElementById('fd-search-clear');if(sc)sc.addEventListener('click',function(e){e.preventDefault();S.searchSymbols=[];S.searchMode=false;S.searchFunds=[];S.searchInput='';S.page=1;renderTable();});
  on('.fd-sym-x','click',function(e){e.stopPropagation();var idx=Number(this.dataset.idx);S.searchSymbols.splice(idx,1);if(!S.searchSymbols.length){S.searchMode=false;S.searchFunds=[];}else{doSearch();return;}S.page=1;renderTable();});
}

function init(){if(typeof jQuery==='undefined'){setTimeout(init,300);return;}loadAll();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
</script>
<?php
}, 99);