# -*- coding: utf-8 -*-

import re

from odoo import api, models, fields
from odoo.tools import file_open
from odoo.tools.translate import html_translate

_PRODUCT_CASE_STUDY_TEMPLATE = 'website_ext/static/src/templates/product_case_study.html'
_WEB_IMAGE_ID_RE = re.compile(r'/web/image/(\d+)\b')


def _product_detail_template(model=None):
    """Full Figma product case-study layout — edit text/images per product in Case Study."""
    with file_open(_PRODUCT_CASE_STUDY_TEMPLATE, 'r') as template_file:
        return template_file.read()


class WebsiteProduct(models.Model):
    _name = 'website.product'
    _description = 'Website Product (Our Product)'
    _order = 'sequence, id'

    name = fields.Char('Name', required=True)
    title = fields.Char('Title', help='Display title; defaults to Name if empty')
    description = fields.Text('Description')
    url = fields.Char('URL', help='Fallback link only if slug is empty. Learn More uses /our-product/<slug>')
    explore_url = fields.Char(
        'Explore Button URL',
        help='Link used by the orange "Explore the product" button on the Case Study page. '
             'Leave empty to scroll to the portals section instead.',
    )
    slug = fields.Char(
        'URL Slug',
        help='Used for Learn More page: /our-product/<slug>',
        copy=False,
    )
    detail_html = fields.Html(
        'Learn More Page',
        sanitize=False,
        sanitize_form=False,
        strip_style=False,
        strip_classes=False,
        translate=html_translate,
        default=_product_detail_template,
        help='Click text to edit, double-click images to replace. Use </> for HTML. Reset HTML Template reloads the default file.',
    )
    image = fields.Binary('Product Image', attachment=True)
    logo = fields.Binary('Logo / Icon', attachment=True, help='Small logo in card header')
    tag_ids = fields.Many2many(
        'website.product.tag',
        'website_product_tag_rel',
        'product_id',
        'tag_id',
        string='Tags'
    )
    badge = fields.Char('Badge Label', help='e.g. AI PORTAL, DASHBOARD, WEBSITE')
    badge_style = fields.Char('Badge CSS', default='website', help='One of: ai, dashboard, website')
    sequence = fields.Integer('Sequence', default=10)
    active = fields.Boolean('Active', default=True)

    _sql_constraints = [
        ('slug_uniq', 'unique(slug)', 'Product URL slug must be unique.'),
    ]

    @api.model
    def _slugify(self, value):
        value = (value or '').strip().lower()
        value = re.sub(r'[^a-z0-9]+', '-', value)
        return value.strip('-') or 'product'

    def _ensure_slug(self):
        for product in self:
            if product.slug:
                continue
            base = self._slugify(product.name)
            slug = base
            n = 1
            Product = self.with_context(active_test=False)
            while Product.search([('slug', '=', slug), ('id', '!=', product.id)], limit=1):
                n += 1
                slug = '%s-%s' % (base, n)
            product.slug = slug

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get('slug') and vals.get('name'):
                vals['slug'] = self._slugify(vals['name'])
            if not vals.get('title') and vals.get('name'):
                vals['title'] = vals['name']
            if not vals.get('detail_html'):
                vals['detail_html'] = _product_detail_template(self)
        products = super().create(vals_list)
        products._ensure_slug()
        self.env.registry.clear_cache('templates')
        self.env.registry.clear_cache('templates.cached_values')
        return products

    def write(self, vals):
        # Card + footer use title or name. If Name changes and Title still matched
        # the old Name, keep Title in sync so the website updates.
        if 'name' in vals and 'title' not in vals:
            to_sync = self.filtered(lambda p: not p.title or p.title == p.name)
            others = self - to_sync
            res = True
            if others:
                res = super(WebsiteProduct, others).write(vals) and res
            if to_sync:
                res = super(WebsiteProduct, to_sync).write(dict(vals, title=vals['name'])) and res
        else:
            res = super().write(vals)
        if 'name' in vals or 'slug' in vals:
            self._ensure_slug()
        if 'detail_html' in vals:
            self._publish_detail_html_attachments()
        # Website page/footer use t-cache; drop cached HTML when product text changes.
        if any(f in vals for f in (
            'name', 'title', 'description', 'badge', 'badge_style',
            'sequence', 'active', 'slug', 'url', 'image', 'logo', 'tag_ids',
        )):
            self.env.registry.clear_cache('templates')
            self.env.registry.clear_cache('templates.cached_values')
        return res

    def unlink(self):
        res = super().unlink()
        self.env.registry.clear_cache('templates')
        self.env.registry.clear_cache('templates.cached_values')
        return res

    def _publish_detail_html_attachments(self):
        """Uploaded Case Study images must be public for the website."""
        Attachment = self.env['ir.attachment'].sudo()
        for product in self:
            ids = {int(x) for x in _WEB_IMAGE_ID_RE.findall(product.detail_html or '')}
            if not ids:
                continue
            atts = Attachment.browse(list(ids)).exists().filtered(lambda a: not a.public)
            if atts:
                atts.write({'public': True})

    def get_learn_more_url(self):
        """Learn More opens this product's HTML page (/our-product/<slug>)."""
        self.ensure_one()
        if self.slug:
            return '/our-product/%s' % self.slug
        if self.url:
            return self.url
        return '#'

    @api.model
    def _init_learn_more_pages(self):
        """Backfill slug + Figma case-study template for existing products."""
        products = self.with_context(active_test=False).search([])
        products._ensure_slug()
        template = _product_detail_template(self)
        for product in products:
            html = product.detail_html or ''
            if not html.strip() or 'icpd-case-hero' not in html:
                product.detail_html = template

    def action_open_learn_more(self):
        self.ensure_one()
        self._ensure_slug()
        return {
            'type': 'ir.actions.act_url',
            'url': '/our-product/%s' % self.slug,
            'target': 'new',
        }

    def action_reset_detail_template(self):
        self.ensure_one()
        self.detail_html = _product_detail_template(self)
        return True
