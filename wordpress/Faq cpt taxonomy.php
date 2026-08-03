// Snippet: FAQ Custom Post Type + Taxonomy
// Type: Run Everywhere

// ── ลงทะเบียน Post Type 'faq' ──
add_action('init', function () {
    register_post_type('faq', [
        'labels' => [
            'name'          => 'คำถามที่พบบ่อย',
            'singular_name' => 'คำถามที่พบบ่อย',
            'add_new_item'  => 'เพิ่มคำถามใหม่',
            'edit_item'     => 'แก้ไขคำถาม',
            'all_items'     => 'คำถามที่พบบ่อยทั้งหมด',
        ],
        'public'       => false,     // ไม่ต้องมีหน้า front ของ WP เอง เพราะ Vue เป็นคนแสดงผล
        'show_ui'      => true,      // แต่ยังโชว์ในเมนู wp-admin ให้แก้ไขได้
        'show_in_menu' => true,
        'menu_icon'    => 'dashicons-editor-help',
        'supports'     => ['title', 'editor', 'page-attributes'], // page-attributes = มีช่อง "Order" ไว้เรียงคำถาม
        'has_archive'  => false,
    ]);

    register_taxonomy('faq_category', 'faq', [
        'labels' => [
            'name'          => 'หมวดหมู่ FAQ',
            'singular_name' => 'หมวดหมู่ FAQ',
        ],
        'hierarchical'       => false,
        'show_ui'            => true,
        'show_admin_column'  => true,
        'show_in_quick_edit' => true,
    ]);
});

// ── สร้างหมวดหมู่เริ่มต้นให้ครั้งเดียว (ตรงกับปุ่ม filter ฝั่ง Vue) ──
add_action('init', function () {
    if (get_option('fund_faq_default_terms_created')) return;

    $defaults = [
        'start'   => 'เริ่มต้นลงทุน',
        'thai'    => 'กองทุนไทย',
        'foreign' => 'กองทุนต่างประเทศ',
        'website' => 'การใช้งานเว็บไซต์',
    ];

    foreach ($defaults as $slug => $name) {
        if (!term_exists($slug, 'faq_category')) {
            wp_insert_term($name, 'faq_category', ['slug' => $slug]);
        }
    }

    update_option('fund_faq_default_terms_created', 1);
}, 20); // priority 20 ให้แน่ใจว่า taxonomy ลงทะเบียนก่อนแล้ว