#!/usr/bin/env python3
"""
Tests unitaires pour le serveur de feedback, télémétrie et health check.
Vérifie le routage GET/POST/OPTIONS, le format de santé, la détection des crashs,
le durcissement sécurité (liste blanche catégories, CORS, anti-spoofing IP, rate-limit borné,
absence d'IP brute sur disque, absence de fuite d'exception 500, embed Discord borné)
et l'absence de vrai webhook Discord dans .env.example.
"""
import importlib.util
import json
import re
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parent.parent.parent
SERVER_PATH = ROOT / "deploy" / "feedback_server" / "server.py"
ENV_EXAMPLE_PATH = ROOT / "deploy" / "feedback_server" / ".env.example"

spec = importlib.util.spec_from_file_location("server", SERVER_PATH)
server_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server_mod)


class TestEnvExampleHygiene(unittest.TestCase):
    def test_no_real_discord_webhook_token_in_env_example(self):
        content = ENV_EXAMPLE_PATH.read_text(encoding="utf-8")
        # Un vrai webhook Discord ressemble à /api/webhooks/<17-20 chiffres>/<token >= 30 car.>
        self.assertIsNone(
            re.search(r"discord\.com/api/webhooks/\d{15,}/[A-Za-z0-9_-]{20,}", content),
            ".env.example ne doit jamais contenir un vrai jeton de webhook Discord",
        )


class TestFeedbackServerHelpers(unittest.TestCase):
    def test_default_bind_host_is_loopback(self):
        self.assertEqual(server_mod.DEFAULT_HOST, "127.0.0.1")

    def test_format_uptime(self):
        self.assertEqual(server_mod.format_uptime(45), "45s")
        self.assertEqual(server_mod.format_uptime(125), "2m 5s")
        self.assertEqual(server_mod.format_uptime(3665), "1h 1m 5s")
        self.assertEqual(server_mod.format_uptime(90065), "1j 1h 1m 5s")

    def test_sanitize_category_uses_allowlist(self):
        self.assertEqual(server_mod.sanitize_category("bug"), "bug")
        self.assertEqual(server_mod.sanitize_category("crash"), "crash")
        self.assertEqual(server_mod.sanitize_category("../../etc/passwd"), "other")
        self.assertEqual(server_mod.sanitize_category("foo/bar"), "other")
        self.assertEqual(server_mod.sanitize_category(None), "other")

    def test_resolve_client_ip_only_trusts_proxy_headers_from_loopback(self):
        headers = {"CF-Connecting-IP": "203.0.113.5", "X-Real-IP": "203.0.113.6"}
        self.assertEqual(server_mod.resolve_client_ip(headers, "127.0.0.1"), "203.0.113.5")
        self.assertEqual(server_mod.resolve_client_ip(headers, "::1"), "203.0.113.5")
        # Un client non-loopback ne doit pas pouvoir usurper CF-Connecting-IP
        self.assertEqual(server_mod.resolve_client_ip(headers, "198.51.100.7"), "198.51.100.7")

    def test_rate_limiting_and_memory_cap(self):
        with server_mod._rate_limit_lock:
            server_mod._ip_requests.clear()
        ip = "192.168.1.99"
        for _ in range(server_mod.RATE_LIMIT_MAX_REQUESTS):
            self.assertFalse(server_mod.is_rate_limited(ip))
        self.assertTrue(server_mod.is_rate_limited(ip))

        # Les entrées expirées sont purgées lors des appels suivants
        with server_mod._rate_limit_lock:
            server_mod._ip_requests["stale-ip"] = [time.time() - server_mod.RATE_LIMIT_WINDOW_SECONDS - 5]
        server_mod.is_rate_limited("192.168.1.100")
        with server_mod._rate_limit_lock:
            self.assertNotIn("stale-ip", server_mod._ip_requests)

    def test_discord_payload_security_and_limits(self):
        huge_detail = "X" * 5000
        payload = server_mod.build_discord_payload(
            cat="crash",
            label="Crash Client JS",
            subject="TypeError @everyone",
            description="boom ```\nmalicious\n```",
            contact="pilot",
            location="app.js:1:1",
            ctx={"version": "1.0", "screen": "LOGBOOK", "runtime": "Web", "viewport": "390x800", "network": "online", "detail": huge_detail},
        )
        self.assertEqual(payload.get("allowed_mentions"), {"parse": []})
        self.assertEqual(payload.get("avatar_url"), "https://assistantparapente.fr/img/icons/icon-192x192.png")
        embed = payload["embeds"][0]
        # Aucune triple backtick non échappée ne doit sortir du bloc code JS
        inner = embed["description"][len("```javascript\n") : -len("\n```")]
        self.assertNotIn("```", inner)
        # Chaque champ Discord doit rester sous la limite de 1024 caractères
        for field in embed["fields"]:
            self.assertLessEqual(len(field["value"]), 1024)


class TestFeedbackServerHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmpdir = tempfile.TemporaryDirectory()
        cls._orig_logs_dir = server_mod.LOGS_DIR
        cls._orig_crashes_dir = server_mod.CRASHES_DIR
        cls._orig_webhook = server_mod.DISCORD_WEBHOOK_URL

        server_mod.LOGS_DIR = Path(cls._tmpdir.name) / "logs"
        server_mod.CRASHES_DIR = server_mod.LOGS_DIR / "crashes"
        server_mod.LOGS_DIR.mkdir(parents=True, exist_ok=True)
        server_mod.CRASHES_DIR.mkdir(parents=True, exist_ok=True)
        server_mod.DISCORD_WEBHOOK_URL = ""

        cls.httpd = server_mod.http.server.ThreadingHTTPServer(("127.0.0.1", 0), server_mod.FeedbackHandler)
        cls.port = cls.httpd.server_address[1]
        cls.server_thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.server_thread.start()
        time.sleep(0.05)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()
        server_mod.LOGS_DIR = cls._orig_logs_dir
        server_mod.CRASHES_DIR = cls._orig_crashes_dir
        server_mod.DISCORD_WEBHOOK_URL = cls._orig_webhook
        cls._tmpdir.cleanup()

    def setUp(self):
        with server_mod._rate_limit_lock:
            server_mod._ip_requests.clear()

    def _post(self, path, body, headers=None):
        raw = body.encode("utf-8") if isinstance(body, str) else json.dumps(body).encode("utf-8")
        hdrs = {"Content-Type": "application/json"}
        if headers:
            hdrs.update(headers)
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}{path}", data=raw, headers=hdrs)
        return urllib.request.urlopen(req)

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
        ctx.exception.close()

    def test_post_404_on_health(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post("/api/health", {"description": "Should not be accepted on /api/health"})
        self.assertEqual(ctx.exception.code, 404)
        ctx.exception.close()

    def test_options_cors_restricted_origin(self):
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/api/feedback", method="OPTIONS")
        with urllib.request.urlopen(req) as resp:
            self.assertEqual(resp.status, 204)
            self.assertEqual(resp.headers.get("Access-Control-Allow-Origin"), server_mod.ALLOWED_ORIGIN)
            self.assertNotEqual(resp.headers.get("Access-Control-Allow-Origin"), "*")

    def test_post_honeypot_botcheck(self):
        with self._post("/api/feedback", {"botcheck": "spam", "description": "Spam message"}) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data.get("success"))

    def test_post_crash_category_no_raw_ip_and_unique_files(self):
        body = {
            "category": "crash",
            "subject": "TypeError in test",
            "description": "TypeError: Cannot read properties of undefined\n    at LogbookView.render",
            "location": "js/views/logbook.js:42:10",
            "context": {"version": "1.0.0", "screen": "LOGBOOK", "runtime": "Firefox 120"},
        }
        with self._post("/api/feedback", body) as resp1:
            self.assertEqual(resp1.status, 200)
        with self._post("/api/crash", {**body, "category": "bug"}) as resp2:
            self.assertEqual(resp2.status, 200)

        crash_files = list(server_mod.CRASHES_DIR.glob("*.json"))
        self.assertEqual(len(crash_files), 2)
        for cf in crash_files:
            stored = json.loads(cf.read_text(encoding="utf-8"))
            self.assertNotIn("ip", stored, "Aucune IP brute ne doit être stockée sur disque (RGPD)")

    def test_post_malicious_category_sanitized_to_other(self):
        with self._post("/api/feedback", {"category": "../../evil", "description": "Tentative de traversée"}) as resp:
            self.assertEqual(resp.status, 200)
        other_files = list(server_mod.LOGS_DIR.glob("*_other_*.json"))
        self.assertGreaterEqual(len(other_files), 1)

    def test_post_validation_errors(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx_json:
            self._post("/api/feedback", "{not valid json")
        self.assertEqual(ctx_json.exception.code, 400)
        ctx_json.exception.close()

        with self.assertRaises(urllib.error.HTTPError) as ctx_short:
            self._post("/api/feedback", {"description": "abc"})
        self.assertEqual(ctx_short.exception.code, 400)
        ctx_short.exception.close()

    def test_post_rejects_non_json_content_type_and_whitelists_context(self):
        with self.assertRaises(urllib.error.HTTPError) as ctx_ct:
            self._post(
                "/api/feedback",
                {"description": "Tentative no-cors text/plain"},
                headers={"Content-Type": "text/plain"},
            )
        self.assertEqual(ctx_ct.exception.code, 415)
        ctx_ct.exception.close()

        with self._post(
            "/api/feedback",
            {
                "description": "Message avec contexte filtré",
                "context": {"version": "1.0", "extraSecret": "should-be-dropped"},
            },
        ) as resp:
            self.assertEqual(resp.status, 200)
        latest = max(server_mod.LOGS_DIR.glob("*.json"), key=lambda p: p.stat().st_mtime)
        stored = json.loads(latest.read_text(encoding="utf-8"))
        self.assertEqual(stored["payload"]["context"], {"version": "1.0"})

    def test_post_rate_limit_429(self):
        for _ in range(server_mod.RATE_LIMIT_MAX_REQUESTS):
            with self._post("/api/feedback", {"description": "Message valide de test"}) as resp:
                self.assertEqual(resp.status, 200)
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            self._post("/api/feedback", {"description": "Message en trop"})
        self.assertEqual(ctx.exception.code, 429)
        ctx.exception.close()

    def test_post_500_does_not_leak_exception_details(self):
        with mock.patch.object(server_mod, "build_discord_payload", side_effect=RuntimeError("SECRET_INTERNAL_STACK")):
            orig = server_mod.DISCORD_WEBHOOK_URL
            server_mod.DISCORD_WEBHOOK_URL = "https://example.invalid/webhook"
            try:
                with self.assertRaises(urllib.error.HTTPError) as ctx:
                    self._post("/api/feedback", {"description": "Message provoquant une erreur interne"})
                self.assertEqual(ctx.exception.code, 500)
                body = ctx.exception.read().decode("utf-8")
                self.assertNotIn("SECRET_INTERNAL_STACK", body)
                ctx.exception.close()
            finally:
                server_mod.DISCORD_WEBHOOK_URL = orig


if __name__ == "__main__":
    unittest.main()
