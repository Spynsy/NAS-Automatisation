// JavaScript source code
// ---------- Waypoints : catégories, icônes et fenêtre d'édition ----------

let categoriesDisponibles = [];

// Dessine un emoji dans une pastille ronde et renvoie l'image obtenue
function creerIcone(emoji) {
  const taille = 48;
  const canvas = document.createElement("canvas");
  canvas.width = taille;
  canvas.height = taille;
  const ctx = canvas.getContext("2d");

  ctx.beginPath();
  ctx.arc(taille / 2, taille / 2, 22, 0, 2 * Math.PI);
  ctx.fillStyle = "white";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#1d3557";
  ctx.stroke();

  ctx.font = "26px 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(emoji, taille / 2, taille / 2 + 2);

  return ctx.getImageData(0, 0, taille, taille);
}

// Appelée une fois, au chargement de la carte (voir app.js)
async function chargerCategories() {
  const reponse = await fetch("/categories");
  categoriesDisponibles = await reponse.json();

  const conteneur = document.getElementById("filtre-categories");
  conteneur.innerHTML = "";

  categoriesDisponibles.forEach((c) => {
    // enregistre l'image dans la carte sous le nom "icone-camping", etc.
    map.addImage(`icone-${c.id}`, creerIcone(c.icone), { pixelRatio: 2 });

    const etiquette = document.createElement("label");
    const caseACocher = document.createElement("input");
    caseACocher.type = "checkbox";
    caseACocher.value = c.id;
    etiquette.append(caseACocher, ` ${c.icone} ${c.nom}`);
    conteneur.append(etiquette);
  });
}

function ajouterCoucheWaypoints() {
  map.addLayer({
    id: "waypoints",
    type: "symbol",
    source: "gpx",
    filter: ["==", "$type", "Point"],
    layout: {
      // l'image affichée dépend de la propriété "categorie" de chaque point
      "icon-image": ["concat", "icone-", ["get", "categorie"]],
      "icon-allow-overlap": true,
    },
  });
}

function ouvrirPopupWaypoint(f) {
  const p = f.properties;

  const conteneur = document.createElement("div");
  const titre = document.createElement("strong");
  titre.textContent = p.name || "(sans nom)";
  conteneur.append(titre);

  if (typeof p.altitude === "number") {
    const altitude = document.createElement("div");
    altitude.textContent = `${Math.round(p.altitude)} m`;
    conteneur.append(altitude);
  }

  const selecteur = document.createElement("select");
  categoriesDisponibles.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = `${c.icone} ${c.nom}`;
    option.selected = c.id === p.categorie;
    selecteur.append(option);
  });

  selecteur.addEventListener("change", async () => {
    await fetch(`/waypoints/${p.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorie: selecteur.value }),
    });
    await chargerDonnees(false); // l'icône change sur la carte
  });
  conteneur.append(selecteur);

  new maplibregl.Popup({ offset: 20 })
    .setLngLat(f.geometry.coordinates.slice())
    .setDOMContent(conteneur)
    .addTo(map);
}

map.on("click", "waypoints", (e) => ouvrirPopupWaypoint(e.features[0]));
map.on("mouseenter", "waypoints", () => (map.getCanvas().style.cursor = "pointer"));
map.on("mouseleave", "waypoints", () => (map.getCanvas().style.cursor = ""));