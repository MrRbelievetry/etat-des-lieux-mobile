# État des lieux local

Application web professionnelle pour réaliser un état des lieux d’entrée ou de sortie depuis téléphone, tablette ou ordinateur, sans serveur obligatoire.

## Technologies

- React, TypeScript strict et Vite.
- IndexedDB via `idb` pour conserver brouillons, dossiers finalisés, photos, signatures et PDF.
- `jsPDF` pour générer le PDF A4 dans le navigateur.
- PWA avec manifeste et service worker pour les ressources essentielles.
- Tests avec Vitest et Testing Library.

## Installation

```bash
npm install
```

## Lancement local

```bash
npm run dev
```

## Commandes

```bash
npm run test
npm run lint
npm run typecheck
npm run build
```

## Fonctionnement

La page d’accueil permet de créer un état des lieux d’entrée ou de sortie, reprendre un brouillon, consulter un dossier finalisé, dupliquer un ancien dossier, supprimer un brouillon avec confirmation et charger un dossier fictif de démonstration.

Le parcours suit 7 étapes : informations générales, parties, compteurs et clés, pièces, synthèse, signatures, PDF. Chaque modification est sauvegardée automatiquement en IndexedDB. Les dossiers finalisés sont en lecture seule ; le bouton “Créer une nouvelle version” duplique le dossier, incrémente la version et demande de nouvelles signatures.

## Caméra et photos

Le bouton “Prendre une photo” utilise un champ fichier mobile avec `accept="image/*"` et `capture="environment"`. Sur Safari iPhone, Chrome Android et navigateurs mobiles compatibles, le navigateur ouvre directement la caméra arrière. Le bouton “Importer depuis la galerie” est séparé et n’utilise pas `capture`.

Les navigateurs gardent le contrôle final de la permission caméra. En cas de refus ou d’incompatibilité, l’utilisateur peut importer depuis la galerie. Les photos sont rattachées à leur pièce ou élément, légendables, réordonnables, pivotables, supprimables avant signature, et intégrées près des observations dans le PDF.

## Signatures

Chaque signataire dispose d’une zone canvas tactile. La validation est bloquée tant que la case de prise de connaissance n’est pas cochée. Le refus de signer est possible et apparaît dans le PDF. Cette fonction n’est pas présentée comme une signature électronique qualifiée ou certifiée.

## PDF

Le PDF contient la couverture, les informations générales, compteurs, clés, pièces, photos, anomalies, observations, signatures, mentions juridiques, mention de protection des données, pied de page, pagination et empreinte SHA-256 du fichier généré.

## Stockage, sauvegarde et restauration

Les données restent sur l’appareil lorsque l’application est utilisée sans serveur. L’export complet fournit le dossier au format JSON ; le PDF finalisé est téléchargeable séparément. Une restauration peut se faire en réimportant les données JSON dans une version ultérieure.

## PWA et hors connexion

Le manifeste et le service worker rendent l’application installable et conservent les ressources essentielles. La création d’un dossier, la prise de photos, la signature et la génération PDF fonctionnent autant que possible hors connexion car elles sont exécutées côté navigateur.

## Déploiement

Le build de production produit un dossier `dist` déployable sur Vercel, Netlify ou toute plateforme statique.

```bash
npm run build
```

## Limites juridiques

L’application aide à produire un document clair, précis, contradictoire et exploitable. Elle ne garantit pas l’issue d’un litige et ne remplace pas un conseil juridique. Toute modification après finalisation doit faire l’objet d’une nouvelle version et de nouvelles signatures.
