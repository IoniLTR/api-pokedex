const { PkmnType } = require("../models/pkmnType");

function listTypes() {
  // On renvoie copie pour éviter modif accidentelle
  return [...PkmnType];
}

module.exports = { listTypes };