from odoo import api, fields, models


def format_answer(lines):
    """Readable text for the candidate's answer lines to one question."""
    values = []
    for line in lines.filtered(lambda l: not l.skipped):
        if line.answer_type == "text_box":
            values.append(line.value_text_box or "")
        elif line.answer_type == "char_box":
            values.append(line.value_char_box or "")
        elif line.answer_type == "numerical_box":
            values.append(("%g" % line.value_numerical_box))
        elif line.answer_type == "scale":
            values.append(str(line.value_scale))
        elif line.answer_type == "date":
            values.append(fields.Date.to_string(line.value_date))
        elif line.answer_type == "datetime":
            values.append(fields.Datetime.to_string(line.value_datetime))
        elif line.answer_type == "suggestion":
            value = line.suggested_answer_id.value or ""
            if line.matrix_row_id:
                value = f"{line.matrix_row_id.value}: {value}"
            values.append(value)
    return ", ".join(v for v in values if v)

REVIEW_SCORES = [
    ("0", "0 - Empty or wrong"),
    ("1", "1 - Weak / vague"),
    ("2", "2 - Correct"),
    ("3", "3 - Strong, with real detail"),
]
REVIEW_MAX = 3.0
# Over-claim when the self-rating is this much higher than the answer shows (both on a 0-1 scale)
OVERCLAIM_GAP = 0.4


class ScreeningReview(models.Model):
    _name = "hr.applicant.screening.review"
    _description = "Screening Answer Review"
    _order = "applicant_id, sequence, id"

    applicant_id = fields.Many2one("hr.applicant", required=True, ondelete="cascade", index=True)
    user_input_id = fields.Many2one("survey.user_input", required=True, ondelete="cascade")
    question_id = fields.Many2one("survey.question", string="Question", required=True, ondelete="cascade")
    sequence = fields.Integer(related="question_id.sequence", store=True)
    section = fields.Char(related="question_id.page_id.title", string="Section")
    question = fields.Char(related="question_id.title", string="Question text")
    answer = fields.Text(compute="_compute_answer", string="Candidate's answer")
    topic_answers = fields.Text(compute="_compute_answer", string="Other answers in this topic")
    marking_key = fields.Text(related="question_id.screening_marking_key", string="Marking key")
    self_rating = fields.Integer(compute="_compute_self_rating", string="Self-rating (1-10)", store=True)
    score = fields.Selection(REVIEW_SCORES, string="Reviewer marks")
    comment = fields.Char(string="Reviewer comment")
    overclaim = fields.Boolean(compute="_compute_overclaim", store=True, string="Over-claim")

    @api.depends("user_input_id", "question_id")
    def _compute_answer(self):
        for line in self.sudo():
            answers = line.user_input_id.user_input_line_ids
            mine = answers.filtered(lambda l: l.question_id == line.question_id and not l.skipped)
            line.answer = "\n".join(filter(None, mine.mapped("value_text_box") + mine.mapped("value_char_box"))) or ""
            # the candidate's other answers in the same section (rating, Yes / No, environment...)
            page = line.question_id.page_id
            others = []
            for question in line.user_input_id.survey_id.question_ids.filtered(
                lambda q: not q.is_page and q.page_id == page and q != line.question_id
            ).sorted("sequence"):
                value = format_answer(answers.filtered(lambda l, q=question: l.question_id == q))
                if value:
                    others.append(f"{question.title}: {value}")
            line.topic_answers = "\n".join(others)

    @api.depends("user_input_id", "question_id")
    def _compute_self_rating(self):
        for line in self:
            lines = line.user_input_id.user_input_line_ids
            rating_q = line.question_id._screening_get_rating_question()
            rating_line = lines.filtered(lambda l: rating_q and l.question_id == rating_q and l.suggested_answer_id)[:1]
            line.self_rating = int(rating_line.suggested_answer_id.answer_score) if rating_line else 0

    @api.depends("score", "self_rating")
    def _compute_overclaim(self):
        for line in self:
            if line.score is False or not line.self_rating:
                line.overclaim = False
            else:
                claimed = line.self_rating / 10.0
                shown = int(line.score) / REVIEW_MAX
                line.overclaim = (claimed - shown) >= OVERCLAIM_GAP
