# 🌺 Ukulélé Facile

Une application web pour apprendre le ukulélé **en partant de zéro**, sans solfège.
Elle est faite pour être posée devant soi (tablette, ordi, téléphone) pendant qu'on joue.

## Ce qu'elle fait

| Page | À quoi ça sert |
|---|---|
| 📚 **Leçons** | 11 leçons courtes, dans l'ordre : tenir le ukulélé, les cordes, accorder, gratter, premiers accords (C, Am, F, G7, G), rythmes, tablature, routine. Les accords appris sont mémorisés. |
| 🎤 **Chansons** | Lecteur synchronisé : **accord actuel** en grand + **accord suivant** (« Prépare-toi ! »), compteur de temps, flèches de grattage qui s'allument, paroles qui défilent, accord affiché sur le manche. Vitesse réglable (40 à 130 %), métronome, le ukulélé qui joue en même temps, mode **pas-à-pas**, répétition d'une ligne, transposition. |
| ✍️ **Ajouter une chanson** | Le « traducteur » : on colle les accords d'une chanson trouvée sur internet (format « accords au-dessus des paroles » ou `[C]paroles`, noms anglais ou français `Lam`, `Sol7`…). L'outil reconnaît les accords, dessine les diagrammes, signale les accords difficiles, et peut **transposer automatiquement vers des accords plus faciles** ou simplifier (`Cmaj7 → C`). |
| 🖐️ **Accords** | Dictionnaire avec diagrammes, doigtés (couleur par doigt), son, positions alternatives. Les accords absents du dictionnaire sont calculés automatiquement. |
| 🎸 **Manche** | Manche interactif : clic = son + nom de la note, gammes, notes d'un accord. |
| 🥁 **Rythmes** | 8 rythmes de grattage avec métronome et exemple sonore. |
| 🎼 **Mélodies** | Tablature animée note par note (Frère Jacques, Au clair de la lune…), avec un mode **🎤 « J'attends ta note »** qui écoute au micro. |
| 🔁 **Entraînement** | Enchaînements d'accords au tempo (l'exercice le plus utile) + quiz « trouve la note sur le manche ». |
| 🎚️ **Accordeur** | Au micro, ou à l'oreille avec des sons de référence. |

Tout est en local dans le navigateur (pas de compte, pas de base de données). La progression et les
chansons ajoutées sont stockées dans le navigateur, avec export/import dans **Réglages**.
L'appli fonctionne aussi hors ligne et peut être « ajoutée à l'écran d'accueil » d'une tablette.

Les chansons fournies sont traditionnelles ou du domaine public. Pour les autres chansons, on colle soi-même
les accords trouvés sur internet (usage personnel).

## Structure

```
ukulele/
├── docker-compose.yml   # conteneur nginx (port 8095)
├── nginx.conf
└── app/                 # le site (HTML/CSS/JS, aucune compilation nécessaire)
    ├── index.html
    ├── css/style.css
    └── js/              # app.js (pages), player.js (lecteur), parser.js (traducteur),
                         # chords.js (dictionnaire), audio.js (son, métronome, micro), ...
```

Pour ajouter une chanson « officielle » au carnet, l'éditer dans `app/js/songs.js` (format ChordPro, `[C:2]` = 2 temps).

## Déploiement sur le NAS (Synology DS218)

1. **Récupérer le code** sur le NAS (SSH), par exemple dans `/volume1/docker/` :
   ```bash
   cd /volume1/docker
   git clone https://github.com/MaxSandman/homelab.git
   cd homelab/ukulele
   ```
2. **Lancer le conteneur**, au choix :
   - en SSH : `sudo docker compose up -d` (ou `sudo docker-compose up -d` selon la version de DSM)
   - ou dans **Portainer** → *Stacks* → *Add stack* → coller le contenu de `docker-compose.yml`,
     en remplaçant `./app` et `./nginx.conf` par les chemins complets
     (`/volume1/docker/homelab/ukulele/app`, etc.)
3. Ouvrir **http://192.168.1.10:8095** (ou `http://maxsandman.synology.me:8095` depuis l'extérieur si le port est redirigé sur la box).

**Mise à jour** : `git pull` dans le dossier, c'est tout (nginx sert directement les fichiers, pas besoin de redémarrer).

## Activer le micro (accordeur + mode « J'attends ta note ») : HTTPS

Les navigateurs n'autorisent le micro que sur une adresse **https://** (ou `localhost`).
Tout le reste de l'appli fonctionne en http. Le plus simple, avec le certificat déjà présent sur le NAS :

**DSM → Panneau de configuration → Portail de connexion → Avancé → Proxy inversé → Créer**
- Source : protocole `HTTPS`, nom d'hôte `maxsandman.synology.me`, port `8443`
- Destination : protocole `HTTP`, nom d'hôte `localhost`, port `8095`

Puis ouvrir **https://maxsandman.synology.me:8443** (redirection du port 8443 sur la box pour un accès extérieur).
Alternative : créer un *Proxy Host* équivalent dans Nginx Proxy Manager avec un certificat Let's Encrypt.

## Tester en local (sans Docker)

```bash
cd ukulele/app
python3 -m http.server 8000
```
puis ouvrir http://localhost:8000 (le micro fonctionne sur `localhost`).
