# Rewrite plan: « À lire de près » sentences (spec 061 amendment, 2026-11-22)

## Why

The owner found the box unclear: its sentences named the trap the learner had just seen (« Deux choix ne diffèrent que d'un mot : « stables » ou « instables ». », 78 times; « « Toujours » tombe dès qu'un seul cas contraire existe. », 76 times) without showing how to avoid it. FR-006 now requires each sentence to name the trap **and** settle it on the question.

## Writing rules

1. **Trap, then how to settle it here.** First half: the word or construction that misleads. Second half, after « : »: the concrete check that decides this question (the counter-example, the clue that separates the paired choices, what the statement really asks).
2. **Absolute words** (« toujours », « jamais », « uniquement », « ne … que », « impossible »…): say that one counter-example is enough, and give that counter-example for this question.
3. **Choices differing by one word**: say that only one of the pair can fit, then give the clue that picks it (often the meaning of the name: stratus = étalé, cumulus = amas, advection = air amené par le vent). Two pairs in one question go in one sentence when possible.
4. **Short.** One or two clauses, under 240 characters (test). Do not copy or paraphrase the choice explanations at length: the box gives the reading reflex and the decisive clue, the explanations give the mechanism.
5. **Neutral register**: no « tu »/« vous », no imperative (« pour trancher, … », « il suffit de … » are fine); no verdict word, « piège » included (test). Facts must agree with the question's explanations and official answer key.
6. 1 to 3 sentences per question; merging two weak sentences into one strong one is encouraged.

## Lots

Codes sorted alphabetically, 30 per lot. One PR per lot, each from a fresh branch off `origin/main` (rows are replaced by code, so lots do not conflict). Lot 01 also carries the FR-006 amendment, the test change and the manual wording. To resume: `gh pr list --search "read-closely lot" --state all` shows which lots are done; take the next number.

| Lot | Codes | Questions | Sentences before | Branch |
|---|---|---|---|---|
| 01 | `A100B` → `A39M` | 30 | 36 | `fix/read-closely-lot01` |
| 02 | `A3V` → `A76M` | 30 | 33 | `fix/read-closely-lot02` |
| 03 | `A77B` → `E37B` | 30 | 36 | `fix/read-closely-lot03` |
| 04 | `E38B` → `E72M` | 30 | 40 | `fix/read-closely-lot04` |
| 05 | `E73M` → `F36M` | 30 | 32 | `fix/read-closely-lot05` |
| 06 | `F37M` → `G32M` | 30 | 35 | `fix/read-closely-lot06` |
| 07 | `G33M` → `L86T` | 30 | 37 | `fix/read-closely-lot07` |
| 08 | `L8B` → `N50B` | 30 | 32 | `fix/read-closely-lot08` |
| 09 | `N51V` → `P30V` | 30 | 37 | `fix/read-closely-lot09` |
| 10 | `P3V` → `S131B` | 30 | 39 | `fix/read-closely-lot10` |
| 11 | `S132B` → `S34T` | 30 | 37 | `fix/read-closely-lot11` |
| 12 | `S35B` → `S54B` | 30 | 33 | `fix/read-closely-lot12` |
| 13 | `S54T` → `S80M` | 30 | 37 | `fix/read-closely-lot13` |
| 14 | `S81M` → `U28V` | 30 | 35 | `fix/read-closely-lot14` |
| 15 | `U29B` → `U61B` | 30 | 38 | `fix/read-closely-lot15` |
| 16 | `U62B` → `U93M` | 30 | 40 | `fix/read-closely-lot16` |
| 17 | `U9M` → `W3V` | 30 | 40 | `fix/read-closely-lot17` |
| 18 | `W40B` → `W6M` | 30 | 42 | `fix/read-closely-lot18` |
| 19 | `W70V` → `W9B` | 27 | 35 | `fix/read-closely-lot19` |

## After the last lot

Add a data test that rejects the old hollow formulas on their own (a sentence that is only « … tombe dès qu'un seul cas contraire existe. » or only « Deux choix ne diffèrent que d'un mot : … »).
