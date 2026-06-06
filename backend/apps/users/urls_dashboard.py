from django.urls import path
from .views_dashboard import DashboardStatsView
from .views_dashboard_rt import DashboardRTStatsView

urlpatterns = [
    path("stats/",    DashboardStatsView.as_view(),   name="dashboard-stats"),
    path("stats-rt/", DashboardRTStatsView.as_view(), name="dashboard-rt-stats"),
]
