import logging
from datetime import timedelta

from markupsafe import Markup, escape

from odoo import _, api, fields, models
from odoo.exceptions import UserError

from .screening_review import REVIEW_MAX

_logger = logging.getLogger(__name__)


def max_points_for_questions(questions):
    """Highest score a candidate can reach, using the same rules as Odoo's survey scoring.

    * single choice  -> best option's score (e.g. self-rating 1..5 -> 5)
    * multiple choice -> sum of all positive option scores
    * other scored questions -> the question's own score
    """
    total = 0.0
    for q in questions:
        if q.question_type == "simple_choice":
            total += max([s for s in q.suggested_answer_ids.mapped("answer_score") if s > 0], default=0)
        elif q.question_type == "multiple_choice":
            total += sum(s for s in q.suggested_answer_ids.mapped("answer_score") if s > 0)
        elif q.is_scored_question:
            total += q.answer_score
    return total


class HrApplicant(models.Model):
    _inherit = "hr.applicant"

    screening_state = fields.Selection(
        [
            ("not_sent", "Not Sent"),
            ("pending", "Waiting for Answers"),
            ("review", "Review Pending"),
            ("selected", "Selected"),
            ("not_selected", "Not Selected"),
        ],
        string="Screening Result",
        compute="_compute_screening",
        store=True,
        tracking=True,
    )
    screening_input_id = fields.Many2one(
        "survey.user_input", string="Screening Answers", compute="_compute_screening", store=True
    )
    # Self-ratings + experience (automatic, from the questionnaire)
    screening_rating_score = fields.Float(
        string="Self-rating Score (%)", compute="_compute_screening", store=True, digits=(5, 1)
    )
    screening_points = fields.Float(string="Self-rating Marks", compute="_compute_screening", store=True)
    screening_max_points = fields.Float(string="Self-rating Total", compute="_compute_screening", store=True)
    # Reviewer marks on written answers
    screening_review_ids = fields.One2many("hr.applicant.screening.review", "applicant_id", string="Answer Reviews")
    screening_review_done = fields.Boolean(string="Review Confirmed", copy=False, tracking=True)
    screening_review_score = fields.Float(
        string="Reviewer Score (%)", compute="_compute_screening", store=True, digits=(5, 1)
    )
    screening_review_progress = fields.Char(string="Answers Reviewed", compute="_compute_screening", store=True)
    screening_overclaim_count = fields.Integer(string="Over-claims", compute="_compute_screening", store=True)
    # Final
    screening_score = fields.Float(
        string="Screening Score (%)", compute="_compute_screening", store=True, digits=(5, 1)
    )
    screening_pass_mark = fields.Float(related="job_id.screening_pass_mark", string="Pass Mark (%)")
    screening_url = fields.Char(string="Screening Link", copy=False, readonly=True)
    screening_section_scores = fields.Html(
        string="Section Scores", compute="_compute_screening_section_scores", sanitize=False
    )

    # ------------------------------------------------------------------
    # Compute
    # ------------------------------------------------------------------
    def _screening_uses_review(self):
        self.ensure_one()
        return bool(self.job_id.screening_review_required and self.screening_review_ids)

    @api.depends(
        "job_id.survey_id",
        "job_id.survey_id.scoring_success_min",
        "job_id.screening_review_required",
        "job_id.screening_review_weight",
        "response_ids.state",
        "response_ids.survey_id",
        "response_ids.scoring_total",
        "response_ids.scoring_percentage",
        "screening_review_ids.score",
        "screening_review_ids.overclaim",
        "screening_review_done",
    )
    def _compute_screening(self):
        for app in self:
            survey = app.job_id.survey_id
            responses = app.response_ids.filtered(
                lambda r: survey and r.survey_id == survey and not r.test_entry
            )
            done = responses.filtered(lambda r: r.state == "done").sorted(
                lambda r: r.end_datetime or r.create_date, reverse=True
            )
            reviews = app.screening_review_ids
            scored = reviews.filtered(lambda r: r.score is not False)
            app.screening_review_progress = f"{len(scored)} / {len(reviews)}" if reviews else False
            app.screening_overclaim_count = len(reviews.filtered("overclaim"))
            app.screening_review_score = (
                sum(int(r.score) for r in scored) / (len(reviews) * REVIEW_MAX) * 100 if reviews else 0.0
            )
            if not done:
                app.screening_input_id = False
                app.screening_rating_score = app.screening_points = app.screening_max_points = 0.0
                app.screening_score = 0.0
                app.screening_state = "pending" if responses else "not_sent"
                continue
            last = done[0]
            app.screening_input_id = last
            app.screening_rating_score = last.scoring_percentage
            app.screening_points = last.scoring_total
            app.screening_max_points = max_points_for_questions(last.predefined_question_ids)
            if last._screening_gate_rejected():
                # e.g. "Willing to work on site?" answered No: Not Selected, nothing to review
                app.screening_score = last.scoring_percentage
                app.screening_state = "not_selected"
                continue
            if app.job_id.screening_review_required and reviews:
                weight = min(max(app.job_id.screening_review_weight, 0.0), 100.0) / 100.0
                app.screening_score = weight * app.screening_review_score + (1 - weight) * last.scoring_percentage
                if not app.screening_review_done:
                    app.screening_state = "review"
                    continue
            else:
                app.screening_score = last.scoring_percentage
            app.screening_state = (
                "selected" if app.screening_score >= survey.scoring_success_min else "not_selected"
            )

    # ------------------------------------------------------------------
    # Link generation / sending
    # ------------------------------------------------------------------
    @api.depends("screening_input_id", "screening_points")
    def _compute_screening_section_scores(self):
        for app in self:
            app.screening_section_scores = app._screening_section_html()

    def _screening_section_groups(self):
        """Section-wise marks of the submitted questionnaire (empty if closed early by a gate answer)."""
        self.ensure_one()
        user_input = self.screening_input_id.sudo()
        if not user_input or user_input._screening_gate_rejected():
            return []
        return user_input._screening_section_scores()

    def _screening_section_html(self):
        self.ensure_one()
        groups = self._screening_section_groups()
        if not groups:
            return False
        rows = []
        for group in groups:
            rows.append(Markup(
                "<tr><td><b>%s</b></td><td class='text-end text-nowrap'><b>%s / %s</b></td>"
                "<td class='text-end text-nowrap'><b>%s%%</b></td></tr>"
            ) % (group["title"], _fmt(group["points"]), _fmt(group["max"]), _fmt(_pct(group["points"], group["max"]))))
            for child in group["children"]:
                rows.append(Markup(
                    "<tr class='text-muted'><td class='ps-4'>%s</td><td class='text-end text-nowrap'>%s / %s</td>"
                    "<td class='text-end text-nowrap'>%s%%</td></tr>"
                ) % (child["title"], _fmt(child["points"]), _fmt(child["max"]), _fmt(_pct(child["points"], child["max"]))))
        return Markup("<table class='table table-sm table-borderless mb-0'><tbody>%s</tbody></table>") % Markup("").join(rows)

    def _screening_ensure_partner(self):
        self.ensure_one()
        if not self.partner_id:
            if not self.partner_name:
                raise UserError(_("Please enter the applicant's name first."))
            partner = self.env["res.partner"].sudo().create(
                {
                    "is_company": False,
                    "name": self.partner_name,
                    "email": self.email_from,
                    "phone": self.partner_phone,
                }
            )
            if "candidate_id" in self._fields:  # Odoo 18: the contact lives on the Candidate record
                self.sudo().candidate_id.partner_id = partner
            else:  # Odoo 17: on the applicant itself
                self.sudo().partner_id = partner
        return self.partner_id

    def _screening_get_or_create_input(self):
        """Return an open personal answer (link) for this applicant, creating one if needed."""
        self.ensure_one()
        survey = self.job_id.survey_id
        if not survey:
            raise UserError(_("Set an Interview Form (questionnaire) on the job position first."))
        partner = self._screening_ensure_partner()
        now = fields.Datetime.now()
        open_inputs = self.sudo().response_ids.filtered(
            lambda r: r.survey_id == survey
            and r.state in ("new", "in_progress")
            and not r.test_entry
            and (not r.deadline or r.deadline > now)
        )
        if open_inputs:
            return open_inputs.sorted("create_date", reverse=True)[0]
        days = self.job_id.screening_deadline_days or 7
        return survey.sudo()._create_answer(
            partner=partner,
            check_attempts=False,
            applicant_id=self.id,
            deadline=now + timedelta(days=days),
        )

    def _screening_full_url(self, user_input):
        return self.get_base_url().rstrip("/") + user_input.get_start_url()

    def _screening_make_link(self):
        """Create (or reuse) the personal link and store it on the applicant. Never sends an email:
        only "Email Screening Link" does that."""
        self.ensure_one()
        app = self.with_context(
            mail_notrack=True, mail_create_nosubscribe=True, mail_post_autofollow=False,
            mail_auto_subscribe_no_notify=True,
        )
        user_input = app._screening_get_or_create_input()
        url = app._screening_full_url(user_input)
        if app.screening_url != url:
            app.screening_url = url
            # internal note only: no recipients, so nothing is emailed
            app.message_post(
                body=Markup("%s<br/><a href='%s'>%s</a>")
                % (_("Screening link created. Valid until %s.", user_input.deadline or "-"), url, url),
                message_type="comment",
                subtype_xmlid="mail.mt_note",
                partner_ids=[],
            )
        return url

    def action_generate_screening_link(self):
        for app in self:
            app._screening_make_link()
        return True

    def action_generate_screening_bulk(self):
        """Create the personal link of every selected applicant (list view > Actions). No emails."""
        created = 0
        skipped = []
        for app in self:
            name = app.partner_name or app.display_name
            if not app.active or not app.job_id.survey_id:
                skipped.append(_("%s (no interview form on the job)", name))
            elif app.screening_state in ("review", "selected", "not_selected"):
                skipped.append(_("%s (already answered)", name))
            else:
                try:
                    with self.env.cr.savepoint():
                        app._screening_make_link()
                    created += 1
                except Exception as error:  # noqa: BLE001 - one failure must not stop the others
                    _logger.exception("Screening: could not create the link of applicant %s", app.id)
                    skipped.append(_("%s (error: %s)", name, getattr(error, "args", [""])[0]))
        message = _("Screening link created for %s applicant(s). No email was sent.", created)
        if skipped:
            message += " " + _("Skipped %s: %s", len(skipped), "; ".join(skipped[:15]))
            if len(skipped) > 15:
                message += " ..."
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Screening links"),
                "message": message,
                "type": "success" if created and not skipped else "warning",
                "sticky": bool(skipped),
                "next": {"type": "ir.actions.act_window_close"},
            },
        }

    def _screening_send_email(self):
        template = self.env.ref(
            "hr_recruitment_survey.mail_template_applicant_interview_invite", raise_if_not_found=False
        )
        if not template:
            raise UserError(_("The interview invitation email template is missing."))
        for app in self:
            if not (app.email_from or app.partner_id.email):
                raise UserError(_("Applicant %s has no email address.", app.partner_name or app.display_name))
            user_input = app._screening_get_or_create_input()
            app.screening_url = app._screening_full_url(user_input)
            template.sudo().send_mail(user_input.id, email_layout_xmlid="mail.mail_notification_light")
            app.message_post(body=_("Screening questionnaire emailed to %s.", app.email_from or app.partner_id.email))

    def action_email_screening_link(self):
        self._screening_send_email()
        return True

    def action_email_screening_bulk(self):
        """Email the screening link to every selected applicant (list view > Actions)."""
        sent = 0
        skipped = []
        for app in self:
            name = app.partner_name or app.display_name
            if not app.active or not app.job_id.survey_id:
                skipped.append(_("%s (no interview form on the job)", name))
            elif not (app.email_from or app.partner_id.email):
                skipped.append(_("%s (no email)", name))
            elif app.screening_state in ("review", "selected", "not_selected"):
                skipped.append(_("%s (already answered)", name))
            else:
                try:
                    with self.env.cr.savepoint():
                        app._screening_send_email()
                    sent += 1
                except Exception as error:  # noqa: BLE001 - one failure must not stop the others
                    _logger.exception("Screening: could not email applicant %s", app.id)
                    skipped.append(_("%s (error: %s)", name, getattr(error, "args", [""])[0]))
        message = _("Screening link emailed to %s applicant(s).", sent)
        if skipped:
            message += " " + _("Skipped %s: %s", len(skipped), "; ".join(skipped[:15]))
            if len(skipped) > 15:
                message += " ..."
        return {
            "type": "ir.actions.client",
            "tag": "display_notification",
            "params": {
                "title": _("Screening links"),
                "message": message,
                "type": "success" if sent and not skipped else "warning",
                "sticky": bool(skipped),
                "next": {"type": "ir.actions.act_window_close"},
            },
        }

    @api.model_create_multi
    def create(self, vals_list):
        applicants = super().create(vals_list)
        for app in applicants:
            job = app.job_id
            if job.screening_auto_send and job.survey_id and (app.email_from or app.partner_id.email):
                try:
                    with self.env.cr.savepoint():
                        app._screening_send_email()
                except Exception:  # noqa: BLE001 - never block an application because of email
                    _logger.exception("Screening: could not auto-send questionnaire to applicant %s", app.id)
        return applicants

    # ------------------------------------------------------------------
    # Result handling
    # ------------------------------------------------------------------
    def _screening_create_reviews(self, user_input):
        """One review line per written answer the reviewer must mark."""
        self.ensure_one()
        asked = user_input.predefined_question_ids
        # Odoo drops conditional questions that stayed hidden (candidate answered "No") from
        # the asked questions; keep them here so they count as 0 marks instead of vanishing.
        hidden = user_input.survey_id.question_ids.filtered(
            lambda q: q.triggering_answer_ids and q.page_id and q.page_id in asked.page_id
        )
        questions = (asked | hidden).filtered("screening_review").sorted("sequence")
        self.screening_review_ids.unlink()
        self.screening_review_done = False
        chosen = user_input.user_input_line_ids.suggested_answer_id
        vals = []
        for q in questions:
            line = {"applicant_id": self.id, "user_input_id": user_input.id, "question_id": q.id}
            # Conditional question that stayed hidden (e.g. candidate answered "No"):
            # nothing to review, it counts as 0 marks automatically.
            if q.triggering_answer_ids and not (q.triggering_answer_ids & chosen):
                line.update(score="0", comment=_("Not shown to the candidate (answered No) - 0 marks automatically"))
            vals.append(line)
        self.env["hr.applicant.screening.review"].sudo().create(vals)

    def _screening_on_submit(self, user_input):
        """Called when the candidate submits the questionnaire."""
        self.ensure_one()
        if user_input._screening_gate_rejected():
            self.invalidate_recordset()
            self._apply_screening_result()
            return
        if self.job_id.screening_review_required:
            self._screening_create_reviews(user_input)
        if self.screening_review_ids:
            self.invalidate_recordset()
            body = Markup(
                "<p><b>%s</b></p><ul><li>%s: <b>%s / %s</b> (%s%%)</li><li>%s: %s</li></ul><p>%s</p>"
            ) % (
                _("Screening questionnaire completed - waiting for review"),
                _("Self-rating marks"),
                _fmt(self.screening_points),
                _fmt(self.screening_max_points),
                _fmt(self.screening_rating_score),
                _("Written answers to review"),
                len(self.screening_review_ids),
                _("Open 'Review Answers', give 0-3 marks to each answer, then click 'Confirm Review'."),
            )
            self.message_post(body=body, author_id=self.env.ref("base.partner_root").id)
            reviewer = self.user_id or self.job_id.user_id
            if reviewer:
                self.activity_schedule(
                    "mail.mail_activity_data_todo",
                    summary=_("Review screening answers"),
                    note=_("Mark the written answers and confirm the review."),
                    user_id=reviewer.id,
                )
        else:
            self._apply_screening_result()

    def action_open_screening_review(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": _("Review Answers: %s", self.partner_name or self.display_name),
            "res_model": "hr.applicant.screening.review",
            "view_mode": "tree,form",
            "views": [
                (self.env.ref("recruitment_screening.screening_review_view_list").id, "tree"),
                (self.env.ref("recruitment_screening.screening_review_view_form").id, "form"),
            ],
            "domain": [("applicant_id", "=", self.id)],
            "context": {"create": False, "delete": False, "screening_applicant_id": self.id},
        }

    def action_confirm_screening_review(self):
        for app in self:
            missing = app.screening_review_ids.filtered(lambda r: r.score is False)
            if missing:
                raise UserError(
                    _("%s answer(s) still have no reviewer marks. Mark every answer (0 is allowed) first.", len(missing))
                )
            app.screening_review_done = True
            app._apply_screening_result()
        return True

    def action_reopen_screening_review(self):
        self.write({"screening_review_done": False})
        return True

    def _apply_screening_result(self):
        self.ensure_one()
        self.invalidate_recordset()
        job = self.job_id
        survey = self.screening_input_id.survey_id or job.survey_id
        passed = self.screening_state == "selected"
        result = _("Selected") if passed else _("Not Selected")
        colour = "text-success" if passed else "text-danger"
        items = [
            Markup("<li>%s: <b>%s / %s</b> (%s%%)</li>")
            % (_("Self-rating marks"), _fmt(self.screening_points), _fmt(self.screening_max_points), _fmt(self.screening_rating_score))
        ]
        for group in self._screening_section_groups():
            items.append(
                Markup("<li>%s: <b>%s / %s</b> (%s%%)</li>")
                % (group["title"], _fmt(group["points"]), _fmt(group["max"]), _fmt(_pct(group["points"], group["max"])))
            )
        if self.screening_review_ids and job.screening_review_required:
            items.append(
                Markup("<li>%s: %s%% (%s)</li>")
                % (_("Reviewer marks on written answers"), _fmt(self.screening_review_score), self.screening_review_progress)
            )
            items.append(
                Markup("<li>%s: %s%% %s + %s%% %s</li>")
                % (_("Weighting"), _fmt(job.screening_review_weight), _("reviewer"),
                   _fmt(100 - job.screening_review_weight), _("self-rating"))
            )
            if self.screening_overclaim_count:
                items.append(
                    Markup("<li class='text-warning'>%s: <b>%s</b></li>")
                    % (_("Over-claims (self-rating much higher than the answer shows)"), self.screening_overclaim_count)
                )
        rejected = self.screening_input_id._screening_gate_rejected() if self.screening_input_id else False
        if rejected:
            items.append(
                Markup("<li class='text-danger'>%s: <b>%s</b></li>")
                % (_("Questionnaire closed early"), escape(", ".join(rejected.mapped("title"))))
            )
        items.append(Markup("<li>%s: <b>%s%%</b> (%s %s%%)</li>")
                     % (_("Final score"), _fmt(self.screening_score), _("pass mark"), _fmt(survey.scoring_success_min)))
        items.append(Markup("<li>%s: <b class='%s'>%s</b></li>") % (_("Result"), colour, escape(result)))
        body = Markup("<p><b>%s</b></p><ul>%s</ul>") % (_("Screening result"), Markup("").join(items))
        self.message_post(body=body, author_id=self.env.ref("base.partner_root").id)

        vals = {}
        target_stage = job.screening_pass_stage_id if passed else job.screening_fail_stage_id
        if target_stage and self.stage_id != target_stage:
            vals["stage_id"] = target_stage.id
        if not passed and job.screening_auto_refuse and job.screening_refuse_reason_id:
            vals.update(
                {
                    "refuse_reason_id": job.screening_refuse_reason_id.id,
                    "active": False,
                    "refuse_date": fields.Datetime.now(),
                }
            )
        if vals:
            self.write(vals)
        # close the "review" to-do, if any
        self.activity_ids.filtered(lambda a: a.summary == _("Review screening answers")).action_feedback(
            feedback=_("Review confirmed: %s", result)
        )
        if passed and job.screening_notify_recruiter:
            recruiter = self.user_id or job.user_id
            if recruiter:
                self.activity_schedule(
                    "mail.mail_activity_data_todo",
                    summary=_("Schedule initial interview"),
                    note=_("Passed screening with %s%%.", _fmt(self.screening_score)),
                    user_id=recruiter.id,
                )


def _pct(points, maximum):
    return (points or 0.0) / maximum * 100 if maximum else 0.0


def _fmt(value):
    value = round(value or 0.0, 1)
    return str(int(value)) if value == int(value) else str(value)
