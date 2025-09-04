/** @odoo-module **/

import publicWidget from '@web/legacy/js/public/public_widget';
import {jsonrpc} from "@web/core/network/rpc_service";

publicWidget.registry.alljobs = publicWidget.Widget.extend({
    selector: '.view_all_jobs',

    setup() {
        this.open_jobs = [];
    },

    async start() {
        try {
            const data = await jsonrpc("/careers/jobs");
            this.open_jobs = data;
            this.renderJobs();
        } catch (error) {
            console.error("Error fetching jobs:", error);
        }
    },

    renderJobs() {

        let job_details = '';

        const academicJobs = this.open_jobs.academic_jobs || [];
        if (academicJobs.length > 0) {
            job_details = this.open_jobs['academic_jobs'].map(job => `
            <div class="col-lg-3 col-md-6 mb-4 d-flex align-items-stretch">
                <div class="job-card w-100">
                    <img src="data:image/png;base64,${job.department_image}" class="card-img-top" alt="${job.college_name}" />
                    <div class="card-body">
                        <h5 class="card-title">${job.college_name}</h5>
                        <a href="${job.url || '#'}" class="contact-btn">
                            View Details
                        </a>
                    </div>
                </div>
            </div>
        `).join('');
        } else {
            job_details = "<h4 class='text-center'>We're not hiring currently, but we'd love to hear from you later!</h4>";
        }

        this.$('#all_jobs').html(job_details);

    }
});

export default publicWidget.registry.alljobs;
