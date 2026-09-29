"""Réparation des caractères Windows-1252 mal décodés (spec 003, US3).

Certaines données sources (FFVL, ParaglidingEarth) ont été décodées en Latin-1 alors qu'elles
étaient en Windows-1252 : l'apostrophe typographique devient le caractère de contrôle U+0092,
la puce U+0095, etc. repair_cp1252 rend à chacun de ces caractères (U+0080–U+009F) sa
signification Windows-1252 ; les positions que Windows-1252 ne définit pas sont supprimées.
Le reste du texte est inchangé, et la fonction est idempotente.
"""

import re

_C1 = re.compile("[\u0080-\u009f]")


def _fix(match):
    try:
        return bytes([ord(match.group(0))]).decode("cp1252")
    except UnicodeDecodeError:
        return ""  # 0x81, 0x8D, 0x8F, 0x90, 0x9D : non définis en Windows-1252


def repair_cp1252(text):
    if text is None:
        return None
    return _C1.sub(_fix, str(text))
