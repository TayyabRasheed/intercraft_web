from odoo import fields, models, api
from odoo.exceptions import UserError, ValidationError


class HrJobExt(models.Model):
    _inherit = 'hr.job'

    """
     To validate department for publishing a job
    """
    @api.onchange('website_published')
    def check_job_department(self):
        if self.website_published:
            if not self.department_id:
                raise ValidationError('Please select department to publish job')