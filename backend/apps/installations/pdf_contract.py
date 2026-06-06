# ─────────────────────────────────────────────────────────────────────────────
#  apps/installations/pdf_contract.py
#  Contrat de vente SSE — design premium inspiré du template HTML d'origine
#  Fidélité maximale : logo pleine largeur, Times New Roman, tableaux identiques,
#  footer sur toutes les pages, signatures sur la dernière page
# ─────────────────────────────────────────────────────────────────────────────
import os
import datetime
from io import BytesIO

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_RIGHT, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image, PageBreak, KeepTogether,
)


# ── Palette ───────────────────────────────────────────────────────────────────
NAVY        = colors.HexColor("#1a3c6e")   # bleu marine (titres, header tableau, footer)
GOLD        = colors.HexColor("#c9a227")   # doré (filets décoratifs)
LIGHT_BLUE  = colors.HexColor("#e8f0fb")   # ligne total tableau
GREY_ROW    = colors.HexColor("#f5f5f5")   # lignes alternées
GREY_HDR    = colors.HexColor("#f0f0f0")   # en-têtes tableau (comme HTML)
DARK        = colors.HexColor("#1a1a1a")   # texte principal
MID         = colors.HexColor("#333333")
BORDER      = colors.HexColor("#000000")   # bordures tableau (identique HTML)
WHITE       = colors.white
PAGE_W, PAGE_H = A4


# ── Styles ────────────────────────────────────────────────────────────────────
def _styles():
    base = getSampleStyleSheet()

    # Times New Roman comme dans le HTML original
    FONT_NORMAL = "Times-Roman"
    FONT_BOLD   = "Times-Bold"

    contract_title = ParagraphStyle(
        "ContractTitle",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=16,
        textColor=DARK,
        alignment=TA_CENTER,
        spaceAfter=4,
        spaceBefore=4,
        underlineProportion=0.05,
    )
    date_style = ParagraphStyle(
        "Date",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=11,
        textColor=DARK,
        alignment=TA_RIGHT,
        spaceAfter=6,
    )
    party_title = ParagraphStyle(
        "PartyTitle",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=11,
        textColor=DARK,
        spaceBefore=8,
        spaceAfter=4,
    )
    body = ParagraphStyle(
        "Body",
        parent=base["Normal"],
        fontName=FONT_NORMAL,
        fontSize=11,
        textColor=DARK,
        alignment=TA_JUSTIFY,
        leading=18,
        spaceAfter=4,
    )
    body_bold = ParagraphStyle(
        "BodyBold",
        parent=body,
        fontName=FONT_BOLD,
    )
    intro = ParagraphStyle(
        "Intro",
        parent=body,
        fontName=FONT_BOLD,
        fontSize=11,
        alignment=TA_CENTER,
        spaceBefore=8,
        spaceAfter=8,
    )
    article_title = ParagraphStyle(
        "ArticleTitle",
        parent=base["Normal"],
        fontName=FONT_BOLD,
        fontSize=11,
        textColor=DARK,
        spaceBefore=10,
        spaceAfter=4,
    )
    center = ParagraphStyle(
        "Center",
        parent=body,
        alignment=TA_CENTER,
        fontName=FONT_BOLD,
    )
    center_normal = ParagraphStyle(
        "CenterNormal",
        parent=body,
        alignment=TA_CENTER,
        fontName=FONT_NORMAL,
    )
    footer_style = ParagraphStyle(
        "Footer",
        parent=base["Normal"],
        fontName=FONT_NORMAL,
        fontSize=8,
        textColor=colors.HexColor("#ffffff"),
        alignment=TA_CENTER,
        leading=12,
    )
    small_grey = ParagraphStyle(
        "SmallGrey",
        parent=body,
        fontSize=9,
        textColor=colors.grey,
    )
    return {
        "contract_title": contract_title,
        "date":          date_style,
        "party_title":   party_title,
        "body":          body,
        "body_bold":     body_bold,
        "intro":         intro,
        "article_title": article_title,
        "center":        center,
        "center_normal": center_normal,
        "footer_style":  footer_style,
        "small_grey":    small_grey,
    }


# ── Footer — fond blanc, texte sombre ─────────────────────────────────────────
def _footer(canvas, doc):
    canvas.saveState()
    w, h = A4

    canvas.setFillColor(DARK)
    canvas.setFont("Times-Roman", 8)
    canvas.drawCentredString(
        w / 2, 1.1 * cm,
        "WhatsApp : 77 846 16 55  |  Bureau : 33 827 28 45 / 33 883 42 42  |  "
        "Ouest Foire, route de l'aéroport Léopold Sédar Senghor, Immeuble Seigneurie"
    )
    canvas.setFont("Times-Roman", 7.5)
    canvas.drawCentredString(w / 2, 0.6 * cm, "Site web : www.sse.sn")

    # Numéro de page (discret, coin droit)
    canvas.setFillColor(colors.HexColor("#aaaaaa"))
    canvas.setFont("Times-Roman", 7)
    canvas.drawRightString(w - 0.8 * cm, 0.25 * cm, f"Page {doc.page}")

    canvas.restoreState()


# ── Header logo pleine largeur (première page uniquement) ──────────────────────
def _header_logo(canvas, doc, logo_path):
    if not logo_path or not os.path.exists(logo_path):
        return
    if doc.page != 1:
        return
    canvas.saveState()
    w, h = A4
    try:
        canvas.drawImage(
            logo_path,
            0, h - 3.8 * cm,
            width=w,
            height=3.8 * cm,
            preserveAspectRatio=False,
            mask="auto",
        )
    except Exception:
        pass
    canvas.restoreState()


def _on_page(canvas, doc, logo_path):
    _header_logo(canvas, doc, logo_path)
    _footer(canvas, doc)


# ── Ligne décorative dorée ────────────────────────────────────────────────────
def _gold_rule():
    return HRFlowable(width="100%", thickness=1.5, color=GOLD, spaceAfter=4, spaceBefore=4)


def _navy_rule():
    return HRFlowable(width="100%", thickness=2, color=NAVY, spaceAfter=4, spaceBefore=2)


# ── Tableau produits (identique au HTML) ──────────────────────────────────────
def _products_table(installation, S):
    fmt = lambda n: f"{n:,.0f} FCFA".replace(",", "\u202f")

    data = [[
        Paragraph("<b>Désignation</b>", S["body_bold"]),
        Paragraph("<b>Qté</b>",        S["body_bold"]),
        Paragraph("<b>Prix unitaire</b>", S["body_bold"]),
        Paragraph("<b>Total</b>",       S["body_bold"]),
    ]]

    for item in installation.products.select_related("product").all():
        name = (item.product.description if item.product else None) or (item.product.name if item.product else None) or "—"
        data.append([
            Paragraph(name, S["body"]),
            Paragraph(str(item.quantity), S["center_normal"]),
            Paragraph(fmt(item.unit_price), S["body"]),
            Paragraph(fmt(item.total_price), S["body"]),
        ])

    # Ligne total
    data.append([
        Paragraph("<b>MONTANT TOTAL À PAYER</b>", S["body_bold"]),
        "", "",
        Paragraph(f"<b>{fmt(installation.montant_total)}</b>", S["body_bold"]),
    ])

    col_w = [9 * cm, 2 * cm, 4 * cm, 3.5 * cm]
    t = Table(data, colWidths=col_w)
    t.setStyle(TableStyle([
        # En-tête — fond gris clair comme le HTML original
        ("BACKGROUND",    (0, 0), (-1, 0), GREY_HDR),
        ("TEXTCOLOR",     (0, 0), (-1, 0), DARK),
        ("FONTNAME",      (0, 0), (-1, 0), "Times-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 10),
        ("ALIGN",         (0, 0), (-1, 0), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        # Corps
        ("FONTNAME",      (0, 1), (-1, -2), "Times-Roman"),
        ("FONTSIZE",      (0, 1), (-1, -1), 10),
        ("ROWBACKGROUNDS",(0, 1), (-1, -2), [WHITE, GREY_ROW]),
        ("ALIGN",         (1, 1), (1, -1), "CENTER"),
        ("ALIGN",         (2, 1), (-1, -1), "RIGHT"),
        # Ligne total — fond bleu clair comme le HTML
        ("BACKGROUND",    (0, -1), (-1, -1), LIGHT_BLUE),
        ("FONTNAME",      (0, -1), (-1, -1), "Times-Bold"),
        ("ALIGN",         (0, -1), (-1, -1), "RIGHT"),
        ("SPAN",          (0, -1), (2, -1)),
        # Filet doré au-dessus de la ligne total
        ("LINEABOVE",     (0, -1), (-1, -1), 1.5, GOLD),
        # Bordures noires comme dans le HTML
        ("GRID",          (0, 0), (-1, -1), 0.8, BORDER),
        ("LINEBELOW",     (0, 0), (-1, 0), 1.5, NAVY),
        # Padding
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
        ("TOPPADDING",    (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ]))
    return t


# ── Tableau calendrier de paiement ────────────────────────────────────────────
def _payment_table(payment_schedule, installation, S):
    fmt = lambda n: f"{n:,.0f} FCFA".replace(",", "\u202f")

    data = [[
        Paragraph("<b>Modalité de paiement</b>", S["body_bold"]),
        Paragraph("<b>Date d'échéance</b>",       S["body_bold"]),
        Paragraph("<b>Montant</b>",               S["body_bold"]),
    ]]

    for p in payment_schedule:
        data.append([
            Paragraph(f"<b>{p['description']}</b>", S["body"]),
            Paragraph(str(p["date"]),               S["center_normal"]),
            Paragraph(fmt(p["montant"]),             S["body"]),
        ])

    # Total
    total = sum(p["montant"] for p in payment_schedule)
    data.append([
        Paragraph("<b>TOTAL À PAYER</b>", S["body_bold"]),
        "",
        Paragraph(f"<b>{fmt(total)}</b>", S["body_bold"]),
    ])

    col_w = [8 * cm, 4.5 * cm, 6 * cm]
    t = Table(data, colWidths=col_w)
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0), GREY_HDR),
        ("TEXTCOLOR",     (0, 0), (-1, 0), DARK),
        ("FONTNAME",      (0, 0), (-1, 0), "Times-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0), 10),
        ("ALIGN",         (0, 0), (-1, 0), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        ("FONTNAME",      (0, 1), (-1, -2), "Times-Roman"),
        ("FONTSIZE",      (0, 1), (-1, -1), 10),
        ("ROWBACKGROUNDS",(0, 1), (-1, -2), [WHITE, GREY_ROW]),
        ("ALIGN",         (1, 1), (1, -1), "CENTER"),
        ("ALIGN",         (2, 1), (-1, -1), "RIGHT"),
        ("BACKGROUND",    (0, -1), (-1, -1), LIGHT_BLUE),
        ("FONTNAME",      (0, -1), (-1, -1), "Times-Bold"),
        ("ALIGN",         (0, -1), (-1, -1), "RIGHT"),
        ("SPAN",          (0, -1), (1, -1)),
        ("LINEABOVE",     (0, -1), (-1, -1), 1.5, GOLD),
        ("GRID",          (0, 0), (-1, -1), 0.8, BORDER),
        ("LINEBELOW",     (0, 0), (-1, 0), 1.5, NAVY),
        ("LEFTPADDING",   (0, 0), (-1, -1), 7),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 7),
        ("TOPPADDING",    (0, 1), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 5),
    ]))
    return t


# ── Fonction principale ───────────────────────────────────────────────────────
def generate_contract_pdf(installation, logo_path=None, cachet_path=None):
    """
    Génère le contrat de vente SSE en PDF.
    Design fidèle au template HTML Flask d'origine :
      - Police Times New Roman
      - Logo pleine largeur en haut de la première page
      - Tableaux avec fond gris clair en en-tête et ligne total bleu clair
      - Footer NAVY sur chaque page
      - Signatures sur une page dédiée
    """
    buffer = BytesIO()
    S      = _styles()

    # Marges : espace pour logo (première page) + footer (toutes pages)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=2.2 * cm,
        rightMargin=2.2 * cm,
        topMargin=4.2 * cm,   # réservé au logo
        bottomMargin=2.4 * cm,
        title=f"Contrat de Vente SSE — {getattr(installation, 'prenom', '')} {getattr(installation, 'nom', '')}",
        author="SSE SUARL",
    )

    def on_page(canvas, doc):
        _on_page(canvas, doc, logo_path)

    story = []

    date_str = (
        installation.created_at.strftime("%d/%m/%Y")
        if getattr(installation, "created_at", None)
        else datetime.date.today().strftime("%d/%m/%Y")
    )

    # ── Titre principal ───────────────────────────────────────────────────────
    story.append(Spacer(1, 0.3 * cm))
    story.append(Paragraph("CONTRAT DE VENTE", S["contract_title"]))
    story.append(Spacer(1, 0.35 * cm))

    # Date
    story.append(Paragraph(f"Date : {date_str}", S["date"]))
    story.append(Spacer(1, 0.5 * cm))

    # ── Parties ───────────────────────────────────────────────────────────────
    story.append(Paragraph("ENTRE :", S["party_title"]))
    story.append(Paragraph(
        "La société <b>SÉNÉGALAISE DE SÉCURITÉ ET D'ÉQUIPEMENT (SSE SUARL)</b>, "
        "ayant son siège social à Ouest Foire sur la route de l'Aéroport Léopold Sédar SENGHOR, "
        "Immeuble Seigneurie, (Dakar), inscrite au RCCM sous le numéro "
        "<b>SN.DKR 2022 B36285</b>, immatriculée fiscalement sous le numéro NINEA "
        "<b>009788988</b>, représentée aux fins des présentes par son Gérant Monsieur "
        "<b>AMETH DIARRA</b>, ayant tous pouvoirs à l'effet des présentes.",
        S["body"],
    ))
    story.append(Paragraph("Ci-après dénommée <b>le Vendeur</b> ;", S["body"]))
    story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph("ET :", S["party_title"]))
    has_company = bool(
        getattr(installation, "rccm",        None) or
        getattr(installation, "immatricule",  None) or
        getattr(installation, "ninea",        None)
    )
    prenom = getattr(installation, "prenom", "")
    nom    = getattr(installation, "nom",    "")
    adresse= getattr(installation, "adresse","")
    tel    = getattr(installation, "telephone","")

    if has_company:
        client_txt = f"La société <b>{nom} {prenom}</b>"
        if adresse:
            client_txt += f", ayant son siège social à <b>{adresse}</b>"
        if getattr(installation, "rccm", None):
            client_txt += f", inscrite au RCCM sous le numéro <b>{installation.rccm}</b>"
        if getattr(installation, "ninea", None):
            client_txt += f", immatriculée fiscalement sous le numéro NINEA <b>{installation.ninea}</b>"
        if getattr(installation, "immatricule", None):
            client_txt += f", N° Immatriculation <b>{installation.immatricule}</b>"
        client_txt += f", représentée aux fins des présentes par son Gérant/Directeur <b>{prenom} {nom}</b>, ayant tout pouvoir à l'effet des présentes."
    else:
        client_txt = f"Monsieur/Madame <b>{prenom} {nom}</b>"
        if adresse:
            client_txt += f", domicilié(e) à <b>{adresse}</b>"
        if tel:
            client_txt += f", Téléphone : <b>{tel}</b>"
        client_txt += "."

    story.append(Paragraph(client_txt, S["body"]))
    story.append(Paragraph("Ci-après dénommé(e) <b>l'Acheteur</b>.", S["body"]))
    story.append(Spacer(1, 0.4 * cm))

    # Séparateur + formule intro
    story.append(Spacer(1, 0.2 * cm))
    story.append(Paragraph("IL A ÉTÉ CONVENU ET ARRÊTÉ CE QUI SUIT :", S["intro"]))
    story.append(Spacer(1, 0.3 * cm))

    # ── Art. 1 ────────────────────────────────────────────────────────────────
    story.append(Paragraph("Art.1 : Description générale du Matériel", S["article_title"]))
    story.append(Paragraph(
        "La société Sénégalaise de Sécurité et d'Équipement (SSE SUARL) est propriétaire du lot "
        "de matériels suivant et ci-après dénommé : « Caméra de surveillance ou Matériel de "
        "surveillance » avec les caractéristiques suivantes :",
        S["body"],
    ))
    story.append(Spacer(1, 0.25 * cm))

    if hasattr(installation, "products") and installation.products.exists():
        story.append(_products_table(installation, S))
    else:
        story.append(Paragraph("[Aucun produit renseigné]", S["small_grey"]))

    story.append(Spacer(1, 0.4 * cm))

    # Calendrier paiement
    payment_schedule = None
    if hasattr(installation, "get_payment_schedule"):
        payment_schedule = installation.get_payment_schedule()

    if payment_schedule:
        story.append(Paragraph(
            "INFORMATIONS FINANCIÈRES SUITE DEVIS", S["center"]
        ))
        story.append(Spacer(1, 0.25 * cm))
        story.append(_payment_table(payment_schedule, installation, S))
        story.append(Spacer(1, 0.3 * cm))

    story.append(Paragraph(
        "Le type et les séries de la ou des caméra(s) de surveillance sont plus amplement "
        "décrits dans les photos annexées au présent contrat.",
        S["body"],
    ))

    # ── Art. 2–14 ─────────────────────────────────────────────────────────────
    fmt = lambda n: f"{n:,.0f} FCFA".replace(",", "\u202f")
    montant_total  = getattr(installation, "montant_total",  0)
    montant_avance = getattr(installation, "montant_avance", 0)
    date_echeance  = getattr(installation, "date_echeance",  None)

    articles = [
        ("Art.2 : Vente",
         "La société Sénégalaise de Sécurité et d'Équipement (SSE SUARL) déclare vendre à "
         "l'Acheteur, qui accepte, la ou les caméra(s) de surveillance ainsi décrite(s) et "
         "définie(s) sur les photos annexées au présent contrat."),

        ("Art.3 : Modalités de vente du matériel",
         f"Le prix intégral de vente de la ou des caméra(s) à payer par l'Acheteur est de "
         f"<b>{fmt(montant_total)}</b> HT tel que spécifié ci-précèdent. "
         f"Le paiement intégral du prix du Matériel de surveillance sera exigible trente (30) "
         f"jours après sa livraison effective"
         + (f", soit au plus tard le <b>{date_echeance.strftime('%d/%m/%Y')}</b>"
            if date_echeance else "")
         + "."),

        ("Art.4 : Acompte",
         f"Lors de la signature du présent contrat, l'Acheteur déposera un acompte à titre de "
         f"dépôt pour l'achat dudit Matériel de surveillance. L'acompte versé s'élève à "
         f"<b>{fmt(montant_avance)}</b> et est déductible du prix d'achat."),

        ("Art.5 : Transfert de propriété – Réserve de propriété",
         "Le transfert de propriété du Matériel de surveillance à l'Acheteur ne s'effectuera "
         "qu'après paiement complet du prix convenu, déduction faite de l'acompte prévu à "
         "l'article précédent. Les biens composants le Matériel de surveillance sont vendus à "
         "l'Acheteur sous réserve de propriété. Ces dispositions ne font toutefois pas obstacle "
         "au transfert des risques que peuvent courir ou occasionner les biens vendus à compter "
         "de la signature du présent contrat conformément à l'article 7 ci-dessous."),

        ("Art.6 : Enlèvement et livraison du matériel",
         "L'enlèvement et la livraison du Matériel de surveillance peuvent être effectués et "
         "organisés dès la signature du présent contrat. L'Acheteur peut, après paiement de "
         "l'acompte prévu à l'article 4 du présent contrat, procéder par ses soins à "
         "l'enlèvement du Matériel de surveillance. Les frais afférents aux opérations de "
         "livraison seront à la charge du Vendeur. En cas d'enlèvement à la diligence du "
         "Vendeur, les frais éventuels sont à la charge de l'Acheteur à partir de la mise à "
         "disposition effective au lieu de livraison."),

        ("Art.7 : Responsabilité – Transfert des risques",
         "L'Acheteur supporte, à l'entière décharge du Vendeur, l'ensemble des risques liés à "
         "la qualité du Matériel de surveillance depuis sa mise à disposition à l'endroit "
         "mentionné dans le présent contrat."),

        ("Art.8 : État du matériel",
         "Le Vendeur déclare être en pleine propriété du Matériel de surveillance et certifie "
         "que les biens vendus ne sont grevés d'aucune charge. Le Matériel de surveillance est "
         "livré dans l'état bien connu de l'Acheteur, lequel ne requiert pas de description "
         "autre que celle figurant sur les photos annexées au présent contrat."),

        ("Art.9 : Garanties",
         "Le Vendeur garantit le Matériel de surveillance contre les droits que d'autres "
         "personnes prétendraient faire valoir sur le matériel vendu. Sur demande du Vendeur, "
         "l'Acheteur doit signer et lui remettre tout document nécessaire pour la perfection du "
         "présent contrat."),

        ("Art.10 : Force majeure",
         "Le Vendeur ne sera pas responsable des réclamations ou dommages résultant de tout "
         "retard dans la livraison ou pour toute non-exécution en raison de la survenance d'un "
         "cas de force majeure, indépendant de sa volonté."),

        ("Art.11 : Cession de droits",
         "Aucune des parties ne peut céder les droits qu'elle tient en vertu du présent contrat, "
         "sauf consentement préalable exprès de l'autre partie. Toute cession intervenue en "
         "violation du présent article est nulle."),

        ("Art.12 : Avenant",
         "Pour être valable, tout avenant au présent contrat doit être passé par écrit et signé "
         "par les deux parties."),

        ("Art.13 : Loi applicable – Juridictions compétentes",
         "Le présent contrat est régi exclusivement par la loi sénégalaise. Seuls les tribunaux "
         "de Dakar sont compétents en cas de litige lié à l'exécution ou à l'interprétation du "
         "présent contrat."),

        ("Art.14 : Entrée en vigueur",
         "Le contrat entre en vigueur au jour de la signature du contrat."),
    ]

    for title, text in articles:
        story.append(KeepTogether([
            Paragraph(title, S["article_title"]),
            Paragraph(text,  S["body"]),
        ]))

    # ── Page Signatures ───────────────────────────────────────────────────────
    story.append(PageBreak())
    story.append(Spacer(1, 0.8 * cm))
    story.append(Paragraph(
        "EN FOI DE QUOI ce présent contrat est établi pour servir et valoir ce que de droit.",
        S["center"],
    ))
    story.append(Spacer(1, 0.4 * cm))
    story.append(Paragraph(
        f"Fait à DAKAR en 2 exemplaires le {date_str}",
        S["center_normal"],
    ))
    story.append(Spacer(1, 0.35 * cm))
    story.append(Paragraph("<b>Lu et Approuvé</b>", S["center"]))
    story.append(Spacer(1, 0.25 * cm))
    story.append(Paragraph("<b>LES PARTIES</b>", S["center"]))
    story.append(Spacer(1, 1.5 * cm))

    # Vendeur : cachet SSE ou nom de la société par défaut
    if cachet_path and os.path.exists(cachet_path):
        try:
            _tmp = Image(cachet_path)
            _max_w = 4 * cm
            _max_h = 3 * cm
            _scale = min(_max_w / _tmp.imageWidth, _max_h / _tmp.imageHeight)
            vendeur_sig = Image(cachet_path,
                                width=_tmp.imageWidth * _scale,
                                height=_tmp.imageHeight * _scale)
        except Exception:
            vendeur_sig = Paragraph("SSE SUARL — AMETH DIARRA", S["center_normal"])
    else:
        vendeur_sig = Paragraph("SSE SUARL — AMETH DIARRA", S["center_normal"])

    # Tableau signatures
    sig_data = [
        [
            Paragraph("<b>Le Vendeur</b>", S["center"]),
            Paragraph("<b>L'Acheteur</b>", S["center"]),
        ],
        [
            vendeur_sig,
            Paragraph(f"<i>{prenom} {nom}</i>", S["center_normal"]),
        ],
    ]
    sig_table = Table(
        sig_data,
        colWidths=[9 * cm, 9 * cm],
        rowHeights=[None, 3.5 * cm],
    )
    sig_table.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("FONTSIZE",      (0, 0), (-1, -1), 11),
        ("FONTNAME",      (0, 1), (-1, 1), "Times-Roman"),
    ]))
    story.append(sig_table)

    # ── Build ─────────────────────────────────────────────────────────────────
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    return buffer.getvalue()