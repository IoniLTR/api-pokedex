function normalizeRegionName(regionName) {
  return String(regionName || "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function inferRegionKeyFromNationalDex(regionPokedexNumber) {
  const num = Number(regionPokedexNumber);
  if (!Number.isFinite(num)) return "";

  if (num >= 1 && num <= 151) return "KANTO";
  if (num >= 152 && num <= 251) return "JOHTO";
  if (num >= 252 && num <= 386) return "HOENN";
  if (num >= 387 && num <= 493) return "SINNOH";
  if (num >= 494 && num <= 649) return "UNYS";
  if (num >= 650 && num <= 721) return "KALOS";
  if (num >= 722 && num <= 809) return "ALOLA";
  if (num >= 810 && num <= 898) return "GALAR";
  if (num >= 899 && num <= 905) return "HISUI";
  if (num >= 906) return "PALDEA";

  return "";
}

const REGION_IMAGE_URLS = {
  KANTO: "https://www.pokepedia.fr/images/thumb/4/44/Kanto_LGPE.png/275px-Kanto_LGPE.png",
  JOHTO: "https://www.pokepedia.fr/images/thumb/f/f2/Johto_HGSS.jpg/275px-Johto_HGSS.jpg",
  HOENN: "https://www.pokepedia.fr/images/thumb/4/4c/Carte_de_Hoenn_ROSA.png/275px-Carte_de_Hoenn_ROSA.png",
  SINNOH: "https://www.pokepedia.fr/images/thumb/9/99/Sinnoh-DEPS.png/275px-Sinnoh-DEPS.png",
  HISUI: "https://www.pokepedia.fr/images/thumb/c/cb/Hisui_-_LPA.png/275px-Hisui_-_LPA.png",
  UNYS: "https://www.pokepedia.fr/images/thumb/a/ae/Unys_-_NB2.png/275px-Unys_-_NB2.png",
  KALOS: "https://www.pokepedia.fr/images/thumb/d/d1/Kalos_-_XY.png/275px-Kalos_-_XY.png",
  ALOLA: "https://www.pokepedia.fr/images/thumb/4/4d/Alola_-_USUL.png/275px-Alola_-_USUL.png",
  GALAR: "https://www.pokepedia.fr/images/thumb/b/bc/Galar_-_EB.png/275px-Galar_-_EB.png",
  PALDEA: "https://www.pokepedia.fr/images/thumb/8/88/Paldea_-_EV.png/275px-Paldea_-_EV.png",
  SEPTENTRIA: "https://www.pokepedia.fr/images/thumb/a/a4/Carte_Septentria_EV.png/275px-Carte_Septentria_EV.png",
  FIORE: "https://www.pokepedia.fr/images/thumb/f/f5/Fiore.png/275px-Fiore.png",
  ALMIA: "https://www.pokepedia.fr/images/thumb/f/f4/Almia.png/275px-Almia.png",
  OBLIVIA: "https://www.pokepedia.fr/images/thumb/9/90/Oblivia.png/275px-Oblivia.png"
};

const REGION_NAME_ALIASES = {
  UNOVA: "UNYS",
  KITAKAMI: "SEPTENTRIA"
};

const REGION_LABELS = {
  KANTO: "Kanto",
  JOHTO: "Johto",
  HOENN: "Hoenn",
  SINNOH: "Sinnoh",
  HISUI: "Hisui",
  UNYS: "Unys",
  KALOS: "Kalos",
  ALOLA: "Alola",
  GALAR: "Galar",
  PALDEA: "Paldea",
  SEPTENTRIA: "Septentria",
  FIORE: "Fiore",
  ALMIA: "Almia",
  OBLIVIA: "Oblivia"
};

function resolveRegionKey(regionName, regionPokedexNumber) {
  const normalized = normalizeRegionName(regionName);
  const inferred = inferRegionKeyFromNationalDex(regionPokedexNumber);

  if (!normalized || normalized === "NATIONAL") {
    return inferred || "";
  }

  const candidates = normalized
    .split(/[\/,-]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    if (candidate === "NATIONAL" && inferred) {
      return inferred;
    }

    const key = REGION_NAME_ALIASES[candidate] || candidate;
    if (REGION_IMAGE_URLS[key]) {
      return key;
    }
  }

  return inferred || "";
}

function resolveRegionName(regionName, regionPokedexNumber) {
  const key = resolveRegionKey(regionName, regionPokedexNumber);
  if (key && REGION_LABELS[key]) return REGION_LABELS[key];
  return String(regionName || "").trim();
}

function resolveRegionImageUrl(regionName, regionPokedexNumber) {
  const key = resolveRegionKey(regionName, regionPokedexNumber);
  if (key && REGION_IMAGE_URLS[key]) {
    return REGION_IMAGE_URLS[key];
  }
  return "";
}

module.exports = {
  normalizeRegionName,
  resolveRegionName,
  inferRegionKeyFromNationalDex,
  resolveRegionImageUrl
};
