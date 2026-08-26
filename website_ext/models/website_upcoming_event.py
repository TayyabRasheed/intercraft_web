# -*- coding: utf-8 -*-

from odoo import api, fields, models
from odoo.http import request


class WebsiteUpcomingEvent(models.Model):
    _name = 'website.upcoming.event'
    _description = 'Upcoming Event Popup'
    _order = 'id desc'

    name = fields.Char('Event Name', required=True)
    image = fields.Binary('Popup Image', attachment=True, required=True)
    active = fields.Boolean('Active', default=True)

    @api.model
    def get_active_popup(self):
        """Return the active event popup for the homepage."""
        if request and request.params.get('enable_editor'):
            return self.browse()
        path = '/'
        try:
            path = request.httprequest.path or '/'
        except Exception:
            pass
        if not self._is_homepage(path):
            return self.browse()
        return self.sudo().search([('active', '=', True)], limit=1).filtered('image')

    def _is_homepage(self, path):
        if path in ('/', ''):
            return True
        try:
            homepage = (request.website.homepage_url or '/').rstrip('/') or '/'
            return path.rstrip('/') == homepage
        except Exception:
            return False
