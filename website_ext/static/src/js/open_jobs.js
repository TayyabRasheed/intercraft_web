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
            console.log("Jobs data:", data);

            this.open_jobs = data;
            this.renderJobs();
        } catch (error) {
            console.error("Error fetching jobs:", error);
        }
    },

    renderJobs() {
        // const academic_jobs = this.open_jobs['academic_jobs'].map(job => `
        //     <div class="col-12 col-sm-6 col-md-4 col-lg-3 mt-4 mb-3">
        //          <div class="card  shadow-lg border-0 rounded-lg overflow-hidden h-100">
        //                 <img src="data:image/png;base64,${job.department_image}" class="card-img-top img-fluid" alt="${job.college_name}" />
        //             <div class="card-body text-center d-flex flex-column justify-content-between">
        //                 <h5 class="card-title font-weight-bold text-dark mb-3">${job.college_name}</h5>
        //                 <a href="${job.url || '#'}" class="btn btn-primary btn-block shadow-sm">
        //                      View Details
        //                 </a>
        //             </div>
        //          </div>
        //     </div>
        //
        //
        // `).join('');

        const academic_jobs = this.open_jobs['academic_jobs'].map(job =>`
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

        this.$('#all_jobs').html(academic_jobs);

    }
});

export default publicWidget.registry.alljobs;
