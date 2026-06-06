# ─────────────────────────────────────────────────────────────────────────────
#  apps/installations/pdf_receipt.py
#  Reçu de versement SSE — format A5
# ─────────────────────────────────────────────────────────────────────────────
import os
import datetime
from io import BytesIO

from reportlab.lib.pagesizes import A5
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, Image,
)

# ── Palette (identique au contrat) ────────────────────────────────────────────
NAVY       = colors.HexColor("#1a3c6e")
LIGHT_BLUE = colors.HexColor("#e8f0fb")
GREY_HDR   = colors.HexColor("#f0f0f0")
GREY_ROW   = colors.HexColor("#f5f5f5")
DARK       = colors.HexColor("#1a1a1a")
WHITE      = colors.white
GREEN      = colors.HexColor("#10b981")
RED        = colors.HexColor("#ef4444")

PAGE_W, PAGE_H = A5
CONTENT_W = PAGE_W - 3 * cm   # marges 1.5cm × 2


# ── Styles ────────────────────────────────────────────────────────────────────
def _styles():
    base = getSampleStyleSheet()
    B = "Times-Bold"
    N = "Times-Roman"
    I = "Times-Italic"
    return {
        "title":       ParagraphStyle("RTitle",    parent=base["Normal"], fontName=B, fontSize=13, textColor=NAVY,  alignment=TA_CENTER, spaceBefore=2, spaceAfter=3),
        "receipt_no":  ParagraphStyle("RNo",       parent=base["Normal"], fontName=I, fontSize=8,  textColor=colors.HexColor("#555555"), alignment=TA_CENTER, spaceAfter=2),
        "body":        ParagraphStyle("RBody",     parent=base["Normal"], fontName=N, fontSize=9,  textColor=DARK, spaceAfter=2),
        "body_bold":   ParagraphStyle("RBodyBold", parent=base["Normal"], fontName=B, fontSize=9,  textColor=DARK),
        "center":      ParagraphStyle("RCenter",   parent=base["Normal"], fontName=B, fontSize=9,  textColor=DARK, alignment=TA_CENTER),
        "amount":      ParagraphStyle("RAmount",   parent=base["Normal"], fontName=B, fontSize=18, textColor=NAVY, alignment=TA_CENTER, spaceBefore=4, spaceAfter=4),
        "paid_label":  ParagraphStyle("RPaid",     parent=base["Normal"], fontName=N, fontSize=8,  textColor=DARK, alignment=TA_CENTER, spaceAfter=1),
        "success":     ParagraphStyle("RSuccess",  parent=base["Normal"], fontName=B, fontSize=10, textColor=GREEN, alignment=TA_CENTER, spaceBefore=4),
    }


# ── Footer ────────────────────────────────────────────────────────────────────
def _footer(canvas, doc):
    canvas.saveState()
    w, _ = A5
    canvas.setFillColor(DARK)
    canvas.setFont("Times-Roman", 7)
    canvas.drawCentredString(
        w / 2, 0.85 * cm,
        "WhatsApp : 77 846 16 55  |  Bureau : 33 827 28 45 / 33 883 42 42",
    )
    canvas.setFont("Times-Roman", 6.5)
    canvas.drawCentredString(
        w / 2, 0.45 * cm,
        "Ouest Foire, route de l'aéroport Léopold Sédar Senghor, Immeuble Seigneurie  |  www.sse.sn",
    )
    canvas.restoreState()


# ── Header logo ───────────────────────────────────────────────────────────────
def _header_logo(canvas, doc, logo_path):
    if not logo_path or not os.path.exists(logo_path):
        return
    canvas.saveState()
    w, h = A5
    try:
        canvas.drawImage(
            logo_path, 0, h - 2.8 * cm,
            width=w, height=2.8 * cm,
            preserveAspectRatio=False, mask="auto",
        )
    except Exception:
        pass
    canvas.restoreState()


def _on_page(canvas, doc, logo_path):
    _header_logo(canvas, doc, logo_path)
    _footer(canvas, doc)


# ── Règle horizontale fine ────────────────────────────────────────────────────
def _rule(color=colors.HexColor("#cccccc"), thickness=0.5):
    return HRFlowable(width="100%", thickness=thickness, color=color, spaceAfter=4, spaceBefore=4)


# ── Fonction principale ───────────────────────────────────────────────────────
def generate_receipt_pdf(installation, montant_verse: float, logo_path=None, cachet_path=None) -> bytes:
    """
    Génère un reçu de versement au format A5.
    montant_verse : montant du versement qui vient d'être enregistré.
    Les champs montant_avance / montant_restant de l'installation sont déjà
    mis à jour avant l'appel à cette fonction.
    """
    buffer = BytesIO()
    S      = _styles()

    now        = datetime.datetime.now()
    date_str   = now.strftime("%d/%m/%Y")
    time_str   = now.strftime("%H:%M")
    receipt_no = f"RECU-{installation.id}-{now.strftime('%Y%m%d%H%M%S')}"

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A5,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=3.2 * cm,
        bottomMargin=1.8 * cm,
        title=f"Reçu — {getattr(installation, 'prenom', '')} {getattr(installation, 'nom', '')}",
    )

    def on_page(canvas, doc):
        _on_page(canvas, doc, logo_path)

    fmt = lambda n: f"{n:,.0f} FCFA".replace(",", "\u202f")
    prenom = getattr(installation, "prenom",    "") or ""
    nom    = getattr(installation, "nom",       "") or ""
    tel    = getattr(installation, "telephone", "") or ""

    story = []

    # ── Titre ─────────────────────────────────────────────────────────────────
    story.append(Paragraph("REÇU DE VERSEMENT", S["title"]))
    story.append(Paragraph(f"N° {receipt_no}", S["receipt_no"]))
    story.append(_rule(NAVY, 1.5))
    story.append(Spacer(1, 0.1 * cm))

    # ── Date / Heure ──────────────────────────────────────────────────────────
    col = CONTENT_W / 2
    story.append(Table(
        [[Paragraph(f"Date : <b>{date_str}</b>", S["body"]),
          Paragraph(f"Heure : <b>{time_str}</b>", S["body"])]],
        colWidths=[col, col],
    ))
    story.append(Spacer(1, 0.15 * cm))

    # ── Client ────────────────────────────────────────────────────────────────
    story.append(_rule())
    label_w  = 3.2 * cm
    value_w  = CONTENT_W - label_w
    client_rows = [
        [Paragraph("<b>CLIENT</b>", S["body_bold"]), ""],
        [Paragraph("Nom :",       S["body"]), Paragraph(f"<b>{prenom} {nom}</b>", S["body_bold"])],
        [Paragraph("Téléphone :", S["body"]), Paragraph(tel, S["body"])],
    ]
    if getattr(installation, "adresse", None):
        client_rows.append([Paragraph("Adresse :", S["body"]), Paragraph(installation.adresse, S["body"])])

    client_tbl = Table(client_rows, colWidths=[label_w, value_w])
    client_tbl.setStyle(TableStyle([
        ("SPAN",          (0, 0), (-1, 0)),
        ("BACKGROUND",    (0, 0), (-1, 0), GREY_HDR),
        ("TOPPADDING",    (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
    ]))
    story.append(client_tbl)
    story.append(Spacer(1, 0.2 * cm))

    # ── Montant versé (mis en valeur) ─────────────────────────────────────────
    story.append(_rule())
    story.append(Paragraph("MONTANT VERSÉ", S["paid_label"]))
    story.append(Paragraph(fmt(montant_verse), S["amount"]))
    story.append(_rule())
    story.append(Spacer(1, 0.15 * cm))

    # ── Récap paiement ────────────────────────────────────────────────────────
    montant_total   = getattr(installation, "montant_total",   0) or 0
    montant_avance  = getattr(installation, "montant_avance",  0) or 0
    montant_restant = getattr(installation, "montant_restant", 0) or 0

    rest_style = ParagraphStyle(
        "RestBold", parent=S["body_bold"],
        textColor=GREEN if montant_restant <= 0 else RED,
    )

    recap_data = [
        [Paragraph("Montant total",     S["body"]),
         Paragraph(fmt(montant_total),  S["body"])],
        [Paragraph("Total déjà payé",   S["body"]),
         Paragraph(fmt(montant_avance), S["body"])],
        [Paragraph("<b>Reste à payer</b>", S["body_bold"]),
         Paragraph(f"<b>{fmt(montant_restant)}</b>", rest_style)],
    ]
    lbl_w = 5 * cm
    val_w = CONTENT_W - lbl_w
    recap_tbl = Table(recap_data, colWidths=[lbl_w, val_w])
    recap_tbl.setStyle(TableStyle([
        ("ROWBACKGROUNDS", (0, 0),  (-1, -2), [WHITE, GREY_ROW]),
        ("BACKGROUND",     (0, -1), (-1, -1), LIGHT_BLUE),
        ("ALIGN",          (1, 0),  (1, -1),  "RIGHT"),
        ("TOPPADDING",     (0, 0),  (-1, -1), 4),
        ("BOTTOMPADDING",  (0, 0),  (-1, -1), 4),
        ("LEFTPADDING",    (0, 0),  (-1, -1), 6),
        ("RIGHTPADDING",   (0, 0),  (-1, -1), 6),
        ("GRID",           (0, 0),  (-1, -1), 0.5, colors.HexColor("#e0e0e0")),
        ("LINEABOVE",      (0, -1), (-1, -1), 1.2, NAVY),
    ]))
    story.append(recap_tbl)
    story.append(Spacer(1, 0.25 * cm))

    # ── Statut ────────────────────────────────────────────────────────────────
    if montant_restant <= 0:
        story.append(Paragraph("✓  PAIEMENT INTÉGRAL — MERCI !", S["success"]))
        story.append(Spacer(1, 0.15 * cm))

    # ── Zone signature ────────────────────────────────────────────────────────
    story.append(_rule())
    story.append(Spacer(1, 0.3 * cm))

    # Cachet SSE
    if cachet_path and os.path.exists(cachet_path):
        try:
            _tmp   = Image(cachet_path)
            _max_w = 3.5 * cm
            _max_h = 2.5 * cm
            _scale = min(_max_w / _tmp.imageWidth, _max_h / _tmp.imageHeight)
            cachet = Image(cachet_path,
                           width=_tmp.imageWidth  * _scale,
                           height=_tmp.imageHeight * _scale)
            cachet.hAlign = "LEFT"
            story.append(cachet)
        except Exception:
            story.append(Paragraph("SSE SUARL", S["body_bold"]))
    else:
        story.append(Paragraph("SSE SUARL", S["body_bold"]))

    story.append(Spacer(1, 0.15 * cm))
    # story.append(Paragraph("Signature / Cachet SSE", S["receipt_no"]))

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()
