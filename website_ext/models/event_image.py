from odoo import models, fields, api
from PIL import Image
import base64
import io


class EventImage(models.Model):
    _name = 'website.event.image'
    _description = 'Event Images for People Culture Section'
    _order = 'sequence, id'

    name = fields.Char('Name', required=True)
    image = fields.Binary('Image', required=True)
    sequence = fields.Integer('Sequence', default=10)
    is_active = fields.Boolean('Active', default=True)
    orientation = fields.Selection([
        ('portrait', 'Portrait'),
        ('landscape', 'Landscape')
    ], string='Orientation', compute='_compute_orientation', store=True)
    
    @api.depends('image')
    def _compute_orientation(self):
        for record in self:
            if record.image:
                try:
                    image_data = base64.b64decode(record.image)
                    img = Image.open(io.BytesIO(image_data))
                    width, height = img.size
                    record.orientation = 'landscape' if width > height else 'portrait'
                except:
                    record.orientation = 'portrait'
            else:
                record.orientation = 'portrait'