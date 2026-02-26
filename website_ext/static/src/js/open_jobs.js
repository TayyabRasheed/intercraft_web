/** @odoo-module **/

import publicWidget from '@web/legacy/js/public/public_widget';

publicWidget.registry.jobsLoader = publicWidget.Widget.extend({
    selector: '#jobs-container',

    start() {
        this.$('.job-card').each(function(index) {
            $(this).css('opacity', '0').delay(index * 100).animate({opacity: 1}, 300);
        });
    }
});

export default publicWidget.registry.jobsLoader;
