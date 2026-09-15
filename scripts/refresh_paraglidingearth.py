#!/usr/bin/env python3
"""
Complète js/data/sites_data.json avec les données ParaglidingEarth (PGE).

PGE expose une API publique sans clé, sous licence Creative Commons BY-SA 3.0
(attribution + partage à l'identique). Ce script s'en sert pour :

  1. ENRICHIR les sites existants : ne remplit QUE les champs vides
     (orientations_vent, aerologie_ideale, observations). Rien qui soit déjà
     renseigné — données FFVL ou saisies à la main — n'est écrasé.
  2. AJOUTER les sites présents dans PGE mais absents du fichier
     (aucun ffvl_site_id correspondant et aucun site connu à moins de 250 m),
     marqués `source: "ParaglidingEarth (CC BY-SA 3.0)"`.

Correspondance : `ffvl_site_id` (PGE) == `reference_terrain` (app) en priorité,
sinon proximité géographique.

Usage :
    python3 scripts/refresh_paraglidingearth.py --dry-run
    python3 scripts/refresh_paraglidingearth.py                # enrichit + ajoute
    python3 scripts/refresh_paraglidingearth.py --no-add       # enrichit seulement
    python3 scripts/refresh_paraglidingearth.py --iso fr,ch,it # plusieurs pays
"""
import argparse
import json
import math
import sys
import unicodedata
import re
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "js" / "data" / "sites_data.json"
API = "https://www.paraglidingearth.com/api/geojson/getCountrySites.php?iso={iso}&style=detailled"

PGE_TO_FR = {"N": "N", "NE": "NE", "E": "E", "SE": "SE", "S": "S", "SW": "SO", "W": "O", "NW": "NO"}
FR_ORDER = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"]
MATCH_RADIUS_M = 250.0


def clean(v):
    if v is None:
        return None
    v = str(v).replace("\r\n", "\n").replace("\r", "\n").strip()
    return v or None


def slug(s):
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-") or "site"


def haversine_m(a_lat, a_lon, b_lat, b_lon):
    r = 6371000.0
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp = math.radians(b_lat - a_lat)
    dl = math.radians(b_lon - a_lon)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def fetch(iso):
    url = API.format(iso=iso)
    print(f"→ ParaglidingEarth : {url}", file=sys.stderr)
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data.get("features", [])


def pge_orientations(props, threshold=1):
    out = []
    for pge, fr in PGE_TO_FR.items():
        try:
            if int(props.get(pge, "0")) >= threshold and fr not in out:
                out.append(fr)
        except ValueError:
            pass
    return [d for d in FR_ORDER if d in out]


def pge_types(props):
    t = []
    if props.get("place", "").find("landing") >= 0:
        t.append("ATTERRO")
    else:
        t.append("NATUREL")
    if props.get("soaring") == "1" and "SOARING" not in t:
        t.append("SOARING")
    if props.get("thermals") == "1" and "THERMIQUE" not in t:
        t.append("THERMIQUE")
    return t


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--iso", default="fr", help="codes pays ISO séparés par des virgules (défaut: fr)")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--no-add", action="store_true", help="enrichir seulement, ne rien ajouter")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    out_path = Path(args.out)
    sites = json.loads(out_path.read_text(encoding="utf-8"))
    by_ref = {str(s.get("reference_terrain")): s for s in sites}
    geo = [s for s in sites
           if s.get("latitude") is not None and s.get("longitude") is not None]

    features = []
    for iso in [x.strip() for x in args.iso.split(",") if x.strip()]:
        features += fetch(iso)
    print(f"PGE features        : {len(features)}", file=sys.stderr)

    enriched_fields = added = matched = 0
    for f in features:
        props = f.get("properties", {})
        try:
            lon, lat = f["geometry"]["coordinates"][:2]
            lat, lon = float(lat), float(lon)
        except (KeyError, TypeError, ValueError):
            continue

        target = None
        ffvl_id = str(props.get("ffvl_site_id", "0")).strip()
        if ffvl_id and ffvl_id != "0" and ffvl_id in by_ref:
            target = by_ref[ffvl_id]
        else:
            best, best_d = None, MATCH_RADIUS_M
            for s in geo:
                d = haversine_m(lat, lon, s["latitude"], s["longitude"])
                if d < best_d:
                    best, best_d = s, d
            target = best

        if target is not None:
            matched += 1
            ori = pge_orientations(props)
            if not target.get("orientations_vent") and ori:
                target["orientations_vent"] = ori
                enriched_fields += 1
            if not target.get("aerologie_ideale") and clean(props.get("weather")):
                target["aerologie_ideale"] = clean(props["weather"])
                enriched_fields += 1
            if not target.get("observations") and clean(props.get("comments")):
                target["observations"] = clean(props["comments"])
                enriched_fields += 1
            if not target.get("reglementation") and clean(props.get("flight_rules")):
                target["reglementation"] = clean(props["flight_rules"])
                enriched_fields += 1
            continue

        if args.no_add:
            continue
        name = clean(props.get("name")) or "SANS NOM"
        pid = str(props.get("pge_site_id") or f.get("id") or "").strip()
        try:
            alt = int(float(props.get("takeoff_altitude") or 0)) or None
        except ValueError:
            alt = None
        new = {
            "id": f"pge-{slug(name)}-{pid}",
            "reference_terrain": None,
            "pge_site_id": pid,
            "nom": name,
            "latitude": round(lat, 5),
            "longitude": round(lon, 5),
            "code_postal": None,
            "ville": None,
            "departement": None,
            "region": None,
            "pays": props.get("countryCode", "").upper() or None,
            "orientations_vent": pge_orientations(props),
            "type": pge_types(props),
            "altitude": alt,
            "affiche": True,
            "conventionnement": None,
            "praticabilite": "terrain ouvert à la pratique",
            "structure_gestionnaire": None,
            "dangers": None,
            "secours_acces": None,
            "aerologie_ideale": clean(props.get("weather")),
            "acces_topo": clean(props.get("going_there")),
            "observations": clean(props.get("comments")),
            "restrictions": None,
            "reglementation": clean(props.get("flight_rules")),
            "url": clean(props.get("pge_link")),
            "atterissage": None,
            "date_modification": clean(props.get("last_edit")),
            "source": "ParaglidingEarth (CC BY-SA 3.0)",
        }
        sites.append(new)
        geo.append({"latitude": new["latitude"], "longitude": new["longitude"]})
        added += 1

    sites.sort(key=lambda s: (s.get("nom") or "").lower())

    print(f"Sites rapprochés    : {matched}", file=sys.stderr)
    print(f"Champs complétés     : {enriched_fields}", file=sys.stderr)
    print(f"Sites ajoutés (PGE)  : {added}", file=sys.stderr)
    print(f"Total en sortie      : {len(sites)}", file=sys.stderr)

    if args.dry_run:
        print("(dry-run: rien écrit)", file=sys.stderr)
        return
    out_path.write_text(json.dumps(sites, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ Écrit : {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
