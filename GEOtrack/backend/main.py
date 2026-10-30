import hashlib
from datetime import date, datetime, time
from pathlib import Path
from typing import Optional

import gpxpy
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from database import Base, engine, get_db
from models import Fichier, Tag, Trace, Waypoint, traces_tags

Base.metadata.create_all(engine)  # crée les tables manquantes (dont tags)

app = FastAPI()


# ---------- Formats des données reçues ----------

class TagEntree(BaseModel):
    nom: str = Field(min_length=1, max_length=50)
    couleur: str = Field(default="#e63946", pattern=r"^#[0-9a-fA-F]{6}$")


class TagsTrace(BaseModel):
    tag_ids: list[int]


# ---------- Import ----------

@app.post("/import")
async def importer(fichier: UploadFile = File(...), db: Session = Depends(get_db)):
    contenu = await fichier.read()
    empreinte = hashlib.sha256(contenu).hexdigest()

    if db.scalar(select(Fichier).where(Fichier.sha256 == empreinte)):
        raise HTTPException(status_code=409, detail="Ce fichier a déjà été importé.")

    try:
        gpx = gpxpy.parse(contenu.decode("utf-8"))
    except (gpxpy.gpx.GPXException, UnicodeDecodeError):
        raise HTTPException(status_code=400, detail="Fichier GPX invalide.")

    entree = Fichier(nom=fichier.filename, sha256=empreinte)
    db.add(entree)

    for w in gpx.waypoints:
        entree.waypoints.append(
            Waypoint(nom=w.name, lat=w.latitude, lon=w.longitude, altitude=w.elevation)
        )

    for t in gpx.tracks:
        points = [p for seg in t.segments for p in seg.points]
        if not points:
            continue
        montee, descente = t.get_uphill_downhill()
        bornes = t.get_bounds()
        debut, _ = t.get_time_bounds()
        duree = t.get_duration()
        entree.traces.append(
            Trace(
                nom=t.name,
                distance_km=round(t.length_3d() / 1000, 2),
                d_plus=round(montee),
                d_moins=round(descente),
                duree_s=round(duree) if duree else None,
                debut=debut,
                lat_min=bornes.min_latitude,
                lat_max=bornes.max_latitude,
                lon_min=bornes.min_longitude,
                lon_max=bornes.max_longitude,
                geometrie=[[p.longitude, p.latitude] for p in points],
            )
        )

    resume = {
        "fichier": fichier.filename,
        "traces": len(entree.traces),
        "waypoints": len(entree.waypoints),
    }
    db.commit()
    return resume


# ---------- Lecture avec filtres ----------

@app.get("/tracks")
def liste_tracks(
    q: Optional[str] = None,
    distance_min: Optional[float] = None,
    distance_max: Optional[float] = None,
    d_plus_min: Optional[int] = None,
    d_plus_max: Optional[int] = None,
    date_debut: Optional[date] = None,
    date_fin: Optional[date] = None,
    bbox: Optional[str] = None,  # "ouest,sud,est,nord"
    tags: list[int] = Query(default=[]),  # ?tags=1&tags=3
    db: Session = Depends(get_db),
):
    lon_min = lat_min = lon_max = lat_max = None
    if bbox:
        try:
            lon_min, lat_min, lon_max, lat_max = map(float, bbox.split(","))
        except ValueError:
            raise HTTPException(status_code=400, detail="bbox invalide")

    # selectinload : charge les tags de toutes les traces en une seule requête
    requete = (
        select(Trace)
        .options(selectinload(Trace.tags))
        .order_by(Trace.debut.desc())
    )
    if q:
        requete = requete.where(Trace.nom.ilike(f"%{q}%"))
    if distance_min is not None:
        requete = requete.where(Trace.distance_km >= distance_min)
    if distance_max is not None:
        requete = requete.where(Trace.distance_km <= distance_max)
    if d_plus_min is not None:
        requete = requete.where(Trace.d_plus >= d_plus_min)
    if d_plus_max is not None:
        requete = requete.where(Trace.d_plus <= d_plus_max)
    if date_debut:
        requete = requete.where(Trace.debut >= datetime.combine(date_debut, time.min))
    if date_fin:
        requete = requete.where(Trace.debut <= datetime.combine(date_fin, time.max))
    if bbox:
        requete = requete.where(
            Trace.lon_max >= lon_min, Trace.lon_min <= lon_max,
            Trace.lat_max >= lat_min, Trace.lat_min <= lat_max,
        )
    if tags:
        # garde les traces qui portent AU MOINS UN des tags cochés
        requete = requete.where(Trace.tags.any(Tag.id.in_(tags)))

    requete_w = select(Waypoint)
    if q:
        requete_w = requete_w.where(Waypoint.nom.ilike(f"%{q}%"))
    if bbox:
        requete_w = requete_w.where(
            Waypoint.lon.between(lon_min, lon_max),
            Waypoint.lat.between(lat_min, lat_max),
        )

    features = []

    # Les waypoints n'ont pas (encore) de tags : on les masque si on filtre par tag
    waypoints = [] if tags else db.scalars(requete_w)
    for w in waypoints:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [w.lon, w.lat]},
            "properties": {"type": "waypoint", "id": w.id, "name": w.nom},
        })

    for t in db.scalars(requete):
        tags_tries = sorted(t.tags, key=lambda g: g.nom.lower())
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": t.geometrie},
            "properties": {
                "type": "track",
                "id": t.id,
                "name": t.nom,
                "distance_km": t.distance_km,
                "d_plus": t.d_plus,
                "d_moins": t.d_moins,
                "duree_s": t.duree_s,
                "debut": t.debut.isoformat() if t.debut else None,
                "tags": [
                    {"id": g.id, "nom": g.nom, "couleur": g.couleur} for g in tags_tries
                ],
                "couleur": tags_tries[0].couleur if tags_tries else None,
            },
        })

    return {"type": "FeatureCollection", "features": features}


# ---------- Tags ----------

@app.get("/tags")
def liste_tags(db: Session = Depends(get_db)):
    lignes = db.execute(
        select(Tag, func.count(traces_tags.c.trace_id))
        .outerjoin(traces_tags, Tag.id == traces_tags.c.tag_id)
        .group_by(Tag.id)
        .order_by(func.lower(Tag.nom))
    )
    return [
        {"id": tag.id, "nom": tag.nom, "couleur": tag.couleur, "nb_traces": nb}
        for tag, nb in lignes
    ]


@app.post("/tags", status_code=201)
def creer_tag(donnees: TagEntree, db: Session = Depends(get_db)):
    nom = donnees.nom.strip()
    if not nom:
        raise HTTPException(status_code=400, detail="Le nom du tag est vide.")
    if db.scalar(select(Tag).where(func.lower(Tag.nom) == nom.lower())):
        raise HTTPException(status_code=409, detail="Ce tag existe déjà.")

    tag = Tag(nom=nom, couleur=donnees.couleur)
    db.add(tag)
    db.commit()
    return {"id": tag.id, "nom": tag.nom, "couleur": tag.couleur, "nb_traces": 0}


@app.delete("/tags/{tag_id}", status_code=204)
def supprimer_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag introuvable.")
    # d'abord les liens avec les traces, puis le tag lui-même
    db.execute(delete(traces_tags).where(traces_tags.c.tag_id == tag_id))
    db.delete(tag)
    db.commit()


@app.put("/traces/{trace_id}/tags")
def definir_tags(trace_id: int, donnees: TagsTrace, db: Session = Depends(get_db)):
    trace = db.get(Trace, trace_id)
    if not trace:
        raise HTTPException(status_code=404, detail="Trace introuvable.")
    # remplace la liste complète des tags de cette trace
    trace.tags = list(db.scalars(select(Tag).where(Tag.id.in_(donnees.tag_ids))))
    db.commit()
    return {"id": trace.id, "tags": [g.id for g in trace.tags]}


# ---------- Frontend (toujours en dernier) ----------

FRONTEND = Path(__file__).resolve().parent.parent / "frontend"
app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="frontend")