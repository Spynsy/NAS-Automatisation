# -*- coding: utf-8 -*-


from fastapi import FastAPI
import gpxpy

app = FastAPI()


def charger_gpx(chemin):
    with open(chemin, encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    features = []

    # Waypoints 
    for wpt in gpx.waypoints:
        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [wpt.longitude, wpt.latitude],
            },
            "properties": {"type": "waypoint", "name": wpt.name},
        })

    # Tracks
    for track in gpx.tracks:
        coords = [
            [p.longitude, p.latitude]
            for seg in track.segments
            for p in seg.points
        ]
        montee, descente = track.get_uphill_downhill()
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "type": "track",
                "name": track.name,
                "distance_km": round(track.length_3d() / 1000, 2),
                "d_plus": round(montee),
                "d_moins": round(descente),
            },
        })

    return {"type": "FeatureCollection", "features": features}


@app.get("/tracks")
def liste_tracks():
    return charger_gpx("test.gpx")