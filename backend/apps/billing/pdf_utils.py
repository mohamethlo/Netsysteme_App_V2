# ─────────────────────────────────────────────────────────────────────────────
#  apps/billing/pdf_utils.py
#  Helpers communs — design fidèle au template Flask
# ─────────────────────────────────────────────────────────────────────────────
import os
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT, TA_LEFT
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, PageBreak, KeepTogether,
)

# ── Palettes ──────────────────────────────────────────────────────────────────
BLUE_SSE    = colors.HexColor("#1e3a8a")
BLUE_NETSYS = colors.HexColor("#1e3a8a")
BLUE_TVA    = colors.HexColor("#d0dff5")
GREY_ODD    = colors.HexColor("#f5f5f5")
WHITE       = colors.white
BLACK       = colors.black
RED         = colors.HexColor("#dc2626")


def palette(domaine: str):
    return BLUE_SSE if (domaine or "").upper() == "SSE" else BLUE_NETSYS


# ── Largeur exacte de la boîte colorée FACTURE / PROFORMA ────────────────────
def _doc_box_width(doc_type: str, doc_number: str,
                   title_font: str = "Helvetica-Bold",
                   title_size: float = 22,
                   title_size_sm: float = 17,
                   num_font: str = "Helvetica-Bold",
                   num_size: float = 9,
                   padding_h: float = 22) -> float:
    """
    Calcule la largeur minimale (en points) de la boîte colorée pour qu'elle
    épouse exactement son contenu, sans espace vide inutile.

    - Titre 1 ligne  (FACTURE, PROFORMA)          → taille title_size
    - Titre 2 lignes (BORDEREAU / DE LIVRAISON)   → taille title_size_sm
    - La largeur = max(largeur_titre, largeur_numéro) + padding_h (gauche + droite)
    """
    lines = doc_type.split("\n")
    if len(lines) > 1:
        w_title = max(stringWidth(line.strip(), title_font, title_size_sm)
                      for line in lines)
    else:
        w_title = stringWidth(doc_type, title_font, title_size)

    w_num = stringWidth(f"N° : #{doc_number}", num_font, num_size)

    return max(w_title, w_num) + padding_h


# ── Hauteur réelle d'une image à 100 % de la largeur A4 ──────────────────────
def _full_width_height(img_path: str) -> float:
    """
    Équivalent CSS : width:100%; height:auto;
    Retourne la hauteur en points. Requiert Pillow.
    """
    from PIL import Image as PILImage
    with PILImage.open(img_path) as im:
        img_w, img_h = im.size
    return A4[0] * (img_h / img_w)


# ── Chargement sécurisé d'un flowable image ───────────────────────────────────
def safe_image(path: str | None, width=None, height=None):
    if not path or not os.path.exists(path):
        return None
    try:
        img = RLImage(path)
        if width:
            img.drawWidth  = width
            img.drawHeight = height or (width * img.imageHeight / img.imageWidth)
        elif height:
            img.drawHeight = height
            img.drawWidth  = height * img.imageWidth / img.imageHeight
        return img
    except Exception:
        return None


# ── Styles ────────────────────────────────────────────────────────────────────
def make_styles(main_color=BLUE_NETSYS):
    base = getSampleStyleSheet()

    def ps(name, **kw):
        parent = kw.pop("parent", base["Normal"])
        return ParagraphStyle(name, parent=parent, **kw)

    return {
        "body": ps("Body",
            fontSize=9, fontName="Helvetica",
            textColor=BLACK, leading=13, spaceAfter=2),
        "body_bold": ps("BodyBold",
            fontSize=9, fontName="Helvetica-Bold",
            textColor=BLACK, leading=13),
        "right": ps("Right",
            fontSize=9, fontName="Helvetica",
            textColor=BLACK, alignment=TA_RIGHT),
        "right_bold": ps("RightBold",
            fontSize=9, fontName="Helvetica-Bold",
            textColor=BLACK, alignment=TA_RIGHT),
        "center": ps("Center",
            fontSize=9, fontName="Helvetica",
            textColor=BLACK, alignment=TA_CENTER),
        "note": ps("Note",
            fontSize=9, fontName="Helvetica",
            textColor=BLACK, leading=14, alignment=TA_JUSTIFY),
        "note_list": ps("NoteList",
            fontSize=9, fontName="Helvetica",
            textColor=BLACK, leading=14, leftIndent=14),
        "red": ps("Red",
            fontSize=9, fontName="Helvetica-Bold",
            textColor=RED, alignment=TA_CENTER),
        "client_label": ps("ClientLabel",
            fontSize=9, fontName="Helvetica-Bold",
            textColor=main_color, alignment=TA_LEFT,
            spaceAfter=0, spaceBefore=0),
        "client_name": ps("ClientName",
            fontSize=10, fontName="Helvetica-Bold",
            textColor=BLACK, leading=13),
        # Texte blanc centré dans la boîte colorée (titre 1 ligne)
        "doc_title": ps("DocTitle",
            fontSize=22, fontName="Helvetica-Bold",
            textColor=WHITE, alignment=TA_CENTER),
        # Texte blanc centré dans la boîte colorée (titre 2 lignes)
        "doc_title_sm": ps("DocTitleSm",
            fontSize=17, fontName="Helvetica-Bold",
            textColor=WHITE, alignment=TA_CENTER, leading=20),
        # Numéro de document dans la boîte colorée
        "doc_number": ps("DocNumber",
            fontSize=9, fontName="Helvetica-Bold",
            textColor=WHITE, alignment=TA_RIGHT),
        "date_style": ps("DateStyle",
            fontSize=10, fontName="Helvetica",
            textColor=BLACK, alignment=TA_RIGHT),
        "ttc_label": ps("TTCLabel",
            fontSize=10, fontName="Helvetica-Bold",
            textColor=WHITE),
        "ttc_value": ps("TTCValue",
            fontSize=10, fontName="Helvetica-Bold",
            textColor=WHITE, alignment=TA_RIGHT),
    }


# ── Page handler (header + footer pleine largeur) ─────────────────────────────
def make_page_handler(logo_path: str | None, footer_path: str | None, domaine: str):
    """
    Reproduit exactement le comportement du template Flask :
      .logo-container img { width: 100%; height: auto; }
      .footer-image       { width: 100%; height: auto; display: block; }

    • draw_width  = largeur A4 exacte (595.28 pt)
    • draw_height = largeur A4 × (hauteur_image / largeur_image)
    • x = 0 (bord gauche absolu de la page)
    • Aucun recadrage, aucun fallback, aucune alternative.

    Retourne (on_page_callback, logo_h_pts, footer_h_pts).
    """
    page_w = A4[0]

    logo_h   = 0.0
    footer_h = 0.0

    if logo_path and os.path.exists(logo_path):
        try:
            logo_h = _full_width_height(logo_path)
        except Exception:
            logo_h = 0.0

    if footer_path and os.path.exists(footer_path):
        try:
            footer_h = _full_width_height(footer_path)
        except Exception:
            footer_h = 0.0

    def on_page(canvas, doc):
        page_w, page_h = A4
        canvas.saveState()

        # Header — collé en haut, pleine largeur
        if logo_path and os.path.exists(logo_path) and logo_h > 0:
            canvas.drawImage(
                logo_path, 0, page_h - logo_h,
                width=page_w, height=logo_h,
                preserveAspectRatio=False, mask="auto",
            )

        # Footer — collé en bas, pleine largeur
        if footer_path and os.path.exists(footer_path) and footer_h > 0:
            canvas.drawImage(
                footer_path, 0, 0,
                width=page_w, height=footer_h,
                preserveAspectRatio=False, mask="auto",
            )

        canvas.restoreState()

    return on_page, logo_h, footer_h


# ── Marges document adaptées aux images ───────────────────────────────────────
def get_image_margins(logo_h: float, footer_h: float,
                      gap: float = 0.3 * cm) -> dict:
    """
    Calcule topMargin et bottomMargin pour que le contenu ne chevauche
    jamais le header ni le footer.
    """
    return {
        "topMargin":    logo_h   + gap,
        "bottomMargin": footer_h + gap,
        "leftMargin":   1 * cm,
        "rightMargin":  1 * cm,
    }


# ── En-tête CLIENT / DOCUMENT ─────────────────────────────────────────────────
# Largeur fixe de la colonne droite (espace disponible côté document)
_RIGHT_COL = 11.5 * cm


def header_table(client_name: str, doc_type: str, doc_number: str,
                 doc_date: str, main_color, styles: dict,
                 doc_lines: int = 1) -> tuple:
    """
    Retourne (header_flowable, date_flowable).

    La boîte colorée (FACTURE / PROFORMA / BORDEREAU…) est dimensionnée
    dynamiquement à la largeur exacte de son contenu, puis alignée à droite
    dans la colonne disponible (11.5 cm).

    ┌─────────────────────┐          ┌─────────────────┐
    │ CLIENT              │          │    FACTURE      │  ← largeur = contenu
    │ ——————————————————  │  espace  │  N° : #XXXX     │
    │ Nom du client       │  vide →  └─────────────────┘
    └─────────────────────┘
                                          Date : jj/mm/aaaa
    """
    # ── Largeur exacte de la boîte colorée ───────────────────────────────────
    box_w   = _doc_box_width(doc_type, doc_number)
    spacer_w = _RIGHT_COL - box_w   # espace vide à gauche de la boîte

    # ── Boîte CLIENT (gauche) ─────────────────────────────────────────────────
    client_inner = Table(
        [
            [Paragraph("CLIENT", styles["client_label"])],
            [HRFlowable(width="100%", thickness=1.5, color=main_color,
                        spaceBefore=1, spaceAfter=3)],
            [Paragraph(client_name.replace("\n", "<br/>"), styles["client_name"])],
        ],
        colWidths=[7 * cm],
    )
    client_inner.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 0.8, colors.HexColor("#cccccc")),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (0, 0),   5),
        ("BOTTOMPADDING", (0, 0), (0, 0),   0),
        ("TOPPADDING",    (0, 1), (0, 1),   0),
        ("BOTTOMPADDING", (0, 1), (0, 1),   0),
        ("TOPPADDING",    (0, 2), (0, 2),   3),
        ("BOTTOMPADDING", (0, 2), (0, 2),   8),
    ]))

    # ── Boîte colorée (droite) — largeur = contenu exact ─────────────────────
    title_style = styles["doc_title"] if doc_lines == 1 else styles["doc_title_sm"]

    doc_box = Table(
        [
            [Paragraph(doc_type.replace("\n", "<br/>"), title_style)],
            [Paragraph(f"N° : #{doc_number}", styles["doc_number"])],
        ],
        colWidths=[box_w],
    )
    doc_box.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), main_color),
        ("LEFTPADDING",   (0, 0), (-1, -1), 11),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 11),
        ("TOPPADDING",    (0, 0), (0, 0),   8),
        ("BOTTOMPADDING", (0, 0), (0, 0),   10),  # espace sous le titre
        ("TOPPADDING",    (0, 1), (0, 1),   10),  # espace au-dessus du numéro
        ("BOTTOMPADDING", (0, 1), (0, 1),   8),
    ]))

    # ── Colonne droite : espace vide + boîte colorée ──────────────────────────
    right_inner = Table(
        [[Spacer(1, 1), doc_box]],
        colWidths=[spacer_w, box_w],
    )
    right_inner.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))

    # ── Tableau principal : CLIENT (gauche) + doc (droite) ────────────────────
    main_row = Table(
        [[client_inner, right_inner]],
        colWidths=[7.5 * cm, _RIGHT_COL],
    )
    main_row.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    # ── Date : séparée, alignée à droite ─────────────────────────────────────
    date_row = Table(
        [[Spacer(1, 1), Paragraph(f"Date : {doc_date}", styles["date_style"])]],
        colWidths=[7.5 * cm, _RIGHT_COL],
    )
    date_row.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))

    return main_row, date_row


# ── Tableau articles ──────────────────────────────────────────────────────────
def items_table(items, main_color, styles: dict,
                show_discount=False, show_images=False) -> Table:
    col_widths = [9.0 * cm, 1.8 * cm, 4.0 * cm, 4.2 * cm]
    th = ParagraphStyle("TH", fontName="Helvetica-Bold", fontSize=10,
                         textColor=WHITE, alignment=TA_CENTER)
    data = [[
        Paragraph("Désignation", th),
        Paragraph("Qté", th),
        Paragraph("P. Unit", th),
        Paragraph("Total HT", th),
    ]]
    for item in items:
        desc     = item.description or (item.product.name if item.product else "—")
        qty      = item.quantity
        unit     = item.unit_price
        total_ht = qty * unit
        data.append([
            Paragraph(desc, styles["body"]),
            Paragraph(str(int(qty)) if qty == int(qty) else str(qty), styles["center"]),
            Paragraph(f"{unit:,.0f} Fcfa".replace(",", " "), styles["right"]),
            Paragraph(f"{total_ht:,.0f} Fcfa".replace(",", " "), styles["right"]),
        ])
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), main_color),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 10),
        ("TOPPADDING",    (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, GREY_ODD]),
        ("ALIGN",         (1, 1), (1, -1),  "CENTER"),
        ("ALIGN",         (2, 1), (3, -1),  "RIGHT"),
        ("LEFTPADDING",   (0, 1), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 1), (-1, -1), 6),
        ("TOPPADDING",    (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("BOX",           (0, 0), (-1, -1), 1.5, main_color),
        ("LINEBELOW",     (0, 0), (-1, 0),  1.5, main_color),
    ]))
    return t


# ── Tableau récapitulatif ─────────────────────────────────────────────────────
def recap_table(total_ht: float, tax_rate: float,
                discount_value: float, discount_percent: float,
                total_ttc: float, advance: float, remaining: float,
                main_color, styles: dict,
                cachet_path: str | None = None) -> Table:
    rows = []
    tva_row_idx = None
    ttc_row_idx = None

    rows.append(["Total HT",
                 Paragraph(f"{total_ht:,.0f} Fcfa".replace(",", " "), styles["right"])])

    if tax_rate > 0:
        tva = total_ht * tax_rate
        tva_row_idx = len(rows)
        rows.append([f"TVA ({int(tax_rate * 100)}%)",
                     Paragraph(f"{tva:,.0f} Fcfa".replace(",", " "), styles["right"])])

    if discount_value > 0:
        label = f"Remise ({int(discount_percent)}%)" if discount_percent > 0 else "Remise"
        rows.append([label,
                     Paragraph(f"- {discount_value:,.0f} Fcfa".replace(",", " "), styles["right"])])

    ttc_row_idx = len(rows)
    rows.append([
        Paragraph("<b>Total TTC</b>", styles["ttc_label"]),
        Paragraph(f"<b>{total_ttc:,.0f} Fcfa</b>".replace(",", " "), styles["ttc_value"]),
    ])

    if advance > 0:
        rows.append(["Avance versée",
                     Paragraph(f"{advance:,.0f} Fcfa".replace(",", " "), styles["right"])])
        rows.append([
            Paragraph("<b>Solde à payer</b>", styles["body_bold"]),
            Paragraph(f"<b>{remaining:,.0f} Fcfa</b>".replace(",", " "), styles["right_bold"]),
        ])

    recap = Table(rows, colWidths=[5.5 * cm, 4.5 * cm])
    style_list = [
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9.5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("ALIGN",         (1, 0), (1, -1),  "RIGHT"),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("BOX",           (0, 0), (-1, -1), 1.5, main_color),
        ("BACKGROUND",    (0, ttc_row_idx), (-1, ttc_row_idx), main_color),
        ("TEXTCOLOR",     (0, ttc_row_idx), (-1, ttc_row_idx), WHITE),
        ("FONTNAME",      (0, ttc_row_idx), (-1, ttc_row_idx), "Helvetica-Bold"),
        ("FONTSIZE",      (0, ttc_row_idx), (-1, ttc_row_idx), 10),
    ]
    if tva_row_idx is not None:
        style_list += [
            ("BACKGROUND", (0, tva_row_idx), (-1, tva_row_idx), BLUE_TVA),
            ("TEXTCOLOR",  (0, tva_row_idx), (-1, tva_row_idx), main_color),
            ("FONTNAME",   (0, tva_row_idx), (-1, tva_row_idx), "Helvetica-Bold"),
        ]
    if advance > 0:
        style_list += [
            ("BACKGROUND", (0, -1), (-1, -1), main_color),
            ("TEXTCOLOR",  (0, -1), (-1, -1), WHITE),
            ("FONTNAME",   (0, -1), (-1, -1), "Helvetica-Bold"),
        ]
    recap.setStyle(TableStyle(style_list))

    cachet_cell: list = []
    if cachet_path and os.path.exists(cachet_path):
        try:
            cachet_cell.append(RLImage(cachet_path, width=4.5 * cm, height=4.5 * cm))
        except Exception:
            cachet_cell.append(Spacer(1, 4.5 * cm))
    else:
        cachet_cell.append(Spacer(1, 1 * cm))

    outer = Table(
        [[cachet_cell, Spacer(1, 1), recap]],
        colWidths=[8.5 * cm, 0.5 * cm, 10 * cm],
    )
    outer.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN",         (2, 0), (2, 0),   "RIGHT"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return outer


# ── Bordereau de livraison ────────────────────────────────────────────────────
def delivery_table(items, main_color, styles: dict) -> Table:
    th = ParagraphStyle("THD", fontName="Helvetica-Bold", fontSize=10,
                         textColor=WHITE, alignment=TA_CENTER)
    data = [[Paragraph("Qté", th), Paragraph("Désignation", th)]]
    for item in items:
        desc = item.description or (item.product.name if item.product else "—")
        qty  = item.quantity
        data.append([
            Paragraph(str(int(qty)) if qty == int(qty) else str(qty), styles["center"]),
            Paragraph(desc, styles["body"]),
        ])
    t = Table(data, colWidths=[2.5 * cm, 16.5 * cm], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), main_color),
        ("FONTNAME",      (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 10),
        ("TOPPADDING",    (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 8),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 9),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, GREY_ODD]),
        ("ALIGN",         (0, 1), (0, -1),  "CENTER"),
        ("LEFTPADDING",   (0, 1), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 1), (-1, -1), 6),
        ("TOPPADDING",    (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("BOX",           (0, 0), (-1, -1), 1.5, main_color),
        ("LINEBELOW",     (0, 0), (-1, 0),  1.5, main_color),
    ]))
    return t


# ── Résolution des chemins d'images ──────────────────────────────────────────
def resolve_image_paths(domaine: str, static_dirs: list) -> dict:
    is_sse = (domaine or "").upper() == "SSE"
    candidates = {
        "logo":   "logo_sse.PNG"   if is_sse else "logo_lgc.png",
        "cachet": "CachetSSE.PNG"  if is_sse else "CachetNetsys.PNG",
        "footer": "footer_sse.PNG" if is_sse else "footer_netsys.PNG",
    }
    result = {}
    for key, filename in candidates.items():
        for base in static_dirs:
            path = os.path.join(str(base), "img", filename)
            if os.path.exists(path):
                result[key] = path
                break
        else:
            result[key] = None
    return result