# ISSATKR Présence — Déploiement

## Démarrage rapide

```bash
cp .env.example .env
# Modifier AUTH_SECRET et mots de passe

npm install
npm run db:setup    # migrations + comptes configurés dans .env
npm run dev
```

Définissez dans `.env` un mot de passe administrateur d’au moins 8 caractères.
Le compte professeur initial est optionnel ; les autres comptes se créent dans
le panneau administrateur.

## Utilisation

### Admin
1. **Classes & étudiants** — importer le fichier scolarité XLS/XLSX (une feuille = une classe), ou créer/modifier manuellement les classes et étudiants
2. **Matières & niveaux** — créer les référentiels avant la planification
3. **Utilisateurs** — gérer les administrateurs, chefs de département et enseignants
4. **Emploi du temps** — créer les séances ou importer (`classe, code, date, heure_debut, enseignant_email`)
5. **Absences** — corriger un pointage ou ajouter un justificatif
6. **Éliminés / Rapports** — consulter par matière/niveau et exporter en CSV
7. **Notifications** — suivre les emails envoyés, en attente ou en échec
8. **Paramètres** — définir le seuil pour chaque couple matière × niveau

Fichiers exemple : `docs/samples/`

### Professeur
1. **Classes** → choisir la classe → ouvrir la séance du jour
2. **Présent / Absent** → Enregistrer
3. **Éliminés** — liste des étudiants au seuil
4. **Rapports** — tableau + export CSV

Une séance finalisée est en lecture seule pour l’enseignant. L’administration
reste seule autorisée à la corriger et à ajouter un justificatif.

### Chef de département
Le chef conserve sa vue enseignant et peut créer, modifier, supprimer ou
importer toutes les séances depuis **Emploi du temps**.

### Étudiant
Il n’existe pas de compte étudiant en V1. L’historique individuel est visible
par l’administration et l’adresse email importée reçoit les alertes.

## Production

```bash
npm run build
npm start
```

Variables obligatoires :
- `DATABASE_URL` — SQLite sur un volume persistant (`file:./prod.db`)
- `AUTH_SECRET` — secret fort (32+ caractères)
- `ADMIN_EMAIL`, `ADMIN_PASSWORD`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`
- `SMTP_USER`, `SMTP_PASSWORD` si le serveur impose une authentification
- `CRON_SECRET` — secret de la relance des emails

Variables optionnelles du compte professeur initial :
- `PROF_EMAIL`, `PROF_PASSWORD`

Pour PostgreSQL, changez le provider dans `prisma/schema.prisma`, créez une
nouvelle migration et testez-la avant le déploiement. Une URL PostgreSQL seule
ne fonctionne pas avec le schéma SQLite actuel.

## Emails et relance

Le pointage et les corrections recalculent immédiatement les absences non
justifiées par matière et niveau :

- avertissement à `seuil - 1` ;
- élimination au seuil ;
- aucune duplication si une séance est enregistrée deux fois ;
- une correction sous le seuil réinitialise le cycle d’alerte.

Planifier régulièrement la relance des emails échoués :

```bash
curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://votre-domaine/api/cron/notifications
```

Pour un test local sans serveur SMTP, définir `SMTP_TRANSPORT=json` et
`SMTP_FROM=absence@issatkr.tn`.

## Docker (optionnel)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

Persister le fichier SQLite défini dans `DATABASE_URL` ou migrer vers
PostgreSQL avant un déploiement multi-instance.
