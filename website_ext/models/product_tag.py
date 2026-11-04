# -*- coding: utf-8 -*-

from odoo import models, fields


class ProductTag(models.Model):
    _name = 'website.product.tag'
    _description = 'Product Tag'

    name = fields.Char('Tag', required=True)
