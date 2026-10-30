// JavaScript source code
// ---------- Choix du fond de carte ----------

const FONDS = ["osm", "planign", "ign", "esri"];

function choisirFond(id) {
  FONDS.forEach((f) => {
    map.setLayoutProperty(`fond-${f}`, "visibility", f === id ? "visible" : "none");
  });
  try {
    localStorage.setItem("fond", id); // pour retrouver ce choix au prochain chargement
  } catch (e) {
    // stockage indisponible : ce n'est pas grave
  }
}

document.querySelectorAll('#fonds input[name="fond"]').forEach((radio) => {
  radio.addEventListener("change", () => choisirFond(radio.value));
});

map.on("load", () => {
  let fond = "osm";
  try {
    fond = localStorage.getItem("fond") || "osm";
  } catch (e) {}
  if (!FONDS.includes(fond)) fond = "osm";

  document.querySelector(`#fonds input[value="${fond}"]`).checked = true;
  choisirFond(fond);
});