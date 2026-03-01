# 🎮 Pokédex API

Une application full-stack permettant de consulter, rechercher et gérer des Pokémon.  
Elle est composée d'une **API REST** (Node.js / Express / MongoDB) et d'un **frontend** (Vue 3 / Vite).

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir installé sur votre machine :

| Outil | Version minimale | Téléchargement |
|-------|-----------------|----------------|
| **Node.js** | `>= 20.19.0` ou `>= 22.12.0` | [nodejs.org](https://nodejs.org) |
| **npm** | Inclus avec Node.js | — |
| **MongoDB** | `>= 6.0` (Community Edition) | [mongodb.com](https://www.mongodb.com/try/download/community) |

> **Important :** MongoDB doit être démarré **avant** de lancer le backend.  
> Vérifiez qu'il tourne sur `mongodb://127.0.0.1:27017`.

---

## 📁 Structure du projet

```
pokedex-api/
├── src/                    # Backend (API REST)
│   ├── app.js              # Configuration Express (CORS, Swagger, routes)
│   ├── server.js           # Point d'entrée - connexion MongoDB + écoute
│   ├── config/             # Connexion base de données
│   ├── controllers/        # Logique métier (Pokémon, Dresseur, Utilisateur)
│   ├── middlewares/        # Auth JWT, vérification des permissions, gestion erreurs
│   ├── models/             # Schémas Mongoose
│   ├── routes/             # Définition des routes API
│   ├── services/           # Services métier
│   ├── scripts/            # Scripts utilitaires (seed, sync)
│   └── tests/              # Tests Jest + Supertest
├── frontend/               # Frontend (Vue 3 / Vite)
│   ├── src/
│   │   ├── views/          # Pages (HomeView, ProfileView...)
│   │   ├── components/     # Composants réutilisables
│   │   ├── services/       # Appels API côté client
│   │   └── assets/         # CSS, sons, images
│   └── index.html
├── .env.example            # Modèle des variables d'environnement
├── jest.config.js          # Configuration Jest
└── package.json            # Dépendances et scripts backend
```

---

## 🚀 Installation et lancement

### 1. Cloner le dépôt

```bash
git clone <url-du-depot>
cd pokedex-api
```

### 2. Configurer les variables d'environnement

Copiez le fichier `.env.example` en `.env` à la racine du projet et renseignez les valeurs :

```bash
cp .env.example .env
```

Contenu du `.env` à compléter :

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/pokedex
JWT_SECRET=votre_secret_jwt_ici
```

> **JWT_SECRET** : remplacez `CHANGE_ME` par une chaîne de caractères longue et aléatoire (ex: `monSuperSecretJWT2024`).

### 3. Installer les dépendances du backend

```bash
npm install
```

### 4. Installer les dépendances du frontend

```bash
cd frontend
npm install
cd ..
```

### 5. Démarrer MongoDB

Selon votre installation, démarrez MongoDB :

```bash
# macOS (Homebrew)
brew services start mongodb-community

# Linux (systemd)
sudo systemctl start mongod

# Windows
net start MongoDB
```

Vérifiez qu'il est accessible sur `mongodb://127.0.0.1:27017`.

### 6. Peupler la base de données (optionnel mais recommandé)

Pour importer les Pokémon depuis l'API PokéAPI :

```bash
npm run seed:pokeapi
```

> ⚠️ Ce script contacte une API externe et peut prendre quelques minutes selon votre connexion.

### 7. Lancer le backend

Depuis la **racine** du projet :

```bash
npm run dev
```

Le serveur démarre sur : **http://localhost:3000**

### 8. Lancer le frontend

Dans un **nouveau terminal**, depuis le dossier `frontend/` :

```bash
cd frontend
npm run dev
```

Le frontend est accessible sur : **http://localhost:5173**

---

## 🌐 URLs importantes

| Service | URL |
|---------|-----|
| Frontend (Vue) | http://localhost:5173 |
| API REST | http://localhost:3000/api |
| Documentation Swagger | http://localhost:3000/docs |

---

## 📡 Routes de l'API

### Utilisateurs (`/api/users`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/register` | ❌ | Créer un compte |
| `POST` | `/login` | ❌ | Se connecter (retourne un token JWT) |
| `GET` | `/checkUser` | ✅ | Vérifier le token / récupérer l'utilisateur connecté |
| `GET` | `/favorites` | ✅ | Récupérer ses favoris |
| `PUT` | `/favorites` | ✅ | Mettre à jour ses favoris |

### Pokémon (`/api/pkmn`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `GET` | `/search` | ❌ | Rechercher des Pokémon (filtres, pagination) |
| `GET` | `/` | ✅ | Récupérer un Pokémon par id ou nom |
| `GET` | `/types` | ✅ | Récupérer tous les types |
| `POST` | `/` | 🔑 ADMIN | Créer un Pokémon |
| `PUT` | `/` | 🔑 ADMIN | Modifier un Pokémon |
| `DELETE` | `/` | 🔑 ADMIN | Supprimer un Pokémon |
| `POST` | `/region` | 🔑 ADMIN | Ajouter une région à un Pokémon |
| `DELETE` | `/region` | 🔑 ADMIN | Retirer une région d'un Pokémon |
| `POST` | `/cry` | 🔑 ADMIN | Synchroniser le cri d'un Pokémon |

### Dresseur (`/api/trainer`)

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| `POST` | `/` | ✅ | Créer mon profil dresseur |
| `GET` | `/` | ✅ | Récupérer mon profil dresseur |
| `DELETE` | `/` | ✅ | Supprimer mon profil dresseur |
| `POST` | `/mark` | ✅ | Marquer un Pokémon comme vu / capturé |

> **Légende :** ❌ = Public, ✅ = Token JWT requis, 🔑 ADMIN = Rôle administrateur requis

---

## 🧪 Lancer les tests

Depuis la **racine** du projet :

```bash
npm test
```

Les tests utilisent **Jest** et **Supertest** pour tester l'API de manière intégrée.  
Le rapport de couverture se trouve dans le dossier `coverage/` après exécution.

---

## 🛠️ Scripts disponibles

### Backend (racine `/`)

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur en mode développement (rechargement auto avec nodemon) |
| `npm run start` | Lance le serveur en production |
| `npm test` | Exécute la suite de tests |
| `npm run seed:pokeapi` | Importe les Pokémon depuis PokéAPI dans MongoDB |
| `npm run sync:cries` | Synchronise les cris des Pokémon |

### Frontend (`frontend/`)

| Commande | Description |
|----------|-------------|
| `npm run dev` | Lance le serveur de développement Vite |
| `npm run build` | Compile le projet pour la production |
| `npm run preview` | Prévisualise le build de production |

---

## 🔐 Authentification

L'API utilise des **tokens JWT** (JSON Web Token).

1. Créez un compte via `POST /api/users/register`
2. Connectez-vous via `POST /api/users/login` → vous recevez un token
3. Ajoutez le token dans le header de vos requêtes : `Authorization: Bearer <token>`

---

## 📖 Documentation Swagger

Une documentation interactive de l'API est disponible à l'adresse :

**http://localhost:3000/docs**

Elle permet de tester toutes les routes directement depuis le navigateur.

---

## ⚙️ Technologies utilisées

**Backend**
- [Node.js](https://nodejs.org) + [Express](https://expressjs.com) — serveur HTTP
- [MongoDB](https://www.mongodb.com) + [Mongoose](https://mongoosejs.com) — base de données
- [JSON Web Token](https://jwt.io) — authentification
- [bcrypt](https://github.com/kelektiv/node.bcrypt.js) — hachage des mots de passe
- [Swagger](https://swagger.io) — documentation API
- [Jest](https://jestjs.io) + [Supertest](https://github.com/ladjs/supertest) — tests

**Frontend**
- [Vue 3](https://vuejs.org) — framework JavaScript
- [Vue Router](https://router.vuejs.org) — navigation
- [Vite](https://vitejs.dev) — bundler / serveur de développement