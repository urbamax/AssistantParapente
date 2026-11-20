#!/usr/bin/env python3
"""
Serveur de réception des retours, télémétrie des crashs et health check Assistant Parapente.
100% Python standard (aucune dépendance tierce requise).
"""
import http.server
import json
import os
import secrets
import sys
import threading
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

DEFAULT_HOST = "127.0.0.1"
HOST = os.environ.get("HOST", DEFAULT_HOST)
PORT = int(os.environ.get("PORT", 8085))
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://assistantparapente.fr")
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "")
AVATAR_URL = "https://assistantparapente.fr/img/icons/icon-192x192.png"
REQUEST_TIMEOUT_SECONDS = 10

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

TRUSTED_PROXIES = frozenset({"127.0.0.1", "::1"})

# Limiteur de débit en mémoire borné et thread-safe (max 10 requêtes par 10 minutes par IP)
RATE_LIMIT_WINDOW_SECONDS = 600
RATE_LIMIT_MAX_REQUESTS = 10
RATE_LIMIT_MAX_KEYS = 10000
_ip_requests = {}
_rate_limit_lock = threading.Lock()
_prune_lock = threading.Lock()
_REQUEST_SEMAPHORE = threading.BoundedSemaphore(16)
CONTEXT_ALLOWED_KEYS = frozenset({"version", "screen", "runtime", "viewport", "network", "detail"})


def sanitize_context(raw_ctx) -> dict:
    """Filtre et tronque les clés du contexte technique avant stockage disque et envoi Discord."""
    if not isinstance(raw_ctx, dict):
        return {}
    clean_ctx = {}
    for key in CONTEXT_ALLOWED_KEYS:
        val = raw_ctx.get(key)
        if val is not None:
            clean_ctx[key] = str(val)[:160]
    return clean_ctx


def sanitize_category(raw) -> str:
    """Restreint la catégorie à la liste blanche connue (prévient toute traversée de chemin)."""
    if not isinstance(raw, str):
        return "other"
    cleaned = raw.strip().lower()
    for allowed in COLORS:
        if cleaned == allowed:
            return allowed
    return "other"


def prune_old_logs(directory: Path, max_files: int = 200) -> None:
    """Limite le nombre de fichiers JSON conservés sur disque pour éviter toute saturation de la carte SD."""
    with _prune_lock:
        try:
            files = sorted(directory.glob("*.json"), key=lambda p: p.stat().st_mtime)
            for old_file in files[:-max_files]:
                old_file.unlink(missing_ok=True)
        except Exception:
            pass


def resolve_client_ip(headers, remote_addr: str) -> str:
    """Ne fait confiance aux en-têtes proxy (Cloudflare/Nginx) que depuis un proxy local (loopback)."""
    if remote_addr in TRUSTED_PROXIES and headers is not None:
        cf_ip = headers.get("CF-Connecting-IP")
        if cf_ip:
            return cf_ip.strip()
        real_ip = headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        xff = headers.get("X-Forwarded-For", "")
        if xff:
            first = xff.split(",")[0].strip()
            if first:
                return first
    return remote_addr


def is_rate_limited(ip: str) -> bool:
    now = time.time()
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    with _rate_limit_lock:
        # Purge des entrées expirées pour éviter toute fuite mémoire
        expired = [k for k, ts_list in _ip_requests.items() if not ts_list or ts_list[-1] <= cutoff]
        for k in expired:
            del _ip_requests[k]

        if ip not in _ip_requests and len(_ip_requests) >= RATE_LIMIT_MAX_KEYS:
            # Éviction de l'entrée la plus ancienne si la table est pleine
            oldest_key = min(_ip_requests, key=lambda k: _ip_requests[k][-1])
            del _ip_requests[oldest_key]

        history = [t for t in _ip_requests.get(ip, []) if t > cutoff]
        if len(history) >= RATE_LIMIT_MAX_REQUESTS:
            _ip_requests[ip] = history
            return True
        history.append(now)
        _ip_requests[ip] = history
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


def _safe_inline(value, max_len: int = 120) -> str:
    text = str(value if value is not None else "?").replace("`", "'").replace("\r", " ").replace("\n", " ").strip()
    return text[:max_len] or "?"


def _safe_codeblock(value: str, max_len: int = 2000) -> str:
    # Empêche toute sortie du bloc ```javascript ... ```
    return value.replace("```", "'''")[:max_len]


def build_discord_payload(
    *,
    cat: str,
    label: str,
    subject: str,
    description: str,
    contact: str,
    location: str = "",
    ctx: dict | None = None,
) -> dict:
    emoji = EMOJIS.get(cat, "💬")
    color = COLORS.get(cat, 0x6B7280)

    fields = []
    if cat == "crash":
        embed_title = f"🚨 Crash Client JS — {subject}"[:256]
        fields.append({"name": "🏷️ Type", "value": "Télémétrie d'erreur automatique", "inline": True})
        if location:
            fields.append({"name": "📍 Emplacement", "value": f"`{_safe_inline(location, 120)}`", "inline": True})
        embed_desc = f"```javascript\n{_safe_codeblock(description, 2000)}\n```"
        footer_text = "Assistant Parapente • Alerte Crash JS"
    else:
        embed_title = f"{emoji} {label} — {subject}"[:256]
        fields.append({"name": "👤 Contact", "value": contact[:256], "inline": True})
        fields.append({"name": "🏷️ Catégorie", "value": f"{emoji} {label}"[:256], "inline": True})
        embed_desc = description[:3500]
        footer_text = "Assistant Parapente • Retour pilote en direct"

    if ctx:
        tech_lines = [
            f"**Version**: `{_safe_inline(ctx.get('version', 'inconnue'), 64)}` | **Écran**: `{_safe_inline(ctx.get('screen', '?'), 64)}`",
            f"**Navigateur**: {_safe_inline(ctx.get('runtime', '?'), 80)} ({_safe_inline(ctx.get('viewport', '?'), 32)}) | **Réseau**: {_safe_inline(ctx.get('network', '?'), 32)}",
        ]
        if ctx.get("detail"):
            tech_lines.append(f"**Élément actif**: `{_safe_inline(ctx.get('detail'), 120)}`")
        fields.append(
            {
                "name": "📱 Contexte technique",
                "value": "\n".join(tech_lines)[:1024],
                "inline": False,
            }
        )

    return {
        "username": "Assistant Parapente",
        "avatar_url": AVATAR_URL,
        "allowed_mentions": {"parse": []},
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
        "avatar_url": AVATAR_URL,
        "allowed_mentions": {"parse": []},
        "embeds": [
            {
                "title": "🟢 Service Backend Démarré",
                "description": f"Le microservice de retours et télémétrie tourne sur le Raspberry Pi.\n**Hôte** : `{HOST}:{PORT}` | **PID** : `{os.getpid()}`",
                "color": 0x16A34A,
                "footer": {"text": "Assistant Parapente • Surveillance système"},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    send_discord_payload(payload, timeout=5)


class FeedbackHandler(http.server.BaseHTTPRequestHandler):
    def setup(self):
        super().setup()
        self.request.settimeout(REQUEST_TIMEOUT_SECONDS)

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Accept")

    def _send_json(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-store")
        self._send_cors_headers()
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
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
        if clean_path not in ("/api/feedback", "/api/crash", "/"):
            self._send_json(404, {"success": False, "message": "Route introuvable"})
            return

        content_type = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if content_type != "application/json":
            self._send_json(415, {"success": False, "message": "Content-Type application/json requis."})
            return

        if not _REQUEST_SEMAPHORE.acquire(blocking=False):
            self._send_json(503, {"success": False, "message": "Serveur temporairement saturé."})
            return

        try:
            client_ip = resolve_client_ip(self.headers, self.client_address[0])

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
                if not isinstance(body, dict):
                    self._send_json(400, {"success": False, "message": "Charge utile JSON attendue."})
                    return

                # Honeypot anti-spam : si botcheck est renseigné, valider silencieusement sans notifier
                if body.get("botcheck"):
                    self._send_json(200, {"success": True, "message": "OK"})
                    return

                cat = "crash" if clean_path == "/api/crash" else sanitize_category(body.get("category", "other"))
                label = str(body.get("categoryLabel") or cat)[:64]
                subject = str(body.get("subject") or "").strip()[:120] or "Sans objet"
                description = str(body.get("description") or "").strip()[:3500]
                contact = str(body.get("contact") or "").strip()[:120] or "Non renseigné"
                location = str(body.get("location") or "").strip()[:120]
                ctx = sanitize_context(body.get("context"))

                if not description or len(description) < 5:
                    self._send_json(400, {"success": False, "message": "Description trop courte."})
                    return

                # Sauvegarde locale JSON horodatée (sans IP brute pour conformité RGPD)
                timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
                target_dir = CRASHES_DIR if cat == "crash" else LOGS_DIR
                base_dir = os.path.realpath(target_dir)
                filename = f"{timestamp_str}_{cat}_{secrets.token_hex(4)}.json"
                log_path = os.path.realpath(os.path.join(base_dir, filename))
                try:
                    if not log_path.startswith(base_dir + os.sep):
                        raise ValueError("Chemin de log hors du répertoire autorisé")
                    with open(log_path, "w", encoding="utf-8") as f:
                        json.dump(
                            {
                                "received_at": datetime.now(timezone.utc).isoformat(),
                                "category": cat,
                                "payload": {
                                    "category": cat,
                                    "categoryLabel": label,
                                    "subject": subject,
                                    "description": description,
                                    "contact": contact,
                                    "location": location,
                                    "context": ctx,
                                },
                            },
                            f,
                            ensure_ascii=False,
                            indent=2,
                        )
                    prune_old_logs(target_dir)
                except Exception as e:
                    print(f"[WARN] Erreur écriture log local: {e}", file=sys.stderr)

                # Envoi vers Discord Webhook
                if DISCORD_WEBHOOK_URL:
                    discord_payload = build_discord_payload(
                        cat=cat,
                        label=label,
                        subject=subject,
                        description=description,
                        contact=contact,
                        location=location,
                        ctx=ctx,
                    )
                    send_discord_payload(discord_payload)

                self._send_json(200, {"success": True, "message": "Signalement transmis avec succès."})

            except (json.JSONDecodeError, ValueError, UnicodeDecodeError):
                self._send_json(400, {"success": False, "message": "JSON invalide."})
            except Exception as e:
                print(f"[ERR] Erreur traitement feedback: {e}", file=sys.stderr)
                self._send_json(500, {"success": False, "message": "Erreur interne du serveur."})
        finally:
            _REQUEST_SEMAPHORE.release()


class BoundedThreadingHTTPServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    if not DISCORD_WEBHOOK_URL:
        print("[AVERTISSEMENT] DISCORD_WEBHOOK_URL n'est pas configuré dans .env !", file=sys.stderr)

    notify_startup()

    server = BoundedThreadingHTTPServer((HOST, PORT), FeedbackHandler)
    print(f"Serveur feedback démarré sur http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du serveur.")
        server.server_close()
