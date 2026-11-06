// JavaScript source code
// ---------- Modification d'un tag (nom, couleur) ----------

// Remplace la ligne d'un tag par un petit formulaire
function ouvrirEditionTag(tag, ligne) {
  const edition = document.createElement("div");
  edition.className = "ligne edition-tag";
  // taper dans ces champs ne doit pas relancer le chargement des filtres
  edition.addEventListener("input", (e) => e.stopPropagation());

  const champNom = document.createElement("input");
  champNom.type = "text";
  champNom.value = tag.nom;
  champNom.maxLength = 50;

  const champCouleur = document.createElement("input");
  champCouleur.type = "color";
  champCouleur.value = tag.couleur;

  const valider = document.createElement("button");
  valider.type = "button";
  valider.textContent = "✔";
  valider.title = "Enregistrer";

  const annuler = document.createElement("button");
  annuler.type = "button";
  annuler.textContent = "✖";
  annuler.title = "Annuler";

  valider.addEventListener("click", async () => {
    const reponse = await fetch(`/tags/${tag.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: champNom.value, couleur: champCouleur.value }),
    });

    if (!reponse.ok) {
      const erreur = await reponse.json();
      alert(typeof erreur.detail === "string" ? erreur.detail : "Modification invalide.");
      return;
    }

    await chargerTags();
    await chargerDonnees(false);
    if (traceFiche) await apresChangementTags(); // met à jour la fiche ouverte (fiche.js)
  });

  annuler.addEventListener("click", () => chargerTags()); // réaffiche la liste normale

  edition.append(champNom, champCouleur, valider, annuler);
  ligne.replaceChildren(edition);
}