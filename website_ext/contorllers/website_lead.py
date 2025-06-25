from odoo import http
from odoo.http import request


class WebsiteFormExt(http.Controller):
    def _create_partner_and_lead(self, **kwargs):
        email_from = kwargs.get('email')
        if not email_from:
            return None, None

        partner = request.env['res.partner']
        lead = request.env['crm.lead']
        partner = partner.search([('email', '=', email_from)], limit=1)
        if not partner:
            partner = partner.sudo().create({
                'name': kwargs.get('name'),
                'email': email_from,
                'phone': kwargs.get('phone'),
                'is_company': False,
            })
        lead = lead.sudo().create({
            'name': kwargs.get('subject'),
            'partner_id': partner.id,
            'email_from': partner.email,
            'phone': partner.phone,
            'description': kwargs.get('message'),
        })
        return partner, lead

    @http.route('/website/crm/', type='http', auth="public", methods=['POST'], website=True, csrf=False)
    def website_form(self, **kwargs):
        self._create_partner_and_lead(**kwargs)

        redirect_url = '/contactus-thank-you'
        return request.redirect(redirect_url)