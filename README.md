# omni-calculateur

Calculatrice scientifique, convertisseur de devises et d’unités, outils de
pourcentages, addition partagée et remise. Application de l’Omni-système,
conçue par Ferrus Dantioch. Elle fonctionne hors ligne, sans compte ;
seule l’actualisation des taux de change demande internet.

Adresse : https://ferrusdantioch.github.io/omni-calculateur/

## Tests automatiques

Les tests ouvrent l’application dans un vrai navigateur et vérifient les
calculs, les outils, le hors ligne et la reprise des réglages des anciennes
versions. Ils ne contactent aucun site (les taux de change sont fournis par
le test lui-même).

Il faut [Node.js](https://nodejs.org) (version 22 ou plus récente), puis,
une seule fois, dans le dossier de l’application :

```
npm install playwright
npx playwright install chromium
```

Ensuite, à chaque fois :

```
node tests/tester.js
```

Le bilan s’affiche à la fin : « Échecs : 0 » veut dire que tout va bien.

## Licence

© 2026 Ferrus Dantioch — Creative Commons BY-NC-ND 4.0 (fichier `LICENSE`).
Polices Oxanium, Literata et JetBrains Mono : SIL Open Font License 1.1
(fichier `POLICES-OFL.txt`).
