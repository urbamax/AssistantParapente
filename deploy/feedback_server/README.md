# Service de Notification Discord pour les Retours Pilotes & Télémétrie

Ce micro-service autonome tourne sur le Raspberry Pi en tâche de fond. Il assure trois rôles essentiels :
1. **Retours pilotes** : Écoute `POST /api/feedback` envoyé depuis la modale et transmet les fiches sous forme d'embeds colorés sur Discord.
2. **Télémétrie des crashs** : Écoute les erreurs JS non gérées (`category: "crash"`) et envoie une alerte rouge immédiate sur Discord avec stack trace et contexte.
3. **Health Check & Uptime** : Répond à `GET /api/health` (et `GET /api/feedback`) avec un JSON de santé pour les outils de surveillance 24/7 (UptimeRobot, BetterStack, etc.).

## 1. Configuration rapide

Sur votre Raspberry Pi :

```bash
cd ~/AssistantParapente/deploy/feedback_server
cp .env.example .env
nano .env
```

Variables disponibles dans `.env` :
```env
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
HOST=127.0.0.1
PORT=8085
ALLOWED_ORIGIN=https://assistantparapente.fr
NOTIFY_ON_START=true
```

## 2. Tester le service en direct

```bash
python3 server.py
```
Le serveur affiche : `Serveur feedback démarré sur http://127.0.0.1:8085`.

### Tester le Health Check :
```bash
curl http://127.0.0.1:8085/api/health
```
Réponse attendue :
```json
{
  "status": "healthy",
  "service": "Assistant Parapente Backend",
  "version": "1.0.0",
  "uptime_seconds": 12,
  "uptime": "12s",
  "timestamp": "2026-11-20T12:00:00+00:00"
}
```

### Tester l'envoi de feedback :
```bash
curl -X POST http://127.0.0.1:8085/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"category":"suggestion","categoryLabel":"Suggestion","subject":"Super idée","description":"Ceci est un test réel.","contact":"Pilote test"}'
```

### Tester une alerte de crash :
```bash
curl -X POST http://127.0.0.1:8085/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"category":"crash","subject":"TypeError in test","description":"TypeError: boom\n    at render (test.js:1:1)","location":"test.js:1:1"}'
```

## 3. Installer en service d'arrière-plan (Systemd)

Pour que le service tourne en continu et redémarre automatiquement au boot :

```bash
sudo cp assistant-parapente-feedback.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now assistant-parapente-feedback
```

Vérifier le statut :
```bash
sudo systemctl status assistant-parapente-feedback
```

Pour voir les logs en direct :
```bash
journalctl -u assistant-parapente-feedback -f
```
