const map = new maplibregl.Map({
  container: "map",
    style: {
    version: 8,
    sources: {
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },

      planign: {
        type: "raster",
        tiles: [
          "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
            "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png" +
            "&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
        ],
        tileSize: 256,
        maxzoom: 18,
        attribution: "© IGN – Géoplateforme",
      },

      ign: {
        type: "raster",
        tiles: [
          "https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
            "&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg" +
            "&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© IGN – Géoplateforme (Licence ouverte Etalab 2.0)",
      },
      esri: {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagerie © Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [
      { id: "fond-osm", type: "raster", source: "osm" },
      { id: "fond-planign", type: "raster", source: "planign", layout: { visibility: "none" } },
      { id: "fond-ign", type: "raster", source: "ign", layout: { visibility: "none" } },
      { id: "fond-esri", type: "raster", source: "esri", layout: { visibility: "none" } },
    ],
  },
  center: [2.35, 46.8],
  zoom: 5,
});

// ---------- État de l'application ----------

let tagsDisponibles = [];   // liste des tags connus (venue du serveur)
let dernierGeojson = null;  // dernières données affichées
let traceEnEdition = null;  // id de l'activité dont l'éditeur de tags est ouvert

// ---------- Utilitaires de cadrage ----------

function englober(features) {
  const bounds = new maplibregl.LngLatBounds();
  features.forEach((f) => {
    const coords =
      f.geometry.type === "Point" ? [f.geometry.coordinates] : f.geometry.coordinates;
    coords.forEach((c) => bounds.extend(c));
  });
  return bounds;
}

function ajusterVue(features) {
  const bounds = englober(features);
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 40 });
}

// ---------- Filtres -> paramètres d'URL ----------

function idsCoches() {
  return [...document.querySelectorAll("#filtre-tags input:checked")].map((c) =>
    Number(c.value)
  );
}

function construireParametres() {
  const params = new URLSearchParams();
  const ajouter = (cle, id) => {
    const valeur = document.getElementById(id).value;
    if (valeur !== "") params.set(cle, valeur);
  };

  ajouter("q", "q");
  ajouter("distance_min", "distance-min");
  ajouter("distance_max", "distance-max");
  ajouter("d_plus_min", "dplus-min");
  ajouter("d_plus_max", "dplus-max");
  ajouter("date_debut", "date-debut");
  ajouter("date_fin", "date-fin");

  idsCoches().forEach((id) => params.append("tags", id));
  document
    .querySelectorAll("#filtre-categories input:checked")
    .forEach((c) => params.append("categories", c.value));

  if (document.getElementById("zone-visible").checked) {
    const b = map.getBounds();
    params.set("bbox", [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(","));
  }
  return params;
}

// ---------- Éléments d'interface pour les tags ----------

function creerPastille(tag) {
  const pastille = document.createElement("span");
  pastille.className = "pastille";

  const point = document.createElement("span");
  point.textContent = "● ";
  point.style.color = tag.couleur;

  pastille.append(point, tag.nom);
  return pastille;
}

async function chargerTags() {
  const reponse = await fetch("/tags");
  tagsDisponibles = await reponse.json();

  const conteneur = document.getElementById("filtre-tags");
  const coches = new Set(idsCoches()); // on garde les cases déjà cochées
  conteneur.innerHTML = "";

  tagsDisponibles.forEach((tag) => {
    const ligne = document.createElement("div");
    ligne.className = "ligne";

    const etiquette = document.createElement("label");
    const caseACocher = document.createElement("input");
    caseACocher.type = "checkbox";
    caseACocher.value = tag.id;
    caseACocher.checked = coches.has(tag.id);
    etiquette.append(caseACocher, creerPastille(tag), ` (${tag.nb_traces})`);

    const supprimer = document.createElement("button");
    supprimer.type = "button";
    supprimer.textContent = "×";
    supprimer.title = "Supprimer ce tag";
    supprimer.addEventListener("click", async () => {
      if (!confirm(`Supprimer le tag « ${tag.nom} » ?`)) return;
      await fetch(`/tags/${tag.id}`, { method: "DELETE" });
      await chargerTags();
      await chargerDonnees(false);
    });

    ligne.append(etiquette, supprimer);
    conteneur.append(ligne);
  });
}

function creerEditeurTags(p, apres) {
  const conteneur = document.createElement("div");
  conteneur.className = "editeur-tags";
  conteneur.addEventListener("click", (e) => e.stopPropagation());

  if (tagsDisponibles.length === 0) {
    conteneur.textContent = "Crée d'abord un tag avec « Nouveau tag ».";
    return conteneur;
  }

  const idsActuels = new Set(p.tags.map((t) => t.id));

  tagsDisponibles.forEach((tag) => {
    const etiquette = document.createElement("label");
    const caseACocher = document.createElement("input");
    caseACocher.type = "checkbox";
    caseACocher.checked = idsActuels.has(tag.id);

    caseACocher.addEventListener("change", async () => {
      if (caseACocher.checked) idsActuels.add(tag.id);
      else idsActuels.delete(tag.id);

      await fetch(`/traces/${p.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag_ids: [...idsActuels] }),
      });
      await chargerTags();        // met à jour les compteurs
      await chargerDonnees(false);
      if (apres) await apres();   // prévient l'appelant (la fiche, le cas échéant)
    });

    etiquette.append(caseACocher, creerPastille(tag));
    conteneur.append(etiquette);
  });
  return conteneur;
}

// ---------- Liste latérale ----------

function afficherListe(geojson) {
  const liste = document.getElementById("liste");
  liste.innerHTML = "";

  const traces = geojson.features.filter((f) => f.properties.type === "track");
  document.getElementById("compteur").textContent = `${traces.length} activité(s)`;

  traces.forEach((f) => {
    const p = f.properties;
    const date = p.debut ? new Date(p.debut).toLocaleDateString("fr-FR") : "date inconnue";

    const titre = document.createElement("strong");
    titre.textContent = p.name || "(sans nom)";

    const details = document.createElement("div");
    details.textContent = `${p.distance_km} km · D+ ${p.d_plus} m · ${date}`;

    const pastilles = document.createElement("div");
    p.tags.forEach((t) => pastilles.append(creerPastille(t)));

    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.textContent = "🏷 Tags";
    bouton.addEventListener("click", (e) => {
      e.stopPropagation();
      traceEnEdition = traceEnEdition === p.id ? null : p.id;
      afficherListe(dernierGeojson);
    });

    const li = document.createElement("li");
    li.append(titre, details, pastilles, bouton);
    if (traceEnEdition === p.id) li.append(creerEditeurTags(p));

    li.addEventListener("click", () => {
      map.fitBounds(englober([f]), {
        padding: { top: 60, left: 60, right: 60, bottom: 280 }, // laisse la place à la fiche
      });
      ouvrirFiche(p.id);
    });
    liste.append(li)
  });
}

// ---------- Chargement des données ----------

async function chargerDonnees(ajuster = false) {
  const reponse = await fetch("/tracks?" + construireParametres());
  dernierGeojson = await reponse.json();

  map.getSource("gpx").setData(dernierGeojson);
  afficherListe(dernierGeojson);
  if (ajuster) ajusterVue(dernierGeojson.features);
}

map.on("load", async () => {
  await chargerCategories(); // enregistre les icônes avant de s'en servir

  map.addSource("gpx", {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "traces",
    type: "line",
    source: "gpx",
    filter: ["==", "$type", "LineString"],
    paint: {
      "line-color": ["coalesce", ["get", "couleur"], "#e63946"],
      "line-width": 3,
    },
  });

  ajouterCoucheWaypoints();
  ajouterCoucheSelection();

  await chargerTags();
  await chargerDonnees(true);
});

// ---------- Réactions aux actions de l'utilisateur ----------

let minuteur;
function planifierChargement() {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => chargerDonnees(false), 300);
}

document.getElementById("filtres").addEventListener("input", planifierChargement);

map.on("moveend", () => {
  if (document.getElementById("zone-visible").checked) planifierChargement();
});

document.getElementById("reinitialiser").addEventListener("click", () => {
  document.querySelectorAll("#filtres input").forEach((champ) => {
    if (champ.type === "checkbox") champ.checked = false;
    else champ.value = "";
  });
  chargerDonnees(true);
});

document.getElementById("ajouter-tag").addEventListener("click", async () => {
  const champ = document.getElementById("nouveau-tag");
  const nom = champ.value.trim();
  if (!nom) return;

  const reponse = await fetch("/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nom,
      couleur: document.getElementById("nouvelle-couleur").value,
    }),
  });

  if (!reponse.ok) {
    const erreur = await reponse.json();
    alert(typeof erreur.detail === "string" ? erreur.detail : "Nom de tag invalide.");
    return;
  }
  champ.value = "";
  await chargerTags();
});

document.getElementById("fichier").addEventListener("change", async (evenement) => {
  const message = document.getElementById("message");
  message.textContent = "";

  for (const fichier of evenement.target.files) {
    const formulaire = new FormData();
    formulaire.append("fichier", fichier);

    const reponse = await fetch("/import", { method: "POST", body: formulaire });
    const resultat = await reponse.json();

    message.textContent += reponse.ok
      ? `✔ ${fichier.name} importé\n`
      : `✘ ${fichier.name} : ${resultat.detail}\n`;
  }

  evenement.target.value = "";
  await chargerDonnees(true);
});