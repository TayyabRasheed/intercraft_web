from . import models


def _grant_admin_rights(env):
    """Give Recruitment and Surveys admin rights to every Settings administrator,
    so the Recruitment and Surveys apps show on their dashboard right after install."""
    Users = env["res.users"].with_context(active_test=False)
    field = "group_ids" if "group_ids" in Users._fields else "groups_id"
    admins = Users.search([(field, "in", env.ref("base.group_system").id), ("share", "=", False)])
    for xmlid in ("hr_recruitment.group_hr_recruitment_manager", "survey.group_survey_manager"):
        group = env.ref(xmlid)
        admins.filtered(lambda u: group not in u[field]).write({field: [(4, group.id)]})
