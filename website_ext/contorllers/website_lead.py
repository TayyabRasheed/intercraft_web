from odoo import http
from odoo.http import request
import json
from odoo.addons.website.controllers.form import WebsiteForm


class WebsiteFormExt(WebsiteForm):

    def _create_partner_and_lead(self, **kwargs):
        email_from = kwargs.get('email_from') or kwargs.get('email')
        if not email_from:
            return None, None

        partner_obj = request.env['res.partner'].sudo()
        lead_obj = request.env['crm.lead'].sudo()

        partner = partner_obj.search([('email', '=', email_from)], limit=1)
        if not partner:
            partner = partner_obj.create({
                'name': kwargs.get('name') or kwargs.get('Your Name'),
                'email': email_from,
                'phone': kwargs.get('phone') or kwargs.get('Phone Number'),
                'is_company': False,
            })

        lead = lead_obj.create({
            'name': kwargs.get('subject') or kwargs.get('name') ,
            'partner_id': partner.id,
            'email_from': partner.email,
            'phone': partner.phone,
            'description': kwargs.get('message'),
        })
        return partner, lead

    @http.route('/website/form/<string:model_name>', type='http', auth="public", methods=['POST'], website=True, csrf=False)
    def website_form(self, model_name, **kwargs):
        response = super().website_form(model_name, **kwargs)
        try:
            response_data = json.loads(response.data)
        except json.JSONDecodeError:
            return response
        is_success = 'error' not in response_data and response_data.get('id')
        if is_success and model_name == 'mail.mail' and kwargs.get('form_source') == 'contact-us':
            self._create_partner_and_lead(**kwargs)

        return response


 # @http.route('/website/crm/', type='http', auth="public", methods=['POST'], website=True, csrf=False)
 #    def website_form(self, **kwargs):
 #        recaptcha_token = kwargs.get('g-recaptcha-response')
 #        secret_key = request.env['ir.config_parameter'].sudo().get_param('captcha_private_key')
 #
 #        if not recaptcha_token:
 #            return request.render("website.403")  # Or return an error message
 #
 #        # Verify with Google
 #        verify_url = "https://www.google.com/recaptcha/api/siteverify"
 #        response = requests.post(verify_url, data={
 #            'secret': secret_key,
 #            'response': recaptcha_token
 #        })
 #        result = response.json()
 #
 #        if not result.get('success'):
 #            return request.render("website.403")
 #
 #        else:
 #            self._create_partner_and_lead(**kwargs)
 #
 #            redirect_url = '/contactus-thank-you'
 #            return request.redirect(redirect_url)