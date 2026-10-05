# Feature Specification: Last Quiz Questions Without a Declared Source

**Feature Branch**: `fix/quiz-b3-last-sources`

**Created**: 2026-10-05

**Status**: Implemented

**Input**: Closing audit gap B3. After spec 030, 49 paragliding questions had neither a verified library page nor a sentence telling the pilot that no source was found: 32 said nothing and 17 cited a document without a page. One more (L5V) only said "not detailed in the documents consulted" without justifying any answer.

## Approach

Each question was searched in the text of the 40 library documents (664 pages). A page is used only when it states what the explanation relies on; the supporting phrase was checked on the page by script.

## Requirements *(mandatory)*

- **FR-001**: Every paragliding question (codes other than H, R and X) MUST either have a `verifiedPage` in `question_course_mapping.json` or an explanation that says clearly that the library has no source for it.
- **FR-002**: A new `verifiedPage` MUST point to a page whose text contains the point the explanation relies on (checked by script before writing).
- **FR-003**: Every option MUST stay justified in the explanation. The official FFVL answer key MUST NOT change.
- **FR-004**: CRLF line endings of the explanations file kept.

## Changes

- **22 verified pages added**: E78M, E79M (Livret Cycle 1 p.19), N37B (p.11), N28B (p.13); N26V, L3V, N27V (Livret Initiation p.23), S13B (p.22), U12B, U35B (p.20), U68M (p.15), U77B (p.17); S103B (BPC manual p.3), U25M (p.97), U46B (p.105), U47M (p.158), U60M (p.21), U79B (p.61), W8B (p.70); U23M (poster Mécanique du vol p.1); U75B (Maîtrise de l'aile en vol p.14); U88B (Livret Cycle 2 p.10).
- **Explanations rewritten from their page**: E78M, E79M, N26V, L3V, N27V, N37B, N28B. U46B: the square-of-speed law is now attributed to the Cycle 2 booklet, where it is written (the BPC manual page does not say it).
- **28 questions marked "no library source"**, sentence appended: « Aucune source trouvée pour le moment. » (the owner's single wording for a missing source; an earlier draft of this spec used a longer sentence mentioning « la grille », replaced on 2026-10-05 because the FFVL answer key is the exam's reference and is never presented as debatable) Weather A35B, A38M, A40M, A41B, A53B, A57B, A66M, A77B, A79V; equipment and standards G29M, L5V, L62T, L85T, N7V, N13B, N22B, N23B, N29M, N30V, N31M, N32M, N33V, N36B, N38V, N39M, N40B, N41B, N42V. G29M and L5V were rewritten so that each option is justified.

## Success Criteria *(mandatory)*

- **SC-001**: Paragliding questions: 777. Verified page: 696 (was 674). No source, said clearly: 81. Silent: 0 (test `tests/data/quiz_sources_declared.test.js`).
- **SC-002**: All other tests pass. Explanations file still CRLF.

## Answer-key doubts (not changed)

- L62T (winch line): the key expects options 2 and 3 ("not fixed to the drum", "free when tension is released") as right; the Dossier Tracté does not discuss them.
- G29M: the key gives 10 g as neutral, not wrong, although it is not the minimum the question asks for.
