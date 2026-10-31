// ---------- Fiche détaillée d'une activité et profil altimétrique ----------

const elementCurseur = document.createElement("div");
elementCurseur.className = "curseur";
const curseur = new maplibregl.Marker({ element: elementCurseur });
let curseurAffiche = false;

let traceFiche = null; // données de l'activité actuellement affichée dans la fiche

const filtreSelection = (id) => [
  "all",
  ["==", ["geometry-type"], "LineString"],
  ["==", ["get", "id"], id],
];

// Appelée par app.js : un trait épais et translucide sous le tracé sélectionné
function ajouterCoucheSelection() {
  map.addLayer(
    {
      id: "trace-selection",
      type: "line",
      source: "gpx",
      filter: filtreSelection(-1), // -1 : aucune activité sélectionnée
      paint: { "line-color": "#000000", "line-width": 8, "line-opacity": 0.3 },
    },
    "traces" // placée juste en dessous de la couche des tracés
  );
}

function formaterDuree(secondes) {
  if (!secondes) return "durée inconnue";
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  return `${h} h ${String(m).padStart(2, "0")}`;
}

function masquerCurseur() {
  curseur.remove();
  curseurAffiche = false;
}

async function chargerFiche(id) {
  const reponse = await fetch(`/traces/${id}`);
  if (!reponse.ok) return null;
  return reponse.json();
}

// Remplit la fiche (titre, statistiques, tags, profil) à partir d'une activité
function remplirFiche(trace) {
  const date = trace.debut
    ? new Date(trace.debut).toLocaleDateString("fr-FR")
    : "date inconnue";
  const morceaux = [
    `${trace.distance_km} km`,
    `D+ ${trace.d_plus} m`,
    `D- ${trace.d_moins} m`,
    formaterDuree(trace.duree_s),
    date,
  ];
  if (trace.alt_min !== null) morceaux.push(`altitude ${trace.alt_min} à ${trace.alt_max} m`);

  document.getElementById("fiche-titre").textContent = trace.nom || "(sans nom)";
  document.getElementById("fiche-stats").textContent = morceaux.join(" · ");

  const zoneTags = document.getElementById("fiche-tags");
  zoneTags.innerHTML = "";
  trace.tags.forEach((t) => zoneTags.append(creerPastille(t))); // fonction de app.js

  const couleur = trace.tags.length ? trace.tags[0].couleur : "#e63946";
  dessinerProfil(trace.profil, couleur);
}

async function ouvrirFiche(id) {
  const trace = await chargerFiche(id);
  if (!trace) return;

  traceFiche = trace;
  map.setFilter("trace-selection", filtreSelection(id));
  fermerEditeurTags();
  remplirFiche(trace);
  document.getElementById("fiche").classList.add("ouverte");
}

function fermerFiche() {
  document.getElementById("fiche").classList.remove("ouverte");
  map.setFilter("trace-selection", filtreSelection(-1));
  fermerEditeurTags();
  masquerCurseur();
  traceFiche = null;
}

// ---------- Sélecteur de tags dans la fiche ----------

function fermerEditeurTags() {
  document.getElementById("fiche-editeur").classList.remove("ouvert");
}

// Rappel appelé après chaque case cochée : on relit l'activité et on redessine la fiche
async function apresChangementTags() {
  if (!traceFiche) return;
  const trace = await chargerFiche(traceFiche.id);
  if (!trace) return;
  traceFiche = trace;
  remplirFiche(trace);
}

function basculerEditeurTags() {
  if (!traceFiche) return;
  const editeur = document.getElementById("fiche-editeur");

  if (editeur.classList.contains("ouvert")) {
    fermerEditeurTags();
    return;
  }
  editeur.innerHTML = "";
  editeur.append(creerEditeurTags(traceFiche, apresChangementTags)); // fonction de app.js
  editeur.classList.add("ouvert");
}

// ---------- Profil altimétrique ----------

function dessinerProfil(profil, couleur) {
  const conteneur = document.getElementById("profil");
  const info = document.getElementById("profil-info");
  conteneur.innerHTML = "";
  info.textContent = "";

  if (profil.length < 2) {
    conteneur.textContent = "Pas de données d'altitude pour cette activité.";
    return;
  }

  // Taille du dessin et marges (en unités du viewBox, pas en pixels écran)
  const L = 900;
  const H = 170;
  const marge = { haut: 10, droite: 12, bas: 22, gauche: 52 };
  const base = H - marge.bas;

  const distMax = Math.max(profil[profil.length - 1][0], 0.001);
  const altitudes = profil.map((p) => p[1]);
  const altMin = Math.min(...altitudes);
  const altMax = Math.max(...altitudes);
  const ecart = Math.max(altMax - altMin, 1);

  // Deux fonctions affines : données -> coordonnées du dessin
  const x = (d) => marge.gauche + (d / distMax) * (L - marge.gauche - marge.droite);
  const y = (a) => base - ((a - altMin) / ecart) * (base - marge.haut);

  const points = profil.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join(" ");
  const aire = `${x(0)},${base} ${points} ${x(distMax).toFixed(1)},${base}`;

  const reperesY = [altMin, (altMin + altMax) / 2, altMax];
  const grille = reperesY
    .map(
      (a) =>
        `<line x1="${marge.gauche}" x2="${L - marge.droite}" y1="${y(a)}" y2="${y(a)}" stroke="#e5e7eb"/>` +
        `<text x="${marge.gauche - 6}" y="${y(a) + 4}" text-anchor="end" font-size="11" fill="#555">${Math.round(a)} m</text>`
    )
    .join("");

  const reperesX = [0, distMax / 2, distMax];
  const legende = reperesX
    .map((d, i) => {
      const ancrage = i === 0 ? "start" : i === 2 ? "end" : "middle";
      return `<text x="${x(d)}" y="${H - 6}" text-anchor="${ancrage}" font-size="11" fill="#555">${d.toFixed(1)} km</text>`;
    })
    .join("");

  conteneur.innerHTML = `
    <svg viewBox="0 0 ${L} ${H}" style="width:100%;height:auto;display:block">
      ${grille}
      ${legende}
      <polygon points="${aire}" fill="${couleur}" fill-opacity="0.2"/>
      <polyline points="${points}" fill="none" stroke="${couleur}" stroke-width="2"/>
      <line class="guide" x1="0" x2="0" y1="${marge.haut}" y2="${base}"
            stroke="#333" stroke-dasharray="4 3" style="visibility:hidden"/>
    </svg>`;

  const svg = conteneur.querySelector("svg");
  const guide = svg.querySelector(".guide");

  svg.addEventListener("mousemove", (e) => {
    // pixel écran -> coordonnée du dessin -> distance -> point le plus proche
    const rect = svg.getBoundingClientRect();
    const xDessin = ((e.clientX - rect.left) / rect.width) * L;
    const ratio = (xDessin - marge.gauche) / (L - marge.gauche - marge.droite);
    const d = Math.min(Math.max(ratio, 0), 1) * distMax;

    let proche = profil[0];
    for (const p of profil) {
      if (Math.abs(p[0] - d) < Math.abs(proche[0] - d)) proche = p;
    }

    guide.setAttribute("x1", x(proche[0]));
    guide.setAttribute("x2", x(proche[0]));
    guide.style.visibility = "visible";
    info.textContent = `${proche[0].toFixed(1)} km · ${Math.round(proche[1])} m`;

    curseur.setLngLat([proche[2], proche[3]]);
    if (!curseurAffiche) {
      curseur.addTo(map);
      curseurAffiche = true;
    }
  });

  svg.addEventListener("mouseleave", () => {
    guide.style.visibility = "hidden";
    info.textContent = "";
    masquerCurseur();
  });
}

// ---------- Interactions ----------

document.getElementById("fiche-fermer").addEventListener("click", fermerFiche);
document.getElementById("fiche-tags-bouton").addEventListener("click", basculerEditeurTags);

// Un clic en dehors du bouton et de la liste referme la liste de tags
document.addEventListener("click", (e) => {
  if (!e.target.closest("#fiche-actions")) fermerEditeurTags();
});

// Cliquer sur un tracé de la carte ouvre sa fiche
map.on("click", "traces", (e) => ouvrirFiche(e.features[0].properties.id));
map.on("mouseenter", "traces", () => (map.getCanvas().style.cursor = "pointer"));
map.on("mouseleave", "traces", () => (map.getCanvas().style.cursor = ""));

// ---------- Renommer et supprimer l'activité de la fiche ----------

function demarrerRenommage() {
  if (!traceFiche) return;

  const id = traceFiche.id;
  const ancienNom = traceFiche.nom || "";
  const titre = document.getElementById("fiche-titre");

  const champ = document.createElement("input");
  champ.type = "text";
  champ.value = ancienNom;
  champ.maxLength = 200;
  titre.replaceChildren(champ);
  champ.focus();
  champ.select();

  let termine = false; // évite d'enregistrer deux fois (Entrée, puis perte de focus)

  const terminer = async (enregistrer) => {
    if (termine) return;
    termine = true;

    let nomFinal = ancienNom;
    const nouveauNom = champ.value.trim();

    if (enregistrer && nouveauNom && nouveauNom !== ancienNom) {
      const reponse = await fetch(`/traces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: nouveauNom }),
      });
      if (reponse.ok) {
        nomFinal = nouveauNom;
        await chargerDonnees(false); // met à jour la liste et la carte
      } else {
        alert("Le renommage a échoué.");
      }
    }

    // la fiche a pu être fermée ou changée pendant ce temps
    if (traceFiche && traceFiche.id === id) {
      traceFiche.nom = nomFinal;
      titre.textContent = nomFinal || "(sans nom)";
    }
  };

  champ.addEventListener("keydown", (e) => {
    if (e.key === "Enter") terminer(true);
    if (e.key === "Escape") terminer(false);
  });
  champ.addEventListener("blur", () => terminer(true));
}

async function supprimerTraceFiche() {
  if (!traceFiche) return;

  const id = traceFiche.id;
  const nom = traceFiche.nom || "(sans nom)";
  if (!confirm(`Supprimer définitivement l'activité « ${nom} » ?\nCette action est irréversible.`)) {
    return;
  }

  const reponse = await fetch(`/traces/${id}`, { method: "DELETE" });
  if (!reponse.ok) {
    alert("La suppression a échoué.");
    return;
  }

  fermerFiche();
  if (traceEnEdition === id) traceEnEdition = null; // variable de app.js
  await chargerTags();       // les compteurs de tags changent
  await chargerDonnees(false);
}

document.getElementById("fiche-renommer").addEventListener("click", demarrerRenommage);
document.getElementById("fiche-supprimer").addEventListener("click", supprimerTraceFiche);