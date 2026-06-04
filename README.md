# Homelab

Configuration du dashboard Homepage pour NAS Synology DS218.

## Structure

```
homepage/config/
├── settings.yaml   # Thème, layout, titre
├── services.yaml   # Liste des services
├── bookmarks.yaml  # Liens rapides
├── widgets.yaml    # Widgets globaux (CPU, RAM, recherche)
└── docker.yaml     # Intégration Docker (vide pour l'instant)
```

## Déploiement

Sur le NAS, dans le dossier de config Homepage :

```bash
git pull origin main
```

Homepage recharge les YAML automatiquement.
