from odoo import api, fields, models


class SurveySurvey(models.Model):
    _inherit = "survey.survey"

    # Odoo 17 has no "Recruitment" survey type (Odoo 18 does): added here so every
    # screening feature below works the same way on both versions.
    survey_type = fields.Selection(
        selection_add=[("recruitment", "Recruitment")],
        ondelete={"recruitment": "set default"},
    )
    screening_collapsible_sections = fields.Boolean(
        string="Foldable sections on one page",
        default=True,
        help="Recruitment questionnaires: show all sections on one page. Each section can be folded / "
        "unfolded by the candidate, who can go back to any section and change answers before the final Submit.",
    )

    def _screening_link_yes_no(self):
        """Hide the questions placed after a ticked "Opens follow-up questions" question until its answer is picked.

        Only conditions set by this module are (re)computed; conditions set by hand are never touched.
        """
        Question = self.env["survey.question"].with_context(screening_no_relink=True)
        for survey in self.filtered(lambda s: s.survey_type == "recruitment"):
            # undo our previous links, so moving / changing questions stays correct
            auto = survey.question_ids.filtered("screening_auto_trigger")
            if auto:
                Question.browse(auto.ids).write({"triggering_answer_ids": [(5,)], "screening_auto_trigger": False})
            # a gate ticked "Applies to all later sections" also hides every later section
            closing_answers = self.env["survey.question.answer"]
            for page in survey.page_ids:
                page_answers = self.env["survey.question.answer"]  # gate of this section only
                for question in page.question_ids:
                    if question._screening_is_gate():
                        if closing_answers and not question.triggering_answer_ids:
                            Question.browse(question.id).write({
                                "triggering_answer_ids": [(6, 0, closing_answers.ids)],
                                "screening_auto_trigger": True,
                            })
                        page_answers = question._screening_gate_answers()
                        if question.screening_gate_closes_form:
                            closing_answers = page_answers
                    else:
                        answers = page_answers or closing_answers
                        if answers and not question.triggering_answer_ids:
                            Question.browse(question.id).write({
                                "triggering_answer_ids": [(6, 0, answers.ids)],
                                "screening_auto_trigger": True,
                            })

    def _screening_force_one_page(self):
        todo = self.filtered(
            lambda s: s.survey_type == "recruitment"
            and s.screening_collapsible_sections
            and s.questions_layout != "one_page"
        )
        if todo:
            super(SurveySurvey, todo).write({"questions_layout": "one_page"})

    @api.model_create_multi
    def create(self, vals_list):
        surveys = super(SurveySurvey, self.with_context(screening_no_relink=True)).create(vals_list)
        surveys = surveys.with_context(screening_no_relink=False)
        surveys._screening_force_one_page()
        surveys._screening_link_yes_no()
        return surveys

    def write(self, vals):
        # questions saved with the questionnaire are linked once, after everything is written
        res = super(SurveySurvey, self.with_context(screening_no_relink=True)).write(vals)
        self = self.with_context(screening_no_relink=False)
        if {"survey_type", "screening_collapsible_sections", "questions_layout"} & set(vals):
            self._screening_force_one_page()
        if {"survey_type", "question_and_page_ids", "question_ids"} & set(vals):
            self._screening_link_yes_no()
        return res

    @api.onchange("screening_collapsible_sections", "survey_type")
    def _onchange_screening_collapsible_sections(self):
        if self.survey_type == "recruitment" and self.screening_collapsible_sections:
            self.questions_layout = "one_page"
