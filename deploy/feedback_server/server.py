#!/usr/bin/env python3
"""
Serveur de réception des retours, télémétrie des crashs et health check Assistant Parapente.
100% Python standard (aucune dépendance tierce requise).
"""
import http.server
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
SERVER_START_TIME = time.time()


def load_env(env_path: Path):
    if not env_path.is_file():
        return
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
    except Exception as e:
        print(f"[WARN] Impossible de lire {env_path}: {e}", file=sys.stderr)


load_env(BASE_DIR / ".env")

PORT = int(os.environ.get("PORT", 8085))
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")

LOGS_DIR = BASE_DIR / "logs"
LOGS_DIR.mkdir(parents=True, exist_ok=True)
CRASHES_DIR = LOGS_DIR / "crashes"
CRASHES_DIR.mkdir(parents=True, exist_ok=True)

# Couleurs Discord par catégorie (format décimal)
COLORS = {
    "bug": 0xE02424,          # Rouge
    "crash": 0xDC2626,        # Rouge vif
    "qcm_course": 0xFF7A00,   # Orange
    "site_weather": 0x2563EB, # Bleu
    "suggestion": 0x16A34A,   # Vert
    "other": 0x6B7280,        # Gris
}

EMOJIS = {
    "bug": "🐛",
    "crash": "🚨",
    "qcm_course": "🎓",
    "site_weather": "🌤️",
    "suggestion": "💡",
    "other": "💬",
}

# Limiteur de débit en mémoire (max 10 requêtes par 10 minutes par IP)
RATE_LIMIT_WINDOW_SECONDS = 600
RATE_LIMIT_MAX_REQUESTS = 10
_ip_requests = {}


def is_rate_limited(ip: str) -> bool:
    now = time.time()
    history = _ip_requests.setdefault(ip, [])
    _ip_requests[ip] = [t for t in history if now - t < RATE_LIMIT_WINDOW_SECONDS]
    if len(_ip_requests[ip]) >= RATE_LIMIT_MAX_REQUESTS:
        return True
    _ip_requests[ip].append(now)
    return False


def format_uptime(seconds_elapsed: int) -> str:
    days = seconds_elapsed // 86400
    hours = (seconds_elapsed % 86400) // 3600
    minutes = (seconds_elapsed % 3600) // 60
    secs = seconds_elapsed % 60
    if days:
        return f"{days}j {hours}h {minutes}m {secs}s"
    if hours:
        return f"{hours}h {minutes}m {secs}s"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def send_discord_payload(payload: dict, timeout: int = 10) -> bool:
    if not DISCORD_WEBHOOK_URL:
        return False
    try:
        req = urllib.request.Request(
            DISCORD_WEBHOOK_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "User-Agent": "AssistantParapente-Server/1.0",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status in (200, 204)
    except Exception as e:
        print(f"[WARN] Envoi Discord échoué: {e}", file=sys.stderr)
        return False


def notify_startup():
    if not DISCORD_WEBHOOK_URL or os.environ.get("NOTIFY_ON_START", "true").lower() not in ("true", "1", "yes"):
        return
    payload = {
        "username": "Assistant Parapente",
        "avatar_url": "https://assistantparapente.fr/img/logos/logo-192.png",
        "embeds": [
            {
                "title": "🟢 Service Backend Démarré",
                "description": f"Le microservice de retours et télémétrie tourne sur le Raspberry Pi.\n**Port** : `{PORT}` | **PID** : `{os.getpid()}`",
                "color": 0x16A34A,
                "footer": {"text": "Assistant Parapente • Surveillance système"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    send_discord_payload(payload, timeout=5)


class FeedbackHandler(http.server.BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")
        self.end_headers()

    def do_GET(self):
        clean_path = self.path.split("?")[0].rstrip("/") or "/"
        if clean_path in ("/api/health", "/api/feedback", "/health", "/"):
            uptime_secs = int(time.time() - SERVER_START_TIME)
            self._send_json(200, {
                "status": "healthy",
                "service": "Assistant Parapente Backend",
                "version": "1.0.0",
                "uptime_seconds": uptime_secs,
                "uptime": format_uptime(uptime_secs),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            return
        self._send_json(404, {"success": False, "message": "Route introuvable"})

    def do_POST(self):
        clean_path = self.path.split("?")[0].rstrip("/") or "/"
        if clean_path not in ("/api/feedback", "/api/crash", "/api/health", "/"):
            self._send_json(404, {"success": False, "message": "Route introuvable"})
            return

        client_ip = (
            self.headers.get("CF-Connecting-IP")
            or self.headers.get("X-Real-IP")
            or (self.headers.get("X-Forwarded-For", "").split(",")[0].strip())
            or self.client_address[0]
        )

        if is_rate_limited(client_ip):
            self._send_json(429, {"success": False, "message": "Trop de requêtes. Veuillez patienter."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0 or content_length > 65536:
                self._send_json(400, {"success": False, "message": "Charge utile invalide ou trop volumineuse."})
                return

            raw_body = self.rfile.read(content_length).decode("utf-8")
            body = json.loads(raw_body)

            # Honeypot anti-spam : si botcheck est renseigné, valider silencieusement sans notifier
            if body.get("botcheck"):
                self._send_json(200, {"success": True, "message": "OK"})
                return

            cat = str(body.get("category", "other"))[:32]
            label = str(body.get("categoryLabel") or cat)[:64]
            subject = str(body.get("subject") or "").strip()[:120] or "Sans objet"
            description = str(body.get("description") or "").strip()[:3500]
            contact = str(body.get("contact") or "").strip()[:120] or "Non renseigné"
            ctx = body.get("context") if isinstance(body.get("context"), dict) else {}

            if not description or len(description) < 5:
                self._send_json(400, {"success": False, "message": "Description trop courte."})
                return

            # Sauvegarde locale JSON horodatée
            timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
            target_dir = CRASHES_DIR if cat == "crash" else LOGS_DIR
            log_file = target_dir / f"{timestamp_str}_{cat}.json"
            try:
                with open(log_file, "w", encoding="utf-8") as f:
                    json.dump(
                        {
                            "received_at": datetime.now(timezone.utc).isoformat(),
                            "ip": client_ip,
                            "payload": body,
                        },
                        f,
                        ensure_ascii=False,
                        indent=2,
                    )
            except Exception as e:
                print(f"[WARN] Erreur écriture log local: {e}", file=sys.stderr)

            # Envoi vers Discord Webhook
            if DISCORD_WEBHOOK_URL:
                emoji = EMOJIS.get(cat, "💬")
                color = COLORS.get(cat, 0x6B7280)

                fields = []
                if cat == "crash":
                    # Spécifique crash JS
                    embed_title = f"🚨 Crash Client JS — {subject}"
                    fields.append({"name": "🏷️ Type", "value": "Télémétrie d'erreur automatique", "inline": True})
                    if body.get("location"):
                        fields.append({"name": "📍 Emplacement", "value": f"`{str(body.get('location'))[:120]}`", "inline": True})
                    embed_desc = f"```javascript\n{description[:2000]}\n```"
                    footer_text = "Assistant Parapente • Alerte Crash JS"
                else:
                    embed_title = f"{emoji} {label} — {subject}"
                    fields.append({"name": "👤 Contact", "value": contact, "inline": True})
                    fields.append({"name": "🏷️ Catégorie", "value": f"{emoji} {label}", "inline": True})
                    embed_desc = description
                    footer_text = "Assistant Parapente • Retour pilote en direct"

                if ctx:
                    tech_lines = [
                        f"**Version**: `{ctx.get('version', 'inconnue')}` | **Écran**: `{ctx.get('screen', '?')}`",
                        f"**Navigateur**: {ctx.get('runtime', '?')} ({ctx.get('viewport', '?')}) | **Réseau**: {ctx.get('network', '?')}",
                    ]
                    if ctx.get("detail"):
                        tech_lines.append(f"**Élément actif**: `{ctx.get('detail')}`")
                    fields.append(
                        {
                            "name": "📱 Contexte technique",
                            "value": "\n".join(tech_lines),
                            "inline": False,
                        }
                    )

                discord_payload = {
                    "username": "Assistant Parapente",
                    "avatar_url": "https://assistantparapente.fr/img/logos/logo-192.png",
                    "embeds": [
                        {
                            "title": embed_title,
                            "description": embed_desc,
                            "color": color,
                            "fields": fields,
                            "footer": {"text": footer_text},
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    ],
                }

                send_discord_payload(discord_payload)

            self._send_json(200, {"success": True, "message": "Signalement transmis avec succès."})

        except json.JSONDecodeError:
            self._send_json(400, {"success": False, "message": "JSON invalide."})
        except Exception as e:
            print(f"[ERR] Erreur traitement feedback: {e}", file=sys.stderr)
            self._send_json(500, {"success": False, "message": f"Erreur serveur: {e}"})


if __name__ == "__main__":
    if not DISCORD_WEBHOOK_URL:
        print("[AVERTISSEMENT] DISCORD_WEBHOOK_URL n'est pas configuré dans .env !", file=sys.stderr)

    notify_startup()

    server = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), FeedbackHandler)
    print(f"Serveur feedback démarré sur http://0.0.0.0:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
        server.server_close()
