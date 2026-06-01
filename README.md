# Twitch Ad Stream Keeper

Pendant une pub Twitch (mid-roll), le stream continue dans un petit lecteur
preview muté en haut à droite. Cette extension détecte la pub, **démute ce
preview** et **mute le lecteur principal** (qui joue la pub) sur l'onglet
courant : tu n'entends plus que le son du stream. Le preview garde sa taille et
sa position d'origine. À la fin de la pub, les états mute sont restaurés.

Aucun PiP, aucun clic, aucune API privilégiée → pas de background script.
(Firefox n'expose de toute façon pas l'API JS Picture-in-Picture.)

> La pub n'est jamais bloquée ni skippée : elle se joue jusqu'au bout (mutée),
> donc l'impression reste comptabilisée pour le streamer.

Un **pre-roll** (pub avant le démarrage du stream) est hors de portée : il n'y a
pas encore de preview à démuter. L'extension le détecte et ne fait rien.

## Structure

```
twitch-ad-stream-keeper/
├── manifest.json        point d'entrée (MV3, Firefox)
├── content.js           détection de pub + swap audio
├── icons/icon.svg       icône barre d'outils
└── popup/               interrupteur on/off
    ├── popup.html
    ├── popup.css
    └── popup.js
```

## Interrupteur on/off

Un clic sur l'icône ouvre un popup avec un toggle. L'état est persisté dans
`browser.storage.local` (clé `enabled`, défaut activé), partagé entre tous les
onglets Twitch et conservé entre les sessions. Le content script réagit en
direct : couper l'extension en pleine pub restaure aussitôt le son d'origine,
la rallumer ré-applique le swap — sans recharger l'onglet.

## Charger l'extension (temporaire)

1. Ouvre `about:debugging#/runtime/this-firefox`
2. **Charger un module complémentaire temporaire…**
3. Sélectionne `manifest.json` dans ce dossier
4. Ouvre / recharge un onglet `twitch.tv`

L'extension temporaire disparaît au redémarrage de Firefox — il suffit de la
recharger.

## Calibrage

Les sélecteurs Twitch changent. `content.js` expose en haut du fichier :

- `AD_MARKER_SELECTORS` — comment on détecte qu'une pub tourne
- `MAIN_PLAYER_SELECTOR` — le conteneur du lecteur principal (tout autre `<video>`
  pendant la pub = le preview à démuter ; ce conteneur = le lecteur pub à muter)
- `DEBUG` — passe à `true` le temps de recalibrer ; les logs sortent en console
  sous le préfixe `[ad-stream-keeper]`, repasse à `false` ensuite

Si la détection rate, ouvre la console pendant une vraie pub, inspecte le DOM du
lecteur preview et ajuste les sélecteurs ci-dessus.
