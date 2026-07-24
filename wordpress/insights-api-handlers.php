// Snippet 1: Insights API Handlers (v2)
// Type: Run Everywhere

// ── insights/trend ──
add_action('wp_ajax_fund_insights_trend','fund_v5_insights_trend');
add_action('wp_ajax_nopriv_fund_insights_trend','fund_v5_insights_trend');
function fund_v5_insights_trend(){
    $params=[];
    foreach(['type','sort_by','limit'] as $k){if(isset($_REQUEST[$k])&&$_REQUEST[$k]!=='')$params[$k]=sanitize_text_field($_REQUEST[$k]);}
    $url=FUND_API_RECON.'/insights/trend';
    if(!empty($params))$url.='?'.http_build_query($params);
    $r=wp_remote_get($url,['headers'=>['ngrok-skip-browser-warning'=>'1'],'timeout'=>30,'sslverify'=>false]);
    $data=json_decode(wp_remote_retrieve_body($r),true); wp_send_json($data?$data:[]);
}

// ── insights/valuation ──
add_action('wp_ajax_fund_insights_valuation','fund_v5_insights_valuation');
add_action('wp_ajax_nopriv_fund_insights_valuation','fund_v5_insights_valuation');
function fund_v5_insights_valuation(){
    $params=[];
    foreach(['type','sort_by','limit'] as $k){if(isset($_REQUEST[$k])&&$_REQUEST[$k]!=='')$params[$k]=sanitize_text_field($_REQUEST[$k]);}
    $url=FUND_API_RECON.'/insights/valuation';
    if(!empty($params))$url.='?'.http_build_query($params);
    $r=wp_remote_get($url,['headers'=>['ngrok-skip-browser-warning'=>'1'],'timeout'=>30,'sslverify'=>false]);
    $data=json_decode(wp_remote_retrieve_body($r),true); wp_send_json($data?$data:[]);
}

// ── insights/popularity ──
add_action('wp_ajax_fund_insights_popularity','fund_v5_insights_popularity');
add_action('wp_ajax_nopriv_fund_insights_popularity','fund_v5_insights_popularity');
function fund_v5_insights_popularity(){
    $params=[];
    foreach(['type','limit'] as $k){if(isset($_REQUEST[$k])&&$_REQUEST[$k]!=='')$params[$k]=sanitize_text_field($_REQUEST[$k]);}
    $url=FUND_API_RECON.'/insights/popularity';
    if(!empty($params))$url.='?'.http_build_query($params);
    $r=wp_remote_get($url,['headers'=>['ngrok-skip-browser-warning'=>'1'],'timeout'=>30,'sslverify'=>false]);
    $data=json_decode(wp_remote_retrieve_body($r),true); wp_send_json($data?$data:[]);
}

// ── insights/themes ──
add_action('wp_ajax_fund_insights_themes','fund_v5_insights_themes');
add_action('wp_ajax_nopriv_fund_insights_themes','fund_v5_insights_themes');
function fund_v5_insights_themes(){
    $limit=isset($_REQUEST['limit'])?sanitize_text_field($_REQUEST['limit']):'10';
    $r=wp_remote_get(FUND_API_RECON.'/insights/themes?limit='.urlencode($limit),['headers'=>['ngrok-skip-browser-warning'=>'1'],'timeout'=>30,'sslverify'=>false]);
    $data=json_decode(wp_remote_retrieve_body($r),true); wp_send_json($data?$data:[]);
}

// ── insights/global-flow ──
add_action('wp_ajax_fund_insights_global_flow','fund_v5_insights_global_flow');
add_action('wp_ajax_nopriv_fund_insights_global_flow','fund_v5_insights_global_flow');
function fund_v5_insights_global_flow(){
    $period=isset($_REQUEST['period'])?sanitize_text_field($_REQUEST['period']):'1M';
    $r=wp_remote_get(FUND_API_RECON.'/insights/global-flow?period='.urlencode($period),['headers'=>['ngrok-skip-browser-warning'=>'1'],'timeout'=>30,'sslverify'=>false]);
    $data=json_decode(wp_remote_retrieve_body($r),true); wp_send_json($data?$data:[]);
}

// ── insights/theme-funds ──
add_action('wp_ajax_fund_insights_theme_funds','fund_v5_insights_theme_funds');
add_action('wp_ajax_nopriv_fund_insights_theme_funds','fund_v5_insights_theme_funds');
function fund_v5_insights_theme_funds(){
    $themes=isset($_REQUEST['themes'])?sanitize_text_field($_REQUEST['themes']):'';
    $limit=isset($_REQUEST['limit'])?sanitize_text_field($_REQUEST['limit']):'10';
    $r=wp_remote_get(FUND_API_RECON.'/insights/theme-funds?themes='.urlencode($themes).'&limit='.urlencode($limit),['headers'=>['ngrok-skip-browser-warning'=>'1'],'timeout'=>30,'sslverify'=>false]);
    $data=json_decode(wp_remote_retrieve_body($r),true); wp_send_json($data?$data:[]);
}

// ── funds/{code}/trend ──
add_action('wp_ajax_fund_fund_trend','fund_v5_fund_trend');
add_action('wp_ajax_nopriv_fund_fund_trend','fund_v5_fund_trend');
function fund_v5_fund_trend(){
    $code=isset($_REQUEST['code'])?sanitize_text_field($_REQUEST['code']):'';
    if(!$code){wp_send_json(['error'=>'no code']);return;}
    $r=wp_remote_get(FUND_API_RECON.'/funds/'.urlencode($code).'/trend',['headers'=>['ngrok-skip-browser-warning'=>'1'],'timeout'=>30,'sslverify'=>false]);
    $data=json_decode(wp_remote_retrieve_body($r),true); wp_send_json($data?$data:[]);
}