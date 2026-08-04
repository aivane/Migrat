// Snippet: FAQ API Handler
// Type: Run Everywhere

// ── faq/list ──
add_action('wp_ajax_fund_faq_list', 'fund_v5_faq_list');
add_action('wp_ajax_nopriv_fund_faq_list', 'fund_v5_faq_list');
function fund_v5_faq_list() {
    $category = isset($_REQUEST['category']) ? sanitize_text_field($_REQUEST['category']) : '';

    $args = [
        'post_type'      => 'faq',
        'post_status'    => 'publish',
        'posts_per_page' => -1,
        'orderby'        => ['menu_order' => 'ASC', 'title' => 'ASC'],
    ];

    if ($category && $category !== 'all') {
        $args['tax_query'] = [[
            'taxonomy' => 'faq_category',
            'field'    => 'slug',
            'terms'    => $category,
        ]];
    }

    $query = new WP_Query($args);
    $faqs = [];

    foreach ($query->posts as $post) {
        $terms = get_the_terms($post->ID, 'faq_category');
        $term  = (!is_wp_error($terms) && !empty($terms)) ? $terms[0] : null;

        $faqs[] = [
            'id'             => $post->ID,
            'question'       => get_the_title($post),
            'answer'         => apply_filters('the_content', $post->post_content),
            'category'       => $term ? $term->slug : '',
            'category_label' => $term ? $term->name : '',
            'order'          => (int) $post->menu_order,
        ];
    }

    $terms = get_terms(['taxonomy' => 'faq_category', 'hide_empty' => true]);
    $categories = [];
    if (!is_wp_error($terms)) {
        foreach ($terms as $term) {
            $categories[] = ['slug' => $term->slug, 'name' => $term->name];
        }
    }

    wp_send_json(['faqs' => $faqs, 'categories' => $categories]);
}