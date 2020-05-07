from django.conf.urls import re_path, include, handler500, handler404


from views import auth
urlpatterns = [
    re_path(r'^slack/auth/?', auth),
]

handler500 = 'views.handle_500'
handler404 = 'views.handle_404'