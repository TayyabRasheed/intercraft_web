# -*- coding: utf-8 -*-

from odoo import models, fields


class WebsiteTestimonial(models.Model):
    _name = 'website.testimonial'
    _description = 'Website Testimonial (Our Work)'
    _order = 'sequence, id'

    title = fields.Char('Title / Headline', required=True)
    quote = fields.Text('Quote', required=True)
    author_name = fields.Char('Author Name', required=True)
    author_role = fields.Char('Author Role / Title')
    company_name = fields.Char('Company Name')
    sequence = fields.Integer('Sequence', default=10)
    active = fields.Boolean('Active', default=True)
