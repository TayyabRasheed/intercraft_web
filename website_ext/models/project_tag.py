# -*- coding: utf-8 -*-

from odoo import models, fields


class ProjectTag(models.Model):
    _name = 'website.project.tag'
    _description = 'Project Tag'

    name = fields.Char('Tag', required=True)
