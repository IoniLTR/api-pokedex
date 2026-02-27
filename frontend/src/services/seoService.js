const DEFAULT_SEO = {
  title: 'Pokedex',
  description: 'Pokedex interactif avec filtres, favoris et fiche detaillee des Pokemon.'
}

const ROUTE_SEO = {
  home: {
    title: 'Pokedex | Accueil',
    description: 'Explorez les Pokemon, filtres par type et region, et gerez vos favoris.'
  },
  connexion: {
    title: 'Pokedex | Connexion',
    description: 'Connectez-vous pour sauvegarder vos Pokemon favoris.'
  },
  inscription: {
    title: 'Pokedex | Inscription',
    description: 'Creez votre compte pour enregistrer et retrouver vos favoris.'
  },
  profil: {
    title: 'Pokedex | Profil',
    description: 'Consultez votre profil et vos Pokemon favoris.'
  }
}

const ensureMetaTag = (name) => {
  if (typeof document === 'undefined') return null
  let tag = document.head.querySelector(`meta[name="${name}"]`)
  if (tag) return tag
  tag = document.createElement('meta')
  tag.setAttribute('name', name)
  document.head.appendChild(tag)
  return tag
}

const ensureCanonicalLink = () => {
  if (typeof document === 'undefined') return null
  let link = document.head.querySelector('link[rel="canonical"]')
  if (link) return link
  link = document.createElement('link')
  link.setAttribute('rel', 'canonical')
  document.head.appendChild(link)
  return link
}

export const updateSeoFromRoute = (route) => {
  if (typeof document === 'undefined') return

  const routeName = String(route?.name || '')
  const baseSeo = ROUTE_SEO[routeName] || DEFAULT_SEO
  const title = String(baseSeo.title || DEFAULT_SEO.title).trim()
  const description = String(baseSeo.description || DEFAULT_SEO.description).trim()

  document.title = title

  const descriptionTag = ensureMetaTag('description')
  if (descriptionTag) {
    descriptionTag.setAttribute('content', description)
  }

  const canonicalLink = ensureCanonicalLink()
  if (canonicalLink && typeof window !== 'undefined') {
    const cleanPath = String(route?.path || '/')
    canonicalLink.setAttribute('href', `${window.location.origin}${cleanPath}`)
  }
}
