# -*- coding: utf-8 -*-

from odoo import models, fields


class WebsiteProject(models.Model):
    _name = 'website.project'
    _description = 'Website Project (Our Work)'
    _order = 'sequence, id'

    name = fields.Char('Name', required=True)
    title = fields.Char('Title', help='Display title; defaults to Name if empty')
    description = fields.Text('Description')
    url = fields.Char('URL', help='Link for "Learn More" (e.g. /our-work/aseyl or external URL)')
    image = fields.Binary('Project Image', attachment=True)
    logo = fields.Binary('Logo / Icon', attachment=True, help='Small logo in card header')
    tag_ids = fields.Many2many(
        'website.project.tag',
        'website_project_tag_rel',
        'project_id',
        'tag_id',
        string='Tags'
    )
    badge = fields.Char('Badge Label', help='e.g. AI PORTAL, DASHBOARD, WEBSITE')
    badge_style = fields.Char('Badge CSS', default='website', help='One of: ai, dashboard, website')
    sequence = fields.Integer('Sequence', default=10)
    active = fields.Boolean('Active', default=True)
