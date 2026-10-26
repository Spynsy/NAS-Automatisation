# -*- coding: utf-8 -*-

import gpxpy

with open("test.gpx", encoding="utf-8") as f:
    gpx = gpxpy.parse(f)

# Waypoints (interest point isolated)
print(f"{len(gpx.waypoints)} waypoint(s)")
for wpt in gpx.waypoints:
    print(f"  - {wpt.name} : {wpt.latitude}, {wpt.longitude}")

# Tracks
for track in gpx.tracks:
    print(f"\nTracé : {track.name}")
    print(f"  Segments : {len(track.segments)}")

    # lengh, climb, time
    print(f"  Distance : {track.length_3d() / 1000:.2f} km")
    montee, descente = track.get_uphill_downhill()
    print(f"  D+ : {montee:.0f} m / D- : {descente:.0f} m")
    print(f"  Durée : {track.get_duration()} s")

    # number of point
    nb_points = sum(len(seg.points) for seg in track.segments)
    print(f"  Points : {nb_points}")

