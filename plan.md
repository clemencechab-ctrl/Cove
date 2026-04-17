# Fonctions majeures du site

## 1. Catalogue produits
- Afficher la liste des produits (nom, prix, image, tailles disponibles, stock si applicable)
- Accéder à une page produit (détails, photos, tailles, description)
- Filtrer / rechercher / trier (si existant)
- Gestion des variantes (ex: taille) : sélection obligatoire avant ajout au panier

## 2. Panier
- Ajouter un produit (avec variante: taille)
- Modifier quantités
- Supprimer un article
- Calcul total (sous-total, livraison si existant)
- Persistance du panier (session / compte) si existant

## 3. Passage de commande (checkout)
- Renseigner infos client (adresse, contact)
- Valider panier non vide
- Créer commande en base (statut initial)
- Afficher confirmation (numéro commande)

## 4. Paiement
- Choisir un moyen de paiement (ex: carte, virement, etc.)
- Paiement réussi → commande confirmée
- Paiement échoué/annulé → commande non confirmée + message clair
- Sécuriser le retour de paiement (si provider)

## 5. Emails liés aux commandes
- Email client envoyé à la création / confirmation
- Email propriétaire envoyé à la création / confirmation
- Contenu email : liste produits + quantités + prix + tailles + total + numéro commande

## 6. Comptes & authentification
- Création de compte client
- Connexion / déconnexion
- Accès protégé aux pages privées
- Compte propriétaire/admin séparé (rôles)

## 7. Suivi des commandes (client)
- Voir historique commandes
- Voir détails d'une commande
- Statut commande (ex: payée, expédiée…)

## 8. Gestion des commandes (propriétaire/admin)
- Voir liste des commandes
- Filtrer par statut
- Mettre à jour statut
- Voir détails commande (dont tailles)

## 9. Administration produits (propriétaire/admin)
- Créer / modifier / supprimer produit
- Ajouter / modifier images
- Ajouter / modifier variantes (taille)
- Publier / dépublier (si existant)

## 10. Déploiement & production
- Images accessibles en prod
- Variables d'environnement correctes (email, paiement)
- Logs d'erreurs activés

---

# Bordereaux d'envoi Colissimo — Guide d'utilisation

## Prérequis

### 1. Obtenir un contrat Colissimo
1. Aller sur https://www.colissimo.entreprise.laposte.fr
2. Créer un compte professionnel ou souscrire a l'offre Colissimo
3. Récupérer le **numero de contrat** et le **mot de passe API**

### 2. Configurer les variables d'environnement
Ajouter dans `backend/.env` :
```
COLISSIMO_CONTRACT_NUMBER=123456       # Numéro de contrat La Poste
COLISSIMO_PASSWORD=motdepasse          # Mot de passe API
COLISSIMO_SENDER_COMPANY=COVE          # Nom de l'entreprise expéditrice
COLISSIMO_SENDER_ADDRESS=10 rue X      # Adresse postale
COLISSIMO_SENDER_CITY=Paris            # Ville
COLISSIMO_SENDER_ZIPCODE=75002         # Code postal
COLISSIMO_SENDER_EMAIL=contact@cove.com # Email expediteur
COLISSIMO_SENDER_PHONE=0600000000      # Telephone
```

### 3. Redémarrer le backend
```bash
cd backend && npm run dev
```

---

## Comment générer un bordereau d'envoi

### Etape 1 — Se connecter en tant qu'admin
- Aller sur `/compte.html`, se connecter avec le compte owner
- Aller sur `/admin.html`

### Etape 2 — Trouver la commande
- Dans l'onglet **Tableau de bord**, repérer la commande a expédier
- La commande doit avoir une adresse de livraison complète (adresse, ville, code postal)

### Etape 3 — Cliquer sur "Colissimo"
- Sur la ligne de la commande, cliquer sur le bouton violet **Colissimo**
- Confirmer la génération dans la popup

### Etape 4 — Résultat automatique
Apres quelques secondes :
1. Le **PDF de l'etiquette** se telecharge automatiquement
2. Le **numéro de suivi Colissimo** est rempli automatiquement dans le champ tracking
3. Le PDF est aussi stocké sur le serveur dans `backend/labels/COVE-XXXX.pdf`

### Etape 5 — Imprimer et coller
- Ouvrir le PDF telecharge
- Imprimer sur papier A4 (format par défaut)
- Découper et coller l'étiquette sur le colis

### Etape 6 — Optionnel : passer en "Bordereau imprimé"
- Utiliser le sélecteur de statut pour passer la commande en **"Bordereau imprimé"**
- Le client recevra un email l'informant que l'expédition est imminente
- Plus tard, passer en **"Expédiée"** quand le colis est déposé a La Poste

---

## Re-télécharger un bordereau existant

Si l'étiquette a déjà été générée :
- Un bouton violet **PDF** apparait a côté du bouton Colissimo
- Cliquer dessus pour télécharger a nouveau le même PDF

---

## Cycle de vie d'une commande avec Colissimo

```
En attente → Payé → Confirmée → En préparation → Bordereau imprimé → Expédiée → Livrée
                                                    ↑
                                        Clic "Colissimo" ici
                                        (génère l'étiquette)
```

### Statuts
| Statut | Description |
|--------|-------------|
| En attente | Commande créée, pas encore payée |
| Payé | Paiement reçu via Stripe |
| Confirmée | Commande validée par l'admin |
| En préparation | Colis en cours de préparation |
| **Bordereau imprimé** | Etiquette Colissimo générée, prête a expédier |
| Expédiée | Colis déposé a La Poste |
| Livrée | Colis reçu par le client |

---

## Fichiers techniques

| Fichier | Rôle |
|---------|------|
| `backend/src/utils/colissimo.js` | Service API Colissimo (generateLabel) |
| `backend/src/routes/admin.js` | Endpoints generate-label + servir PDF |
| `backend/labels/` | Dossier de stockage des PDF d'étiquettes |
| `js/api.js` | Méthode `api.generateColissimoLabel()` |
| `js/admin.js` | Fonctions UI Firebase temps réel |
| `admin.html` / `en/admin.html` | Interface admin avec boutons Colissimo |

---

## Dépannage

### "Variables Colissimo non configurees"
→ Vérifier que `COLISSIMO_CONTRACT_NUMBER` et `COLISSIMO_PASSWORD` sont dans `backend/.env`

### "Adresse de livraison incomplete"
→ La commande n'a pas d'adresse valide (champs address, city, postalCode requis)

### "Colissimo erreur: ..."
→ Erreur renvoyée par l'API Colissimo. Vérifier :
- Les identifiants du contrat
- Que le contrat est actif
- Que l'adresse destinataire est valide (code postal, ville)

### Le PDF ne se telecharge pas
→ Vérifier que le navigateur n'a pas bloqué le téléchargement automatique (popup blocker)
→ Utiliser le bouton **PDF** pour re-télécharger manuellement
