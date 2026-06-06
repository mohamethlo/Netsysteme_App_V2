# ─────────────────────────────────────────────────────────────────────────────
#  apps/interventions/pdf_intervention.py
#  Génère la fiche d'intervention PDF avec ReportLab.
#  Fidèle à 100 % au template Flask (deux pages, bleu #3498db, checkboxes,
#  info-box côte à côte, badges intervenants, signatures bas de page 2).
# ─────────────────────────────────────────────────────────────────────────────
import os
import base64
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image as RLImage, KeepTogether,
)
from reportlab.platypus.flowables import Flowable

from apps.billing.pdf_utils import (
    make_page_handler, get_image_margins,
    WHITE, BLACK,
)

# ── Palette identique au template Flask ──────────────────────────────────────
BLUE   = colors.HexColor("#3498db")   # couleur principale Flask
BLUE_D = colors.HexColor("#2980b9")   # bleu foncé (checked checkbox)
GREY_F = colors.HexColor("#f8fafc")   # fond sections
GREY_L = colors.HexColor("#cccccc")
TEXT   = colors.HexColor("#2c3e50")   # couleur texte Flask


# ── Styles de base ────────────────────────────────────────────────────────────
def _styles():
    body = ParagraphStyle(
        "Body", fontName="Helvetica", fontSize=9,
        textColor=TEXT, leading=13, spaceAfter=0,
    )
    bold = ParagraphStyle(
        "Bold", fontName="Helvetica-Bold", fontSize=9,
        textColor=TEXT, leading=13,
    )
    center = ParagraphStyle(
        "Center", fontName="Helvetica", fontSize=9,
        textColor=TEXT, leading=13, alignment=TA_CENTER,
    )
    small = ParagraphStyle(
        "Small", fontName="Helvetica", fontSize=7.5,
        textColor=TEXT, leading=11, alignment=TA_CENTER,
    )
    return dict(body=body, bold=bold, center=center, small=small)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _user_nom(u) -> str:
    if u is None:
        return "—"
    prenom = getattr(u, "prenom", "") or ""
    nom    = getattr(u, "nom",    "") or ""
    return f"{prenom} {nom}".strip() or getattr(u, "username", "—")


def _resolve_images(static_dirs: list) -> dict:
    candidates = {
        "logo":   "logo_lgc.png",
        "cachet": "CachetNetsys.PNG",
        "footer": "footer_netsys.PNG",
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


def _checkbox(label: str, checked: bool, S: dict) -> Paragraph:
    """Rendu d'une case à cocher (☑ ou ☐) comme dans le template Flask."""
    mark  = "☑" if checked else "☐"
    color = BLUE_D if checked else TEXT
    style = ParagraphStyle(
        "CB", fontName="Helvetica-Bold" if checked else "Helvetica",
        fontSize=9, textColor=color, leading=13,
    )
    return Paragraph(f"{mark} {label}", style)


def _hr(color=BLUE, thickness=0.8):
    return HRFlowable(width="100%", thickness=thickness, color=color,
                      spaceBefore=0, spaceAfter=0)


# ═════════════════════════════════════════════════════════════════════════════
#  FONCTION PRINCIPALE
# ═════════════════════════════════════════════════════════════════════════════
def generate_intervention_pdf(intervention, static_dirs: list) -> bytes:
    imgs   = _resolve_images(static_dirs)
    S      = _styles()
    buffer = BytesIO()

    # ── Page handler (logo en-tête + footer) ──────────────────────────────────
    on_page, logo_h, footer_h = make_page_handler(
        imgs["logo"], imgs["footer"], "NETSYSTEME"
    )
    margins = get_image_margins(logo_h, footer_h)

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        title=f"Fiche Intervention #{intervention.id}",
        # author="NETSYSTEME INFORMATIQUE & TELECOM",
        **margins,
    )

    # ── Infos de base ─────────────────────────────────────────────────────────
    if intervention.client:
        client_nom = (
            f"{intervention.client.nom or ''} "
            f"{intervention.client.prenom or ''}".strip()
        )
        entreprise = getattr(intervention.client, "entreprise", "") or ""
        if entreprise:
            client_nom += f" - {entreprise}"
    elif getattr(intervention, "client_libre_nom", None):
        client_nom = intervention.client_libre_nom
        societe    = getattr(intervention, "societe", "") or ""
        if societe:
            client_nom += f" - {societe}"
    else:
        client_nom = "—"

    tech_nom = _user_nom(intervention.responsable) or _user_nom(intervention.technicien)
    date_str = (
        intervention.date_prevue.strftime("%d/%m/%Y")
        if intervention.date_prevue else "—"
    )

    # ─────────────────────────────────────────────────────────────────────────
    #  PAGE 1
    # ─────────────────────────────────────────────────────────────────────────
    story = []
    story.append(Spacer(1, 0.3 * cm))

    # ── Titre centré ──────────────────────────────────────────────────────────
    story.append(Paragraph("FICHE D'INTERVENTION", ParagraphStyle(
        "MainTitle", fontName="Helvetica-Bold", fontSize=16,
        textColor=TEXT, alignment=TA_CENTER, spaceAfter=14,
    )))

    # ── Info-box : client (droite) | technicien (gauche) ─────────────────────
    # (Flask : info-box-left=technicien, info-box-right=client — inversé visuellement)
    PAGE_W = 19 * cm   # largeur utile entre marges

    label_style = ParagraphStyle(
        "ILabel", fontName="Helvetica-Bold", fontSize=9, textColor=TEXT,
        spaceAfter=3,
    )
    val_style = ParagraphStyle(
        "IVal", fontName="Helvetica", fontSize=9, textColor=TEXT, leading=13,
    )

    # Cellule droite — Société / client
    right_content = [
        [Paragraph("Société ou organisme :", label_style)],
        [Paragraph(client_nom, val_style)],
        [Paragraph(f"N°000{intervention.id}", val_style)],
    ]
    right_tbl = Table(right_content, colWidths=[PAGE_W / 2 - 1])
    right_tbl.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (0, 0),   6),
        ("BOTTOMPADDING", (0, -1), (0, -1), 6),
        ("TOPPADDING",    (0, 1), (-1, -2),  2),
        ("BOTTOMPADDING", (0, 1), (-1, -2),  2),
    ]))

    # Cellule gauche — Technicien
    left_content = [
        [Paragraph("Nom de l'intervenant :", label_style)],
        [Paragraph(tech_nom, val_style)],
    ]
    left_tbl = Table(left_content, colWidths=[PAGE_W / 2 - 1])
    left_tbl.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (0, 0),   6),
        ("BOTTOMPADDING", (0, -1), (0, -1), 6),
        ("TOPPADDING",    (0, 1), (-1, -1),  2),
        ("BOTTOMPADDING", (0, 1), (-1, -1),  2),
    ]))

    info_box = Table(
        [[right_tbl, left_tbl]],
        colWidths=[PAGE_W / 2, PAGE_W / 2],
    )
    info_box.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 1,   BLUE),
        ("LINEAFTER",     (0, 0), (0, -1),  1,   BLUE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(info_box)
    story.append(Spacer(1, 0.35 * cm))

    # ── Autres intervenants (badges) ──────────────────────────────────────────
    autres = list(intervention.autres_intervenants.all())
    if autres:
        noms = [_user_nom(u) for u in autres]

        # En-tête bleu
        header_ai = Table(
            [[Paragraph("AUTRES INTERVENANTS", ParagraphStyle(
                "AIH", fontName="Helvetica-Bold", fontSize=10,
                textColor=WHITE, alignment=TA_CENTER,
            ))]],
            colWidths=[PAGE_W],
        )
        header_ai.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), BLUE),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ]))

        # Badges : tableau multi-colonnes (max 4 par ligne)
        badge_style = ParagraphStyle(
            "Badge", fontName="Helvetica", fontSize=9,
            textColor=TEXT, alignment=TA_CENTER,
        )
        cols_per_row = min(4, len(noms))
        badge_w      = PAGE_W / cols_per_row
        badges_rows  = []
        row_buf      = []
        for i, nom in enumerate(noms):
            row_buf.append(Paragraph(nom, badge_style))
            if len(row_buf) == cols_per_row:
                badges_rows.append(row_buf)
                row_buf = []
        if row_buf:
            # Compléter la dernière ligne
            row_buf += [""] * (cols_per_row - len(row_buf))
            badges_rows.append(row_buf)

        badges_tbl = Table(
            badges_rows,
            colWidths=[badge_w] * cols_per_row,
        )
        badges_tbl.setStyle(TableStyle([
            ("BOX",           (0, 0), (-1, -1), 0.5, BLUE),
            ("INNERGRID",     (0, 0), (-1, -1), 0.5, GREY_L),
            ("BACKGROUND",    (0, 0), (-1, -1), GREY_F),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 8),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ]))

        ai_outer = Table(
            [[header_ai], [badges_tbl]],
            colWidths=[PAGE_W],
        )
        ai_outer.setStyle(TableStyle([
            ("BOX",           (0, 0), (-1, -1), 1,   BLUE),
            ("LEFTPADDING",   (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
            ("TOPPADDING",    (0, 0), (-1, -1), 0),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ]))
        story.append(ai_outer)
        story.append(Spacer(1, 0.35 * cm))

    # ── Tableau NATURE DE L'INTERVENTION ─────────────────────────────────────
    # Colonne 1 : catégorie | Colonne 2 : checkboxes | Colonne 3 : description (rowspan)
    # ReportLab ne supporte pas rowspan natif, on l'émule avec SPAN.

    type_inter = intervention.type_intervention or "Type inconnu"

    # Checkboxes colonne 2 — ligne 1 : Assistance Administrative
    cb_admin = "\n".join([
        "☐  Audit",
        "☐  Règlement",
        "☐  Conseil",
        "☐  Formation",
    ])

    # Checkboxes colonne 2 — ligne 2 : Assistance Technique (cochée dynamiquement)
    cb_tech = f"☑  {type_inter}"

    # Checkboxes colonne 2 — ligne 3 : Logiciel
    cb_logiciel = "\n".join([
        "☐  Installation logiciel",
        "☐  MAJ version logiciel",
        "☐  Formation initiale",
        "☐  Dépannage logiciel",
    ])

    desc_text = intervention.description or ""

    cb_style = ParagraphStyle(
        "CBStyle", fontName="Helvetica", fontSize=9,
        textColor=TEXT, leading=14,
    )
    cb_tech_style = ParagraphStyle(
        "CBTechStyle", fontName="Helvetica-Bold", fontSize=9,
        textColor=BLUE_D, leading=14,
    )
    cat_style = ParagraphStyle(
        "CatStyle", fontName="Helvetica", fontSize=9,
        textColor=TEXT, leading=14,
    )

    nature_data = [
        # En-tête
        [
            Paragraph("<b>NATURE DE L'INTERVENTION</b>", ParagraphStyle(
                "NH", fontName="Helvetica-Bold", fontSize=10,
                textColor=WHITE, alignment=TA_CENTER,
            )),
            "", "",
        ],
        # Ligne 1
        [
            Paragraph("- Assistance Administrative", cat_style),
            Paragraph(cb_admin.replace("\n", "<br/>"), cb_style),
            Paragraph(desc_text, S["body"]),   # rowspan sur 3 lignes
        ],
        # Ligne 2
        [
            Paragraph("- Assistance Technique", cat_style),
            Paragraph(cb_tech, cb_tech_style),
            "",   # couvert par SPAN
        ],
        # Ligne 3
        [
            Paragraph("- Logiciel", cat_style),
            Paragraph(cb_logiciel.replace("\n", "<br/>"), cb_style),
            "",   # couvert par SPAN
        ],
    ]

    col_w = [PAGE_W * 0.20, PAGE_W * 0.25, PAGE_W * 0.55]
    nature_tbl = Table(nature_data, colWidths=col_w)
    nature_tbl.setStyle(TableStyle([
        # En-tête bleu
        ("BACKGROUND",    (0, 0), (-1, 0),  BLUE),
        ("SPAN",          (0, 0), (-1, 0)),   # en-tête sur toute la largeur
        ("TOPPADDING",    (0, 0), (-1, 0),  8),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  8),
        # Rowspan description (colonne 2, lignes 1-3)
        ("SPAN",          (2, 1), (2, 3)),
        # Grille
        ("GRID",          (0, 0), (-1, -1), 1, BLUE),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",   (0, 1), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 1), (-1, -1), 8),
        ("TOPPADDING",    (0, 1), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 6),
        ("FONTNAME",      (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE",      (0, 1), (-1, -1), 9),
        ("TEXTCOLOR",     (0, 1), (-1, -1), TEXT),
    ]))
    story.append(nature_tbl)

    # ── Saut de page ──────────────────────────────────────────────────────────
    from reportlab.platypus import PageBreak
    story.append(PageBreak())

    # ─────────────────────────────────────────────────────────────────────────
    #  PAGE 2
    # ─────────────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.3 * cm))

    # ── Boîte principale page 2 ───────────────────────────────────────────────
    # Observations et suite donnée
    obs_text    = intervention.observations_technicien or ""
    taches_text = intervention.taches_realisees or "Aucune tâche renseignée"

    heure_arr  = intervention.heure_arrivee.strftime("%H:%M")  if getattr(intervention, "heure_arrivee", None)  else "--:--"
    heure_dep  = intervention.heure_depart.strftime("%H:%M")   if getattr(intervention, "heure_depart", None)   else "--:--"
    duree      = intervention.duree_intervention.strftime("%H:%M") if getattr(intervention, "duree_intervention", None) else "--:--"
    id_dvr     = getattr(intervention, "id_dvr_nvr",  None) or "Non renseigné"
    mdp_dvr    = getattr(intervention, "mdp_dvr_nvr", None) or "Non renseigné"

    row_label = ParagraphStyle(
        "RowLabel", fontName="Helvetica-Bold", fontSize=9,
        textColor=TEXT, spaceAfter=4,
    )
    row_val = ParagraphStyle(
        "RowVal", fontName="Helvetica", fontSize=9,
        textColor=TEXT, leading=13,
    )

    def _p2_row(label_text, value_text, bg=WHITE):
        return [
            Table(
                [
                    [Paragraph(label_text, row_label)],
                    [Paragraph(value_text, row_val)],
                ],
                colWidths=[PAGE_W - 2],
            )
        ]

    p2_rows = [
        [Paragraph("Observations et suite donnée :", row_label)],
        [Paragraph(obs_text or "—", row_val)],
        [_hr()],
        [Paragraph("Tâches réalisées :", row_label)],
        [Paragraph(taches_text, row_val)],
        [_hr()],
        [Paragraph(
            f"<b>Durée de l'intervention :</b> {duree} &nbsp;&nbsp; "
            f"<b>Heure d'arrivée :</b> {heure_arr} &nbsp;&nbsp; "
            f"<b>Heure de départ :</b> {heure_dep}",
            row_val,
        )],
        [_hr()],
        [Paragraph(
            f"<b>Identifiant DVR/NVR :</b> {id_dvr} &nbsp;&nbsp; "
            f"<b>Mot de passe DVR/NVR :</b> {mdp_dvr}",
            row_val,
        )],
    ]

    p2_inner = Table(p2_rows, colWidths=[PAGE_W - 16])
    p2_inner.setStyle(TableStyle([
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))

    p2_outer = Table([[p2_inner]], colWidths=[PAGE_W])
    p2_outer.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 1, BLUE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(p2_outer)
    story.append(Spacer(1, 0.5 * cm))

    # ── Bloc final : Observations du représentant ─────────────────────────────
    date_fait = (
        intervention.date_prevue.strftime("%d/%m/%Y")
        if intervention.date_prevue else "—"
    )

    # En-tête
    final_header = Table(
        [[Paragraph("Observations du représentant", ParagraphStyle(
            "FH", fontName="Helvetica-Bold", fontSize=10,
            textColor=WHITE,
        ))]],
        colWidths=[PAGE_W],
    )
    final_header.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 8),
    ]))

    # Cellule gauche : "La direction" + cachet + date
    dir_items = [
        Paragraph("<b>La direction</b>", ParagraphStyle(
            "DirL", fontName="Helvetica-Bold", fontSize=9,
            textColor=TEXT, alignment=TA_CENTER,
        )),
        Spacer(1, 4),
        _hr(color=BLUE, thickness=0.5),
        Spacer(1, 8),
    ]

    if imgs["cachet"] and os.path.exists(imgs["cachet"]):
        try:
            dir_items.append(RLImage(imgs["cachet"], width=3.5 * cm, height=3.5 * cm))
        except Exception:
            dir_items.append(Spacer(1, 3.5 * cm))
    else:
        dir_items.append(Spacer(1, 3.5 * cm))

    dir_items.append(Spacer(1, 6))
    dir_items.append(Paragraph(
        f"Fait le : {date_fait}",
        ParagraphStyle("DateFait", fontName="Helvetica", fontSize=9,
                       textColor=TEXT, alignment=TA_CENTER),
    ))

    dir_cell = Table([[item] for item in dir_items], colWidths=[PAGE_W / 2 - 1])
    dir_cell.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (0, 0),   12),
        ("BOTTOMPADDING", (0, -1), (0, -1), 12),
        ("TOPPADDING",    (0, 1), (-1, -2),  3),
        ("BOTTOMPADDING", (0, 1), (-1, -2),  3),
    ]))

    # Cellule droite : signature représentant
    sig_items = [
        Paragraph("<b>Signature représentant</b>", ParagraphStyle(
            "SigL", fontName="Helvetica-Bold", fontSize=9,
            textColor=TEXT, alignment=TA_CENTER,
        )),
        Spacer(1, 4),
        _hr(color=BLUE, thickness=0.5),
        Spacer(1, 8),
    ]

    sig_data = getattr(intervention, "signature_data", None)
    if sig_data:
        try:
            b64_part  = sig_data.split(",")[1] if "," in sig_data else sig_data
            sig_bytes = BytesIO(base64.b64decode(b64_part))
            sig_items.append(RLImage(sig_bytes, width=5 * cm, height=2.5 * cm))
        except Exception:
            sig_items.append(Spacer(1, 2.5 * cm))
    else:
        sig_items.append(Spacer(1, 2.5 * cm))

    sig_cell = Table([[item] for item in sig_items], colWidths=[PAGE_W / 2 - 1])
    sig_cell.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
        ("TOPPADDING",    (0, 0), (0, 0),   12),
        ("BOTTOMPADDING", (0, -1), (0, -1), 12),
        ("TOPPADDING",    (0, 1), (-1, -2),  3),
        ("BOTTOMPADDING", (0, 1), (-1, -2),  3),
    ]))

    # Assemblage du bloc final
    final_content = Table(
        [[dir_cell, sig_cell]],
        colWidths=[PAGE_W / 2, PAGE_W / 2],
    )
    final_content.setStyle(TableStyle([
        ("LINEAFTER",     (0, 0), (0, -1), 1, BLUE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))

    final_outer = Table(
        [[final_header], [final_content]],
        colWidths=[PAGE_W],
    )
    final_outer.setStyle(TableStyle([
        ("BOX",           (0, 0), (-1, -1), 1, BLUE),
        ("LEFTPADDING",   (0, 0), (-1, -1), 0),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 0),
        ("TOPPADDING",    (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(KeepTogether(final_outer))

    # ── Build ──────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()