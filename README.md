# Homelab

Configuration du dashboard Homepage pour NAS Synology DS218.

L'application « Ukulélé Facile » (tuile *Perso* du Homepage, port 8095) vit dans son propre dépôt : [MaxSandman/yukulele](https://github.com/MaxSandman/yukulele).

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
