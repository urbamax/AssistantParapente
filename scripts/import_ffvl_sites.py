#!/usr/bin/env python3
"""
Import / refresh js/data/sites_data.json from the FFVL "sites de pratique" open-data dump.

The FFVL OpenData API (data.ffvl.fr) is currently gated behind an API key whose
issuance is paused. This script rebuilds the local sites database from the last
public snapshot of `data.ffvl.fr/json/sites.json`, which was distributed under the
Licence Ouverte / Etalab 2.0 (attribution: "Source : FFVL").

Field mapping (dump -> app schema):
    suid                      -> reference_terrain   (== id in federation.ffvl.fr/terrain/<suid>)
    nom / sous_nom            -> nom
    lat / lon / alt           -> latitude / longitude / altitude
    cp / ville                -> code_postal / ville (title-cased)
    numero prefix / cp prefix -> departement {code, nom} + region  (static table)
    orientation               -> orientations_vent[]  (16-pt -> 8-pt FR cardinals, TOUTES -> all 8)
    site_sous_type + pratiques -> type[]  (coarse: dump has no THERMIQUE/SOARING/… detail)
    acces + trajet_*          -> acces_topo
    description               -> observations
    conditions_ideales/vent_favo -> aerologie_ideale
    restrictions              -> restrictions
    reg_aerienne              -> reglementation
    dangers                   -> dangers
    numero_cross              -> secours_acces
    date_modification         -> date_modification (added field)

Existing hand-enriched entries in sites_data.json (scraped from the HTML site pages,
with richer `type`, `conventionnement`, `structure_gestionnaire`, …) are KEPT as-is;
only sites missing from the current file are added. Use --overwrite to replace them.

Usage:
    python3 scripts/import_ffvl_sites.py                 # fetch Wayback snapshot, merge, write
    python3 scripts/import_ffvl_sites.py --input dump.json
    python3 scripts/import_ffvl_sites.py --overwrite     # replace existing entries too
    python3 scripts/import_ffvl_sites.py --dry-run
"""
import argparse
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path
from text_repair import repair_cp1252

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "js" / "data" / "sites_data.json"

# Last fully-public snapshot of the FFVL open-data sites file (id_ = raw, no Wayback banner)
WAYBACK_URL = "https://web.archive.org/web/20221205210404id_/https://data.ffvl.fr/json/sites.json"

# ---------------------------------------------------------------------------
# département code -> (nom, région).  Metropole + Corse + DOM.
# ---------------------------------------------------------------------------
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

# 16-point -> 8-point French cardinals (secondary intercardinals map to both neighbours)
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
    # Caractères Windows-1252 mal décodés à la source (’ • … €) : réparés à chaque import (spec 003).
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
    for src in (rec.get("numero", ""), rec.get("cp", "")):
        src = (src or "").strip().upper()
        m = re.match(r"^(2A|2B|97[0-8]|98[0-8])", src) or re.match(r"^(\d{2})", src)
        if m and m.group(1) in DEPTS:
            code = m.group(1)
            return {"code": code, "nom": DEPTS[code][0]}, DEPTS[code][1]
    return None, None


def build_types(rec):
    # Site-nature types only (the app's type filter is about the terrain, not the
    # discipline). The dump's coarse `site_sous_type` is all we can infer here;
    # richer types (THERMIQUE, SOARING, MARCHE ET VOL…) only exist on hand-scraped
    # entries and are preserved by the merge, not regenerated.
    types = list(SOUS_TYPE_MAP.get(rec.get("site_sous_type", ""), []))
    prat = (rec.get("pratiques") or "").lower()
    if "kite" in prat and "KITE" not in types:
        types.append("KITE")
    return types or ["NATUREL"]


def build_acces(rec):
    parts = []
    if clean(rec.get("acces")):
        parts.append(clean(rec["acces"]))
    tp = clean(rec.get("trajet_parcking"))
    if tp and tp not in ("0",):
        parts.append(f"Trajet parking → déco : {tp} min")
    td = clean(rec.get("trajet_attero_deco"))
    if td and td not in ("0",):
        parts.append(f"Trajet atterro → déco : {td} min")
    return "\n\n".join(parts) or None


def convert(rec):
    suid = str(rec.get("suid") or rec.get("id") or "").strip()
    nom = clean(rec.get("nom")) or "SANS NOM"
    sous = clean(rec.get("sous_nom"))
    full_nom = f"{nom} — {sous}" if sous and sous.lower() not in nom.lower() else nom
    full_nom = re.sub(r"\s*[—\-]\s*$", "", full_nom).strip() or "SANS NOM"
    placeholder = bool(re.match(r"^\s*(a|à)\s+renseigner", nom, re.I)) or full_nom == "SANS NOM"
    dept, region = dept_from(rec)
    sous_type = rec.get("site_sous_type", "")
    try:
        lat = round(float(rec["lat"]), 5)
        lon = round(float(rec["lon"]), 5)
    except (TypeError, ValueError, KeyError):
        lat = lon = None
    try:
        alt = int(float(rec["alt"]))
    except (TypeError, ValueError, KeyError):
        alt = None
    return {
        "id": f"{slug(nom)}-{suid}",
        "reference_terrain": suid,
        "nom": full_nom,
        "latitude": lat,
        "longitude": lon,
        "code_postal": clean(rec.get("cp")),
        "ville": title_fr(clean(rec.get("ville"))),
        "departement": dept,
        "region": region,
        "pays": "France",
        "orientations_vent": parse_orientations(rec.get("orientation")),
        "type": build_types(rec),
        "altitude": alt,
        "affiche": sous_type != "Interdiction de pratique" and not placeholder,
        "conventionnement": None,
        "praticabilite": "pratique interdite" if sous_type == "Interdiction de pratique"
        else "terrain ouvert à la pratique",
        "structure_gestionnaire": None,
        "dangers": clean(rec.get("dangers")),
        "secours_acces": (f"N° secours / CROSS : {clean(rec.get('numero_cross'))}"
                          if clean(rec.get("numero_cross")) else None),
        "aerologie_ideale": clean(rec.get("conditions_ideales")) or clean(rec.get("vent_favo")),
        "acces_topo": build_acces(rec),
        "observations": clean(rec.get("description")),
        "restrictions": clean(rec.get("restrictions")),
        "reglementation": clean(rec.get("reg_aerienne")),
        "url": f"https://federation.ffvl.fr/terrain/{suid}" if suid else None,
        "atterissage": None,
        "date_modification": clean(rec.get("date_modification")),
        "source": "FFVL (Licence Ouverte/Etalab 2.0) — snapshot 2022-12-05",
    }


def load_dump(args):
    if args.input:
        return json.loads(Path(args.input).read_text(encoding="utf-8"))
    print(f"→ Téléchargement du snapshot FFVL : {WAYBACK_URL}", file=sys.stderr)
    req = urllib.request.Request(WAYBACK_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", help="chemin d'un dump sites.json local (sinon: Wayback)")
    ap.add_argument("--out", default=str(OUT), help=f"fichier de sortie (défaut: {OUT})")
    ap.add_argument("--overwrite", action="store_true", help="remplacer aussi les entrées déjà présentes")
    ap.add_argument("--dry-run", action="store_true", help="ne rien écrire, afficher les stats")
    args = ap.parse_args()

    dump = load_dump(args)
    if not isinstance(dump, list):
        sys.exit("Format inattendu: le dump n'est pas une liste JSON")

    out_path = Path(args.out)
    existing = []
    if out_path.exists():
        existing = json.loads(out_path.read_text(encoding="utf-8"))
    by_ref = {str(s.get("reference_terrain")): s for s in existing}

    added = updated = skipped = bad = 0
    for rec in dump:
        conv = convert(rec)
        if conv["latitude"] is None or conv["longitude"] is None or not conv["reference_terrain"]:
            bad += 1
            continue
        ref = conv["reference_terrain"]
        if ref in by_ref:
            if args.overwrite:
                by_ref[ref] = conv
                updated += 1
            else:
                skipped += 1
        else:
            by_ref[ref] = conv
            added += 1

    merged = sorted(by_ref.values(), key=lambda s: (s.get("nom") or "").lower())

    print(f"Dump FFVL          : {len(dump)} enregistrements", file=sys.stderr)
    print(f"Coords invalides   : {bad}", file=sys.stderr)
    print(f"Ajoutés            : {added}", file=sys.stderr)
    print(f"Mis à jour         : {updated}", file=sys.stderr)
    print(f"Conservés (existant): {skipped}", file=sys.stderr)
    print(f"Total en sortie    : {len(merged)}", file=sys.stderr)

    if args.dry_run:
        print("(dry-run: rien écrit)", file=sys.stderr)
        return
    out_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Écrit : {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
