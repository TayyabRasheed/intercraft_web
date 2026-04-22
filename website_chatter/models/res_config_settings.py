from odoo import fields, models, api


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    api_chatter = fields.Char(
        string="Chat API Endpoint",
        config_parameter='website_chatter.api_chatter',

    )
