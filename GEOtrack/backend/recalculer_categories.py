# -*- coding: utf-8 -*-
from sqlalchemy import select

from categories import deviner_categorie
from database import SessionLocal
from models import Waypoint

with SessionLocal() as db:
    for w in db.scalars(select(Waypoint).where(Waypoint.categorie.is_(None))):
        w.categorie = deviner_categorie(w.symbole, w.nom)
    db.commit()
print("Terminé.")

