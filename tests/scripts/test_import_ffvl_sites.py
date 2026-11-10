"""Import FFVL (data.gouv.fr) : rafraîchissement des entrées existantes (python3 -m unittest)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import import_ffvl_sites as imp  # noqa: E402

RECORD = {
    "suid": 42,
    "toponym": "MONT TEST - DECO NORD",
    "zip": "74000",
    "city": "ANNECY",
    "latitude": 45.9,
    "longitude": 6.1,
    "altitude": 1200,
    "status": "actif",
    "convention_type": "convention_ffvl",
    "possible_usages_text": "parapente;delta",
    "flying_functions_text": "décollage",
    "wind_orientations_ok": "N;NE;NO",
    "warnings": "ras",
    "ideal_conditions_description": "Thermiques d'été",
    "access_description": "Piste puis sentier",
    "flying_rules_description": "Zone réglementée",
    "last_modification_datetime": "2026-10-20T18:01:56+02:00",
}


class ConvertTest(unittest.TestCase):
    def test_new_dataset_fields_are_mapped(self):
        site = imp.convert(RECORD)
        self.assertEqual(site["aerologie_ideale"], "Thermiques d'été")
        self.assertEqual(site["acces_topo"], "Piste puis sentier")
        self.assertEqual(site["reglementation"], "Zone réglementée")
        self.assertEqual(site["orientations_vent"], ["N", "NE", "NO"])
        self.assertEqual(site["conventionnement"], "Convention FFVL")
        self.assertIsNone(site["dangers"])  # « ras » n'est pas un danger

    def test_alert_message_is_kept_as_danger(self):
        site = imp.convert({**RECORD, "alert_msg": "Pilotes expérimentés uniquement", "warnings": "Câbles"})
        self.assertEqual(site["dangers"], "Pilotes expérimentés uniquement\n\nCâbles")


class RefreshEntryTest(unittest.TestCase):
    def setUp(self):
        self.new = imp.convert(RECORD)
        self.old = {
            "id": "mont-test-42",
            "type": ["NATUREL", "SOARING"],
            "structure_gestionnaire": "Club du Mont",
            "conventionnement": "Ancienne convention",
            "aerologie_ideale": "Brise de vallée",
            "source": "FFVL (Licence Ouverte/Etalab 2.0) — snapshot 2022-12-05",
        }

    def test_id_never_changes(self):
        merged = imp.refresh_entry(self.old, self.new)
        self.assertEqual(merged["id"], "mont-test-42")
        self.assertNotEqual(self.new["id"], "mont-test-42")

    def test_manual_types_are_kept(self):
        self.assertEqual(imp.refresh_entry(self.old, self.new)["type"], ["NATUREL", "SOARING"])

    def test_official_values_win_and_empty_ones_keep_old(self):
        merged = imp.refresh_entry(self.old, {**self.new, "conventionnement": None, "aerologie_ideale": None})
        self.assertEqual(merged["conventionnement"], "Ancienne convention")
        self.assertEqual(merged["aerologie_ideale"], "Brise de vallée")
        self.assertEqual(merged["structure_gestionnaire"], "Club du Mont")
        fresh = imp.refresh_entry(self.old, self.new)
        self.assertEqual(fresh["conventionnement"], "Convention FFVL")
        self.assertEqual(fresh["aerologie_ideale"], "Thermiques d'été")
        self.assertEqual(fresh["orientations_vent"], ["N", "NE", "NO"])


class SupersededTest(unittest.TestCase):
    def site(self, ref, lat, lon, source="FFVL (Licence Ouverte/Etalab 2.0)", affiche=True):
        return {"reference_terrain": ref, "latitude": lat, "longitude": lon, "source": source, "affiche": affiche}

    def test_only_nearby_unlisted_ffvl_entries_are_hidden(self):
        by_ref = {
            "1": self.site("1", 45.9, 6.1),  # toujours dans le jeu officiel
            "2": self.site("2", 45.9005, 6.1),  # absent, ~55 m d'un terrain officiel : doublon
            "3": self.site("3", 47.0, 2.0),  # absent mais loin de tout : conservé
            "4": self.site("4", 45.9005, 6.1, source=None),  # saisi à la main : jamais touché
        }
        hidden = imp.hide_superseded(by_ref, {"1"}, [(45.9, 6.1)])
        self.assertEqual(hidden, 1)
        self.assertFalse(by_ref["2"]["affiche"])
        self.assertTrue(by_ref["1"]["affiche"])
        self.assertTrue(by_ref["3"]["affiche"])
        self.assertTrue(by_ref["4"]["affiche"])


if __name__ == "__main__":
    unittest.main()
