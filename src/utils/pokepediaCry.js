const POKEPEDIA_API_URL = "https://www.pokepedia.fr/api.php";
const AUDIO_EXTENSION_REGEX = /\.(?:ogg|mp3|wav)$/i;
const cryUrlCache = new Map();
const frenchNameCache = new Map();

function cleanToken(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeCacheKey(value) {
  return cleanToken(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buildApiUrl(params) {
  const query = new URLSearchParams({
    format: "json",
    formatversion: "2",
    ...params
  });
  return `${POKEPEDIA_API_URL}?${query.toString()}`;
}

async function fetchJson(url) {
  if (typeof fetch !== "function") {
    throw new Error("Fetch API indisponible (Node >= 18 requis)");
  }

  const res = await fetch(url, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Pokepedia API HTTP ${res.status}`);
  }

  return res.json();
}

async function fetchFrenchNameFromPokeApi(pokemonName) {
  const sourceName = cleanToken(pokemonName);
  if (!sourceName) return "";

  const cacheKey = normalizeCacheKey(sourceName);
  if (frenchNameCache.has(cacheKey)) {
    return frenchNameCache.get(cacheKey);
  }

  const speciesKey = sourceName
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\s+/g, "-");

  try {
    const payload = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(speciesKey)}`);
    const names = Array.isArray(payload?.names) ? payload.names : [];
    const french = names.find((entry) => entry?.language?.name === "fr");
    const frenchName = cleanToken(french?.name);
    frenchNameCache.set(cacheKey, frenchName);
    return frenchName;
  } catch {
    frenchNameCache.set(cacheKey, "");
    return "";
  }
}

function buildTitleCandidates(name) {
  const base = cleanToken(name);
  if (!base) return [];

  const candidates = [
    base,
    base.replace(/ /g, "_"),
    base.replace(/'/g, "’"),
    base.replace(/’/g, "'"),
    base.replace(/[.\-]/g, " "),
    base
      .split(" ")
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(" ")
  ];

  return [...new Set(candidates.map((item) => cleanToken(item)).filter(Boolean))];
}

async function getWikitextForTitle(title) {
  const payload = await fetchJson(
    buildApiUrl({
      action: "parse",
      page: title,
      redirects: "1",
      prop: "wikitext|text"
    })
  );

  const wikitext = payload?.parse?.wikitext;
  const html = payload?.parse?.text;
  return {
    wikitext: typeof wikitext === "string" ? wikitext : "",
    html: typeof html === "string" ? html : ""
  };
}

async function findPageWikitext(pokemonName) {
  const titleCandidates = buildTitleCandidates(pokemonName);

  for (const candidate of titleCandidates) {
    try {
      const { wikitext, html } = await getWikitextForTitle(candidate);
      if (wikitext || html) return { title: candidate, wikitext, html };
    } catch {
      // Ignore and try next candidate.
    }
  }

  const searchPayload = await fetchJson(
    buildApiUrl({
      action: "query",
      list: "search",
      srsearch: cleanToken(pokemonName),
      srlimit: "6"
    })
  );

  const results = Array.isArray(searchPayload?.query?.search) ? searchPayload.query.search : [];
  for (const result of results) {
    const title = cleanToken(result?.title);
    if (!title) continue;

    try {
      const { wikitext, html } = await getWikitextForTitle(title);
      if (wikitext || html) return { title, wikitext, html };
    } catch {
      // Ignore and try next candidate.
    }
  }

  return { title: "", wikitext: "", html: "" };
}

function normalizeMediaName(rawName) {
  let cleaned = cleanToken(rawName)
    .replace(/^\[\[/, "")
    .replace(/\]\]$/, "")
    .replace(/^https?:\/\/www\.pokepedia\.fr\//i, "")
    .replace(/^\/+/, "")
    .replace(/^(?:fichier|file)\s*:/i, "")
    .replace(/_/g, " ")
    .replace(/[)>.,;]+$/g, "")
    .trim();

  cleaned = cleaned.split("#")[0].split("?")[0].trim();
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // Ignore malformed URI sequences and keep raw token.
  }
  return cleaned;
}

function extractAudioCandidates(wikitext) {
  if (!wikitext) return [];
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    const cleaned = normalizeMediaName(value);
    if (!cleaned || !AUDIO_EXTENSION_REGEX.test(cleaned)) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(cleaned);
  };

  const mediaLinkRegex = /\[\[(?:fichier|file)\s*:\s*([^\]|]+\.(?:ogg|mp3|wav))/gi;
  let mediaMatch;
  while ((mediaMatch = mediaLinkRegex.exec(wikitext)) !== null) {
    addCandidate(mediaMatch[1]);
  }

  const cryParamRegex = /(?:\bcri\b|\bcry\b)\s*=\s*([^\n|}]+?\.(?:ogg|mp3|wav))/gi;
  let cryMatch;
  while ((cryMatch = cryParamRegex.exec(wikitext)) !== null) {
    addCandidate(cryMatch[1]);
  }

  const httpRegex = /(https?:\/\/[^\s|<>"']+\.(?:ogg|mp3|wav))/gi;
  let httpMatch;
  while ((httpMatch = httpRegex.exec(wikitext)) !== null) {
    addCandidate(httpMatch[1]);
  }

  const protocolRelativeRegex = /(\/\/[^\s|<>"']+\.(?:ogg|mp3|wav))/gi;
  let prMatch;
  while ((prMatch = protocolRelativeRegex.exec(wikitext)) !== null) {
    addCandidate(prMatch[1]);
  }

  return candidates;
}

function extractAudioCandidatesFromHtml(html) {
  if (!html) return [];
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    const cleaned = normalizeMediaName(value);
    if (!cleaned || !AUDIO_EXTENSION_REGEX.test(cleaned)) return;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(cleaned);
  };

  const filePageRegex = /(https?:\/\/www\.pokepedia\.fr\/Fichier:[^"'<> ]+\.(?:ogg|mp3|wav))/gi;
  let filePageMatch;
  while ((filePageMatch = filePageRegex.exec(html)) !== null) {
    addCandidate(filePageMatch[1]);
  }

  const relativeFilePageRegex = /(\/Fichier:[^"'<> ]+\.(?:ogg|mp3|wav))/gi;
  let relativeMatch;
  while ((relativeMatch = relativeFilePageRegex.exec(html)) !== null) {
    addCandidate(relativeMatch[1]);
  }

  const directAudioRegex = /(https?:\/\/[^"'<> ]+\.(?:ogg|mp3|wav))/gi;
  let directMatch;
  while ((directMatch = directAudioRegex.exec(html)) !== null) {
    addCandidate(directMatch[1]);
  }

  const protocolRelativeRegex = /(\/\/[^"'<> ]+\.(?:ogg|mp3|wav))/gi;
  let protocolRelativeMatch;
  while ((protocolRelativeMatch = protocolRelativeRegex.exec(html)) !== null) {
    addCandidate(protocolRelativeMatch[1]);
  }

  return candidates;
}

function pickBestAudioCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return "";
  if (candidates.length === 1) return candidates[0];

  const scored = candidates.map((candidate) => {
    const lower = candidate.toLowerCase();
    let score = 0;
    if (lower.includes("cri")) score += 4;
    if (lower.includes("cry")) score += 4;
    if (lower.includes("pokemon")) score += 2;
    if (lower.includes("voix")) score += 1;
    if (lower.endsWith(".ogg")) score += 1;
    return { candidate, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].candidate;
}

async function resolveMediaToUrl(mediaName) {
  let token = cleanToken(mediaName);
  if (!token) return "";

  const filePageUrlMatch = token.match(/^https?:\/\/www\.pokepedia\.fr\/Fichier:(.+)$/i);
  if (filePageUrlMatch) {
    token = `Fichier:${filePageUrlMatch[1]}`;
  }

  const relativeFilePageMatch = token.match(/^\/Fichier:(.+)$/i);
  if (relativeFilePageMatch) {
    token = `Fichier:${relativeFilePageMatch[1]}`;
  }

  if (token.startsWith("http://") || token.startsWith("https://")) {
    return cleanToken(token);
  }

  if (token.startsWith("//")) {
    return `https:${token}`;
  }

  const normalizedFileName = normalizeMediaName(token);
  if (!normalizedFileName) return "";

  const title = `Fichier:${normalizedFileName}`;

  try {
    const payload = await fetchJson(
      buildApiUrl({
        action: "query",
        prop: "imageinfo",
        iiprop: "url",
        titles: title
      })
    );

    const pages = Array.isArray(payload?.query?.pages) ? payload.query.pages : [];
    for (const page of pages) {
      const imageInfo = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
      const url = cleanToken(imageInfo?.url);
      if (url) return url;
    }
  } catch {
    // Continue with fallback URL below.
  }

  return `https://www.pokepedia.fr/wiki/Sp%C3%A9cial:Fichier/${encodeURIComponent(
    normalizedFileName.replace(/ /g, "_")
  )}`;
}

async function fetchPokemonCryUrlFromPokepedia(pokemonName) {
  const name = cleanToken(pokemonName);
  if (!name) return "";

  const cacheKey = normalizeCacheKey(name);
  if (cryUrlCache.has(cacheKey)) {
    return cryUrlCache.get(cacheKey);
  }

  const resolveFromName = async (candidateName) => {
    const { wikitext, html } = await findPageWikitext(candidateName);
    const candidates = [
      ...extractAudioCandidates(wikitext),
      ...extractAudioCandidatesFromHtml(html)
    ];
    const bestCandidate = pickBestAudioCandidate(candidates);
    return bestCandidate ? resolveMediaToUrl(bestCandidate) : "";
  };

  try {
    let resolvedUrl = cleanToken(await resolveFromName(name));

    if (!resolvedUrl) {
      const frenchName = await fetchFrenchNameFromPokeApi(name);
      if (frenchName && normalizeCacheKey(frenchName) !== cacheKey) {
        resolvedUrl = cleanToken(await resolveFromName(frenchName));
      }
    }

    cryUrlCache.set(cacheKey, resolvedUrl);
    return resolvedUrl;
  } catch {
    cryUrlCache.set(cacheKey, "");
    return "";
  }
}

module.exports = {
  fetchPokemonCryUrlFromPokepedia
};
