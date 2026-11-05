from odoo import api, fields, models


class SurveyQuestion(models.Model):
    _inherit = "survey.question"

    screening_review = fields.Boolean(
        string="Reviewer marks this answer",
        compute="_compute_screening_review",
        store=True,
        readonly=False,
        help="A reviewer gives 0-3 marks to the candidate's written answer to this question.",
    )
    screening_rating_question_id = fields.Many2one(
        "survey.question",
        string="Linked self-rating question",
        domain="[('survey_id', '=', survey_id), ('question_type', '=', 'simple_choice')]",
        help="The candidate's self-rating for this topic. Used to compare what the candidate claims "
        "with what the answer shows. Leave empty to use the nearest 1-10 rating on the same page.",
    )
    screening_display = fields.Selection(
        [
            ("auto", "Automatic"),
            ("radio", "Buttons (Odoo default)"),
            ("dropdown", "Dropdown"),
            ("slider", "Slider"),
        ],
        string="Show answers as",
        default="auto",
        help="How a 'Multiple choice: only one answer' question is shown to the candidate. "
        "Automatic (Recruitment questionnaires only): questions with exactly 10 options (1-10 ratings) "
        "are shown as a slider, all other single-choice questions as a dropdown.",
    )
    screening_display_mode = fields.Char(compute="_compute_screening_display_mode")
    screening_opens_followup = fields.Boolean(
        string="Opens follow-up questions",
        help="Tick only on the questions that should open the next ones. The questions placed after this one "
        "in the same section (e.g. Environment, Your answer) stay hidden until the candidate picks the answer "
        "below ('Yes' if left empty). With any other answer they stay hidden and are not required.",
    )
    screening_gate_answer_ids = fields.Many2many(
        "survey.question.answer",
        "survey_question_screening_gate_answer_rel",
        "question_id",
        "answer_id",
        string="Show them when the answer is",
        domain="[('question_id', '=', id)]",
        help="Leave empty to use 'Yes'.",
    )
    screening_gate_closes_form = fields.Boolean(
        string="Applies to all later sections",
        help="Tick on the last question of the first section (e.g. 'Are you willing to work on site?'). "
        "Every question in every later section stays hidden until the candidate picks the answer above "
        "('Yes' if left empty). With any other answer the candidate sees nothing more and just submits.",
    )
    screening_gate_reject = fields.Boolean(
        string="Not Selected on any other answer",
        default=True,
        help="When the candidate picks any other answer, the application is marked Not Selected "
        "straight away: no written answers are created for review. The job position's stage / "
        "auto-refuse settings for 'Not Selected' are applied.",
    )
    screening_auto_trigger = fields.Boolean(
        copy=False,
        help="Technical: the conditional display of this question was set by Recruitment Screening.",
    )
    screening_marking_key = fields.Text(
        string="Marking key (reviewer only)",
        help="Expected points for the reviewer. Never shown to the candidate.",
    )

    @api.depends("question_type")
    def _compute_screening_review(self):
        # Default: written (multi-line) answers are reviewed; can be unticked per question.
        for question in self:
            question.screening_review = question.question_type == "text_box"

    def _screening_is_rating(self):
        """A 1-10 self-rating: single choice with 10 options."""
        self.ensure_one()
        return self.question_type == "simple_choice" and len(self.suggested_answer_ids) == 10

    def _screening_is_yes_no(self):
        """A single-choice question whose two options are Yes and No."""
        self.ensure_one()
        values = {(a.value or "").strip().lower() for a in self.suggested_answer_ids}
        return self.question_type == "simple_choice" and values == {"yes", "no"}

    def _screening_is_gate(self):
        """Ticked by the recruiter: this question opens the questions placed after it."""
        self.ensure_one()
        return self.screening_opens_followup and self.question_type == "simple_choice" and bool(self.suggested_answer_ids)

    def _screening_gate_answers(self):
        """The answers that show the follow-up questions (default: 'Yes')."""
        self.ensure_one()
        if self.screening_gate_answer_ids:
            return self.screening_gate_answer_ids
        yes = self.suggested_answer_ids.filtered(lambda a: (a.value or "").strip().lower() == "yes")
        return yes[:1] or self.suggested_answer_ids[:1]

    @api.model_create_multi
    def create(self, vals_list):
        questions = super().create(vals_list)
        if not self.env.context.get("screening_no_relink"):
            questions.survey_id._screening_link_yes_no()
        return questions

    def write(self, vals):
        if "triggering_answer_ids" in vals and not self.env.context.get("screening_no_relink"):
            vals = dict(vals, screening_auto_trigger=False)  # set by hand: leave it alone
        res = super().write(vals)
        if not self.env.context.get("screening_no_relink") and {
            "sequence", "question_type", "suggested_answer_ids", "is_page", "survey_id",
            "screening_opens_followup", "screening_gate_answer_ids", "screening_gate_closes_form",
        } & set(vals):
            self.survey_id._screening_link_yes_no()
        return res

    def _screening_get_rating_question(self):
        """Explicit link, else the nearest 1-10 rating on the same page (after first, then before)."""
        self.ensure_one()
        if self.screening_rating_question_id:
            return self.screening_rating_question_id
        siblings = self.survey_id.question_ids.filtered(
            lambda q: not q.is_page and q.page_id == self.page_id and q._screening_is_rating()
        ).sorted("sequence")
        after = siblings.filtered(lambda q: q.sequence > self.sequence)
        if after:
            return after[0]
        before = siblings.filtered(lambda q: q.sequence < self.sequence)
        return before[-1] if before else self.browse()

    @api.depends("question_type", "screening_display", "suggested_answer_ids", "survey_id.survey_type")
    def _compute_screening_display_mode(self):
        for question in self:
            if question.question_type != "simple_choice":
                question.screening_display_mode = "radio"
            elif question.screening_display and question.screening_display != "auto":
                question.screening_display_mode = question.screening_display
            elif question.survey_id.survey_type != "recruitment":
                # never change the look of other (non-recruitment) surveys automatically
                question.screening_display_mode = "radio"
            elif len(question.suggested_answer_ids) == 10:
                question.screening_display_mode = "slider"
            else:
                question.screening_display_mode = "dropdown"
