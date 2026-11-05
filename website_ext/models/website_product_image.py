# -*- coding: utf-8 -*-

import re

from odoo import api, fields, models
from odoo.exceptions import ValidationError


class WebsiteProductImage(models.Model):
    _name = 'website.product.image'
    _description = 'Product Case Study Image'
    _order = 'name, id'

    name = fields.Char(
        'Name',
        required=True,
        help='Short name used in the case study HTML. Example: dashboard',
    )
    image = fields.Binary('Image', required=True, attachment=True)
    active = fields.Boolean('Active', default=True)
    image_url = fields.Char('HTML path', compute='_compute_image_url')

    _sql_constraints = [
        ('name_uniq', 'unique(name)', 'Image name must be unique.'),
    ]

    @api.depends('name')
    def _compute_image_url(self):
        for record in self:
            record.image_url = '/case-image/%s' % record.name if record.name else False

    @api.constrains('name')
    def _check_name(self):
        pattern = re.compile(r'^[A-Za-z0-9][A-Za-z0-9_-]*$')
        for record in self:
            if not pattern.match(record.name or ''):
                raise ValidationError(
                    'Use a short name with letters, numbers, hyphens, or underscores. '
                    'Example: dashboard'
                )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name'):
                vals['name'] = vals['name'].strip()
        return super().create(vals_list)

    def write(self, vals):
        if vals.get('name'):
            vals['name'] = vals['name'].strip()
        return super().write(vals)
