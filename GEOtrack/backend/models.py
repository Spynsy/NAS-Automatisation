from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Column, ForeignKey, String, Table
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base

# Table d'association : une ligne = "cette trace porte ce tag"
traces_tags = Table(
    "traces_tags",
    Base.metadata,
    Column("trace_id", ForeignKey("traces.id"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id"), primary_key=True),
)


class Fichier(Base):
    __tablename__ = "fichiers"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str]
    sha256: Mapped[str] = mapped_column(String(64), unique=True)
    importe_le: Mapped[datetime] = mapped_column(default=datetime.now)

    traces: Mapped[list["Trace"]] = relationship(
        back_populates="fichier", cascade="all, delete-orphan"
    )
    waypoints: Mapped[list["Waypoint"]] = relationship(
        back_populates="fichier", cascade="all, delete-orphan"
    )


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    nom: Mapped[str] = mapped_column(String(50), unique=True)
    couleur: Mapped[str] = mapped_column(String(7), default="#e63946")


class Trace(Base):
    __tablename__ = "traces"

    id: Mapped[int] = mapped_column(primary_key=True)
    fichier_id: Mapped[int] = mapped_column(ForeignKey("fichiers.id"))
    nom: Mapped[Optional[str]]
    distance_km: Mapped[float]
    d_plus: Mapped[int]
    d_moins: Mapped[int]
    duree_s: Mapped[Optional[int]]
    debut: Mapped[Optional[datetime]]
    lat_min: Mapped[float]
    lat_max: Mapped[float]
    lon_min: Mapped[float]
    lon_max: Mapped[float]
    geometrie: Mapped[list] = mapped_column(JSON)

    fichier: Mapped["Fichier"] = relationship(back_populates="traces")
    tags: Mapped[list["Tag"]] = relationship(secondary=traces_tags)


class Waypoint(Base):
    __tablename__ = "waypoints"

    id: Mapped[int] = mapped_column(primary_key=True)
    fichier_id: Mapped[int] = mapped_column(ForeignKey("fichiers.id"))
    nom: Mapped[Optional[str]]
    lat: Mapped[float]
    lon: Mapped[float]
    altitude: Mapped[Optional[float]]
    symbole: Mapped[Optional[str]]    # symbole GPX d'origine (<sym>)
    categorie: Mapped[Optional[str]]  # choix d'icône, pour l'étape suivante

    fichier: Mapped["Fichier"] = relationship(back_populates="waypoints")