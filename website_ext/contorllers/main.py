from odoo.addons.website_hr_recruitment.controllers.main import WebsiteHrRecruitment
from odoo.http import request
from odoo import http


class ElearningSnippet(http.Controller):
    @http.route(['/careers/jobs'], type="json", auth="public", website=True, methods=['POST'])
    def all_jobs(self):
        jobs = request.env['hr.job'].search([('is_published', '=', 'True')])

        unique_departments = {}
        for job in jobs:
            if job.department_id.id not in unique_departments:
                unique_departments[job.department_id.id] = {
                    'college_name': job.department_id.name,
                    'url': f'jobs?department_id={job.department_id.id}',
                    'department_image': job.department_id.image_department,
                }
        return {'academic_jobs': list(unique_departments.values())}

class WebsiteHrRecruitmentExt(WebsiteHrRecruitment):
    @http.route([
        '/jobs',
        '/jobs/page/<int:page>',
    ], type='http', auth="public", website=True)
    def jobs(self, country_id=None, department_id=None, office_id=None, contract_type_id=None,
             is_remote=False, is_other_department=False, is_untyped=None, page=1, search=None, **kwargs):

        result = super().jobs(country_id=country_id, department_id=department_id, office_id=office_id,
                              contract_type_id=contract_type_id, is_remote=is_remote,
                              is_other_department=is_other_department, is_untyped=is_untyped, page=page, search=search,
                              **kwargs
                              )
        if department_id:
            jobs = request.env['hr.job'].search(
                [('is_published', '=', 'True'),("department_id.id", '=',department_id )]
            )

            return request.render("website_hr_recruitment.index", {
                'jobs': jobs,
                'countries': result.qcontext.get('countries', []),
                'departments': result.qcontext.get('departments', []),
                'offices': result.qcontext.get('offices', []),
                'employment_types': result.qcontext.get('employment_types', []),
                'country_id': result.qcontext.get('country_id'),
                'department_id': result.qcontext.get('department_id'),
                'office_id': result.qcontext.get('office_id'),
                'contract_type_id': result.qcontext.get('contract_type_id'),
                'is_remote': result.qcontext.get('is_remote'),
                'is_other_department': result.qcontext.get('is_other_department'),
                'is_untyped': result.qcontext.get('is_untyped'),
                'pager': result.qcontext.get('pager'),
                'search': result.qcontext.get('search'),
                'search_count': result.qcontext.get('search_count'),
                'original_search': result.qcontext.get('original_search'),
                'count_per_country': result.qcontext.get('count_per_country', {}),
                'count_per_department': result.qcontext.get('count_per_department', {}),
                'count_per_office': result.qcontext.get('count_per_office', {}),
                'count_per_employment_type': result.qcontext.get('count_per_employment_type', {}),
            })

        return result
