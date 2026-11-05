from odoo import fields, models


class HrJob(models.Model):
    _inherit = "hr.job"

    screening_pass_mark = fields.Float(
        string="Pass Mark (%)",
        related="survey_id.scoring_success_min",
        readonly=False,
        help="Candidates scoring at or above this percentage are Selected; below it, Not Selected. "
        "Stored on the questionnaire itself.",
    )
    screening_pass_stage_id = fields.Many2one(
        "hr.recruitment.stage",
        string="Stage if Selected",
        help="Applicant moves here automatically when the questionnaire is passed "
        "(e.g. 'Initial Interview'). Leave empty to keep the current stage.",
    )
    screening_fail_stage_id = fields.Many2one(
        "hr.recruitment.stage",
        string="Stage if Not Selected",
        help="Applicant moves here automatically when the questionnaire is failed. "
        "Leave empty to keep the current stage.",
    )
    screening_auto_refuse = fields.Boolean(
        string="Auto-refuse if Not Selected",
        help="Refuse (archive) the application automatically when the score is below the pass mark.",
    )
    screening_refuse_reason_id = fields.Many2one(
        "hr.applicant.refuse.reason",
        string="Refuse Reason",
    )
    screening_auto_send = fields.Boolean(
        string="Email Link to New Applicants",
        help="When a new applicant with an email address is created for this job, "
        "email the screening link automatically.",
    )
    screening_deadline_days = fields.Integer(
        string="Days to Answer",
        default=7,
        help="The personal link expires after this many days.",
    )
    screening_review_required = fields.Boolean(
        string="Reviewer marks written answers",
        default=True,
        help="After the candidate submits, a reviewer gives 0-3 marks to each written answer. "
        "The result is decided only after the review is confirmed. "
        "Untick to decide immediately from self-ratings only.",
    )
    screening_review_weight = fields.Float(
        string="Weight of reviewer marks (%)",
        default=70.0,
        help="Final score = this % from reviewer marks + the rest from self-ratings and experience.",
    )
    screening_notify_recruiter = fields.Boolean(
        string="To-do for Recruiter if Selected",
        default=True,
        help="Create a 'Schedule initial interview' activity for the recruiter when a candidate passes.",
    )
