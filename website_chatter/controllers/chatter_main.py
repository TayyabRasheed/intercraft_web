# controllers/main.py
from odoo import http
from odoo.http import request


class ChatConfig(http.Controller):

    @http.route('/web/chat/config', type='json', auth='public')
    def get_chat_config(self):
        api_url = request.env['ir.config_parameter'].sudo().get_param(
            'website_chatter.api_chatter',
            default=''
        )
        return {'api_url': api_url}