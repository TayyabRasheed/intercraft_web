from odoo import fields , models

class HrDepartmentExt(models.Model):
    _inherit = 'hr.department'

    image_department = fields.Binary(
        string="Department Image"
    )