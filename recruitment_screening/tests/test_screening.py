import base64
import io
from unittest.mock import patch

from odoo.addons.mail.models.mail_thread import MailThread
from odoo.tests import HttpCase, TransactionCase, tagged


class ScreeningFixture:
    """Whole flow on a small questionnaire:

    Section 1 "Quick Fit": on-site (Yes/No) + qualification, both closing gates
    "Technical" (header) > "Linux", "Docker" (self-ratings 1-10)
    "Behaviour" (header) > "Teamwork" (self-rating 1-10)
    """

    @classmethod
    def _build_fixture(cls):
        cls.survey = cls.env["survey.survey"].create({
            "title": "Screening test",
            "survey_type": "recruitment",
            "scoring_type": "scoring_without_answers",
            "scoring_success_min": 50.0,
            "questions_layout": "one_page",
        })
        seq = iter(range(1, 100))

        def page(title):
            return cls.env["survey.question"].create({
                "survey_id": cls.survey.id, "title": title, "is_page": True, "sequence": next(seq),
            })

        def choice(title, options, **vals):
            return cls.env["survey.question"].create({
                "survey_id": cls.survey.id, "title": title, "question_type": "simple_choice",
                "sequence": next(seq), "constr_mandatory": True,
                "suggested_answer_ids": [
                    (0, 0, {"value": value, "sequence": i, "answer_score": score, "is_correct": bool(score >= 10)})
                    for i, (value, score) in enumerate(options)
                ],
                **vals,
            })

        def rating(title):
            return choice(title, [(str(n), n) for n in range(1, 11)])

        page("Quick Fit")
        cls.q_site = choice(
            "Are you willing to work on site?", [("Yes", 0), ("No", 0)],
            screening_opens_followup=True, screening_gate_closes_form=True,
        )
        cls.q_edu = choice(
            "Highest qualification?", [("BS or higher", 0), ("BA / ADP", 0), ("Below", 0)],
            screening_opens_followup=True, screening_gate_closes_form=True,
        )
        page("Technical")
        page("Linux")
        cls.q_linux = rating("Linux rating")
        page("Docker")
        cls.q_docker = rating("Docker rating")
        page("Behaviour")
        page("Teamwork")
        cls.q_team = rating("Teamwork rating")

        cls.job = cls.env["hr.job"].create({
            "name": "DevOps test", "survey_id": cls.survey.id, "screening_deadline_days": 2,
            "screening_review_required": False,
        })

    # ------------------------------------------------------------------ helpers
    def _applicant(self, name="Test Candidate", email="cand@example.com"):
        if "hr.candidate" in self.env:  # Odoo 18
            candidate = self.env["hr.candidate"].create({"partner_name": name, "email_from": email})
            return self.env["hr.applicant"].create({"candidate_id": candidate.id, "job_id": self.job.id})
        return self.env["hr.applicant"].create({  # Odoo 17
            "name": "DevOps - %s" % name, "partner_name": name, "email_from": email, "job_id": self.job.id,
        })

    def _answer(self, applicant, picks):
        """picks: {question: option text}; submits the questionnaire like the candidate's browser."""
        user_input = applicant._screening_get_or_create_input()
        for question, text in picks.items():
            option = question.suggested_answer_ids.filtered(lambda a: a.value == text)
            self.assertTrue(option, "no option %r on %s" % (text, question.title))
            user_input._save_lines(question, option.id)
        user_input._mark_done()
        return user_input

    def _ok_gates(self):
        return {self.q_site: "Yes", self.q_edu: "BS or higher"}


@tagged("standard", "at_install")
class TestScreening(ScreeningFixture, TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._build_fixture()

    # ------------------------------------------------------------------ links
    def test_01_gates_cover_all_later_sections(self):
        yes = self.q_site.suggested_answer_ids.filtered(lambda a: a.value == "Yes")
        edu_ok = self.q_edu.suggested_answer_ids[:1]
        self.assertFalse(self.q_site.triggering_answer_ids)
        self.assertEqual(self.q_edu.triggering_answer_ids, yes)
        for question in (self.q_linux, self.q_docker, self.q_team):
            self.assertEqual(question.triggering_answer_ids, edu_ok, question.title)

    # ------------------------------------------------------------------ outcomes
    def test_02_all_good_sections_and_scores(self):
        applicant = self._applicant()
        self._answer(applicant, {**self._ok_gates(), self.q_linux: "8", self.q_docker: "4", self.q_team: "6"})
        self.assertEqual(applicant.screening_state, "selected")
        groups = applicant.screening_input_id._screening_section_scores()
        self.assertEqual([g["title"] for g in groups], ["Technical", "Behaviour"])
        technical, behaviour = groups
        self.assertEqual((technical["points"], technical["max"]), (12, 20))
        self.assertEqual([(c["title"], c["points"], c["max"]) for c in technical["children"]],
                         [("Linux", 8, 10), ("Docker", 4, 10)])
        self.assertEqual((behaviour["points"], behaviour["max"]), (6, 10))
        html = str(applicant.screening_section_scores)
        self.assertIn("Technical", html)
        self.assertIn("12 / 20", html)
        self.assertIn("6 / 10", html)

    def test_03_low_ratings_not_selected(self):
        applicant = self._applicant("Low Scorer", "low@example.com")
        self._answer(applicant, {**self._ok_gates(), self.q_linux: "1", self.q_docker: "2", self.q_team: "1"})
        self.assertEqual(applicant.screening_state, "not_selected")

    def test_04_on_site_no_closes_the_form(self):
        applicant = self._applicant("No Site", "nosite@example.com")
        user_input = self._answer(applicant, {self.q_site: "No"})
        self.assertEqual(user_input._screening_gate_rejected(), self.q_site)
        self.assertEqual(applicant.screening_state, "not_selected")
        self.assertFalse(applicant.screening_section_scores)
        self.assertTrue(any("closed early" in (m.body or "") for m in applicant.message_ids))

    def test_05_wrong_qualification_closes_the_form(self):
        applicant = self._applicant("No BS", "nobs@example.com")
        self._answer(applicant, {self.q_site: "Yes", self.q_edu: "BA / ADP"})
        self.assertEqual(applicant.screening_state, "not_selected")

    def test_06_gate_reject_can_be_switched_off(self):
        self.q_site.screening_gate_reject = False
        try:
            applicant = self._applicant("Soft No", "softno@example.com")
            user_input = self._answer(applicant, {self.q_site: "No"})
            self.assertFalse(user_input._screening_gate_rejected())
        finally:
            self.q_site.screening_gate_reject = True

    # ------------------------------------------------------------------ emails
    def test_07_single_email_sends_only_the_invitation(self):
        applicant = self._applicant("Mail One", "one@example.com")
        self.env.flush_all()
        before = self.env["mail.mail"].search([]).ids
        applicant.action_email_screening_link()
        new_mails = self.env["mail.mail"].search([("id", "not in", before)])
        self.assertEqual(len(new_mails), 1, new_mails.mapped("subject"))
        self.assertIn("Participate to", new_mails.subject)
        self.assertTrue(applicant.screening_url)

    def test_08_bulk_email(self):
        ok1 = self._applicant("Bulk One", "b1@example.com")
        ok2 = self._applicant("Bulk Two", "b2@example.com")
        no_email = self._applicant("Bulk NoMail", False)
        done = self._applicant("Bulk Done", "b3@example.com")
        self._answer(done, self._ok_gates())
        self.env.flush_all()
        before = self.env["mail.mail"].search([]).ids
        action = (ok1 | ok2 | no_email | done).action_email_screening_bulk()
        message = action["params"]["message"]
        self.assertIn("emailed to 2", message)
        self.assertIn("Skipped 2", message)
        self.assertIn("Bulk NoMail", message)
        self.assertIn("Bulk Done", message)
        invites = self.env["mail.mail"].search([("id", "not in", before)])
        self.assertEqual(len(invites), 2, invites.mapped("email_to"))
        self.assertIn("b1@example.com", invites[0].email_to + invites[1].email_to)
        self.assertIn("b2@example.com", invites[0].email_to + invites[1].email_to)

    def test_09_bulk_server_action_is_bound_to_applicants(self):
        action = self.env.ref("recruitment_screening.action_email_screening_link_multi")
        applicants = self._applicant("Srv One", "s1@example.com") | self._applicant("Srv Two", "s2@example.com")
        result = action.with_context(active_model="hr.applicant", active_ids=applicants.ids, active_id=applicants.ids[0]).run()
        self.assertEqual(result["tag"], "display_notification")
        self.assertTrue(all(applicants.mapped("screening_url")))

    # ------------------------------------------------------------------ get link (no email)
    def test_14_get_link_sends_no_email(self):
        applicant = self._applicant("Link Only", "linkonly@example.com")
        self.env.flush_all()
        mails_before = self.env["mail.mail"].search([]).ids
        msgs_before = self.env["mail.message"].search([]).ids
        applicant.action_generate_screening_link()
        self.env.flush_all()
        self.env.cr.precommit.run()
        self.assertTrue(applicant.screening_url)
        self.assertFalse(self.env["mail.mail"].search([("id", "not in", mails_before)]),
                         "Get Screening Link must not email anyone")
        notes = self.env["mail.message"].search([("id", "not in", msgs_before)])
        self.assertTrue(all(not m.partner_ids for m in notes), "the chatter note must have no recipients")
        # the link works like the emailed one: same personal answer
        self.assertIn("answer_token=", applicant.screening_url)

    def test_15_get_link_bulk(self):
        a1 = self._applicant("Link One", "l1@example.com")
        a2 = self._applicant("Link Two", False)  # no email is fine: nothing is emailed
        done = self._applicant("Link Done", "l3@example.com")
        self._answer(done, self._ok_gates())
        self.env.flush_all()
        mails_before = self.env["mail.mail"].search([]).ids
        action = (a1 | a2 | done).action_generate_screening_bulk()
        self.env.flush_all()
        message = action["params"]["message"]
        self.assertIn("created for 2", message)
        self.assertIn("No email was sent", message)
        self.assertIn("Skipped 1", message)
        self.assertIn("Link Done", message)
        self.assertTrue(a1.screening_url and a2.screening_url)
        self.assertFalse(self.env["mail.mail"].search([("id", "not in", mails_before)]))
        # running it again keeps the same links (nothing new is created)
        url1 = a1.screening_url
        (a1 | a2).action_generate_screening_bulk()
        self.assertEqual(a1.screening_url, url1)

    def test_16_get_link_bulk_server_action(self):
        action = self.env.ref("recruitment_screening.action_generate_screening_link_multi")
        applicants = self._applicant("Sa One", "sa1@example.com") | self._applicant("Sa Two", "sa2@example.com")
        result = action.with_context(
            active_model="hr.applicant", active_ids=applicants.ids, active_id=applicants.ids[0]
        ).run()
        self.assertEqual(result["tag"], "display_notification")
        self.assertTrue(all(applicants.mapped("screening_url")))

    def test_17_get_link_then_email_sends_exactly_one_mail(self):
        applicant = self._applicant("Link Then Mail", "ltm@example.com")
        applicant.action_generate_screening_link()
        self.env.flush_all()
        before = self.env["mail.mail"].search([]).ids
        url = applicant.screening_url
        applicant.action_email_screening_link()
        self.env.flush_all()
        sent = self.env["mail.mail"].search([("id", "not in", before)])
        self.assertEqual(len(sent), 1)
        self.assertEqual(applicant.screening_url, url, "the emailed link is the same personal link")

    # ------------------------------------------------------------------ views / export
    def test_10_views_load(self):
        list_type = "list" if "hr.candidate" in self.env else "tree"  # renamed in Odoo 18
        for view_type in ("form", list_type, "kanban"):
            self.env["hr.applicant"].get_view(view_type=view_type)
        self.env["survey.question"].get_view(view_type="form")

    def test_11_excel_export_has_section_sheet(self):
        applicant = self._applicant("Excel Person", "x@example.com")
        self._answer(applicant, {**self._ok_gates(), self.q_linux: "8", self.q_docker: "4", self.q_team: "6"})
        action = applicant.action_export_screening_xlsx()
        attachment_id = int(action["url"].split("/web/content/")[1].split("?")[0])
        data = base64.b64decode(self.env["ir.attachment"].browse(attachment_id).datas)
        import openpyxl
        book = openpyxl.load_workbook(io.BytesIO(data))
        self.assertIn("Section Scores", book.sheetnames)
        rows = list(book["Section Scores"].iter_rows(values_only=True))
        self.assertEqual(rows[1][:6], ("Excel Person", "Technical", "Total", 12, 20, 60.0))
        self.assertEqual(rows[2][:6], ("Excel Person", "Technical", "Linux", 8, 10, 80.0))

    def test_12_closed_early_export_does_not_break(self):
        applicant = self._applicant("Excel No", "xn@example.com")
        self._answer(applicant, {self.q_site: "No"})
        action = applicant.action_export_screening_xlsx()
        self.assertIn("/web/content/", action["url"])

    def test_13_screening_button_never_sends_the_stage_email(self):
        """"We confirm we received your application" is the Email Template of a recruitment stage.
        Pressing "Email Screening Link" on an applicant sitting in such a stage must send the
        invitation only."""
        tracking = {"tracking_disable": False, "mail_notrack": False}
        stage = self.env["hr.recruitment.stage"].search(
            ["|", ("job_ids", "=", False), ("job_ids", "=", self.job.id), ("fold", "=", False)],
            order="sequence", limit=1,
        )
        stage.template_id = self.env.ref("hr_recruitment.email_template_data_applicant_congratulations")
        applicant = self._applicant("Ack Person", "ack@example.com")
        applicant.stage_id = stage
        self.env.flush_all()
        sent_templates = []
        original = MailThread.message_post_with_source

        def spy(thread, source_ref, **kwargs):
            sent_templates.append(source_ref)
            return original(thread, source_ref, **kwargs)

        with patch.object(MailThread, "message_post_with_source", spy):
            before = self.env["mail.mail"].search([]).ids
            applicant.with_context(**tracking).action_email_screening_link()
            self.env.flush_all()
            self.env.cr.precommit.run()
        on_button = self.env["mail.mail"].search([("id", "not in", before)])
        self.assertEqual(len(on_button), 1, on_button.mapped("subject"))
        self.assertIn("Participate to", on_button.subject)
        self.assertFalse(sent_templates, "the screening button must not send a stage email")


@tagged("post_install", "-at_install")
class TestScreeningSubmit(ScreeningFixture, HttpCase):
    """The candidate's browser posts the whole one-page form to /survey/submit."""

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls._build_fixture()
        cls.survey.access_mode = "token"

    def setUp(self):
        super().setUp()
        self.applicant = self._applicant("Http Person", "http@example.com")
        self.user_input = self.applicant._screening_get_or_create_input()

    def _option(self, question, text):
        return question.suggested_answer_ids.filtered(lambda a: a.value == text).id

    def _submit(self, answers):
        """Post the form; returns the validation errors {question id: message} (empty when accepted)."""
        url = "/survey/submit/%s/%s" % (self.survey.access_token, self.user_input.access_token)
        params = {str(q.id): value for q, value in answers.items()}
        params["button_submit"] = "finish"
        _correct, payload = self.make_jsonrpc_request(url, params)
        self.assertNotEqual(payload.get("error"), "unauthorized", payload)
        return payload.get("fields", {}) if payload.get("error") == "validation" else {}

    def test_on_site_no_submits_without_asking_for_the_other_sections(self):
        errors = self._submit({self.q_site: self._option(self.q_site, "No")})
        self.assertFalse(errors, "no mandatory error expected after No")
        self.user_input.invalidate_recordset()
        self.assertEqual(self.user_input.state, "done")
        self.assertEqual(self.applicant.screening_state, "not_selected")

    def test_both_gates_ok_then_the_next_sections_are_required(self):
        errors = self._submit({
            self.q_site: self._option(self.q_site, "Yes"),
            self.q_edu: self._option(self.q_edu, "BS or higher"),
        })
        self.assertEqual(
            {int(k) for k in errors}, {self.q_linux.id, self.q_docker.id, self.q_team.id}, errors
        )
        self.user_input.invalidate_recordset()
        self.assertNotEqual(self.user_input.state, "done")

    def test_wrong_qualification_submits_without_asking_for_the_other_sections(self):
        errors = self._submit({
            self.q_site: self._option(self.q_site, "Yes"),
            self.q_edu: self._option(self.q_edu, "BA / ADP"),
        })
        self.assertFalse(errors)
        self.assertEqual(self.applicant.screening_state, "not_selected")

    def test_complete_form_is_selected(self):
        errors = self._submit({
            self.q_site: self._option(self.q_site, "Yes"),
            self.q_edu: self._option(self.q_edu, "BS or higher"),
            self.q_linux: self._option(self.q_linux, "9"),
            self.q_docker: self._option(self.q_docker, "8"),
            self.q_team: self._option(self.q_team, "7"),
        })
        self.assertFalse(errors)
        self.assertEqual(self.applicant.screening_state, "selected")
        groups = self.applicant.screening_input_id._screening_section_scores()
        self.assertEqual([(g["points"], g["max"]) for g in groups], [(17, 20), (7, 10)])

    def test_form_page_has_one_wrapper_per_section(self):
        """The candidate's page: every section in its own wrapper; sections whose questions are all
        conditional (hidden until the gates are answered) start hidden."""
        self.user_input._mark_in_progress()
        response = self.url_open("/survey/%s/%s" % (self.survey.access_token, self.user_input.access_token))
        html = response.text
        self.assertEqual(html.count('class="js_section_wrapper'), 6, "one wrapper per section")
        self.assertEqual(html.count('js_section_wrapper d-none'), 5, "only the first section is visible at start")
        self.assertIn("Quick Fit", html)
