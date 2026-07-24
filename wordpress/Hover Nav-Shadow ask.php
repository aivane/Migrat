add_action('wp_footer', function() { ?>
<script>
document.addEventListener('DOMContentLoaded', function() {
    // Active nav link
    const currentUrl = window.location.href.replace(/\/$/, '');
    document.querySelectorAll('.wp-block-navigation-item__content').forEach(function(link) {
        const href = link.getAttribute('href').replace(/\/$/, '');
        if (href === currentUrl) {
            link.style.color = '#60b8f0';
        }
    });

    // Remove accordion box shadow
    document.querySelectorAll('.gs-accordion-item').forEach(function(el) {
        el.style.removeProperty('box-shadow');
    });
});
</script>
<?php });