from odoo import models, fields


class TeamTag(models.Model):
    _name = 'website.team.tag'
    _description = 'Team Tag'

    name = fields.Char('Tag Name', required=True)
    color = fields.Integer('Color', default=0)