# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/pdf_proforma.py
# ─────────────────────────────────────────────────────────────────────────────
from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, PageBreak,
)

from .pdf_utils import (
    palette, make_styles, make_page_handler, get_image_margins,
    header_table, items_table, recap_table,
    resolve_image_paths, WHITE, BLACK,
)


def generate_proforma_pdf(proforma, static_dirs: list) -> bytes:
    domaine    = (proforma.domaine or "NETSYSTEME").upper()
    imgs       = resolve_image_paths(domaine, static_dirs)
    main_color = palette(domaine)
    S          = make_styles(main_color)
    buffer     = BytesIO()

    client_name = (
        proforma.billing_client.display_name
        if proforma.billing_client else "—"
    )
    date_str = proforma.date.strftime("%d/%m/%Y") if proforma.date else "—"

    # ── Page handler + hauteurs réelles des images ────────────────────────────
    on_page, logo_h, footer_h = make_page_handler(imgs["logo"], imgs["footer"], domaine)
    margins = get_image_margins(logo_h, footer_h)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=f"Proforma #{proforma.proforma_number} — {client_name}",
        author="NETSYSTEME / SSE",
        **margins,
    )

    # ── CALCULS ───────────────────────────────────────────────────────────────
    total_ht     = proforma.total_amount()
    tax_rate     = proforma.tax_rate or 0
    discount_val = proforma.discount_value()
    discount_pct = proforma.discount_percent or 0
    total_ttc    = proforma.total_with_tax_and_discount()

    # ══════════════════════════════════════════════════════════════════════════
    #  PAGE 1 — PROFORMA
    # ══════════════════════════════════════════════════════════════════════════
    story = []

    story.append(Spacer(1, 0.2 * cm))

    hdr, date_row = header_table(
        client_name, "PROFORMA",
        proforma.proforma_number or str(proforma.id),
        date_str, main_color, S, doc_lines=1,
    )
    story.append(hdr)
    story.append(date_row)

    if proforma.valid_until:
        story.append(Paragraph(
            f"Valide jusqu'au : <b>{proforma.valid_until.strftime('%d/%m/%Y')}</b>",
            S["date_style"],
        ))

    story.append(Spacer(1, 0.5 * cm))
    story.append(items_table(proforma.items.all(), main_color, S))
    story.append(Spacer(1, 0.5 * cm))

    story.append(recap_table(
        total_ht, tax_rate, discount_val, discount_pct,
        total_ttc, 0, 0,
        main_color, S, cachet_path=imgs["cachet"],
    ))

    if proforma.notes:
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph(
            f"<b>Notes :</b> {proforma.notes}",
            ParagraphStyle("NR", fontSize=9, fontName="Helvetica-Bold",
                           textColor=colors.HexColor("#dc2626"), alignment=TA_CENTER),
        ))

    # ══════════════════════════════════════════════════════════════════════════
    #  PAGE 2 — CONDITIONS COMMERCIALES
    # ══════════════════════════════════════════════════════════════════════════
    story.append(PageBreak())
    story.append(Spacer(1, 0.5 * cm))

    story.append(Paragraph("CONDITIONS COMMERCIALES", ParagraphStyle(
        "CC", fontSize=15, fontName="Helvetica-Bold",
        textColor=main_color, alignment=TA_CENTER, spaceAfter=2,
    )))
    story.append(HRFlowable(width="100%", thickness=2, color=main_color, spaceAfter=18))

    story.append(Paragraph("<b>BON POUR ACCORD</b>", ParagraphStyle(
        "BPA", fontSize=10, fontName="Helvetica-Bold",
        textColor=BLACK, spaceAfter=12,
    )))

    pts   = "." * 35
    body_s = ParagraphStyle("BPABody", fontSize=9, fontName="Helvetica",
                             textColor=BLACK, leading=16)

    # ── Bloc 2 colonnes : champs gauche | mode de règlement droite ─────────
    left_data = [
        [Paragraph(f"Pour un montant total de : {pts}", body_s)],
        [Paragraph(f"Date : {pts}", body_s)],
        [Paragraph(f"Nom : {pts}", body_s)],
    ]
    left_tbl = Table(left_data, colWidths=[11 * cm])
    left_tbl.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))

    right_data = [[Paragraph(f"Mode de règlement : {pts[:20]}", body_s)]]
    right_tbl = Table(right_data, colWidths=[8 * cm])
    right_tbl.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))

    bpa_outer = Table([[left_tbl, right_tbl]], colWidths=[11 * cm, 8 * cm])
    bpa_outer.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(bpa_outer)

    # ── "Signature et cachet :" centré + cachet centré en dessous ────────────
    center_s = ParagraphStyle("SigCenter", fontSize=9, fontName="Helvetica",
                               textColor=BLACK, leading=16, alignment=TA_CENTER)
    story.append(Spacer(1, 0.8 * cm))
    story.append(Paragraph("Signature et cachet :", center_s))
    story.append(Spacer(1, 0.3 * cm))

    if imgs["cachet"]:
        try:
            cachet_img = RLImage(imgs["cachet"], width=4 * cm, height=4 * cm)
            cachet_row = Table([[cachet_img]], colWidths=[19 * cm])
            cachet_row.setStyle(TableStyle([
                ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING",   (0, 0), (-1, -1), 0),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
                ("TOPPADDING",    (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]))
            story.append(cachet_row)
        except Exception:
            pass

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()