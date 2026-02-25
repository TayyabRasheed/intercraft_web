/** @odoo-module **/

import publicWidget from '@web/legacy/js/public/public_widget';

// Lightweight loading enhancement for job cards
publicWidget.registry.jobsLoader = publicWidget.Widget.extend({
    selector: '#jobs-container',

    start() {
        // Add smooth fade-in animation for job cards
        this.$('.job-card').each(function(index) {
            $(this).css('opacity', '0').delay(index * 100).animate({opacity: 1}, 300);
        });
    }
});

export default publicWidget.registry.jobsLoader;
