from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("billing", "0003_invoice_installation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="invoiceitem",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name="proformaitem",
            name="description",
            field=models.TextField(blank=True, null=True),
        ),
    ]
