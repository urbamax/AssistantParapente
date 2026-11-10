"""Un import FFVL met à jour les sites existants sans écraser les saisies à la main (python3 -m unittest)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from import_ffvl_sites import refresh_existing  # noqa: E402

NEW = {
    "affiche": False, "praticabilite": "pratique interdite", "date_modification": "2026-10-20",
    "source": "FFVL (data.gouv.fr) — 2026-10-20", "latitude": 45.1, "longitude": 6.2, "altitude": 1500,
    "conventionnement": "Convention FFVL", "orientations_vent": ["N", "NE"], "secours_acces": None,
    "dangers": None,
}


class RefreshExistingTest(unittest.TestCase):
    def test_official_values_replace_old_ones(self):
        old = {"source": "FFVL (Licence Ouverte/Etalab 2.0) — snapshot 2022-12-05", "affiche": True,
               "praticabilite": "terrain ouvert à la pratique", "latitude": 45.0, "longitude": 6.0,
               "orientations_vent": ["S"], "nom": "Nom saisi", "type": ["THERMIQUE"]}
        self.assertTrue(refresh_existing(old, NEW))
        self.assertFalse(old["affiche"])
        self.assertEqual(old["orientations_vent"], ["N", "NE"])
        self.assertEqual(old["latitude"], 45.1)

    def test_hand_written_fields_are_kept(self):
        old = {"source": "FFVL (x)", "nom": "Nom saisi", "type": ["THERMIQUE"], "dangers": "à la main"}
        refresh_existing(old, NEW)
        self.assertEqual(old["nom"], "Nom saisi")
        self.assertEqual(old["type"], ["THERMIQUE"])
        self.assertEqual(old["dangers"], "à la main")  # le flux est vide : on garde

    def test_entries_from_other_sources_are_not_touched(self):
        old = {"source": "ParaglidingEarth (CC BY-SA 3.0)", "latitude": 1.0}
        self.assertFalse(refresh_existing(old, NEW))
        self.assertEqual(old, {"source": "ParaglidingEarth (CC BY-SA 3.0)", "latitude": 1.0})
        self.assertFalse(refresh_existing({"latitude": 1.0}, NEW))


if __name__ == "__main__":
    unittest.main()
