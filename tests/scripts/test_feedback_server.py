#!/usr/bin/env python3
"""
Tests unitaires pour le serveur de feedback, télémétrie et health check.
Vérifie le routage GET/POST/OPTIONS, le format de santé, la détection des crashs et l'anti-spam.
"""
import importlib.util
import json
import os
import sys
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
SERVER_PATH = ROOT / "deploy" / "feedback_server" / "server.py"

spec = importlib.util.spec_from_file_location("server", SERVER_PATH)
server_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_mod)


class TestFeedbackServerHelpers(unittest.TestCase):
    def test_format_uptime(self):
        self.assertEqual(server_mod.format_uptime(45), "45s")
        self.assertEqual(server_mod.format_uptime(125), "2m 5s")
        self.assertEqual(server_mod.format_uptime(3665), "1h 1m 5s")
        self.assertEqual(server_mod.format_uptime(90065), "1j 1h 1m 5s")

    def test_rate_limiting(self):
        ip = "192.168.1.99"
        server_mod._ip_requests.pop(ip, None)
        for _ in range(server_mod.RATE_LIMIT_MAX_REQUESTS):
            self.assertFalse(server_mod.is_rate_limited(ip))
        self.assertTrue(server_mod.is_rate_limited(ip))


class TestFeedbackServerHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = 18085
        cls.httpd = server_mod.http.server.ThreadingHTTPServer(("127.0.0.1", cls.port), server_mod.FeedbackHandler)
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.05)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_get_health(self):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/health")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("status"), "healthy")
            self.assertIn("uptime_seconds", data)
            self.assertIn("service", data)

    def test_get_feedback_path_alias(self):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/feedback")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data.get("status"), "healthy")

    def test_get_404_on_unknown(self):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/nonexistent")
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req)
        self.assertEqual(ctx.exception.code, 404)

    def test_options_cors(self):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/feedback", method="OPTIONS")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 204)
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")

    def test_post_honeypot_botcheck(self):
        payload = json.dumps({"botcheck": "spam", "description": "Spam message"}).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/feedback",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))

    def test_post_crash_category(self):
        payload = json.dumps({
            "category": "crash",
            "subject": "TypeError in test",
            "description": "TypeError: Cannot read properties of undefined\n    at LogbookView.render",
            "location": "js/views/logbook.js:42:10",
            "context": {
                "version": "1.0.0",
                "screen": "LOGBOOK",
                "runtime": "Firefox 120",
            },
        }).encode("utf-8")
        req = urllib.request.Request(
            f"http://127.0.0.1:{self.port}/api/feedback",
            data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))


if __name__ == "__main__":
    unittest.main()
