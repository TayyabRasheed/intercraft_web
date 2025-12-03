from odoo import models, fields, api


class TeamMember(models.Model):
    _name = 'website.team.member'
    _description = 'Team Member'
    _inherit = ['image.mixin']
    _order = 'sequence, id'

    name = fields.Char('Name', required=True)
    role = fields.Char('Role', required=True)
    image = fields.Image('Photo', max_width=1024, max_height=1024)
    # image = fields.Image('Photo')
    linkedin_url = fields.Char('LinkedIn URL')
    tag_ids = fields.Many2many('website.team.tag', string='Tags')
    sequence = fields.Integer('Sequence', default=10)
    active = fields.Boolean('Active', default=True)