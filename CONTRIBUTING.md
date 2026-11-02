# Contribuer à Lovense Arcade

Merci de contribuer à des jeux navigateur haptiques accessibles, testables et sûrs.

## Prérequis

- Node.js récent et npm ;
- Git ;
- aucun appareil Lovense n’est requis : utilisez le mode démo et les transports simulés.

## Installation

```bash
git clone git@github.com:m0nsieurdodo/lovenseGame.git
cd lovenseGame
npm ci
npm run dev
```

## Tests et build

Avant toute pull request, exécutez :

```bash
npm test
npm run build
```

Ajoutez des tests déterministes pour les moteurs, règles de score, courbes haptiques et cas d’arrêt. Un test avec un faux transport ne constitue pas une validation sur appareil réel.

## Ajouter un jeu

1. Créez sa route dans `app/games/<id>/page.tsx`.
2. Placez la logique déterministe et testable dans `lib/`, séparée du rendu.
3. Faites émettre au moteur des événements sémantiques ; traduisez-les en effets dans une couche haptique dédiée.
4. Ajoutez le jeu à `lib/games.ts` avec un identifiant et un `href` uniques. Ne passez `ready` à `true` que lorsque la route est jouable.
5. Prévoyez les commandes clavier et tactiles nécessaires, ainsi qu’un mode démo sans matériel.
6. Documentez le jeu et complétez les tests pertinents.

## Sécurité Lovense

- Exigez une action explicite avant toute découverte ou connexion.
- Sélectionnez les appareils selon leurs capacités annoncées ; ne ciblez pas automatiquement tous les appareils.
- Bornez l’intensité, utilisez des commandes de durée finie et évitez tout envoi à chaque frame.
- Sérialisez les effets et fournissez un arrêt immédiat qui vide la file et impose un réarmement explicite.
- Coupez la sortie sur pause, fin de partie, démontage et erreur fatale.
- N’exposez jamais l’API Lovense, un relais local ou des secrets sur Internet. Un relais doit rester lié à `127.0.0.1`.
- Ne présentez pas les tests simulés comme une validation matérielle.

## Pull requests

- Créez une branche ciblée et gardez la modification aussi petite que possible.
- Expliquez le problème, la solution, les risques haptiques et les vérifications réalisées.
- N’incluez ni dépendance ni refonte sans justification claire.
- Vérifiez que la documentation reste exacte et que le mode démo fonctionne sans appareil.
- Attendez la revue avant fusion ; ne joignez aucune donnée sensible, adresse réseau privée ou identifiant d’appareil.

En contribuant, vous acceptez que votre contribution soit distribuée sous la [licence MIT](LICENSE) du projet.
