# Plan - Ajout d'un formulaire de contact

## Objectif
Ajouter une page de contact fonctionnelle au site COVE.

---

## Etape 1 : Creer la page contact.html
- Creer un nouveau fichier `contact.html`
- Reprendre le header et footer existants pour la coherence
- Ajouter une section hero simplifiee avec le titre "Contact"

## Etape 2 : Concevoir le formulaire
- Champ Nom (obligatoire)
- Champ Email (obligatoire)
- Champ Sujet (optionnel)
- Champ Message (zone de texte, obligatoire)
- Bouton d'envoi

## Etape 3 : Ajouter les styles CSS
- Styler les champs input et textarea
- Styler le bouton submit
- Ajouter les etats hover et focus
- Assurer le responsive mobile

## Etape 4 : Mettre a jour la navigation
- Modifier le lien "Contact" dans le header (index.html)
- Modifier le lien "Contact" dans le footer (index.html)
- Faire pointer vers contact.html

## Etape 5 : Ajouter la fonctionnalite d'envoi
- Option A : Utiliser Formspree (gratuit, sans backend)
- Option B : Utiliser EmailJS (gratuit, sans backend)
- Option C : Creer un backend Node.js/PHP

## Etape 6 : Ajouter les validations
- Validation HTML5 (required, type email)
- Messages d'erreur personnalises
- Message de confirmation apres envoi

## Etape 7 : Tester et deployer
- Tester sur desktop et mobile
- Verifier l'envoi du formulaire
- Commit et push sur GitHub

---

## Fichiers a modifier/creer
- [ ] `contact.html` (nouveau)
- [ ] `css/style.css` (ajout styles formulaire)
- [ ] `index.html` (mise a jour liens navigation)

## Estimation
6 etapes de developpement + 1 etape de test
