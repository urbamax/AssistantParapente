#!/usr/bin/env python3
"""
Import / refresh js/data/sites_data.json from the FFVL open-data dataset on data.gouv.fr.

Source officielle :
    https://www.data.gouv.fr/datasets/terrains-de-pratique-de-la-ffvl-federation-francaise-de-vol-libre
    Fichier : terrains.json (mis à jour quotidiennement sous Licence Ouverte / Etalab 2.0)

Par défaut, ce script filtre strictement les terrains ouverts à la pratique du PARAPENTE
(les spots exclusifs de kite, delta seul, speed-riding seul, cerf-volant et boomerang sont ignorés).
Utilisez `--all-disciplines` pour importer l'intégralité du réseau fédéral.

Field mapping (dump -> app schema):
    suid                              -> reference_terrain
    toponym / nom                     -> nom
    latitude / longitude / altitude   -> latitude / longitude / altitude
    zip / cp                          -> code_postal
    city / ville                      -> ville (title-cased)
    zip / cp prefix                   -> departement {code, nom} + region (table statique)
    wind_orientations_ok / orientation-> orientations_vent[] (16-pt -> 8-pt FR cardinals)
    flying_functions_text / site_sous_type -> type[] (NATUREL, ATTERRO, GONFLAGE, TREUIL, KITE)
    walking_time_from_parking_minutes / acces -> acces_topo
    environmental_description / description -> observations
    warnings / dangers                -> dangers
    emergency_services_text / emergency_access_text / numero_cross -> secours_acces
    status                            -> praticabilite + affiche
    convention_type                   -> conventionnement
    restrictions                      -> restrictions
    last_modification_datetime        -> date_modification

Usage:
    python3 scripts/import_ffvl_sites.py                 # parapente strict (par défaut)
    python3 scripts/import_ffvl_sites.py --all-disciplines # inclure kite, cerf-volant, etc.
    python3 scripts/import_ffvl_sites.py --input dump.json
    python3 scripts/import_ffvl_sites.py --wayback       # fallback: use 2022 Wayback archive
    python3 scripts/import_ffvl_sites.py --overwrite     # remplacer les entrées existantes
    python3 scripts/import_ffvl_sites.py --dry-run
"""
import argparse
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))
from text_repair import repair_cp1252

REPO = SCRIPTS_DIR.parent
OUT = REPO / "js" / "data" / "sites_data.json"

# Flux officiel data.gouv.fr (mis à jour quotidiennement par la FFVL)
DATA_GOUV_URL = "https://www.data.gouv.fr/api/1/datasets/r/4375c95d-cf26-4e71-b72d-2e09be5a0e36"

# Ancien snapshot Wayback Machine (conservé comme secours historique)
WAYBACK_URL = "https://web.archive.org/web/20221205210404id_/https://data.ffvl.fr/json/sites.json"

DEPTS = {
    "01": ("Ain", "Auvergne-Rhône-Alpes"), "02": ("Aisne", "Hauts-de-France"),
    "03": ("Allier", "Auvergne-Rhône-Alpes"), "04": ("Alpes-de-Haute-Provence", "Provence-Alpes-Côte d'Azur"),
    "05": ("Hautes-Alpes", "Provence-Alpes-Côte d'Azur"), "06": ("Alpes-Maritimes", "Provence-Alpes-Côte d'Azur"),
    "07": ("Ardèche", "Auvergne-Rhône-Alpes"), "08": ("Ardennes", "Grand Est"),
    "09": ("Ariège", "Occitanie"), "10": ("Aube", "Grand Est"),
    "11": ("Aude", "Occitanie"), "12": ("Aveyron", "Occitanie"),
    "13": ("Bouches-du-Rhône", "Provence-Alpes-Côte d'Azur"), "14": ("Calvados", "Normandie"),
    "15": ("Cantal", "Auvergne-Rhône-Alpes"), "16": ("Charente", "Nouvelle-Aquitaine"),
    "17": ("Charente-Maritime", "Nouvelle-Aquitaine"), "18": ("Cher", "Centre-Val de Loire"),
    "19": ("Corrèze", "Nouvelle-Aquitaine"), "21": ("Côte-d'Or", "Bourgogne-Franche-Comté"),
    "22": ("Côtes-d'Armor", "Bretagne"), "23": ("Creuse", "Nouvelle-Aquitaine"),
    "24": ("Dordogne", "Nouvelle-Aquitaine"), "25": ("Doubs", "Bourgogne-Franche-Comté"),
    "26": ("Drôme", "Auvergne-Rhône-Alpes"), "27": ("Eure", "Normandie"),
    "28": ("Eure-et-Loir", "Centre-Val de Loire"), "29": ("Finistère", "Bretagne"),
    "2A": ("Corse-du-Sud", "Corse"), "2B": ("Haute-Corse", "Corse"),
    "30": ("Gard", "Occitanie"), "31": ("Haute-Garonne", "Occitanie"),
    "32": ("Gers", "Occitanie"), "33": ("Gironde", "Nouvelle-Aquitaine"),
    "34": ("Hérault", "Occitanie"), "35": ("Ille-et-Vilaine", "Bretagne"),
    "36": ("Indre", "Centre-Val de Loire"), "37": ("Indre-et-Loire", "Centre-Val de Loire"),
    "38": ("Isère", "Auvergne-Rhône-Alpes"), "39": ("Jura", "Bourgogne-Franche-Comté"),
    "40": ("Landes", "Nouvelle-Aquitaine"), "41": ("Loir-et-Cher", "Centre-Val de Loire"),
    "42": ("Loire", "Auvergne-Rhône-Alpes"), "43": ("Haute-Loire", "Auvergne-Rhône-Alpes"),
    "44": ("Loire-Atlantique", "Pays de la Loire"), "45": ("Loiret", "Centre-Val de Loire"),
    "46": ("Lot", "Occitanie"), "47": ("Lot-et-Garonne", "Nouvelle-Aquitaine"),
    "48": ("Lozère", "Occitanie"), "49": ("Maine-et-Loire", "Pays de la Loire"),
    "50": ("Manche", "Normandie"), "51": ("Marne", "Grand Est"),
    "52": ("Haute-Marne", "Grand Est"), "53": ("Mayenne", "Pays de la Loire"),
    "54": ("Meurthe-et-Moselle", "Grand Est"), "55": ("Meuse", "Grand Est"),
    "56": ("Morbihan", "Bretagne"), "57": ("Moselle", "Grand Est"),
    "58": ("Nièvre", "Bourgogne-Franche-Comté"), "59": ("Nord", "Hauts-de-France"),
    "60": ("Oise", "Hauts-de-France"), "61": ("Orne", "Normandie"),
    "62": ("Pas-de-Calais", "Hauts-de-France"), "63": ("Puy-de-Dôme", "Auvergne-Rhône-Alpes"),
    "64": ("Pyrénées-Atlantiques", "Nouvelle-Aquitaine"), "65": ("Hautes-Pyrénées", "Occitanie"),
    "66": ("Pyrénées-Orientales", "Occitanie"), "67": ("Bas-Rhin", "Grand Est"),
    "68": ("Haut-Rhin", "Grand Est"), "69": ("Rhône", "Auvergne-Rhône-Alpes"),
    "70": ("Haute-Saône", "Bourgogne-Franche-Comté"), "71": ("Saône-et-Loire", "Bourgogne-Franche-Comté"),
    "72": ("Sarthe", "Pays de la Loire"), "73": ("Savoie", "Auvergne-Rhône-Alpes"),
    "74": ("Haute-Savoie", "Auvergne-Rhône-Alpes"), "75": ("Paris", "Île-de-France"),
    "76": ("Seine-Maritime", "Normandie"), "77": ("Seine-et-Marne", "Île-de-France"),
    "78": ("Yvelines", "Île-de-France"), "79": ("Deux-Sèvres", "Nouvelle-Aquitaine"),
    "80": ("Somme", "Hauts-de-France"), "81": ("Tarn", "Occitanie"),
    "82": ("Tarn-et-Garonne", "Occitanie"), "83": ("Var", "Provence-Alpes-Côte d'Azur"),
    "84": ("Vaucluse", "Provence-Alpes-Côte d'Azur"), "85": ("Vendée", "Pays de la Loire"),
    "86": ("Vienne", "Nouvelle-Aquitaine"), "87": ("Haute-Vienne", "Nouvelle-Aquitaine"),
    "88": ("Vosges", "Grand Est"), "89": ("Yonne", "Bourgogne-Franche-Comté"),
    "90": ("Territoire de Belfort", "Bourgogne-Franche-Comté"), "91": ("Essonne", "Île-de-France"),
    "92": ("Hauts-de-Seine", "Île-de-France"), "93": ("Seine-Saint-Denis", "Île-de-France"),
    "94": ("Val-de-Marne", "Île-de-France"), "95": ("Val-d'Oise", "Île-de-France"),
    "971": ("Guadeloupe", "Guadeloupe"), "972": ("Martinique", "Martinique"),
    "973": ("Guyane", "Guyane"), "974": ("La Réunion", "La Réunion"),
    "975": ("Saint-Pierre-et-Miquelon", "Saint-Pierre-et-Miquelon"), "976": ("Mayotte", "Mayotte"),
    "977": ("Saint-Barthélemy", "Saint-Barthélemy"), "978": ("Saint-Martin", "Saint-Martin"),
    "986": ("Wallis-et-Futuna", "Wallis-et-Futuna"), "987": ("Polynésie française", "Polynésie française"),
    "988": ("Nouvelle-Calédonie", "Nouvelle-Calédonie"),
}

ORIENT_MAP = {
    "N": ["N"], "NNE": ["N", "NE"], "NE": ["NE"], "ENE": ["NE", "E"],
    "E": ["E"], "ESE": ["E", "SE"], "SE": ["SE"], "SSE": ["SE", "S"],
    "S": ["S"], "SSO": ["S", "SO"], "SSW": ["S", "SO"], "SO": ["SO"], "SW": ["SO"],
    "OSO": ["SO", "O"], "WSW": ["SO", "O"], "O": ["O"], "W": ["O"],
    "ONO": ["O", "NO"], "WNW": ["O", "NO"], "NO": ["NO"], "NW": ["NO"],
    "NNO": ["NO", "N"], "NNW": ["NO", "N"],
}
ORIENT_ORDER = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]

SOUS_TYPE_MAP = {
    "Atterrissage": ["ATTERRO"],
    "Décollage": ["NATUREL"],
    "Plateforme de treuil": ["TREUIL"],
    "Pente école": ["GONFLAGE"],
    "Domaine skiable": ["NATUREL"],
    "Roulage": ["ROULAGE"],
    "Kitesurf": ["KITE"],
    "Snowkite": ["KITE"],
    "Itinéraire de Snowkite": ["KITE"],
    "Interdiction de pratique": ["INTERDIT"],
}

CONVENTION_MAP = {
    "convention_ffvl": "Convention FFVL",
    "convention_usage": "Convention d'usage",
    "propriete_ffvl": "Propriété FFVL",
    "convention_orale_ffvl": "Convention orale FFVL",
    "convention_non_ffvl": "Convention non FFVL",
    "convention_en_cours_de_negociation": "Convention en cours de négociation",
    "pas_de_convention": "Pas de convention identifiée",
    "etat_conventionnement_inconnu": None,
}

STATUS_PRATICABILITE = {
    "actif": "terrain ouvert à la pratique",
    "actif_autorisation_systematique_requise": "autorisation préalable requise",
    "non_praticable_temporaire": "non praticable temporairement",
    "interdit_sauf_autorisation": "pratique interdite sauf autorisation",
    "interdit": "pratique interdite",
}

TRIVIAL_WARNINGS = {
    ".", "-", "ras", "r.a.s", "r.a.s.", "aucun", "néant", "neant",
    "non", "0", "rien à signaler", "pas de danger particulier",
}


def slug(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "site"


def title_fr(s):
    if not s:
        return s
    return re.sub(r"[A-Za-zÀ-ÿ]+", lambda m: m.group(0).capitalize(), s.strip())


def clean(v):
    if v is None:
        return None
    v = repair_cp1252(str(v)).replace("\r\n", "\n").replace("\r", "\n").strip()
    return v or None


def parse_orientations(raw):
    if not raw:
        return []
    out = []
    for tok in re.split(r"[;,/]", raw):
        tok = tok.strip().upper()
        if not tok:
            continue
        if tok in ("TOUTES", "TOUS", "360", "ALL"):
            return ORIENT_ORDER[:]
        for mapped in ORIENT_MAP.get(tok, []):
            if mapped not in out:
                out.append(mapped)
    return [d for d in ORIENT_ORDER if d in out]


def dept_from(rec):
    for src in (rec.get("zip", ""), rec.get("cp", ""), rec.get("numero", "")):
        src = (src or "").strip().upper()
        m = re.match(r"^(2A|2B|97[0-8]|98[0-8])", src) or re.match(r"^(\d{2})", src)
        if m and m.group(1) in DEPTS:
            code = m.group(1)
            return {"code": code, "nom": DEPTS[code][0]}, DEPTS[code][1]
    return None, None


def is_parapente(rec):
    usages = (rec.get("possible_usages_text") or rec.get("pratiques") or "").lower()
    if usages:
        return "parapente" in usages
    types = rec.get("type") or []
    if types and all(t in ("KITE", "ROULAGE") for t in types):
        return False
    return True


def build_types(rec):
    types = []
    fft = (rec.get("flying_functions_text") or "").lower()
    if fft:
        if "décollage" in fft or "decollage" in fft:
            types.append("NATUREL")
        if "atterrissage" in fft:
            types.append("ATTERRO")
        if "pente-école" in fft or "pente école" in fft or "gonflage" in fft:
            types.append("GONFLAGE")
        if "treuil" in fft:
            types.append("TREUIL")
    elif rec.get("site_sous_type"):
        types.extend(SOUS_TYPE_MAP.get(rec.get("site_sous_type", ""), []))

    usages = (rec.get("possible_usages_text") or rec.get("pratiques") or "").lower()
    if "kite" in usages and "KITE" not in types:
        types.append("KITE")

    return types or ["NATUREL"]


def build_acces(rec):
    parts = []
    if clean(rec.get("acces")):
        parts.append(clean(rec["acces"]))
    wt = rec.get("walking_time_from_parking_minutes")
    if wt is not None and str(wt).strip() not in ("0", "None", ""):
        parts.append(f"Trajet parking → déco : {wt} min")
    tp = clean(rec.get("trajet_parcking"))
    if tp and tp not in ("0",):
        parts.append(f"Trajet parking → déco : {tp} min")
    td = clean(rec.get("trajet_attero_deco"))
    if td and td not in ("0",):
        parts.append(f"Trajet atterro → déco : {td} min")
    return "\n\n".join(parts) or None


def build_secours(rec):
    secours = []
    if clean(rec.get("numero_cross")):
        secours.append(f"N° secours / CROSS : {clean(rec['numero_cross'])}")
    es = clean(rec.get("emergency_services_text"))
    if es and es.lower() not in ("aucun", "neant", "néant", "0"):
        secours.append(f"Services de secours : {es}")
    ea = clean(rec.get("emergency_access_text"))
    if ea and ea.lower() not in ("aucun", "neant", "néant", "0", "autre"):
        secours.append(f"Accès secours : {ea}")
    return "\n".join(secours) if secours else None


def build_dangers(rec):
    w = clean(rec.get("warnings") or rec.get("dangers"))
    if not w:
        return None
    if w.strip().lower() in TRIVIAL_WARNINGS:
        return None
    return w


def build_convention(rec):
    if rec.get("convention_type"):
        return CONVENTION_MAP.get(rec["convention_type"])
    return clean(rec.get("conventionnement"))


def build_praticabilite(rec):
    st = rec.get("status")
    if st in STATUS_PRATICABILITE:
        return STATUS_PRATICABILITE[st]
    sous_type = rec.get("site_sous_type", "")
    if sous_type == "Interdiction de pratique":
        return "pratique interdite"
    return "terrain ouvert à la pratique"


def convert(rec):
    suid = str(rec.get("suid") or rec.get("id") or "").strip()
    raw_nom = rec.get("toponym") or rec.get("nom")
    nom = clean(raw_nom) or "SANS NOM"
    sous = clean(rec.get("sous_nom"))
    full_nom = f"{nom} — {sous}" if sous and sous.lower() not in nom.lower() else nom
    full_nom = re.sub(r"\s*[—\-]\s*$", "", full_nom).strip() or "SANS NOM"
    placeholder = bool(re.match(r"^\s*(a|à)\s+renseigner", nom, re.I)) or full_nom == "SANS NOM"

    dept, region = dept_from(rec)

    try:
        lat = round(float(rec["latitude"] if "latitude" in rec else rec["lat"]), 5)
        lon = round(float(rec["longitude"] if "longitude" in rec else rec["lon"]), 5)
    except (TypeError, ValueError, KeyError):
        lat = lon = None
    try:
        alt = int(float(rec["altitude"] if "altitude" in rec else rec["alt"]))
    except (TypeError, ValueError, KeyError):
        alt = None

    st = rec.get("status")
    sous_type = rec.get("site_sous_type", "")
    is_interdit = st == "interdit" or sous_type == "Interdiction de pratique"
    affiche = not is_interdit and not placeholder

    date_mod = clean(rec.get("last_modification_datetime") or rec.get("date_modification"))
    source = f"FFVL (data.gouv.fr) — {date_mod[:10]}" if date_mod else "FFVL (data.gouv.fr)"

    return {
        "id": f"{slug(nom)}-{suid}",
        "reference_terrain": suid,
        "nom": full_nom,
        "latitude": lat,
        "longitude": lon,
        "code_postal": clean(rec.get("zip") or rec.get("cp")),
        "ville": title_fr(clean(rec.get("city") or rec.get("ville"))),
        "departement": dept,
        "region": region,
        "pays": "France",
        "orientations_vent": parse_orientations(rec.get("wind_orientations_ok") or rec.get("orientation")),
        "type": build_types(rec),
        "altitude": alt,
        "affiche": affiche,
        "conventionnement": build_convention(rec),
        "praticabilite": build_praticabilite(rec),
        "structure_gestionnaire": clean(rec.get("structure_gestionnaire")),
        "dangers": build_dangers(rec),
        "secours_acces": build_secours(rec),
        "aerologie_ideale": clean(rec.get("conditions_ideales")) or clean(rec.get("vent_favo")),
        "acces_topo": build_acces(rec),
        "observations": clean(rec.get("description") or rec.get("environmental_description")),
        "restrictions": clean(rec.get("restrictions")),
        "reglementation": clean(rec.get("reg_aerienne")),
        "url": f"https://federation.ffvl.fr/terrain/{suid}" if suid else None,
        "atterissage": None,
        "date_modification": date_mod,
        "source": source,
    }


def load_dump(args):
    if args.input:
        return json.loads(Path(args.input).read_text(encoding="utf-8"))
    url = WAYBACK_URL if args.wayback else DATA_GOUV_URL
    label = "snapshot Wayback (2022)" if args.wayback else "flux officiel data.gouv.fr"
    print(f"→ Téléchargement du jeu de données FFVL ({label}) : {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (AssistantParapente sync)"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


# Champs recalculés depuis le flux officiel pour les sites déjà présents (issus d'un import FFVL).
# Les champs enrichis à la main (nom, type, structure_gestionnaire, textes d'accès…) ne sont jamais touchés.
REFRESH_ALWAYS = ("affiche", "praticabilite", "date_modification", "source")
REFRESH_IF_FILLED = (
    "latitude", "longitude", "altitude", "conventionnement", "orientations_vent",
    "secours_acces", "dangers",
)


def refresh_existing(old, conv):
    """Met à jour une entrée existante avec les valeurs officielles. Retourne True si elle a changé."""
    if not str(old.get("source") or "").startswith("FFVL"):
        return False  # entrée saisie à la main ou venue d'une autre source : on n'y touche pas
    changed = False
    for key in REFRESH_ALWAYS:
        if old.get(key) != conv[key]:
            old[key] = conv[key]
            changed = True
    for key in REFRESH_IF_FILLED:
        if conv[key] not in (None, [], "") and old.get(key) != conv[key]:
            old[key] = conv[key]
            changed = True
    return changed


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", help="chemin d'un fichier JSON local (sinon: data.gouv.fr)")
    ap.add_argument("--wayback", action="store_true", help="utiliser l'ancien snapshot Wayback 2022")
    ap.add_argument("--all-disciplines", action="store_true", help="inclure toutes les disciplines FFVL (kite, cerf-volant, boomerang...)")
    ap.add_argument("--out", default=str(OUT), help=f"fichier de sortie (défaut: {OUT})")
    ap.add_argument("--overwrite", action="store_true", help="remplacer aussi les entrées déjà présentes")
    ap.add_argument("--dry-run", action="store_true", help="ne rien écrire, afficher les stats")
    args = ap.parse_args()

    dump = load_dump(args)
    if not isinstance(dump, list):
        sys.exit("Format inattendu: le dump n'est pas une liste JSON")

    parapente_only = not args.all_disciplines
    mode_label = "Toutes disciplines" if args.all_disciplines else "Parapente strict"
    print(f"Mode sélectionné   : {mode_label}", file=sys.stderr)

    dump_by_ref = {str(r.get("suid") or r.get("id") or ""): r for r in dump if r.get("suid") or r.get("id")}

    out_path = Path(args.out)
    existing = []
    if out_path.exists():
        existing = json.loads(out_path.read_text(encoding="utf-8"))

    # Nettoyage / filtrage des existants
    by_ref = {}
    purged_non_parapente = 0
    for s in existing:
        ref = str(s.get("reference_terrain"))
        if parapente_only:
            if ref in dump_by_ref and not is_parapente(dump_by_ref[ref]):
                purged_non_parapente += 1
                continue
            if ref not in dump_by_ref and not is_parapente(s):
                purged_non_parapente += 1
                continue
        by_ref[ref] = s

    added = updated = skipped = bad = skipped_non_parapente = 0
    for rec in dump:
        if parapente_only and not is_parapente(rec):
            skipped_non_parapente += 1
            continue

        conv = convert(rec)
        if conv["latitude"] is None or conv["longitude"] is None or not conv["reference_terrain"]:
            bad += 1
            continue
        ref = conv["reference_terrain"]
        if ref in by_ref:
            if args.overwrite:
                by_ref[ref] = conv
                updated += 1
            elif refresh_existing(by_ref[ref], conv):
                updated += 1
            else:
                skipped += 1
        else:
            by_ref[ref] = conv
            added += 1

    absent = sorted(r for r in by_ref if r not in dump_by_ref)
    if absent:
        print(f"Absents du flux officiel (conservés, à vérifier) : {len(absent)}", file=sys.stderr)

    merged = sorted(by_ref.values(), key=lambda s: (s.get("nom") or "").lower())

    print(f"Dump FFVL           : {len(dump)} enregistrements", file=sys.stderr)
    if parapente_only:
        print(f"Ignorés (non-parapente dans dump) : {skipped_non_parapente}", file=sys.stderr)
        print(f"Purgés (non-parapente existants)  : {purged_non_parapente}", file=sys.stderr)
    print(f"Coords invalides    : {bad}", file=sys.stderr)
    print(f"Ajoutés             : {added}", file=sys.stderr)
    print(f"Mis à jour          : {updated}", file=sys.stderr)
    print(f"Inchangés           : {skipped}", file=sys.stderr)
    print(f"Total final sites   : {len(merged)}", file=sys.stderr)

    if args.dry_run:
        print("(dry-run: rien écrit)", file=sys.stderr)
        return
    out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Écrit : {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
