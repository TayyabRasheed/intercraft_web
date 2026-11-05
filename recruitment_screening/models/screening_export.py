import base64
import io

import xlsxwriter

from odoo import _, fields, models
from odoo.exceptions import UserError

from .screening_review import format_answer


class HrApplicant(models.Model):
    _inherit = "hr.applicant"

    def action_export_screening_xlsx(self):
        """Excel file with the screening result, every answer and the reviewer marks."""
        applicants = self.filtered("screening_input_id")
        if not applicants:
            raise UserError(_("None of the selected applicants has submitted the screening questionnaire yet."))
        state_labels = dict(self._fields["screening_state"]._description_selection(self.env))
        score_labels = dict(self.env["hr.applicant.screening.review"]._fields["score"]._description_selection(self.env))

        buffer = io.BytesIO()
        book = xlsxwriter.Workbook(buffer, {"in_memory": True})
        bold = book.add_format({"bold": True, "bg_color": "#E9ECEF", "border": 1, "text_wrap": True, "valign": "top"})
        wrap = book.add_format({"text_wrap": True, "valign": "top", "border": 1})
        num = book.add_format({"num_format": "0.0", "valign": "top", "border": 1})
        warn = book.add_format({"text_wrap": True, "valign": "top", "border": 1, "bg_color": "#FFF3CD"})

        def sheet(name, headers, widths):
            ws = book.add_worksheet(name)
            for col, (head, width) in enumerate(zip(headers, widths)):
                ws.write(0, col, head, bold)
                ws.set_column(col, col, width)
            ws.freeze_panes(1, 0)
            ws.autofilter(0, 0, 0, len(headers) - 1)
            return ws

        # 1. Summary - one row per applicant
        summary = sheet(
            _("Summary"),
            [_("Candidate"), _("Email"), _("Job Position"), _("Result"), _("Final Score (%)"), _("Pass Mark (%)"),
             _("Self-rating Marks"), _("Max Marks"), _("Self-rating (%)"), _("Reviewer Score (%)"),
             _("Reviewed"), _("Over-claims"), _("Submitted On")],
            [26, 28, 26, 16, 14, 13, 14, 11, 14, 16, 12, 12, 20],
        )
        # 2. All answers - every question the candidate answered
        answers_ws = sheet(
            _("All Answers"),
            [_("Candidate"), _("Section"), _("Question"), _("Answer"), _("Marks")],
            [24, 30, 50, 70, 8],
        )
        # 3. Reviewer marks - written answers
        review_ws = sheet(
            _("Reviewer Marks"),
            [_("Candidate"), _("Section"), _("Question"), _("Candidate's Answer"), _("Other Answers in this Topic"),
             _("Self-rating (1-10)"), _("Reviewer Marks (0-3)"), _("Over-claim"), _("Reviewer Comment")],
            [24, 26, 40, 60, 40, 12, 22, 11, 40],
        )

        sections_ws = sheet(
            _("Section Scores"),
            [_("Candidate"), _("Section"), _("Sub-section"), _("Marks"), _("Max Marks"), _("%")],
            [24, 34, 30, 10, 11, 10],
        )
        row_s = row_a = row_r = row_c = 1
        for app in applicants.sudo():
            name = app.partner_name or app.display_name
            user_input = app.screening_input_id
            submitted = user_input.end_datetime and fields.Datetime.context_timestamp(self, user_input.end_datetime)
            summary.write_row(row_s, 0, [
                name, app.email_from or "", app.job_id.name or "", state_labels.get(app.screening_state, ""),
            ], wrap)
            pending = app.screening_state == "review"  # final / reviewer score not known yet
            summary.write(row_s, 4, "" if pending else app.screening_score, wrap if pending else num)
            summary.write(row_s, 5, app.screening_pass_mark, num)
            summary.write_row(row_s, 6, [app.screening_points, app.screening_max_points, app.screening_rating_score], num)
            summary.write(row_s, 9, "" if pending else app.screening_review_score, wrap if pending else num)
            summary.write_row(row_s, 10, [
                _("Yes") if app.screening_review_done else _("No"),
                app.screening_overclaim_count,
                submitted.strftime("%Y-%m-%d %H:%M") if submitted else "",
            ], wrap)
            row_s += 1

            lines = user_input.user_input_line_ids
            for question in user_input.survey_id.question_ids.filtered(lambda q: not q.is_page).sorted(
                lambda q: (q.page_id.sequence, q.sequence, q.id)
            ):
                q_lines = lines.filtered(lambda l, q=question: l.question_id == q)
                if not q_lines and question not in user_input.predefined_question_ids:
                    continue  # hidden question (e.g. after answering "No")
                value = format_answer(q_lines) or _("(no answer)")
                answers_ws.write_row(row_a, 0, [name, question.page_id.title or "", question.title or "", value], wrap)
                answers_ws.write(row_a, 4, sum(q_lines.mapped("answer_score")), num)
                row_a += 1

            for review in app.screening_review_ids:
                fmt = warn if review.overclaim else wrap
                review_ws.write_row(row_r, 0, [
                    name, review.section or "", review.question or "", review.answer or "",
                    review.topic_answers or "", review.self_rating or "",
                    score_labels.get(review.score, "") if review.score is not False else _("Not marked"),
                    _("Yes") if review.overclaim else "", review.comment or "",
                ], fmt)
                row_r += 1
            if not user_input._screening_gate_rejected():
                for group in user_input.sudo()._screening_section_scores():
                    sections_ws.write_row(row_c, 0, [name, group["title"], _("Total")], bold)
                    sections_ws.write_row(row_c, 3, [
                        group["points"], group["max"], round(group["points"] / group["max"] * 100, 1)], num)
                    row_c += 1
                    for child in group["children"]:
                        sections_ws.write_row(row_c, 0, [name, group["title"], child["title"]], wrap)
                        sections_ws.write_row(row_c, 3, [
                            child["points"], child["max"], round(child["points"] / child["max"] * 100, 1)], num)
                        row_c += 1
        book.close()

        if len(applicants) == 1:
            filename = "Screening - %s.xlsx" % (applicants.partner_name or applicants.display_name)
        else:
            filename = "Screening - %s applicants.xlsx" % len(applicants)
        filename = filename.replace("/", "-")
        attachment = self.env["ir.attachment"].create({
            "name": filename,
            "datas": base64.b64encode(buffer.getvalue()),
            "mimetype": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        })
        return {
            "type": "ir.actions.act_url",
            "url": "/web/content/%s?download=true" % attachment.id,
            "target": "self",
        }


class ScreeningReview(models.Model):
    _inherit = "hr.applicant.screening.review"

    def action_export_screening_xlsx(self):
        """'Export to Excel' on the Review Answers screen."""
        applicants = self.applicant_id
        if not applicants and self.env.context.get("screening_applicant_id"):
            applicants = self.env["hr.applicant"].browse(self.env.context["screening_applicant_id"])
        return applicants.action_export_screening_xlsx()
