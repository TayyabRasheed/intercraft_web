import os
import re

from odoo.addons.website_hr_recruitment.controllers.main import WebsiteHrRecruitment
from odoo.http import request, Stream
from odoo import http
from odoo.modules.module import get_module_path


class ProductDetailController(http.Controller):
    @http.route(['/our-product/<string:slug>'], type='http', auth='public', website=True, sitemap=True)
    def product_detail(self, slug, **kwargs):
        product = request.env['website.product'].sudo().search([
            ('slug', '=', slug),
            ('active', '=', True),
        ], limit=1)
        if not product:
            return request.not_found()
        return request.render('website_ext.product_detail', {
            'product': product,
            'main_object': product,
        })

    @http.route(['/case-image/<string:name>'], type='http', auth='public', website=True, sitemap=False)
    def case_image(self, name, **kwargs):
        """Serve Product Images uploads, or static case-study/<name>.jpg|png as fallback."""
        if not re.match(r'^[A-Za-z0-9][A-Za-z0-9_-]*$', name or ''):
            return request.not_found()

        record = request.env['website.product.image'].sudo().search([
            ('name', '=', name),
            ('active', '=', True),
        ], limit=1)
        if record and record.image:
            return request.env['ir.binary']._get_image_stream_from(
                record, 'image', filename=record.name,
            ).get_response()

        module_path = get_module_path('website_ext')
        if module_path:
            images_dir = os.path.join(module_path, 'static', 'src', 'images', 'case-study')
            for ext in ('.jpg', '.jpeg', '.png', '.webp', '.svg'):
                file_path = os.path.join(images_dir, name + ext)
                if os.path.isfile(file_path):
                    return Stream.from_path(file_path, public=True).get_response()
            # Fallback so missing tab names still show a picture
            for ext in ('.png', '.jpg', '.jpeg', '.webp'):
                file_path = os.path.join(images_dir, 'dashboard' + ext)
                if os.path.isfile(file_path):
                    return Stream.from_path(file_path, public=True).get_response()

        return request.not_found()


class CareerController(http.Controller):
    @http.route(['/career'], type='http', auth="public", website=True, cache=300)
    def career_page(self, **kwargs):
        culture_images = request.env['website.event.image'].sudo().search([
            ('is_active', '=', True)
        ], order='sequence, id')

        jobs = request.env['hr.job'].search([('is_published', '=', True)])
        departments_dict = {}
        for job in jobs:
            dept_id = job.department_id.id
            if dept_id not in departments_dict:
                departments_dict[dept_id] = {
                    'name': job.department_id.name,
                    'url': f'/jobs?department_id={dept_id}',
                    'image': job.department_id.image_department,
                    'job_count': 0
                }
            departments_dict[dept_id]['job_count'] += 1

        return request.render('website_ext.career', {
            'job_departments': list(departments_dict.values()),
            'culture_images': culture_images
        })


class ElearningSnippet(http.Controller):
    pass

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
