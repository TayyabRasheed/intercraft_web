from odoo import models, fields

class JobApplication(models.Model):
    _inherit = 'hr.applicant'

    current_salary = fields.Float(
        string="Current Salary",
        help="Applicant's current salary"
    )
