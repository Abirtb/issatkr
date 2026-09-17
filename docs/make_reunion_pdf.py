from pathlib import Path

from fpdf import FPDF

OUT = Path(__file__).with_name("reunion-donnees-et-regles.pdf")
FONT = r"C:\Windows\Fonts\calibri.ttf"
FONT_B = r"C:\Windows\Fonts\calibrib.ttf"

NAVY = (11, 28, 51)
GOLD = (226, 154, 43)
MUTED = (90, 102, 120)
LINE = (227, 232, 239)
FILL = (244, 246, 249)
WHITE = (255, 255, 255)


class Doc(FPDF):
    def header(self):
        if self.page_no() == 1:
            return
        self.set_fill_color(*NAVY)
        self.rect(0, 0, 210, 10, "F")
        self.set_font("Calibri", "", 8)
        self.set_text_color(*WHITE)
        self.set_xy(14, 3)
        self.cell(0, 4, "ISSATKR  ·  Réunion — Données et règles de présence", align="L")
        self.set_xy(-40, 3)
        self.cell(26, 4, f"{self.page_no()}", align="R")
        self.ln(12)

    def footer(self):
        self.set_y(-12)
        self.set_draw_color(*GOLD)
        self.set_line_width(0.5)
        self.line(14, self.get_y(), 196, self.get_y())
        self.set_font("Calibri", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 8, "Document de travail  ·  Confidentiel  ·  ISSAT Kairouan", align="L")
        self.set_xy(-28, -12)
        self.cell(14, 8, str(self.page_no()), align="R")


def section(pdf: Doc, title: str):
    pdf.ln(4)
    pdf.set_fill_color(*NAVY)
    pdf.rect(14, pdf.get_y(), 3.2, 7.2, "F")
    pdf.set_xy(20, pdf.get_y())
    pdf.set_font("Calibri", "B", 13)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 7.2, title)
    pdf.ln(9)


def subsection(pdf: Doc, title: str):
    pdf.ln(1.5)
    pdf.set_font("Calibri", "B", 11)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 6.5, title)
    pdf.ln(7)


def body(pdf: Doc, text: str):
    pdf.set_font("Calibri", "", 10)
    pdf.set_text_color(30, 38, 50)
    pdf.multi_cell(182, 5.2, text)
    pdf.ln(1)


def checkbox(pdf: Doc, text: str, indent: float = 0):
    x = 14 + indent
    y = pdf.get_y()
    if y > 272:
        pdf.add_page()
        y = pdf.get_y()
    pdf.set_draw_color(*NAVY)
    pdf.set_line_width(0.3)
    pdf.rect(x, y + 0.8, 3.4, 3.4)
    pdf.set_xy(x + 6, y)
    pdf.set_font("Calibri", "", 10)
    pdf.set_text_color(30, 38, 50)
    pdf.multi_cell(182 - indent - 6, 5.2, text)
    pdf.ln(0.4)


def table(pdf: Doc, headers: list[str], rows: list[list[str]], widths: list[float]):
    if pdf.get_y() > 250:
        pdf.add_page()
    pdf.set_fill_color(*NAVY)
    pdf.set_text_color(*WHITE)
    pdf.set_font("Calibri", "B", 9)
    x0 = 14
    pdf.set_x(x0)
    for h, w in zip(headers, widths):
        pdf.cell(w, 7, f"  {h}", border=0, fill=True)
    pdf.ln(7)
    pdf.set_font("Calibri", "", 9)
    for i, row in enumerate(rows):
        if pdf.get_y() > 272:
            pdf.add_page()
            pdf.set_fill_color(*NAVY)
            pdf.set_text_color(*WHITE)
            pdf.set_font("Calibri", "B", 9)
            pdf.set_x(x0)
            for h, w in zip(headers, widths):
                pdf.cell(w, 7, f"  {h}", border=0, fill=True)
            pdf.ln(7)
            pdf.set_font("Calibri", "", 9)
        h = 8
        pdf.set_fill_color(*(FILL if i % 2 == 0 else WHITE))
        pdf.set_text_color(30, 38, 50)
        pdf.set_draw_color(*LINE)
        pdf.set_x(x0)
        for val, w in zip(row, widths):
            pdf.cell(w, h, f"  {val}", border="B", fill=True)
        pdf.ln(h)
    pdf.ln(2)


def dots(pdf: Doc, n: int = 3):
    pdf.set_text_color(*MUTED)
    pdf.set_font("Calibri", "", 10)
    for _ in range(n):
        pdf.cell(182, 7, "." * 92)
        pdf.ln(7)


def build():
    pdf = Doc(format="A4", unit="mm")
    pdf.set_auto_page_break(auto=True, margin=16)
    pdf.add_font("Calibri", "", FONT)
    pdf.add_font("Calibri", "B", FONT_B)
    pdf.add_page()

    pdf.set_fill_color(*NAVY)
    pdf.rect(0, 0, 210, 42, "F")
    pdf.set_fill_color(*GOLD)
    pdf.rect(0, 42, 210, 2.2, "F")

    pdf.set_xy(14, 12)
    pdf.set_font("Calibri", "", 10)
    pdf.set_text_color(*GOLD)
    pdf.cell(0, 5, "ISSAT KAIROUAN  ·  DOCUMENT DE TRAVAIL")
    pdf.set_xy(14, 20)
    pdf.set_font("Calibri", "B", 20)
    pdf.set_text_color(*WHITE)
    pdf.cell(0, 8, "Réunion — Données et règles de présence")
    pdf.set_xy(14, 30)
    pdf.set_font("Calibri", "", 11)
    pdf.set_text_color(200, 210, 222)
    pdf.cell(0, 6, "Plateforme de saisie de présence  ·  Ce dont nous avons besoin de l’institut")

    pdf.set_y(50)
    pdf.set_font("Calibri", "", 10)
    pdf.set_text_color(30, 38, 50)
    meta = [
        ("Objet", "Plateforme de saisie de présence — besoins institut"),
        ("Date", "....... / ....... / 2026"),
        ("Présents", "..................................................."),
        ("Référent institut", "..................................................."),
    ]
    for label, value in meta:
        pdf.set_font("Calibri", "B", 10)
        pdf.set_text_color(*NAVY)
        pdf.cell(42, 6.2, label)
        pdf.set_font("Calibri", "", 10)
        pdf.set_text_color(30, 38, 50)
        pdf.cell(0, 6.2, value)
        pdf.ln(6.2)

    pdf.ln(3)
    pdf.set_fill_color(252, 246, 234)
    pdf.set_draw_color(*GOLD)
    y = pdf.get_y()
    pdf.rect(14, y, 182, 18, "DF")
    pdf.set_xy(18, y + 2.5)
    pdf.set_font("Calibri", "B", 10)
    pdf.set_text_color(*NAVY)
    pdf.cell(0, 5, "Objectif de la réunion")
    pdf.set_xy(18, y + 8)
    pdf.set_font("Calibri", "", 10)
    pdf.set_text_color(40, 48, 60)
    pdf.multi_cell(
        174,
        4.6,
        "Sortir avec des règles de présence écrites et un fichier de données réel pour un groupe. "
        "La plateforme est prête en maquette et fonctionne actuellement avec des données de démonstration.",
    )
    pdf.ln(6)

    section(pdf, "1.  Règles de présence — à trancher")
    subsection(pdf, "1.1  Définition des statuts")
    table(
        pdf,
        ["Statut", "Définition retenue", "Notes"],
        [
            ["Présent", "", ""],
            ["Retard", "Après ....... min. du début de séance", ""],
            ["Absent", "Après ....... minutes", ""],
            ["Absence justifiée", "", ""],
        ],
        [42, 88, 52],
    )

    subsection(pdf, "1.2  Justification et modification")
    checkbox(pdf, "Qui a le droit de justifier une absence ?")
    checkbox(pdf, "L’enseignant", 8)
    checkbox(pdf, "Le service scolarité", 8)
    checkbox(pdf, "Le chef de département / la direction", 8)
    checkbox(pdf, "Quel justificatif est accepté (certificat médical, demande, autre) ?  .......................")
    checkbox(pdf, "L’enseignant peut-il modifier la présence après la séance ?")
    checkbox(pdf, "Oui, dans un délai de ....... heure(s) / jour(s)", 8)
    checkbox(pdf, "Non", 8)
    checkbox(pdf, "Qui peut modifier après expiration du délai ?  .......................")

    subsection(pdf, "1.3  Seuils d’alerte")
    table(
        pdf,
        ["Niveau", "Nombre d’absences", "Qui est notifié ?"],
        [
            ["Surveillance", "", ""],
            ["Avertissement", "", ""],
            ["Critique", "", ""],
        ],
        [50, 66, 66],
    )
    checkbox(pdf, "Le seuil se calcule par matière ou sur l’ensemble des séances ?  .......................")
    checkbox(pdf, "Le retard entre-t-il dans le calcul des absences ? (ex. 3 retards = 1 absence)  ........")

    subsection(pdf, "1.4  Conséquences de l’absence")
    checkbox(pdf, "L’absence a un effet sur :")
    checkbox(pdf, "La note", 8)
    checkbox(pdf, "Le droit de passer l’examen / le rattrapage", 8)
    checkbox(pdf, "L’exclusion", 8)
    checkbox(pdf, "Les rapports uniquement", 8)
    checkbox(pdf, "Texte réglementaire ou circulaire de référence (si existant) :  .......................")

    subsection(pdf, "1.5  Cas particuliers")
    checkbox(pdf, "Que se passe-t-il si la séance est annulée ou si l’enseignant est absent ?  ............")
    checkbox(pdf, "La séance est-elle saisie une fois pour le groupe ou uniquement étudiant par étudiant ?")
    checkbox(pdf, "Étudiants redoublants ou inscrits dans plusieurs groupes :  .......................")

    section(pdf, "2.  Données demandées")
    body(
        pdf,
        "Format accepté pour le premier essai : Excel ou CSV. Aucun raccordement technique n’est nécessaire à ce stade.",
    )

    subsection(pdf, "2.1  Liste des étudiants")
    table(
        pdf,
        ["Champ", "Obligatoire", "Note"],
        [
            ["Nom et prénom", "Oui", ""],
            ["Numéro d’inscription (matricule)", "Oui", "Identifiant unique"],
            ["E-mail", "Si disponible", ""],
            ["Filière / spécialité", "Oui", ""],
            ["Groupe", "Oui", "Ex. : GL3-A"],
            ["Année d’études", "Oui", ""],
        ],
        [82, 42, 58],
    )

    subsection(pdf, "2.2  Enseignants et matières")
    table(
        pdf,
        ["Champ", "Obligatoire"],
        [
            ["Nom et prénom de l’enseignant", "Oui"],
            ["E-mail professionnel", "Oui"],
            ["Matières enseignées", "Oui"],
            ["Groupes associés à chaque matière", "Oui"],
        ],
        [130, 52],
    )

    subsection(pdf, "2.3  Emploi du temps")
    table(
        pdf,
        ["Champ", "Obligatoire"],
        [
            ["Nom de la matière et code", "Oui"],
            ["Groupe", "Oui"],
            ["Salle / laboratoire", "Oui"],
            ["Jour et date", "Oui"],
            ["Heure de début et de fin", "Oui"],
            ["Type de séance (cours, TD, TP)", "Souhaitable"],
        ],
        [130, 52],
    )

    subsection(pdf, "2.4  Données optionnelles")
    checkbox(pdf, "Historique des absences (migration ou comparaison)")
    checkbox(pdf, "Logo officiel en PNG / SVG haute qualité")

    subsection(pdf, "2.5  Mise à jour des données")
    checkbox(pdf, "Source officielle des listes :  .......................")
    checkbox(pdf, "Qui les met à jour ?  .......................")
    checkbox(pdf, "Fréquence de mise à jour :  .......................")

    section(pdf, "3.  Périmètre du premier essai")
    table(
        pdf,
        ["Élément", "Proposition", "Décision"],
        [
            ["Département", "Informatique", ""],
            ["Nombre d’enseignants", "2 à 3", ""],
            ["Nombre de groupes", "1 à 2", ""],
            ["Durée", "2 à 3 semaines", ""],
            ["Date de lancement", "", ""],
        ],
        [62, 60, 60],
    )

    section(pdf, "4.  Ce qu’il faut obtenir aujourd’hui")
    checkbox(pdf, "Règles d’absence et de retard écrites (même par e-mail après la réunion)")
    checkbox(pdf, "Seuils d’alerte chiffrés")
    checkbox(pdf, "Qui justifie l’absence, de façon définitive")
    checkbox(pdf, "Fichier Excel d’un groupe + emploi du temps d’une semaine")
    checkbox(pdf, "Contact de suivi + date de la prochaine réunion")

    section(pdf, "5.  Points de suivi")
    table(
        pdf,
        ["Point", "Responsable", "Échéance"],
        [["", "", ""], ["", "", ""], ["", "", ""]],
        [82, 50, 50],
    )

    section(pdf, "Notes de réunion")
    dots(pdf, 6)

    pdf.output(OUT)
    print(OUT)


if __name__ == "__main__":
    build()
