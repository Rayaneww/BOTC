# Design Spec — Refonte nuit & UX joueurs

**Date :** 2026-03-28
**Statut :** Approuvé

---

## Contexte

Après tests de l'application, 5 problèmes identifiés :
1. Le système de vote n'est pas utilisé (se fait à l'oral).
2. L'Empoisonneur et le Diablotin doivent être appelés en premier la nuit, ce qui révèle leur rôle à tous (l'appel est visible sur l'écran partagé du conteur).
3. Il n'y a pas d'écran "fermez les yeux" au début de la nuit.
4. Le rôle s'affiche trop librement — les joueurs peuvent le montrer à d'autres.
5. La table ronde n'est visible que pour le conteur, pas pour les joueurs.

---

## Changement 1 — Suppression du système de vote

### Ce qui est supprimé
**Backend (`socket.ts`) :**
- Actions host : `start_meeting`, `nominate_player`, `remove_nomination`, `start_voting`, `end_voting`, `confirm_elimination`, `end_meeting_no_vote`
- Event player : `cast_vote`
- Auto-démarrage de meeting lors du passage en phase nuit (`change_phase`)

**Backend (`MeetingService.ts`) :** fichier entier supprimé.

**Frontend host (`host/[code]/page.tsx`) :**
- Tout le bloc UI de nomination/vote/résultats
- États : `meetingStatus`, `nominatedPlayers`, `voteCount`, `votingResults`
- Listeners socket : `meeting_started`, `nominations_updated`, `voting_started`, `vote_cast`, `voting_results`, `player_eliminated`, `meeting_ended`

**Frontend player (`play/[code]/page.tsx`) :**
- Modal "Réunion du Village"
- Boutons de vote et vote blanc
- États : `meetingStatus`, `hasVoted`, `myVote`, `nominatedPlayers`

### Ce qui reste
- Action host `set_alive` → le conteur marque manuellement les joueurs comme morts.
- `night_call` / `night_call_end` → conservés, utilisés pour le nouveau système nuit.

---

## Changement 2 — Rôle affiché une seule fois

### Comportement
- Au démarrage de la partie, le rôle s'affiche dans un **modal simple** (sans animation) : nom du rôle, type, description, numéro de siège.
- Un bouton **"J'ai mémorisé mon rôle"** ferme le modal.
- Une fois fermé, le modal **ne peut plus être rouvert**.
- L'onglet "Rôle" dans la vue joueur est remplacé par un message statique :
  *"Votre rôle a été mémorisé. Si vous l'avez oublié, demandez au Maître du Jeu."*

### Implémentation
- `RoleReveal.tsx` : supprimer les animations, garder uniquement l'affichage statique avec le bouton de confirmation.
- `play/[code]/page.tsx` : gérer l'état `roleRevealed` (boolean). Une fois `true`, ne plus jamais afficher le modal. Ne pas persister en localStorage (si la page est rechargée, le joueur perd son rôle — il doit demander au MJ).

---

## Changement 3 — Table ronde pour les joueurs

### Comportement
- Ajout d'un onglet **"Table"** dans la vue joueur (`play/[code]/page.tsx`).
- Utilise le composant `SeatMap` existant.
- `showRoles={false}` : pas de couleurs par type de rôle (confidentialité).
- Affiche uniquement les pseudos, numéros de sièges, et statut vivant/mort.

### Données nécessaires
- `players` (liste publique) déjà disponible via `lobby_update` / `request_state`.

---

## Changement 4 — Écran "Fermez les yeux" + Actions nocturnes sur téléphone

### Vue d'ensemble du flux nuit

```
Host passe en nuit
  → tous les joueurs : écran plein écran "🌙 Fermez les yeux"
  → host : dashboard nuit avec liste des rôles à appeler

Host fait night_call(playerId)
  → joueur ciblé : écran "yeux fermés" se lève → UI d'action nocturne
  → autres joueurs : rien ne change (yeux toujours fermés)

Joueur soumet son action (submit_night_action)
  → host : voit le résultat dans le dashboard nuit
  → joueur : confirmation visuelle

Host fait night_call_end(playerId)
  → joueur : retour à l'écran "yeux fermés"

Fin de nuit (host change phase → jour)
  → tous les joueurs : écran "yeux fermés" disparaît
```

---

### Socket events (nouveaux)

#### `submit_night_action` — émis par le joueur

```typescript
// Payload
{
  actionType: 'choose_target' | 'choose_two' | 'choose_master',
  targetId: string,       // pour choose_target / choose_master
  targetIds: string[],    // pour choose_two (Voyante)
}

// Réponse au joueur
socket.emit('night_action_confirmed', { actionType, targetId?, targetIds? })

// Broadcast au host uniquement (room host-${gameCode})
io.to(`host-${gameCode}`).emit('night_action_received', {
  playerId,
  playerPseudo,
  roleName,
  actionType,
  targetId?,
  targetIds?,
  targetPseudo?,   // résolu côté serveur
  targetPseudos?,  // pour choose_two
})
```

#### `send_night_info` — émis par le host

```typescript
// Payload (host → serveur → joueur)
{
  playerId: string,
  info: string,    // texte libre que le conteur tape
}

// Envoyé au joueur ciblé
socket.emit('night_info_received', { info })
```

---

### UI d'action nocturne par rôle (vue joueur)

| Rôle | actionType | UI |
|------|------------|----|
| Diablotin | `choose_target` | Liste des joueurs vivants (sauf soi-même) — 1 à sélectionner |
| Empoisonneur | `choose_target` | Liste des joueurs vivants — 1 à sélectionner |
| Moine | `choose_target` | Liste des joueurs vivants (sauf soi-même) — 1 à sélectionner |
| Voyante | `choose_two` | Liste de tous les joueurs — 2 à sélectionner |
| Majordome | `choose_master` | Liste des joueurs vivants (sauf soi-même) — 1 à sélectionner |
| Archiviste, Enquêteur, Lavandière, Cuistot, Empathe, Fossoyeur | — | *"En attente d'information du MJ…"* puis affichage de `night_info_received` |

---

### Dashboard nuit (vue host)

Quand la phase est `night`, le conteur voit :
- **Liste des rôles à appeler** (avec bouton "Appeler" / "Terminer l'appel" par joueur)
- **Zone résultats** : affiche en temps réel les `night_action_received` reçus (pseudo + rôle + cible choisie)
- **Pour les rôles info-receivers** : champ texte + bouton "Envoyer l'info" → émet `send_night_info`

---

### Validation backend (`socket.ts`)

Lors de `submit_night_action` :
- Vérifier que le joueur est bien en `night_call` actif (optionnel, peut être omis en v1)
- Vérifier que `targetId` correspond à un joueur vivant dans la partie
- Pour `choose_two` : vérifier que 2 IDs distincts sont fournis
- Résoudre le pseudo de la cible côté serveur avant de relayer au host

---

## Rôles sans action nocturne (non appelés la nuit)

Baron, Femme Écarlate, Pourfendeur, Soldat, Vierge, Ivrogne, Reclus, Saint, Maire — aucune UI nocturne, le conteur ne les appelle pas.

---

## Fichiers impactés

| Fichier | Changement |
|---------|-----------|
| `backend/src/socket.ts` | Supprimer vote, ajouter `submit_night_action` et `send_night_info` |
| `backend/src/services/MeetingService.ts` | **Supprimer** |
| `frontend/src/app/host/[code]/page.tsx` | Supprimer UI vote, ajouter dashboard nuit |
| `frontend/src/app/play/[code]/page.tsx` | Écran yeux fermés, UI actions nuit, onglet Table, rôle une seule fois |
| `frontend/src/components/RoleReveal.tsx` | Supprimer animations, garder affichage simple + bouton confirmation |
