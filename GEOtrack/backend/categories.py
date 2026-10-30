# -*- coding: utf-8 -*-


import re

CATEGORIES = {
    "camping": {"nom": "Camping", "icone": "⛺"},
    "cabane": {"nom": "Cabane / refuge", "icone": "🛖"},
    "eau": {"nom": "Point d'eau", "icone": "💧"},
    "sommet": {"nom": "Sommet", "icone": "⛰️"},
    "parking": {"nom": "Parking", "icone": "🅿️"},
    "vue": {"nom": "Point de vue", "icone": "📷"},
    "danger": {"nom": "Danger", "icone": "⚠️"},
    "autre": {"nom": "Autre", "icone": "📍"},
}

# Détection automatique : la première règle qui correspond l'emporte.
# \b marque une frontière de mot : "eau" ne doit pas matcher "plateau".
REGLES = [
    ("cabane", r"cabane|refuge|shelter|cabin|\bhut\b|lodging|gîte|gite|bothy"),
    ("camping", r"\b(camping|campground|tente|tent|bivouac)\b"),
    ("eau", r"\b(eau|source|fontaine|spring|water|fountain)\b"),
    ("sommet", r"summit|\bpeak\b|sommet|\bpic\b"),
    ("parking", r"parking"),
    ("vue", r"scenic|viewpoint|panorama|belv[ée]d[èe]re"),
    ("danger", r"danger|hazard|warning"),
]


def deviner_categorie(symbole, nom):
    """Renvoie une catégorie d'après le symbole et le nom, ou None si rien ne correspond."""
    texte = f"{symbole or ''} {nom or ''}".lower()
    for categorie, motif in REGLES:
        if re.search(motif, texte):
            return categorie
    return None