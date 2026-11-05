{
    "name": "Recruitment Screening",
    "version": "17.0.1.12.0",
    "summary": "Pre-interview screening by link: knowledge + self-rating marks, pass mark, automatic Selected / Not Selected",
    "description": """
Recruitment Screening
=====================
Builds on Odoo's own Interview Forms (Survey + Recruitment).

* One personal questionnaire link per candidate (copy and share on WhatsApp / email)
* Knowledge questions (marks for the right answer) and self-rating
  questions (marks per rating level, e.g. 1-5)
* Pass mark (%) per job position
* On completion: score, Selected / Not Selected, chatter note,
  automatic stage move, optional automatic refusal, recruiter to-do
* Reviewer marks (0-3) for every written answer, with a hidden marking key,
  claim-vs-answer (over-claim) flag and a weighted final score
* Candidate form: foldable sections on one page, 1-10 ratings as a slider,
  single-choice questions as a dropdown, sub-sections inside main sections
* Follow-up questions shown only after a chosen answer (ticked per question)
* "Applies to all later sections": e.g. 'Willing to work on site?' = No hides all later sections,
  the candidate just submits and is marked Not Selected automatically
* Section-wise marks (obtained / total) for the self-rating sections: applicant form, chatter, Excel
* Get Screening Link for several selected applicants in one go, without any email (Actions menu)
* Email the screening link to several selected applicants in one go (Actions menu)
* "Are you sure?" confirmation before the candidate's final Submit
* Export to Excel: summary, all answers, reviewer marks and section scores
* Optional automatic sending of the link when a new applicant arrives
* Score and result on the applicant form, kanban card and list
""",
    "author": "InterCraft Solutions",
    "website": "https://intercraftsol.com",
    "category": "Human Resources/Recruitment",
    "license": "LGPL-3",
    "depends": ["hr_recruitment_survey"],
    "data": [
        "security/ir.model.access.csv",
        "views/survey_views.xml",
        "views/screening_review_views.xml",
        "views/survey_templates.xml",
        "views/hr_job_views.xml",
        "views/hr_applicant_views.xml",
        "data/sample_screening_survey.xml",
    ],
    "assets": {
        "survey.survey_assets": [
            "recruitment_screening/static/src/js/screening_survey_form.js",
            "recruitment_screening/static/src/css/screening_survey_form.css",
        ],
    },
    "post_init_hook": "_grant_admin_rights",
    "installable": True,
    "application": False,
}
