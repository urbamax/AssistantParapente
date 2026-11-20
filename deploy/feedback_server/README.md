# Service de Notification Discord pour les Retours Pilotes

Ce micro-service autonome tourne sur le Raspberry Pi en tâche de fond. Il écoute les requêtes `POST /api/feedback` envoyées depuis le site web et les transmet instantanément sous forme de cartes riches (embeds) sur votre salon Discord privé.

## 1. Configuration rapide

Sur votre Raspberry Pi :

```bash
cd ~/AssistantParapente-public/deploy/feedback_server
cp .env.example .env
nano .env
```

Vérifiez que votre URL de Webhook Discord est bien présente dans `.env` :
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/1573285229035257947/kis320fw9kChtR3I3bJzzcGCkq9H2H-dB9btInwjfP360wJmtk97nhFQ9QMqwBWeM-Gd
PORT=8085
```

## 2. Tester en direct

```bash
python3 server.py
```
Le serveur affiche : `Serveur feedback démarré sur http://0.0.0.0:8085`.
Faites un test depuis votre navigateur ou via curl :
```bash
curl -X POST http://127.0.0.1:8085/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"category":"suggestion","categoryLabel":"Suggestion","subject":"Super idée","description":"Ceci est un premier test réel.","contact":"Pilote test"}'
```
Une notification doit s'afficher immédiatement sur votre Discord.

## 3. Installer en service d'arrière-plan (Systemd)

Pour que le service tourne en continu et redémarre tout seul au reboot du Raspberry Pi :

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

## 4. Recharger Nginx

Sur le Pi, appliquez la mise à jour de configuration Nginx :
```bash
cd ~/AssistantParapente-public
cp deploy/nginx/assistant-parapente.conf ~/assistant-parapente-nginx.conf
docker exec assistant-parapente nginx -t && docker exec assistant-parapente nginx -s reload
```
