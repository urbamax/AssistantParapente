#!/usr/bin/env python3
"""Tests unitaires pour scripts/refresh_paraglidingearth.py."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "scripts"))

import refresh_paraglidingearth as pge  # noqa: E402


class TestRefreshParaglidingEarth(unittest.TestCase):
    def test_none_reference_terrain_does_not_collide_and_new_site_dedupes_in_geo(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            out_path = Path(tmpdir) / "sites.json"
            existing = [
                {
                    "id": "existing-none",
                    "reference_terrain": None,
                    "nom": "Site sans ref",
                    "latitude": 45.0,
                    "longitude": 6.0,
                    "orientations_vent": ["N"],
                }
            ]
            out_path.write_text(json.dumps(existing), encoding="utf-8")

            features = [
                {
                    "id": "pge-1",
                    "geometry": {"coordinates": [6.5, 45.5]},
                    "properties": {
                        "pge_site_id": "101",
                        "name": "Nouveau Spot",
                        "ffvl_site_id": None,
                        "countryCode": "fr",
                        "takeoff_altitude": "1200",
                        "weather": None,
                        "S": 2,
                    },
                },
                {
                    "id": "pge-2",
                    "geometry": {"coordinates": [6.5001, 45.5001]},
                    "properties": {
                        "pge_site_id": "102",
                        "name": "Nouveau Spot Bis",
                        "ffvl_site_id": "0",
                        "weather": "Thermique doux",
                        "comments": "Accès facile",
                    },
                },
            ]

            with (
                mock.patch.object(pge, "fetch", return_value=features),
                mock.patch.object(sys, "argv", ["refresh_paraglidingearth.py", "--iso", "fr", "--out", str(out_path)]),
            ):
                pge.main()

            result = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(len(result), 2)
            added = next(s for s in result if s["id"] == "pge-nouveau-spot-101")
            # Le second feature PGE à <250m enrichit directement l'objet `new` ajouté dans `geo`
            self.assertEqual(added["aerologie_ideale"], "Thermique doux")
            self.assertEqual(added["observations"], "Accès facile")
            # L'ancien site avec reference_terrain=None n'a pas été modifié par ffvl_site_id=None
            self.assertEqual(existing[0]["orientations_vent"], ["N"])


if __name__ == "__main__":
    unittest.main()
