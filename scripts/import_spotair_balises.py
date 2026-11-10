#!/usr/bin/env python3
"""
Récupère le réseau officiel de balises météo FFVL depuis data.gouv.fr (Licence Ouverte / Etalab 2.0).

Source officielle :
    https://www.data.gouv.fr/datasets/reseau-de-balises-meteo-de-la-ffvl-federation-francaise-de-vol-libre
    Fichier : balises.json (mis à jour quotidiennement)

Chaque balise météo est rattachée au site de vol le plus proche dans sites_data.json,
uniquement si la distance est inférieure à 1 km (seuil configurable).
Les balises en maintenance (en_maintenance == 1) sont ignorées pour éviter d'afficher
un widget SpotAiR sans mesure.

Sortie : js/data/spotair_widgets.js (mapping site.id -> id de balise FFVL),
généré automatiquement -- ne pas éditer à la main, relancer ce script à la place.
"""
import argparse
import json
import math
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SITES_PATH = REPO / "js" / "data" / "sites_data.json"
OUT_PATH = REPO / "js" / "data" / "spotair_widgets.js"

DATA_GOUV_BALISES_URL = "https://www.data.gouv.fr/api/1/datasets/r/8d795154-9145-4ab2-99de-6768a36f31ea"
HEADERS = {"User-Agent": "Mozilla/5.0 (AssistantParapente balise sync)"}


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def load_balises(args):
    if args.input:
        return json.loads(Path(args.input).read_text(encoding="utf-8"))
    print(f"→ Téléchargement des balises FFVL depuis data.gouv.fr...", file=sys.stderr)
    req = urllib.request.Request(DATA_GOUV_BALISES_URL, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--input", help="chemin vers un balises.json local")
    ap.add_argument("--max-dist", type=int, default=1000, help="distance maximale en mètres (défaut: 1000 m)")
    ap.add_argument("--dry-run", action="store_true", help="ne rien écrire, afficher le résumé")
    args = ap.parse_args()

    raw_balises = load_balises(args)
    if not isinstance(raw_balises, list):
        sys.exit("Format inattendu : balises.json n'est pas une liste JSON")

    print(f"{len(raw_balises)} balises reçues de data.gouv.fr.", file=sys.stderr)

    # Filtrage des balises actives et valides
    active_balises = []
    maintenance_count = 0
    invalid_coords = 0

    for b in raw_balises:
        if b.get("en_maintenance") == 1:
            maintenance_count += 1
            continue
        try:
            lat = float(b["latitude"])
            lon = float(b["longitude"])
        except (KeyError, TypeError, ValueError):
            invalid_coords += 1
            continue
        active_balises.append({
            "ffvl_id": str(b["idBalise"]),
            "nom": (b.get("nom") or "").strip(),
            "lat": lat,
            "lng": lon,
        })

    print(f"Balises actives et localisées : {len(active_balises)} "
          f"({maintenance_count} en maintenance, {invalid_coords} sans coordonnées)", file=sys.stderr)

    if not SITES_PATH.exists():
        sys.exit(f"Fichier de sites introuvable : {SITES_PATH}")

    sites = json.loads(SITES_PATH.read_text(encoding="utf-8"))

    mapping = {}
    matched_count = 0
    for site in sites:
        if site.get("affiche") is False:
            continue
        try:
            lat = float(site.get("latitude") or site.get("lat"))
            lon = float(site.get("longitude") or site.get("lon"))
        except (TypeError, ValueError):
            continue

        best = None
        best_dist = None
        for b in active_balises:
            d = haversine_m(lat, lon, b["lat"], b["lng"])
            if best_dist is None or d < best_dist:
                best_dist = d
                best = b

        if best is not None and best_dist <= args.max_dist:
            mapping[site["id"]] = {
                "ffvl_id": best["ffvl_id"],
                "dist_m": round(best_dist),
                "titre": best["nom"],
            }
            matched_count += 1

    print(f"{matched_count} sites rattachés à une balise à moins de {args.max_dist} m.", file=sys.stderr)

    if args.dry_run:
        print("(dry-run: rien écrit)", file=sys.stderr)
        return

    lines = [
        "// js/data/spotair_widgets.js",
        "//",
        "// GENERE AUTOMATIQUEMENT par scripts/import_spotair_balises.py -- ne pas editer",
        "// a la main, relancer le script a la place.",
        "//",
        "// Mapping site.id -> identifiant de balise meteo FFVL (utilise par le widget",
        "// SpotAiR : https://www.spotair.mobi/widget/wind/ffvl/<ID>). Chaque balise est",
        "// rattachee au site de vol le plus proche, uniquement si elle se trouve a",
        f"// moins de {args.max_dist} m de ce site (source : https://data.gouv.fr / FFVL).",
        "",
        "export const SPOTAIR_WIND_WIDGETS = {",
    ]

    for site_id in sorted(mapping.keys()):
        info = mapping[site_id]
        escaped_title = info["titre"].replace("'", "\\'")
        lines.append(f"    '{site_id}': '{info['ffvl_id']}', // {escaped_title} (~{info['dist_m']} m)")

    lines.extend([
        "};",
        "",
        "export function getSpotairWidgetId(site) {",
        "    if (!site) return null;",
        "    return SPOTAIR_WIND_WIDGETS[site.id] || null;",
        "}",
        "",
    ])

    OUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"✓ Écrit : {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
