{
    'name': 'Website Chatter',
    'version': '17.0.0.0.0',
    'category': 'Website Chatter',
    'description': "Module to design website chatter",
    'author': 'Intercraftsol',
    'company': 'Intercraftsol',
    'maintainer': 'Intercraftsol',
    'website': "https://www.Intercraftsol.com",
    'depends': ['base', 'hr', 'website'],
    'data': [
        'views/chatter-widget.xml',
        'views/res_config_setting_view.xml',
        'views/angle_up_ext.xml',


    ],
    'assets': {
        'web.assets_frontend': [
            # '/website_ext/static/src/js/open_jobs.js',
            '/website_chatter/static/src/js/*.js',
            '/website_chatter/static/src/css/*.css'
            # '/website_ext/static/src/scss/*.s/css'

        ],
    },
    'license': 'AGPL-3',
    'installable': True,
    'auto_install': False,
    'application': False,
}
