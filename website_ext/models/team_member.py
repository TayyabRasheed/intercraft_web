from odoo import models, fields, api


class TeamMember(models.Model):
    _name = 'website.team.member'
    _description = 'Team Member'
    _order = 'sequence, id'

    name = fields.Char('Name', required=True)
    role = fields.Char('Role', required=True)
    image = fields.Image('Photo', max_width=400, max_height=400)
    linkedin_url = fields.Char('LinkedIn URL')
    sequence = fields.Integer('Sequence', default=10)
    active = fields.Boolean('Active', default=True)