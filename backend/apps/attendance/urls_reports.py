# apps/attendance/urls_reports.py
# Ajoutez dans config/urls.py :
#   path("api/reports/", include("apps.attendance.urls_reports")),
from django.urls import path
from . import views_reports as vr

urlpatterns = [
    # GET /api/reports/monthly/?year=2026&month=3
    path("monthly/",                            vr.monthly_report_api,   name="report-monthly"),
    # GET /api/reports/monthly/export/pdf/?year=2026&month=3
    path("monthly/export/pdf/",                 vr.export_monthly_pdf,   name="report-monthly-pdf"),
    # GET /api/reports/monthly/export/excel/?year=2026&month=3
    path("monthly/export/excel/",               vr.export_monthly_excel, name="report-monthly-excel"),
    # GET /api/reports/employee/<id>/pdf/?year=2026&month=3
    path("employee/<int:employee_id>/pdf/",     vr.export_employee_pdf,  name="report-employee-pdf"),
]