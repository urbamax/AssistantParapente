"""Spec 003, US3 : réparation des caractères Windows-1252 mal décodés (python3 -m unittest)."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

from text_repair import repair_cp1252  # noqa: E402


class RepairCp1252Test(unittest.TestCase):
    def test_apostrophe(self):
        self.assertEqual(repair_cp1252("l\x92objectif"), "l’objectif")

    def test_common_characters(self):
        cases = {
            "\x95": "•",
            "\x85": "…",
            "\x80": "€",
            "\x9c": "œ",
            "\x96": "–",
            "\x97": "—",
            "\x93\x94": "“”",
            "\x91": "‘",
        }
        for broken, fixed in cases.items():
            with self.subTest(broken=repr(broken)):
                self.assertEqual(repair_cp1252(broken), fixed)

    def test_undefined_positions_are_removed(self):
        self.assertEqual(repair_cp1252("a\x81b\x8dc\x8fd\x90e\x9df"), "abcdef")

    def test_plain_text_unchanged_and_idempotent(self):
        text = "Décollage « nord » — vent < 25 km/h, œuvre à 5 €"
        self.assertEqual(repair_cp1252(text), text)
        once = repair_cp1252("l\x92objectif \x96 fin")
        self.assertEqual(repair_cp1252(once), once)

    def test_none(self):
        self.assertIsNone(repair_cp1252(None))


if __name__ == "__main__":
    unittest.main()
