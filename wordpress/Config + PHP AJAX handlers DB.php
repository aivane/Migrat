define('FUND_BACKEND',  'https://unexcusable-depreciatingly-lieselotte.ngrok-free.dev');
define('FUND_API',      'https://isabella-hagiologic-rolland.ngrok-free.dev/api/fund');
define('FUND_API_RECON','https://isabella-hagiologic-rolland.ngrok-free.dev/api/recon/v2');

add_action('wp_enqueue_scripts', function(){ wp_enqueue_script('jquery'); });

// ============================================================
// AUTH HANDLERS  →  FUND_BACKEND
// ============================================================
add_action('wp_ajax_nopriv_fund_login', 'fund_v5_login');
add_action('wp_ajax_fund_login', 'fund_v5_login');
function fund_v5_login() {
    $remember = isset($_POST['remember']) && $_POST['remember'] == '1';
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/login', array(
        'headers' => array('Content-Type' => 'application/json', 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('username' => $_POST['username'], 'password' => $_POST['password'], 'remember_me' => $remember)),
        'timeout' => 15, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่ภายหลัง', 'error_type' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code >= 500) { wp_send_json_error(array('error' => 'เซิร์ฟเวอร์มีปัญหา กรุณาลองใหม่ภายหลัง', 'error_type' => 'server')); return; }
    if ($code == 200 && isset($body['token'])) {
        $cookie_days = $remember ? 30 : 1;
        setcookie('auth_api_token', $body['token'], time() + 86400 * $cookie_days, '/');
        wp_send_json_success($body);
    } else { wp_send_json_error($body); }
}

add_action('wp_ajax_nopriv_fund_register', 'fund_v5_register');
add_action('wp_ajax_fund_register', 'fund_v5_register');
function fund_v5_register() {
    $email    = sanitize_email($_POST['email']);
    $username = sanitize_text_field($_POST['username']);
    if (empty($username)) $username = explode('@', $email)[0];
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/register', array(
        'headers' => array('Content-Type' => 'application/json', 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('username' => $username, 'email' => $email, 'password' => $_POST['password'])),
        'timeout' => 15, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่ภายหลัง', 'error_type' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200 && !isset($body['error'])) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_logout', 'fund_v5_logout');
add_action('wp_ajax_nopriv_fund_logout', 'fund_v5_logout');
function fund_v5_logout() {
    setcookie('auth_api_token', '', time() - 3600, '/');
    wp_send_json_success(array('message' => 'ok'));
}

add_action('wp_ajax_fund_verify', 'fund_v5_verify');
add_action('wp_ajax_nopriv_fund_verify', 'fund_v5_verify');
function fund_v5_verify() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_get(FUND_BACKEND . '/api/auth/verify', array(
        'headers' => array('Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_profile', 'fund_v5_profile');
add_action('wp_ajax_nopriv_fund_profile', 'fund_v5_profile');
function fund_v5_profile() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_get(FUND_BACKEND . '/api/auth/profile', array(
        'headers' => array('Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_nopriv_fund_forgot', 'fund_v5_forgot');
add_action('wp_ajax_fund_forgot', 'fund_v5_forgot');
function fund_v5_forgot() {
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/forgot-password', array(
        'headers' => array('Content-Type' => 'application/json', 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('email' => sanitize_email($_POST['email']))),
        'timeout' => 15, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200 && !isset($body['error'])) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_nopriv_fund_reset_pw', 'fund_v5_reset_pw');
add_action('wp_ajax_fund_reset_pw', 'fund_v5_reset_pw');
function fund_v5_reset_pw() {
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/reset-password', array(
        'headers' => array('Content-Type' => 'application/json', 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('token' => $_POST['token'], 'new_password' => $_POST['password'])),
        'timeout' => 15, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200 && !isset($body['error'])) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_account_info', 'fund_v5_account_info');
add_action('wp_ajax_nopriv_fund_account_info', 'fund_v5_account_info');
function fund_v5_account_info() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_get(FUND_BACKEND . '/api/auth/account-info', array(
        'headers' => array('Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_change_pw', 'fund_v5_change_pw');
function fund_v5_change_pw() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/change-password', array(
        'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('current_password' => $_POST['current_password'], 'new_password' => $_POST['new_password'])),
        'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_set_pw', 'fund_v5_set_pw');
function fund_v5_set_pw() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/set-password', array(
        'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('new_password' => $_POST['new_password'])),
        'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_link_google', 'fund_v5_link_google');
function fund_v5_link_google() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/link-google', array(
        'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('google_token' => $_POST['google_token'])),
        'timeout' => 15, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_update_profile', 'fund_v5_update_profile');
function fund_v5_update_profile() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/update-profile', array(
        'headers' => array('Content-Type' => 'application/json', 'Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('display_name' => sanitize_text_field($_POST['display_name']))),
        'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_upload_avatar', 'fund_v5_upload_avatar');
function fund_v5_upload_avatar() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    if (!isset($_FILES['avatar'])) { wp_send_json_error(array('message' => 'no file')); return; }
    $file     = $_FILES['avatar'];
    $boundary = wp_generate_password(24, false);
    $body     = '';
    $body    .= "--{$boundary}\r\n";
    $body    .= "Content-Disposition: form-data; name=\"file\"; filename=\"{$file['name']}\"\r\n";
    $body    .= "Content-Type: {$file['type']}\r\n\r\n";
    $body    .= file_get_contents($file['tmp_name']) . "\r\n";
    $body    .= "--{$boundary}--\r\n";
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/upload-avatar', array(
        'headers' => array(
            'Content-Type'               => 'multipart/form-data; boundary=' . $boundary,
            'Authorization'              => 'Bearer ' . $token,
            'ngrok-skip-browser-warning' => '1'
        ),
        'body'    => $body, 'timeout' => 30, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_fund_unlink_google', 'fund_v5_unlink_google');
function fund_v5_unlink_google() {
    $token = isset($_POST['token']) ? $_POST['token'] : '';
    if (!$token) { wp_send_json_error(array('message' => 'no token')); return; }
    $r = wp_remote_request(FUND_BACKEND . '/api/auth/unlink/google', array(
        'method'  => 'DELETE',
        'headers' => array('Authorization' => 'Bearer ' . $token, 'ngrok-skip-browser-warning' => '1'),
        'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200) { wp_send_json_success($body); } else { wp_send_json_error($body); }
}

add_action('wp_ajax_nopriv_fund_google_url', 'fund_v5_google_url');
add_action('wp_ajax_fund_google_url', 'fund_v5_google_url');
function fund_v5_google_url() {
    $r = wp_remote_get(FUND_BACKEND . '/api/auth/google/url', array(
        'headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' => 10, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    wp_send_json_success($body);
}

add_action('wp_ajax_nopriv_fund_google_verify', 'fund_v5_google_verify');
add_action('wp_ajax_fund_google_verify', 'fund_v5_google_verify');
function fund_v5_google_verify() {
    $r = wp_remote_post(FUND_BACKEND . '/api/auth/google/verify', array(
        'headers' => array('Content-Type' => 'application/json', 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('credential' => $_POST['credential'])),
        'timeout' => 15, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json_error(array('error' => 'connection')); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    $code = wp_remote_retrieve_response_code($r);
    if ($code == 200 && !isset($body['error']) && isset($body['token'])) {
        $cookie_days = 30;
        setcookie('auth_api_token', $body['token'], time() + 86400 * $cookie_days, '/');
        wp_send_json_success($body);
    } else { wp_send_json_error($body); }
}

// ============================================================
// SEARCH SUGGESTIONS  →  FUND_API_RECON (v2)
// ============================================================
add_action('wp_ajax_fund_search_nav', 'fund_search_nav');
add_action('wp_ajax_nopriv_fund_search_nav', 'fund_search_nav');
function fund_search_nav() {
    $q = isset($_REQUEST['q']) ? sanitize_text_field($_REQUEST['q']) : '';
    if (!$q) { wp_send_json([]); return; }
    $r = wp_remote_get(
        FUND_API_RECON . '/search/suggestions?q=' . urlencode($q) . '&type=TH',
        array('headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' => 15, 'sslverify' => false)
    );
    if (is_wp_error($r)) { wp_send_json([]); return; }
    $data = json_decode(wp_remote_retrieve_body($r), true);
    wp_send_json(is_array($data) ? $data : []);
}

// ============================================================
// DASHBOARD STATS  →  FUND_API_RECON (v2)
// ============================================================
add_action('wp_ajax_fund_dashboard_stats', 'fund_v5_dashboard_stats');
add_action('wp_ajax_nopriv_fund_dashboard_stats', 'fund_v5_dashboard_stats');
function fund_v5_dashboard_stats() {
    $type = isset($_REQUEST['type']) ? sanitize_text_field($_REQUEST['type']) : 'TH';
    $period = isset($_REQUEST['period']) ? sanitize_text_field($_REQUEST['period']) : '1M';
    $r = wp_remote_get(FUND_API_RECON . '/dashboard/stats?type=' . urlencode($type) . '&period=' . urlencode($period), array(
        'headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' => 120, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json(array('error' => 'connection', 'detail' => $r->get_error_message())); return; }
    $data = json_decode(wp_remote_retrieve_body($r), true);
    wp_send_json($data ? $data : array());
}

// ============================================================
// TOP STOCKS  →  FUND_API_RECON (v2)
// ============================================================
add_action('wp_ajax_fund_top_stocks', 'fund_v5_top_stocks');
add_action('wp_ajax_nopriv_fund_top_stocks', 'fund_v5_top_stocks');
function fund_v5_top_stocks() {
    $type  = isset($_REQUEST['type'])  ? sanitize_text_field($_REQUEST['type'])  : 'TH';
    $limit = isset($_REQUEST['limit']) ? intval($_REQUEST['limit']) : 10;
    $r = wp_remote_get(FUND_API_RECON . '/stocks/top?type=' . urlencode($type) . '&limit=' . $limit,
        array('headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' => 30, 'sslverify' => false)
    );
    if (is_wp_error($r)) { wp_send_json([]); return; }
    $body = json_decode(wp_remote_retrieve_body($r), true);
    wp_send_json($body ? $body : []);
}

// ============================================================
// FUND DETAIL  →  FUND_API_RECON (v2)
// ============================================================
add_action('wp_ajax_fund_fund_detail', 'fund_v5_fund_detail');
add_action('wp_ajax_nopriv_fund_fund_detail', 'fund_v5_fund_detail');
function fund_v5_fund_detail() {
    $code = isset($_REQUEST['code']) ? sanitize_text_field($_REQUEST['code']) : '';
    if (!$code) { wp_send_json(array('error' => 'no code')); return; }
    $r = wp_remote_get(FUND_API_RECON . '/funds/' . urlencode($code), array(
        'headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' => 30, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json(array('error' => 'connection')); return; }
    $data = json_decode(wp_remote_retrieve_body($r), true);
    wp_send_json($data ? $data : array());
}

// ============================================================
// SEARCH FUNDS  →  FUND_API_RECON (v2) [FIXED BUGS]
// ============================================================
add_action('wp_ajax_fund_search', 'handle_fund_search');
add_action('wp_ajax_nopriv_fund_search', 'handle_fund_search');
function handle_fund_search() {
    $symbols = isset($_POST['symbols']) ? json_decode(stripslashes($_POST['symbols']), true) : [];
    if (!is_array($symbols)) { wp_send_json_error('Invalid input'); return; }

    $args = array(
        'headers' => array('Content-Type' => 'application/json', 'ngrok-skip-browser-warning' => '1'),
        'body'    => json_encode(array('symbols' => $symbols)),
        'timeout' => 45, 'sslverify' => false
    );

    $resTH = wp_remote_post(FUND_API_RECON . '/search/funds?type=TH', $args);
    $resFR = wp_remote_post(FUND_API_RECON . '/search/funds?type=FOREIGN', $args);

    $holders = array();
    
    if (!is_wp_error($resTH)) {
        $dataTH = json_decode(wp_remote_retrieve_body($resTH), true);
        if (isset($dataTH['holders']) && is_array($dataTH['holders'])) {
            foreach($dataTH['holders'] as $h) { 
                $h['target_type'] = 'TH'; 
                $holders[] = $h; 
            }
        }
    }
    
    if (!is_wp_error($resFR)) {
        $dataFR = json_decode(wp_remote_retrieve_body($resFR), true);
        if (isset($dataFR['holders']) && is_array($dataFR['holders'])) {
            foreach($dataFR['holders'] as $h) { 
                $h['target_type'] = 'FOREIGN'; 
                $holders[] = $h; 
            }
        }
    }

    wp_send_json(array('holders' => $holders));
}

// ============================================================
// FUND LIST  →  FUND_API_RECON (v2)
// ============================================================
add_action('wp_ajax_fund_fund_list', 'fund_v5_fund_list');
add_action('wp_ajax_nopriv_fund_fund_list', 'fund_v5_fund_list');
function fund_v5_fund_list() {
    $allowed = ['type','period','fund_type','amc','sector','stock_type','risk','min_return','max_return','sort_by','sort_dir','page','per_page'];
    $params  = [];
    foreach ($allowed as $k) { if (isset($_REQUEST[$k]) && $_REQUEST[$k] !== '') { $params[$k] = sanitize_text_field($_REQUEST[$k]); } }
    $url = FUND_API_RECON . '/funds/list';
    if (!empty($params)) $url .= '?' . http_build_query($params);
    $r = wp_remote_get($url, array('headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' => 45, 'sslverify' => false));
    if (is_wp_error($r)) { wp_send_json(array('error' => 'connection', 'detail' => $r->get_error_message())); return; }
    $data = json_decode(wp_remote_retrieve_body($r), true);
    wp_send_json($data ? $data : array());
}

// ============================================================
// NEW FEATURES: INSIGHTS & FLOW -> FUND_API_RECON (v2.7.0)
// ============================================================

// 1. Global Fund Flow - รองรับ New 1D Option
add_action('wp_ajax_fund_insights_global_flow', 'fund_v5_global_flow');
add_action('wp_ajax_nopriv_fund_insights_global_flow', 'fund_v5_global_flow');
function fund_v5_global_flow() {
    $period = isset($_REQUEST['period']) ? sanitize_text_field($_REQUEST['period']) : '1M';
    $r = wp_remote_get(FUND_API_RECON . '/insights/global-flow?period=' . urlencode($period), array(
        "headers" => array("ngrok-skip-browser-warning" => "1"), "timeout" => 60, "sslverify" => false
    ));
    if (is_wp_error($r)) { wp_send_json(array("error" => "connection")); return; }
    wp_send_json(json_decode(wp_remote_retrieve_body($r), true));
}

// 2. Inflow / Outflow Trend - ปรับระยะเวลาตาม Filter
add_action('wp_ajax_fund_insights_flow_trend', 'fund_v5_flow_trend');
add_action('wp_ajax_nopriv_fund_insights_flow_trend', 'fund_v5_flow_trend');
function fund_v5_flow_trend() {
    $type = isset($_REQUEST['type']) ? sanitize_text_field($_REQUEST['type']) : 'FOREIGN';
    $period = isset($_REQUEST['period']) ? sanitize_text_field($_REQUEST['period']) : '5Y';
    
    $r = wp_remote_get(FUND_API_RECON . '/insights/flow-trend?type='.urlencode($type).'&period='.urlencode($period), array(
        "headers" => array("ngrok-skip-browser-warning" => "1"), "timeout" => 60, "sslverify" => false
    ));
    if (is_wp_error($r)) { wp_send_json([]); return; }
    wp_send_json(json_decode(wp_remote_retrieve_body($r), true));
}

// 3. Theme Funds - รายชื่อกองทุนในแต่ละ Theme
add_action('wp_ajax_fund_insights_theme_funds', 'fund_v5_theme_funds');
add_action('wp_ajax_nopriv_fund_insights_theme_funds', 'fund_v5_theme_funds');
function fund_v5_theme_funds() {
    $themes = isset($_REQUEST['themes']) ? sanitize_text_field($_REQUEST['themes']) : '';
    $limit = isset($_REQUEST['limit']) ? intval($_REQUEST['limit']) : 10;
    if (!$themes) { wp_send_json([]); return; }
    $r = wp_remote_get(FUND_API_RECON . '/insights/theme-funds?themes=' . urlencode($themes) . '&limit=' . $limit, array(
        "headers" => array("ngrok-skip-browser-warning" => "1"), "timeout" => 60, "sslverify" => false
    ));
    if (is_wp_error($r)) { wp_send_json([]); return; }
    wp_send_json(json_decode(wp_remote_retrieve_body($r), true));
}

// ============================================================
// NEW FEATURES: ETF ZONE (DASHBOARD DEMO) -> FUND_API_RECON (v2)
// ============================================================

// 4. Master ETFs (โชว์ Unit-based Flow แทน Return)
add_action('wp_ajax_fund_dashboard_master_etfs', 'fund_v5_master_etfs');
add_action('wp_ajax_nopriv_fund_dashboard_master_etfs', 'fund_v5_master_etfs');
function fund_v5_master_etfs() {
    $period = isset($_REQUEST['period']) ? sanitize_text_field($_REQUEST['period']) : '1M';
    $r = wp_remote_get(FUND_API_RECON . '/dashboard/master-etfs?type=FOREIGN&period=' . urlencode($period), array(
        'headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' =>60, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json([]); return; }
    wp_send_json(json_decode(wp_remote_retrieve_body($r), true));
}

// 5. Thai ETFs (Flow & Nav)
add_action('wp_ajax_fund_dashboard_thai_etfs', 'fund_v5_thai_etfs');
add_action('wp_ajax_nopriv_fund_dashboard_thai_etfs', 'fund_v5_thai_etfs');
function fund_v5_thai_etfs() {
    $period = isset($_REQUEST['period']) ? sanitize_text_field($_REQUEST['period']) : '1M';
    $r = wp_remote_get(FUND_API_RECON . '/dashboard/thai-etfs?period=' . urlencode($period), array(
        'headers' => array('ngrok-skip-browser-warning' => '1'), 'timeout' => 30, 'sslverify' => false
    ));
    if (is_wp_error($r)) { wp_send_json([]); return; }
    wp_send_json(json_decode(wp_remote_retrieve_body($r), true));
}

// ============================================================
// 🟢 6. PORTFOLIO ALLOCATION (API v2.7.0 เส้นใหม่ล่าสุด) 
// ============================================================
add_action('wp_ajax_fund_dashboard_portfolio_allocation', 'fund_v5_portfolio_allocation');
add_action('wp_ajax_nopriv_fund_dashboard_portfolio_allocation', 'fund_v5_portfolio_allocation');
function fund_v5_portfolio_allocation() {
    // ดึงพารามิเตอร์เผื่อไว้กรณีส่งรหัสกองทุนคัดแยกเจาะจงมาทาง Query String [cite: 194]
    $funds = isset($_REQUEST['funds']) ? sanitize_text_field($_REQUEST['funds']) : '';
    $url = FUND_API_RECON . '/dashboard/portfolio-allocation'; // 
    if (!empty($funds)) {
        $url .= '?codes=' . urlencode($funds);
    }

    $r = wp_remote_get($url, array(
        'headers' => array('ngrok-skip-browser-warning' => '1'),
        'timeout' => 45,
        'sslverify' => false
    ));

    if (is_wp_error($r)) {
        wp_send_json(array('error' => 'connection', 'detail' => $r->get_error_message()));
        return;
    }

    $data = json_decode(wp_remote_retrieve_body($r), true);
    wp_send_json($data ? $data : array());
}