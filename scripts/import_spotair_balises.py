"""
Crawle le reseau public de balises meteo FFVL (balisemeteo.com) pour recuperer,
pour chaque balise, son numero FFVL (l'ID utilise par les widgets SpotAiR :
https://www.spotair.mobi/widget/wind/ffvl/<ID>) et ses coordonnees GPS.

Chaque balise est ensuite rattachee au site de vol le plus proche dans
sites_data.json, uniquement si la distance est inferieure a 1 km (les balises
ne sont jamais des "sites" a part entiere : c'est juste un capteur de vent
associe a un site existant).

Sortie : js/data/spotair_widgets.js (mapping site.id -> id de balise FFVL),
genere automatiquement -- ne pas editer a la main, relancer ce script a la
place quand le reseau de balises evolue.

Source : https://balisemeteo.com (FFVL, reseau federal de balises meteo).
"""
import json
import math
import re
import time
import urllib.request
from datetime import datetime, timedelta

# Une balise dont la dernière mesure remonte à plus de ce délai est considérée
# hors service (en maintenance, débranchée, etc.) : son widget SpotAiR affiche
# alors un rond blanc "-/-/-" illisible sur fond sombre au lieu du vent en
# direct, donc on ne la propose pas du tout plutôt que d'afficher ça.
MAX_STALENESS = timedelta(hours=3)

BASE = "https://balisemeteo.com/"
HEADERS = {"User-Agent": "Mozilla/5.0 (AssistantParapente balise sync)"}


def fetch(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def get_region_ids():
    html = fetch(BASE + "index.php")
    return sorted(set(int(m) for m in re.findall(r"idRegion=(\d+)", html)))


def get_dept_codes(region_id):
    html = fetch(BASE + f"region.php?idRegion={region_id}")
    return sorted(set(re.findall(r"depart\.php\?dept=([0-9A-Za-z]+)", html)))


def parse_balises(dept_code):
    html = fetch(BASE + f"depart.php?dept={dept_code}")
    m = re.search(r"const points\s*=\s*(\[.*?\]);", html, re.S)
    if not m:
        return []
    raw_points = m.group(1)
    balises = []
    # Each point is its own JSON-ish object; split on "},\n{" boundaries is fragile,
    # so parse with a tolerant regex per point block instead of full JSON (the
    # popup HTML contains unescaped quotes-free JS strings but stays JSON-valid here).
    for point_str in re.findall(r"\{[^{}]*\"popup\"[^{}]*\}", raw_points, re.S):
        lat_m = re.search(r'"lat":\s*([\-0-9.]+)', point_str)
        lng_m = re.search(r'"lng":\s*([\-0-9.]+)', point_str)
        id_m = re.search(r'idBalise=(\d+)', point_str)
        title_m = re.search(r'<b>([^<]+)</b>(?:</[a-zA-Z]+>)*\s*-\s*\d+', point_str)
        time_m = re.search(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})', point_str)
        if not (lat_m and lng_m and id_m):
            continue

        # Ignore les balises hors service (dernière mesure trop ancienne, ex:
        # station "en maintenance") : leur widget SpotAiR n'affiche aucune
        # valeur, juste un rond blanc illisible sur fond sombre.
        if time_m:
            try:
                last_seen = datetime.strptime(time_m.group(1), "%Y-%m-%d %H:%M:%S")
                if datetime.now() - last_seen > MAX_STALENESS:
                    continue
            except ValueError:
                pass

        balises.append({
            "ffvl_id": id_m.group(1),
            "lat": float(lat_m.group(1)),
            "lng": float(lng_m.group(1)),
            "titre": title_m.group(1).strip() if title_m else "",
        })
    return balises


def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def main():
    print("Recuperation de la liste des regions...")
    region_ids = get_region_ids()

    dept_codes = set()
    for rid in region_ids:
        try:
            codes = get_dept_codes(rid)
            dept_codes.update(codes)
        except Exception as e:
            print(f"  ! region {rid} : {e}")
        time.sleep(0.15)
    print(f"{len(dept_codes)} departements trouves.")

    all_balises = []
    for i, code in enumerate(sorted(dept_codes, key=lambda c: (len(c), c))):
        try:
            balises = parse_balises(code)
            all_balises.extend(balises)
            print(f"  [{i+1}/{len(dept_codes)}] dept {code} : {len(balises)} balise(s)")
        except Exception as e:
            print(f"  ! dept {code} : {e}")
        time.sleep(0.15)

    # Deduplique par ffvl_id (une meme balise peut apparaitre sur plusieurs pages)
    by_id = {b["ffvl_id"]: b for b in all_balises}
    all_balises = list(by_id.values())
    print(f"\n{len(all_balises)} balises uniques au total.")

    with open("js/data/sites_data.json", encoding="utf-8") as f:
        sites = json.load(f)

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
        for b in all_balises:
            d = haversine_m(lat, lon, b["lat"], b["lng"])
            if best_dist is None or d < best_dist:
                best_dist = d
                best = b

        if best is not None and best_dist <= 1000:
            mapping[site["id"]] = {"ffvl_id": best["ffvl_id"], "dist_m": round(best_dist), "titre": best["titre"]}
            matched_count += 1

    print(f"{matched_count} sites rattaches a une balise a moins de 1 km.")

    lines = []
    lines.append("// js/data/spotair_widgets.js")
    lines.append("//")
    lines.append("// GENERE AUTOMATIQUEMENT par scripts/import_spotair_balises.py -- ne pas editer")
    lines.append("// a la main, relancer le script a la place.")
    lines.append("//")
    lines.append("// Mapping site.id -> identifiant de balise meteo FFVL (utilise par le widget")
    lines.append("// SpotAiR : https://www.spotair.mobi/widget/wind/ffvl/<ID>). Chaque balise est")
    lines.append("// rattachee au site de vol le plus proche, uniquement si elle se trouve a")
    lines.append("// moins d'1 km de ce site (source : https://balisemeteo.com, reseau FFVL).")
    lines.append("")
    lines.append("export const SPOTAIR_WIND_WIDGETS = {")
    for site_id in sorted(mapping.keys()):
        info = mapping[site_id]
        lines.append(f"    {json.dumps(site_id)}: {json.dumps(info['ffvl_id'])}, // {info['titre']} (~{info['dist_m']} m)")
    lines.append("};")
    lines.append("")
    lines.append("export function getSpotairWidgetId(site) {")
    lines.append("    if (!site) return null;")
    lines.append("    return SPOTAIR_WIND_WIDGETS[site.id] || null;")
    lines.append("}")
    lines.append("")

    with open("js/data/spotair_widgets.js", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print("js/data/spotair_widgets.js regenere.")


if __name__ == "__main__":
    main()
