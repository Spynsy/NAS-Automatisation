// ---------- Modification du nom et de la couleur (tags et familles) ----------

// Remplace la ligne d'un élément par un petit formulaire.
// ressource : "tags" ou "familles" ; rechargerListe : fonction qui réaffiche la liste
function ouvrirEdition(ressource, element, ligne, rechargerListe) {
  const edition = document.createElement("div");
  edition.className = "ligne edition-tag";
  // taper dans ces champs ne doit pas relancer le chargement des données
  edition.addEventListener("input", (e) => e.stopPropagation());
  edition.addEventListener("change", (e) => e.stopPropagation());

  const champNom = document.createElement("input");
  champNom.type = "text";
  champNom.value = element.nom;
  champNom.maxLength = ressource === "tags" ? 50 : 80;

  const champCouleur = document.createElement("input");
  champCouleur.type = "color";
  champCouleur.value = element.couleur;

  const valider = document.createElement("button");
  valider.type = "button";
  valider.textContent = "✔";
  valider.title = "Enregistrer";

  const annuler = document.createElement("button");
  annuler.type = "button";
  annuler.textContent = "✖";
  annuler.title = "Annuler";

  valider.addEventListener("click", async () => {
    const reponse = await fetch(`/${ressource}/${element.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: champNom.value, couleur: champCouleur.value }),
    });

    if (!reponse.ok) {
      const erreur = await reponse.json();
      alert(typeof erreur.detail === "string" ? erreur.detail : "Modification invalide.");
      return;
    }

    await rechargerListe();
    await chargerDonnees(false);
    if (traceFiche) await apresChangementTags(); // met à jour la fiche ouverte (fiche.js)
  });

  annuler.addEventListener("click", () => rechargerListe());

  edition.append(champNom, champCouleur, valider, annuler);
  ligne.replaceChildren(edition);
}

// Appelée par app.js pour les tags (inchangé de ce côté)
function ouvrirEditionTag(tag, ligne) {
  ouvrirEdition("tags", tag, ligne, chargerTags);
}
// Affichage d'un tag dans la liste : même disposition que les familles, avec un rond
function creerEtiquetteTag(tag) {
  const element = document.createElement("span");
  element.className = "etiquette-famille"; // même mise en forme que les familles

  const rond = document.createElement("span");
  rond.className = "carre-famille rond-tag";
  rond.style.background = tag.couleur;

  element.append(rond, tag.nom);
  return element;
}