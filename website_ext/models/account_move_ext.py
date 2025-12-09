from odoo import _,api, fields, models
from datetime import datetime
from odoo.osv import expression


class AccountAssetExt(models.Model):
    _inherit = 'account.asset'


    employee_id = fields.Many2one('hr.employee',string="Allocated To",help="Specify the partner to whom the asset is allocated.", tracking=True)
    department_to_id = fields.Many2one('hr.department', string="Department", related="employee_id.department_id", store=True)
    email = fields.Char(string="Email Address", related="employee_id.work_email")
    allocation_date = fields.Date(string="Allocation Date")
    allocation_status = fields.Selection([('allocated', 'Allocated'), ('not_allocated', 'Not Allocated')],
                                         string="Allocation Status", default='not_allocated',
                                         help="Specify whether the asset is allocated or not.", tracking=True)

