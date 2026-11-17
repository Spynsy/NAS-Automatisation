// JavaScript source code
// ---------- Familles : collections de tracés et de waypoints ----------

let famillesDisponibles = [];

function creerPastilleFamille(famille) {
  const element = document.createElement("span");
  element.className = "etiquette-famille";

  const carre = document.createElement("span");
  carre.className = "carre-famille";
  carre.style.background = famille.couleur;

  element.append(carre, famille.nom);
  return element;
}

function idsFamillesCochees() {
  return [...document.querySelectorAll("#filtre-familles input:checked")].map((c) =>
    Number(c.value)
  );
}

// Recharge tout ce qui dépend des familles
async function actualiserApresFamilles() {
  await chargerFamilles();
  await chargerDonnees(false);
  if (traceFiche) await apresChangementTags(); // fiche.js
}

async function chargerFamilles() {
  const reponse = await fetch("/familles");
  famillesDisponibles = await reponse.json();

  // ----- liste des familles (avec cases de filtre) -----
  const coches = new Set(idsFamillesCochees());
  const conteneur = document.getElementById("filtre-familles");
  conteneur.innerHTML = "";

  famillesDisponibles.forEach((famille) => {
    const ligne = document.createElement("div");
    ligne.className = "ligne";

    const etiquette = document.createElement("label");
    const caseACocher = document.createElement("input");
    caseACocher.type = "checkbox";
    caseACocher.value = famille.id;
    caseACocher.checked = coches.has(famille.id);
    etiquette.append(
      caseACocher,
      creerPastilleFamille(famille),
      ` (${famille.nb_traces} tracés, ${famille.nb_waypoints} points)`
    );

    const modifier = document.createElement("button");
    modifier.type = "button";
    modifier.textContent = "✏️";
    modifier.title = "Modifier le nom ou la couleur";
    modifier.addEventListener("click", () =>
      ouvrirEdition("familles", famille, ligne, chargerFamilles)
    );

    const supprimer = document.createElement("button");
    supprimer.type = "button";
    supprimer.textContent = "×";
    supprimer.title = "Supprimer cette famille";
    supprimer.addEventListener("click", async () => {
      const message =
        `Supprimer la famille « ${famille.nom} » ?\n` +
        "Les tracés et waypoints qu'elle contient ne sont pas supprimés.";
      if (!confirm(message)) return;
      await fetch(`/familles/${famille.id}`, { method: "DELETE" });
      await actualiserApresFamilles();
    });

    ligne.append(etiquette, modifier, supprimer);
    conteneur.append(ligne);
  });

  // ----- liste déroulante des opérations en masse -----
  const selecteur = document.getElementById("famille-cible");
  const choix = selecteur.value;
  selecteur.innerHTML = "";
  famillesDisponibles.forEach((f) => {
    const option = document.createElement("option");
    option.value = f.id;
    option.textContent = `📁 ${f.nom}`;
    selecteur.append(option);
  });
  if (famillesDisponibles.some((f) => String(f.id) === choix)) selecteur.value = choix;
}

// Cases à cocher d'appartenance pour un tracé ou un waypoint
function creerEditeurFamilles(p, apres, ressource = "traces") {
  const conteneur = document.createElement("div");
  conteneur.className = "editeur-tags";
  conteneur.addEventListener("click", (e) => e.stopPropagation());

  if (famillesDisponibles.length === 0) {
    conteneur.textContent = "Crée d'abord une famille dans le bloc « Familles ».";
    return conteneur;
  }

  const idsActuels = new Set((p.familles || []).map((f) => f.id));

  famillesDisponibles.forEach((famille) => {
    const etiquette = document.createElement("label");
    const caseACocher = document.createElement("input");
    caseACocher.type = "checkbox";
    caseACocher.checked = idsActuels.has(famille.id);

    caseACocher.addEventListener("change", async () => {
      if (caseACocher.checked) idsActuels.add(famille.id);
      else idsActuels.delete(famille.id);

      await fetch(`/${ressource}/${p.id}/familles`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ famille_ids: [...idsActuels] }),
      });
      await chargerFamilles(); // met à jour les compteurs
      await chargerDonnees(false);
      if (apres) await apres();
    });

    etiquette.append(caseACocher, creerPastilleFamille(famille));
    conteneur.append(etiquette);
  });
  return conteneur;
}

// ---------- Opérations en masse sur les éléments affichés ----------

function elementsAffiches() {
  const features = dernierGeojson ? dernierGeojson.features : []; // variable de app.js
  const ids = (type) =>
    features.filter((f) => f.properties.type === type).map((f) => f.properties.id);

  return {
    trace_ids: document.getElementById("op-traces").checked ? ids("track") : [],
    waypoint_ids: document.getElementById("op-points").checked ? ids("waypoint") : [],
  };
}

async function operationGroupee(action) { // "ajouter" ou "retirer"
  const selecteur = document.getElementById("famille-cible");
  const famille = famillesDisponibles.find((f) => String(f.id) === selecteur.value);
  if (!famille) {
    alert("Crée d'abord une famille.");
    return;
  }

  const elements = elementsAffiches();
  const nbTraces = elements.trace_ids.length;
  const nbPoints = elements.waypoint_ids.length;
  if (nbTraces + nbPoints === 0) {
    alert("Aucun élément à traiter : vérifie les filtres et les cases « tracés » / « points ».");
    return;
  }

  const verbe = action === "ajouter" ? "Ajouter à" : "Retirer de";
  const message = `${verbe} la famille « ${famille.nom} » : ${nbTraces} tracé(s) et ${nbPoints} point(s) actuellement affichés ?`;
  if (!confirm(message)) return;

  const reponse = await fetch(`/familles/${famille.id}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(elements),
  });
  if (!reponse.ok) {
    alert("L'opération a échoué.");
    return;
  }
  await actualiserApresFamilles();
}

// ---------- Interactions ----------

// Cocher une famille dans la liste relance l'affichage filtré
document.getElementById("filtre-familles").addEventListener("change", planifierChargement);

document.getElementById("ajouter-famille").addEventListener("click", async () => {
  const champ = document.getElementById("nouvelle-famille");
  const nom = champ.value.trim();
  if (!nom) return;

  const reponse = await fetch("/familles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nom, couleur: document.getElementById("couleur-famille").value }),
  });

  if (!reponse.ok) {
    const erreur = await reponse.json();
    alert(typeof erreur.detail === "string" ? erreur.detail : "Nom de famille invalide.");
    return;
  }
  champ.value = "";
  await chargerFamilles();
});

document.getElementById("familles-ajouter").addEventListener("click", () => operationGroupee("ajouter"));
document.getElementById("familles-retirer").addEventListener("click", () => operationGroupee("retirer"));

chargerFamilles();