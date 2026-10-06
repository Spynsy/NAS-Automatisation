# -*- coding: utf-8 -*-
"""
Created on Tue Oct  6 09:50:24 2026

@author: sthieblemont
"""

"""
Détecte les nouvelles vidéos des chaînes YouTube, affiche leurs miniatures
dans le navigateur pour validation, puis télécharge celles que tu as cochées.
 
Prérequis : pip install yt-dlp et ffmpeg installé sur le système
Fichiers  : channels.txt (une URL de chaîne par ligne, à côté du script)
"""
import html
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import parse_qs
 
from yt_dlp import YoutubeDL
 
BASE = Path(__file__).parent
CHANNELS_FILE = BASE / "channels.txt" # URL list of the channels followed
STATE_FILE = BASE / "deja_vues.json"
DOWNLOAD_DIR = BASE / "telechargements"
MAX_PAR_CHAINE = 3   # Number of video for each channel
PORT = 8765
 
 
# ---------- Resume the new video and open a window ----------
def charger_deja_vues():
    if STATE_FILE.exists():
        return set(json.loads(STATE_FILE.read_text(encoding="utf-8")))
    return set()
 
 
def sauver_deja_vues(ids):
    STATE_FILE.write_text(json.dumps(sorted(ids)), encoding="utf-8") #Stock the previous video already proposed
 
 
def chercher_nouvelles(deja_vues):
    if not CHANNELS_FILE.exists():
        raise SystemExit(f"Crée d'abord {CHANNELS_FILE.name} (une URL de chaîne par ligne).")
    chaines = [l.strip() for l in CHANNELS_FILE.read_text(encoding="utf-8").splitlines()
               if l.strip() and not l.startswith("#")]
 
    opts = {"quiet": True, "extract_flat": True, "playlistend": MAX_PAR_CHAINE,
            "ignoreerrors": True}
    nouvelles = []
    with YoutubeDL(opts) as ydl:
        for url in chaines:
            if "/videos" not in url and "/playlist" not in url:
                url = url.rstrip("/") + "/videos"
            info = ydl.extract_info(url, download=False)
            if not info:
                print(f"! Impossible de lire {url}")
                continue
            nom = info.get("channel") or info.get("uploader") or info.get("title") or url
            for e in info.get("entries") or []:
                if e and e.get("id") and e["id"] not in deja_vues:
                    nouvelles.append({"id": e["id"], "titre": e.get("title") or e["id"],
                                      "chaine": nom})
    return nouvelles
 
 
# ---------- Validate each video to download them ----------
def page_html(videos):
    cartes = "".join(f"""
      <label class="carte">
        <img src="https://i.ytimg.com/vi/{v['id']}/mqdefault.jpg" loading="lazy">
        <div class="txt"><input type="checkbox" name="id" value="{v['id']}">
          <b>{html.escape(v['titre'])}</b><br><small>{html.escape(v['chaine'])}</small></div>
      </label>""" for v in videos)
    return f"""<!doctype html><html lang="fr"><meta charset="utf-8">
<title>Nouvelles vidéos</title>
<style>
 body{{font-family:system-ui,sans-serif;margin:20px;background:#111;color:#eee}}
 .grille{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}}
 .carte{{background:#222;border-radius:8px;overflow:hidden;cursor:pointer;display:block}}
 .carte img{{width:100%;display:block}}
 .txt{{padding:8px}} input{{margin-right:6px}}
 .carte:has(input:checked){{outline:3px solid #4caf50}}
 button{{padding:10px 18px;margin:0 8px 14px 0;font-size:15px;cursor:pointer}}
</style>
<h2>{len(videos)} nouvelle(s) vidéo(s) — coche celles à télécharger</h2>
<form method="post" action="/valider">
  <button type="button" onclick="document.querySelectorAll('input').forEach(i=>i.checked=true)">Tout cocher</button>
  <button type="button" onclick="document.querySelectorAll('input').forEach(i=>i.checked=false)">Tout décocher</button>
  <button type="submit">Télécharger la sélection</button>
  <div class="grille">{cartes}</div>
</form></html>"""
 
 
def demander_validation(videos):
    resultat = {"ids": None}
    html_page = page_html(videos).encode("utf-8")
 
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass
 
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(html_page)
 
        def do_POST(self):
            n = int(self.headers.get("Content-Length", 0))
            data = parse_qs(self.rfile.read(n).decode())
            resultat["ids"] = data.get("id", [])
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write("<h2 style='font-family:sans-serif'>Sélection reçue, "
                             "tu peux fermer cet onglet.</h2>".encode())
 
    serveur = HTTPServer(("127.0.0.1", PORT), Handler)
    threading.Timer(0.5, lambda: webbrowser.open(f"http://127.0.0.1:{PORT}")).start()
    print(f"Page de validation : http://127.0.0.1:{PORT}")
    while resultat["ids"] is None:
        serveur.handle_request()
    serveur.server_close()
    return resultat["ids"]
 
 
# ---------- Download the video with ffmpeg ----------
def telecharger(ids):
    opts = {
        "format": "bv*[height<=1080]+ba/b",
        "merge_output_format": "mp4",
        "outtmpl": str(DOWNLOAD_DIR / "%(channel)s" / "%(title)s [%(id)s].%(ext)s"),
    }
    with YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={i}" for i in ids])
 
 
def main():
    deja_vues = charger_deja_vues()
    print("Recherche des nouvelles vidéos...")
    nouvelles = chercher_nouvelles(deja_vues)
    if not nouvelles:
        print("Rien de nouveau.")
        return
    print(f"{len(nouvelles)} nouvelle(s) vidéo(s) trouvée(s).")
    choisies = demander_validation(nouvelles)
 
    # Toutes les vidéos présentées sont marquées comme vues (cochées ou non)
    sauver_deja_vues(deja_vues | {v["id"] for v in nouvelles})
 
    if choisies:
        print(f"Téléchargement de {len(choisies)} vidéo(s)...")
        telecharger(choisies)
    print("Terminé.")
 
 
if __name__ == "__main__":
    main()
 