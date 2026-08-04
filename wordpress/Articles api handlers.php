// ── articles/list ──
add_action('wp_ajax_fund_articles_list', 'fund_v5_articles_list');
add_action('wp_ajax_nopriv_fund_articles_list', 'fund_v5_articles_list');
function fund_v5_articles_list(){
    $page     = isset($_REQUEST['page']) ? max(1, (int) $_REQUEST['page']) : 1;
    $per_page = isset($_REQUEST['per_page']) ? max(1, (int) $_REQUEST['per_page']) : 6;
    $category = isset($_REQUEST['category']) ? (int) $_REQUEST['category'] : 0;
    $exclude  = isset($_REQUEST['exclude']) ? (int) $_REQUEST['exclude'] : 0;

    $args = [
        'post_type'      => 'post',
        'post_status'    => 'publish',
        'posts_per_page' => $per_page,
        'paged'          => $page,
        'orderby'        => 'date',
        'order'          => 'DESC',
    ];

    if ($category > 0) $args['cat'] = $category;
    if ($exclude > 0) $args['post__not_in'] = [$exclude];

    $query = new WP_Query($args);
    $articles = array_map('fund_v5_format_article', $query->posts);

    wp_send_json([
        'articles'   => $articles,
        'total'      => (int) $query->found_posts,
        'totalPages' => max(1, (int) $query->max_num_pages),
    ]);
}

// ── articles/detail ──
add_action('wp_ajax_fund_articles_detail', 'fund_v5_articles_detail');
add_action('wp_ajax_nopriv_fund_articles_detail', 'fund_v5_articles_detail');
function fund_v5_articles_detail(){
    $id = isset($_REQUEST['id']) ? (int) $_REQUEST['id'] : 0;

    if (!$id) { wp_send_json(['error' => 'no id']); return; }

    $post = get_post($id);

    if (!$post || $post->post_type !== 'post' || $post->post_status !== 'publish') {
        wp_send_json(['error' => 'not found']);
        return;
    }

    wp_send_json(['article' => fund_v5_format_article($post)]);
}

function fund_v5_render_content($raw_content){
    $content = apply_filters('the_content', $raw_content);
    $content = preg_replace('#<nav\b[^>]*>.*?</nav>#is', '', $content);

    return $content;
}

function fund_v5_format_article($post){
    setup_postdata($post);

    $thumbnail = get_the_post_thumbnail_url($post->ID, 'medium_large');

    if (!$thumbnail) {
        // ยังไม่ได้ตั้ง featured image ไว้ -> ดึงรูปแรกในเนื้อหาแทน (ตรงกับ featuredImage()
        // เดิมฝั่ง JS ที่ fallback ไปจับรูปแรกในเนื้อหาเหมือนกัน)
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $post->post_content, $m)) {
            $thumbnail = $m[1];
        }
    }

    $site_url  = home_url();
    $content   = fund_v5_render_content($post->post_content);
    $content   = str_replace($site_url, '', $content);
    $thumbnail = $thumbnail ? str_replace($site_url, '', $thumbnail) : '';

    $data = [
        'id'         => $post->ID,
        'title'      => html_entity_decode(get_the_title($post), ENT_QUOTES, 'UTF-8'),
        'excerpt'    => html_entity_decode(wp_strip_all_tags(get_the_excerpt($post)), ENT_QUOTES, 'UTF-8'),
        'content'    => $content,
        'date'       => date('F j, Y', strtotime($post->post_date)),
        'rawDate'    => $post->post_date,
        'thumbnail'  => $thumbnail,
        'link'       => get_permalink($post),
        'categories' => wp_get_post_categories($post->ID),
    ];

    wp_reset_postdata();

    return $data;
}