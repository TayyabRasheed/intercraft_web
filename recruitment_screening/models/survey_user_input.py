import logging

from odoo import models

from .hr_applicant import max_points_for_questions

_logger = logging.getLogger(__name__)


class SurveyUserInput(models.Model):
    _inherit = "survey.user_input"

    def _screening_gate_rejected(self):
        """The 'closing' questions (e.g. 'Willing to work on site?') the candidate answered with a
        non-opening answer such as 'No', when those questions are set to reject.
        """
        self.ensure_one()
        rejected = self.env["survey.question"]
        closing = self.survey_id.question_ids.filtered(
            lambda q: q.screening_gate_closes_form and q.screening_gate_reject and q._screening_is_gate()
        )
        for question in closing:
            chosen = self.user_input_line_ids.filtered(
                lambda line: line.question_id == question and line.suggested_answer_id
            ).suggested_answer_id
            if chosen and not (chosen & question._screening_gate_answers()):
                rejected |= question
        return rejected

    def _screening_section_scores(self):
        """Marks per main section, e.g. [{'title': 'Technical Skills', 'points': 38, 'max': 60,
        'children': [{'title': 'Linux', 'points': 8, 'max': 10}, ...]}].

        A section without questions of its own is a main section; the sections with questions that
        follow it are its sub-sections (same grouping as on the candidate's form). Sections without
        any marks (e.g. the eligibility check) are left out.
        """
        self.ensure_one()
        lines = self.user_input_line_ids
        asked = self.predefined_question_ids

        def measure(page):
            questions = page.question_ids & asked
            return {
                "title": page.title or "",
                "points": sum(lines.filtered(lambda line: line.question_id in questions).mapped("answer_score")),
                "max": max_points_for_questions(questions),
            }

        groups = []
        current = None
        for page in self.survey_id.page_ids.sorted(lambda p: (p.sequence, p.id)):
            if not page.question_ids:
                current = {"title": page.title or "", "points": 0.0, "max": 0.0, "children": []}
                groups.append(current)
            elif current:
                current["children"].append(measure(page))
            else:
                groups.append(dict(measure(page), children=[]))
        result = []
        for group in groups:
            if group["children"]:
                group["children"] = [c for c in group["children"] if c["max"] > 0]
                group["points"] = sum(c["points"] for c in group["children"])
                group["max"] = sum(c["max"] for c in group["children"])
            if group["max"] > 0:
                result.append(group)
        return result

    def _mark_done(self):
        res = super()._mark_done()
        for user_input in self.sudo():
            applicant = user_input.applicant_id
            if not applicant or user_input.test_entry:
                continue
            if applicant.job_id.survey_id != user_input.survey_id:
                continue
            try:
                with self.env.cr.savepoint():
                    applicant._screening_on_submit(user_input)
            except Exception:  # noqa: BLE001 - the candidate's submission must always succeed
                _logger.exception("Screening: could not process submission for applicant %s", applicant.id)
        return res
