# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/pdf_invoice.py
# ─────────────────────────────────────────────────────────────────────────────
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, PageBreak,
)

from .pdf_utils import (
    palette, make_styles, make_page_handler, get_image_margins,
    header_table, items_table, recap_table, delivery_table,
    resolve_image_paths, safe_image, WHITE, BLACK,
)


def generate_invoice_pdf(invoice, static_dirs: list) -> bytes:
    domaine    = (invoice.domaine or "NETSYSTEME").upper()
    imgs       = resolve_image_paths(domaine, static_dirs)
    main_color = palette(domaine)
    S          = make_styles(main_color)
    buffer     = BytesIO()

    client_name = (
        invoice.billing_client.display_name
        if invoice.billing_client else "—"
    )
    date_str = invoice.date.strftime("%d/%m/%Y") if invoice.date else "—"

    # ── Page handler + hauteurs réelles des images ────────────────────────────
    on_page, logo_h, footer_h = make_page_handler(imgs["logo"], imgs["footer"], domaine)
    margins = get_image_margins(logo_h, footer_h)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=f"Facture #{invoice.invoice_number} — {client_name}",
        author="NETSYSTEME / SSE",
        **margins,
    )

    # ── CALCULS ───────────────────────────────────────────────────────────────
    total_ht     = invoice.total_amount()
    tax_rate     = invoice.tax_rate or 0
    discount_val = invoice.discount_value()
    discount_pct = invoice.discount_percent or 0
    total_ttc    = invoice.total_with_tax_and_discount()
    advance      = invoice.advance_amount or 0
    remaining    = invoice.remaining_balance()

    # ══════════════════════════════════════════════════════════════════════════
    #  PAGE 1 — FACTURE
    # ══════════════════════════════════════════════════════════════════════════
    story = []

    story.append(Spacer(1, 0.2 * cm))

    hdr, date_row = header_table(
        client_name, "FACTURE",
        invoice.invoice_number or str(invoice.id),
        date_str, main_color, S, doc_lines=1,
    )
    story.append(hdr)
    story.append(date_row)
    story.append(Spacer(1, 0.5 * cm))

    story.append(items_table(invoice.items.all(), main_color, S))
    story.append(Spacer(1, 0.5 * cm))

    story.append(recap_table(
        total_ht, tax_rate, discount_val, discount_pct,
        total_ttc, advance, remaining,
        main_color, S, cachet_path=imgs["cachet"],
    ))

    if invoice.notes:
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph(f"<b>Notes :</b> {invoice.notes}", S["red"]))

    # ══════════════════════════════════════════════════════════════════════════
    #  PAGE 2 — BORDEREAU DE LIVRAISON
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Spacer(1, 0.2 * cm))

    hdr2, date_row2 = header_table(
        client_name, "BORDEREAU\nDE LIVRAISON",
        invoice.invoice_number or str(invoice.id),
        date_str, main_color, S, doc_lines=2,
    )
    story.append(hdr2)
    story.append(date_row2)
    story.append(Spacer(1, 0.5 * cm))

    story.append(delivery_table(invoice.items.all(), main_color, S))
    story.append(Spacer(1, 0.8 * cm))

    if imgs["cachet"]:
        try:
            story.append(RLImage(imgs["cachet"], width=4 * cm, height=4 * cm))
        except Exception:
            pass

    # ══════════════════════════════════════════════════════════════════════════
    #  PAGE 3 — NOTES & GARANTIE
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("NOTES :", ParagraphStyle(
        "NT", fontSize=12, fontName="Helvetica-Bold", textColor=main_color)))
    story.append(HRFlowable(width="100%", thickness=2, color=main_color, spaceAfter=8))

    notes_text = [
        "Tous appareils vendus sont garantis pour une période de <b>01 an</b> à compter "
        "de la date d'installation.",
        "Il est formellement convenu que la garantie contre les vices cachés de la chose "
        "vendue prévue par l'article 287 du COCC est exclue dans les cas suivants :",
    ]
    for txt in notes_text:
        story.append(Paragraph(txt, S["note"]))
        story.append(Spacer(1, 0.15 * cm))

    conditions = [
        "En cas de choc ou de démontage de l'appareil et de manipulation par l'acheteur ou un tiers",
        "En cas de panne due à une surtension électrique",
        "En cas d'utilisation de l'appareil dans des conditions incompatibles avec celles "
        "prévues par le fabricant",
    ]
    for i, c in enumerate(conditions, 1):
        story.append(Paragraph(f"{i}. {c}", S["note_list"]))

    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph(
        "Un service après-vente expérimenté, compétent et dynamique est à votre disposition "
        "pour le suivi, contrôle et l'entretien de l'ensemble des appareils que nous commercialisons.",
        S["note"],
    ))
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("<b>Merci pour la confiance.</b>", S["note"]))
    story.append(Spacer(1, 1 * cm))

    if imgs["cachet"]:
        try:
            story.append(RLImage(imgs["cachet"], width=4 * cm, height=4 * cm))
        except Exception:
            pass

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()

    