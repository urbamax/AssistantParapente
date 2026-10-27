# Data Model: Axes de Révision (`043-revision-axes`)

## 1. Taxonomie des Axes de Révision (`REVISION_AXES_CATALOG`)

Chaque question Parapente (`q.parapente === true`, identifiant `q.num` tel que `A80`, `E42`, `L65T`, `S12T`, `W31`) est rattachée de façon déterministe à l'un des **21 axes pédagogiques** suivants via `resolveAxisIdForQuestion(question)` :

| `axisId` | `category` | Règle de correspondance (`q.num`) | Titre pédagogique (`FR.quiz.axes.catalog[axisId].title`) |
|---|---|---|---|
| `meteo-nuages-masses-air` | `Météo` | `A1`–`A31` | Humidité, nuages, brouillards & masses d'air |
| `meteo-pression-fronts` | `Météo` | `A32`–`A77` | Pression, vent météo, fronts & perturbations |
| `meteo-brises-aerologie` | `Météo` | `A78`–`A110` (et tout autre `A*`) | Brises, effets de relief, fœhn, ondes & thermiques |
| `mecavol-forces-trainees` | `Mécavol` | `E1`–`E29` | Écoulement, portance, traînées & axes de rotation |
| `mecavol-polaire-finesse` | `Mécavol` | `E30`–`E65` | Vent relatif, incidence, polaire des vitesses & finesse |
| `mecavol-charge-decrochage` | `Mécavol` | `E66`–`E87` (et tout autre `E*`) | Charge alaire, facteur de charge, décrochage & vol tracté |
| `mecavol-pendulaire-fermetures` | `Mécavol` | `G1`–`G35` (et tout `G*`) | Stabilité pendulaire, virage, fermetures, vrille & oreilles |
| `materiel-voile-suspentage` | `Matériel` | `N1`–`N34`, `N60` | Architecture de l'aile, suspentage, calage & entretien |
| `materiel-homologation-sellette` | `Matériel` | `N35`–`N59`, `N61`–`N68` (et tout autre `N*`) | Homologation EN/CEN, choix de voile, sellette & secours |
| `materiel-instruments-secours` | `Matériel` | `L1`–`L57` | Altimètre (QNH/QFE), variomètre, casque & parachute de secours |
| `materiel-treuil` | `Matériel` | `L58`–`L86` (et tout autre `L*`) | Matériel de treuillage : treuils, ligne, parachute & largueur |
| `reglementation-treuil` | `Réglementation` | `S*` se terminant par `T` (sans `B`, `P`, `C`) | Réglementation, cursus et procédures de treuillage |
| `reglementation-cadre-sites` | `Réglementation` | `S1`–`S44`, `S81`, `S91`–`S105` (hors pur `T`) | Cadre fédéral FFVL, brevets, assurances, responsabilité & sites |
| `reglementation-priorites-espaces` | `Réglementation` | `S45`–`S80`, `S82`–`S90`, `S106`–`S136` (et tout autre `S*` hors pur `T`) | Règles de priorité en vol, VFR/VMC & espaces aériens |
| `pilotage-gonflage-decollage` | `Pilotage` | `W1`–`W22`, `W61`–`W63`, `W68`–`W73` | Préparation, gonflage dos/face voile, temporisation & décollage |
| `pilotage-plan-vol-vent` | `Pilotage` | `U1`–`U47` | Analyse des conditions, plan de vol, cône de sécurité, vent & hypoxie |
| `pilotage-thermique-pente` | `Pilotage` | `U48`–`U67` | Exploitation du vol de pente, centrage du thermique & nuages dangereux |
| `pilotage-manoeuvres-incidents` | `Pilotage` | `W23`–`W49`, `W57`–`W60`, `W64`–`W67`, `W74`–`W81`, `W83`–`W95` (et tout autre `W*`) | Pilotage actif, oreilles, tangage/roulis, fermetures & incidents de vol |
| `pilotage-approche-atterrissage` | `Pilotage` | `U68`–`U93` (et tout autre `U*`), `W50`–`W56`, `W82` | Approche (PTS), gradient de vent, finale & atterrissage |
| `facteurs-humains` | `Facteurs humains` | `F1`–`F39` (et tout `F*`) | Connaissance de soi, fatigue, stress, effet de groupe & prise de décision |
| `milieu-naturel` | `Milieu naturel` | `P1`–`P30` (et tout `P*`) | Espaces naturels protégés (Parcs, ZSM), faune sauvage & rapaces |

## 2. Classification Individuelle d'une Question dans un Axe

Pour une question `q` et sa statistique `stat = stats[q.id]` à la date `now` :
- `ratio = masteryRatio(stat)` (dans `[0, 1]`)
- `total = stat?.total || 0`
- `streak = stat?.streak ?? 0`
- **État de la question (`bucket`)** :
  1. `unattempted` : `total === 0`
  2. `struggling` (*Point de blocage*) : `total > 0` et (`ratio < 0.5` OU (`total >= 2` et `streak === 0`))
  3. `hesitant` (*Notion hésitante*) : `total > 0`, non `struggling`, et `ratio < 0.85`
  4. `due` (*Acquis à rafraîchir*) : `ratio >= 0.85` et `isDue(stat, now) === true`
  5. `mastered` (*Acquis consolidé*) : `ratio >= 0.85` et `isDue(stat, now) === false`

## 3. Modèle d'un Axe Évalué (`EvaluatedRevisionAxis`)

```ts
interface CoursePageLink {
  page: number;
  url: string; // e.g. "courses/Les brises.pdf#page=4"
}

interface AxisCourseReading {
  courseId: string;
  title: string;
  category: string;
  file: string;
  pages: number[];          // Pages vérifiées triées par ordre croissant
  pageRangesText: string;   // Ex: "4–6, 9"
  primaryUrl: string;       // Lien direct vers la 1re page pertinente
  pageLinks: CoursePageLink[];
  focusHitCount: number;    // Nombre d'occurrences sur les questions fragiles/hésitantes/à revoir
}

interface AxisTakeaway {
  questionId: string;
  questionNum: string;      // Ex: "A80" (référence discrète, sans énoncé QCM ni choix A/B/C/D)
  bucket: 'struggling' | 'hesitant' | 'due' | 'unattempted' | 'mastered';
  explanation: string;      // Explication pédagogique nettoyée
  courseTitle: string | null;
  coursePage: number | null;
  courseUrl: string | null;
}

type AxisStatus = 'BLOCKER' | 'REFRESH' | 'EXPLORE' | 'MASTERED';

interface EvaluatedRevisionAxis {
  id: string;
  category: string;
  title: string;
  subtitle: string;
  status: AxisStatus;
  priorityRank: number;     // Plus petit = plus prioritaire
  totalQuestions: number;
  attemptedCount: number;
  unattemptedCount: number;
  strugglingCount: number;
  hesitantCount: number;
  dueCount: number;
  masteredCount: number;
  masteryPct: number;           // Moyenne de masteryRatio sur totalQuestions (0-100)
  attemptedMasteryPct: number;  // Moyenne de masteryRatio sur attemptedCount (0-100)
  courseReadings: AxisCourseReading[];
  takeaways: AxisTakeaway[];
  workshopSize: number;         // Nombre de questions proposées pour l'atelier (entre 1 et 8)
  questionIds: string[];
}
```

### Règle de Détermination du `status` de l'Axe

1. **`BLOCKER`** : `strugglingCount > 0 || hesitantCount > 0`
2. **`REFRESH`** : `!BLOCKER && dueCount > 0`
3. **`EXPLORE`** : `!BLOCKER && !REFRESH && unattemptedCount > 0`
4. **`MASTERED`** : `strugglingCount === 0 && hesitantCount === 0 && dueCount === 0 && unattemptedCount === 0`

### Règle de Tri par Priorité (`priorityRank`)

Les axes sont triés par ordre de statut (`BLOCKER` < `REFRESH` < `EXPLORE` < `MASTERED`), puis à l'intérieur d'un même statut :
- Dans `BLOCKER` : par `(strugglingCount * 3 + hesitantCount * 1.5)` décroissant, puis `attemptedMasteryPct` croissant.
- Dans `REFRESH` : par `dueCount` décroissant, puis `masteryPct` croissant.
- Dans `EXPLORE` : par `attemptedCount > 0` d'abord (chapitres déjà entamés), puis `masteryPct` croissant.
- Dans `MASTERED` : par `masteryPct` croissant, puis ordre du catalogue.

## 4. Algorithme de Sélection de l'Atelier Ciblé (`pickWorkshopQuestions`)

Pour un axe donné et un objectif `targetCount = 6` (borné à `Math.min(8, axisQuestions.length)`) :
1. **Cœur de révision (`focusPool`)** :
   - Si l'axe a des questions `struggling`, `hesitant` ou `due` : les prendre par ordre `struggling` → `hesitant` → `due` (jusqu'à `targetCount - 1` s'il existe des questions de consolidation disponibles, sinon jusqu'à `targetCount`).
   - Sinon, si l'axe a des questions `unattempted` : prendre jusqu'à `targetCount - 1` questions `unattempted`.
2. **Consolidation anti-élimination (`consolidationPool`)** :
   - Compléter avec 1 à 2 questions `mastered` (ou `unattempted` si `focusPool` était composé de `struggling`/`hesitant`) du même axe afin que l'élève ne puisse pas déduire les réponses en sachant que « toutes les questions posées sont celles que j'ai ratées ».
3. **Fallback** : si le total est inférieur à `Math.min(targetCount, axisQuestions.length)`, compléter avec les questions restantes de l'axe.
