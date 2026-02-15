# Rapport des tests E2E - COVE

## Configuration

| Parametre | Valeur |
|-----------|--------|
| Framework | Playwright (@playwright/test) |
| Navigateur | Chromium |
| Mode | headless: true |
| Base URL | http://localhost:3000 (backend Express) |
| Workers | 1 (sequentiel) |
| Temps d'execution | ~43 secondes |
| Backend | Demarre automatiquement via webServer config |

---

## Resultats : 9 suites, 50 tests - 100% passes

### 1. navigation.spec.js - 5 tests
| Test | Statut |
|------|--------|
| Page d'accueil - titre et navigation | OK |
| Navigation vers la page produit T-shirt | OK |
| Selectionner une taille et ajouter au panier | OK |
| Verifier le panier avec un article | OK |
| Parcours complet: accueil > produit > panier | OK |

### 2. checkout.spec.js - 4 tests
| Test | Statut |
|------|--------|
| Panier affiche correctement avant checkout | OK |
| Ouvrir le formulaire de commande | OK |
| Fermer la modale de checkout | OK |
| Remplir le formulaire de commande | OK |

### 3. auth-admin.spec.js - 6 tests
| Test | Statut |
|------|--------|
| Page compte - formulaire de connexion visible | OK |
| Connexion utilisateur | OK |
| Deconnexion utilisateur | OK |
| Erreur de connexion avec mauvais mot de passe | OK |
| Admin refuse pour un utilisateur normal | OK |
| Onglet inscription visible | OK |

### 4. forgot-password.spec.js - 4 tests
| Test | Statut |
|------|--------|
| Lien "Mot de passe oublie" visible | OK |
| Clic affiche le formulaire | OK |
| Retour a la connexion | OK |
| Soumission avec email | OK |

### 5. shop.spec.js - 9 tests (nouveau)
| Test | Statut |
|------|--------|
| Affichage de tous les produits | OK |
| Filtre par categorie Tops | OK |
| Filtre "Tout" affiche tous les produits | OK |
| Recherche produit par nom | OK |
| Tri par prix croissant | OK |
| Tri par prix decroissant | OK |
| Tri par nom A-Z | OK |
| Ajout rapide au panier avec taille selectionnee | OK |
| Ajout sans taille affiche un message | OK |

### 6. contact.spec.js - 4 tests (nouveau)
| Test | Statut |
|------|--------|
| Formulaire visible avec tous les champs | OK |
| Infos de contact affichees | OK |
| Soumission vide bloquee par validation | OK |
| Soumission avec formulaire rempli | OK |

### 7. i18n.spec.js - 6 tests (nouveau)
| Test | Statut |
|------|--------|
| Page d'accueil EN - textes en anglais | OK |
| Navigation EN - liens corrects | OK |
| Page Shop EN | OK |
| Changement de langue FR -> EN | OK |
| Changement de langue EN -> FR | OK |
| Panier partage entre les langues | OK |

### 8. legal.spec.js - 7 tests (nouveau)
| Test | Statut |
|------|--------|
| Page CGV accessible et contenu present | OK |
| Page Mentions legales accessible | OK |
| Page Confidentialite accessible | OK |
| Page Retours accessible | OK |
| Page About accessible | OK |
| Navigation depuis le footer vers CGV | OK |
| Navigation retour depuis une page legale | OK |

### 9. mobile.spec.js - 5 tests (nouveau)
| Test | Statut |
|------|--------|
| Page d'accueil responsive (375px) | OK |
| Page produit - galerie et tailles | OK |
| Panier responsive | OK |
| Page shop responsive | OK |
| Footer visible sur mobile | OK |

---

## Problemes resolus

| Probleme | Solution |
|----------|----------|
| Images avec espaces dans les tests | Remplace par `image/t-shirt-front.JPG` |
| waitForTimeout excessifs | Remplaces par `expect().toBeVisible()` et attentes explicites |
| Tests non-deterministes (if/else) | Supprimes, tests clairs avec assertions directes |
| Backend non auto-demarre | Ajoute `webServer` dans playwright.config.js |
| Conflit selecteur taille L/XL | Utilise regex `/^L$/` pour match exact |
| Script npm test cassé | Corrige pour utiliser `@playwright/test/cli.js` |
| Global setup rate-limited | Simplifie pour login d'abord, register en fallback |
| Tests i18n cassés (beforeEach) | Ajoute `page.goto('/')` avant `page.evaluate()` |

## Commandes

```bash
# Lancer tous les tests (backend demarre automatiquement)
npm test

# Lancer avec navigateur visible
npm run test:headed

# Lancer un seul fichier
node ./node_modules/@playwright/test/cli.js test tests/shop.spec.js

# Voir le rapport HTML
npm run test:report
```
