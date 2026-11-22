// Parcours débutant : leçons courtes avec des éléments interactifs.
// Les blocs <div data-w="..."></div> sont remplacés par des widgets (diagramme, manche, rythme…).

export const LESSONS = [
  {
    id: 'decouvrir',
    title: 'Découvrir ton ukulélé',
    icon: '🎸',
    minutes: 5,
    body: `
<p>Bienvenue ! Le ukulélé est l’instrument idéal pour débuter : <b>4 cordes en nylon</b> (douces pour les doigts),
des accords simples, et on peut jouer de vraies chansons au bout de quelques jours. Aucune connaissance en solfège n’est nécessaire.</p>
<div data-w="parts"></div>
<h3>Le vocabulaire à connaître</h3>
<ul>
  <li><b>La tête</b> et ses <b>mécaniques</b> : les petites clés qui servent à tendre les cordes (à accorder).</li>
  <li><b>Le manche</b> : la partie longue où la main gauche appuie sur les cordes.</li>
  <li><b>Les frettes</b> : les petites barres de métal sur le manche. L’espace entre deux frettes s’appelle une <b>case</b>.
  « Case 1 » = la case la plus proche de la tête.</li>
  <li><b>La caisse</b> avec sa <b>rosace</b> (le trou) : c’est là que le son résonne.</li>
</ul>
<h3>Comment le tenir</h3>
<ul>
  <li>Assieds-toi confortablement, le ukulélé posé contre le ventre, la tête du ukulélé vers la <b>gauche</b> (si tu es droitière).</li>
  <li>Ton <b>avant-bras droit</b> maintient doucement la caisse contre toi.</li>
  <li>Ta <b>main gauche</b> tient le manche : le pouce derrière le manche, les doigts devant, légèrement arrondis.</li>
  <li>Le manche monte un peu vers le haut (environ 15°). Reste détendue : épaules basses !</li>
</ul>
<p class="tip">💡 Gauchère ? Va dans <a href="#/reglages">Réglages</a> et coche « Je suis gauchère » : le manche sera affiché à l’envers.</p>`,
  },
  {
    id: 'cordes',
    title: 'Les 4 cordes : Sol, Do, Mi, La',
    icon: '🎶',
    minutes: 5,
    body: `
<p>Ton ukulélé a 4 cordes. En le tenant, de la corde la plus proche de ton visage à celle la plus proche du sol :</p>
<p class="big-strings"><span class="badge sg">Sol (G)</span> <span class="badge sc">Do (C)</span> <span class="badge se">Mi (E)</span> <span class="badge sa">La (A)</span></p>
<p>Les musiciens utilisent souvent les lettres anglaises : <b>G C E A</b>. Tu les verras partout sur internet, donc l’outil affiche les deux.
Petit moyen mnémotechnique : « <b>G</b>entil <b>C</b>hat <b>E</b>n <b>A</b>vion » 🐱✈️.</p>
<p>Clique sur chaque corde pour entendre son son :</p>
<div data-w="strings"></div>
<p>Sur l’écran, le manche est dessiné comme quand tu regardes ton ukulélé en baissant les yeux : la tête à gauche,
la corde de Sol en haut. Chaque corde garde toujours la même couleur dans l’outil.</p>
<div data-w="fretboard:open"></div>
<p class="tip">🤔 Surprise : la corde de Sol (en haut) sonne plus <b>aigu</b> que la corde de Do. C’est normal, c’est ce qui donne au ukulélé son son si joyeux !</p>`,
  },
  {
    id: 'accorder',
    title: 'Accorder ton ukulélé',
    icon: '🎚️',
    minutes: 5,
    body: `
<p>Avant chaque séance, on vérifie que le ukulélé est <b>accordé</b> (que chaque corde sonne à la bonne hauteur).
Un instrument désaccordé sonne « faux » même si tu joues parfaitement : c’est la première chose à vérifier !</p>
<ul>
  <li>Chaque corde a sa mécanique. Tourner dans un sens <b>tend</b> la corde (le son monte), dans l’autre sens la <b>détend</b> (le son descend).</li>
  <li>Va doucement : un petit quart de tour suffit souvent.</li>
  <li>Les cordes neuves se détendent beaucoup les premiers jours : il faudra réaccorder souvent, c’est normal.</li>
</ul>
<p><a class="btn primary" href="#/accordeur">🎤 Ouvrir l’accordeur</a></p>
<p>L’accordeur utilise le micro de ta tablette ou de ton ordinateur et t’indique s’il faut tendre ou détendre.
Tu peux aussi accorder à l’oreille avec les sons de référence :</p>
<div data-w="strings"></div>
<p class="tip">💡 Une application d’accordeur sur ton téléphone, ou un petit accordeur à pince (environ 10 €), fonctionne très bien aussi.</p>`,
  },
  {
    id: 'gratter',
    title: 'Gratter les cordes',
    icon: '✋',
    minutes: 10,
    body: `
<p>La main droite fait le rythme : on dit qu’elle <b>gratte</b>. Pour commencer :</p>
<ul>
  <li>Utilise ton <b>index</b>. Les autres doigts sont repliés, le pouce peut s’appuyer doucement sur l’index.</li>
  <li>Gratte vers le <b>bas</b> (↓) avec l’ongle de l’index, en passant sur les 4 cordes.</li>
  <li>Gratte à l’endroit où le manche rejoint la caisse (pas au-dessus de la rosace) : le son est plus doux.</li>
  <li>Le mouvement vient du <b>poignet</b>, comme si tu secouais de l’eau de tes doigts. Pas besoin de taper fort !</li>
</ul>
<p>Exercice : sans appuyer sur aucune corde (ça s’appelle jouer « à vide », c’est en fait l’accord <b>Am7</b>),
gratte un coup vers le bas à chaque clic du métronome. Commence à 60 BPM (battements par minute).</p>
<div data-w="strum:d4:Am7"></div>
<p class="tip">🎯 Le but n’est pas d’aller vite, mais d’être <b>régulière</b> : pile sur le clic. Quand c’est facile, monte un peu le tempo.</p>`,
  },
  {
    id: 'premier-accord',
    title: 'Ton premier accord : Do (C)',
    icon: '⭐',
    minutes: 10,
    learn: ['C'],
    body: `
<p>Un <b>accord</b>, c’est plusieurs notes jouées en même temps. On le « forme » avec la main gauche, puis on gratte avec la main droite.</p>
<h3>Lire un diagramme d’accord</h3>
<p>Partout (dans l’outil et sur internet), les accords sont dessinés comme ceci :</p>
<ul>
  <li>Les <b>4 lignes verticales</b> sont les cordes : Sol, Do, Mi, La de gauche à droite.</li>
  <li>Les <b>lignes horizontales</b> sont les frettes. Le trait épais en haut = la tête du ukulélé.</li>
  <li>Un <b>point</b> = où poser un doigt. Le <b>chiffre</b> dans le point dit <b>quel doigt</b> utiliser.</li>
  <li>Un <b>petit rond vide</b> au-dessus = la corde est jouée à vide (sans appuyer).</li>
</ul>
<div data-w="legend"></div>
<div class="two">
  <div data-w="chord:C"></div>
  <div>
    <p><b>Do majeur (C)</b> : un seul doigt ! Pose ton <b>annulaire (3)</b> sur la <b>3e case</b> de la corde de <b>La</b>
    (la corde du bas, la plus fine).</p>
    <ul>
      <li>Appuie avec le bout du doigt, juste derrière la frette (pas dessus).</li>
      <li>Garde les autres doigts loin des autres cordes pour qu’elles sonnent bien.</li>
      <li>Gratte : les 4 cordes doivent sonner clairement. Si une corde « frise », appuie un peu plus fort ou rapproche le doigt de la frette.</li>
    </ul>
  </div>
</div>
<div data-w="fretboard:chord:C"></div>
<h3>Ta première chanson !</h3>
<p>« Frère Jacques » se joue avec seulement l’accord de Do. Gratte 4 coups vers le bas par mesure et chante (ou fredonne) :</p>
<p><a class="btn primary" href="#/chansons/frere-jacques">▶ Jouer Frère Jacques</a></p>
<p class="tip">😬 Le bout des doigts fait un peu mal les premiers jours ? C’est normal : de la corne va se former en 1 à 2 semaines.
Joue souvent mais peu longtemps (10-15 minutes).</p>`,
  },
  {
    id: 'la-mineur',
    title: 'Deuxième accord : La mineur (Am)',
    icon: '🌙',
    minutes: 10,
    learn: ['Am'],
    body: `
<p>Les accords <b>majeurs</b> sonnent plutôt joyeux, les accords <b>mineurs</b> (avec un « m ») plutôt tristes ou doux. Écoute la différence !</p>
<div class="two">
  <div data-w="chord:Am"></div>
  <div>
    <p><b>La mineur (Am)</b> : pose ton <b>majeur (2)</b> sur la <b>2e case</b> de la corde de <b>Sol</b> (la corde du haut).</p>
    <p>Encore un seul doigt ! 😊</p>
  </div>
</div>
<div data-w="fretboard:chord:Am"></div>
<h3>Le vrai défi : changer d’accord</h3>
<p>Jouer un accord, c’est facile. Passer <b>rapidement</b> d’un accord à l’autre en gardant le rythme, c’est ça qui demande de l’entraînement.</p>
<ul>
  <li>Entraîne-toi d’abord sans gratter : C → Am → C → Am… regarde tes doigts.</li>
  <li>Puis avec l’exercice ci-dessous : 4 temps sur chaque accord. L’écran te prévient quand le changement arrive (« Prépare-toi ! »).</li>
</ul>
<p><a class="btn primary" href="#/entrainement?chords=C,Am&bpm=60">🔁 Exercice C ↔ Am</a></p>`,
  },
  {
    id: 'fa-sol7',
    title: 'Fa (F) et Sol 7 (G7)',
    icon: '🎵',
    minutes: 15,
    learn: ['F', 'G7'],
    body: `
<p>Avec ces deux accords en plus, tu pourras jouer des dizaines de chansons traditionnelles.</p>
<div class="two">
  <div data-w="chord:F"></div>
  <div><p><b>Fa majeur (F)</b> : c’est La mineur + l’index ! Garde le majeur (2) sur la corde de Sol case 2,
  et ajoute l’<b>index (1)</b> sur la corde de <b>Mi</b>, case 1.</p></div>
</div>
<div class="two">
  <div data-w="chord:G7"></div>
  <div><p><b>Sol 7 (G7)</b> : trois doigts en petit triangle : <b>index (1)</b> case 1 sur la corde de Mi,
  <b>majeur (2)</b> case 2 sur la corde de Do, <b>annulaire (3)</b> case 2 sur la corde de La.</p></div>
</div>
<p>Exercices de changement :</p>
<p><a class="btn" href="#/entrainement?chords=Am,F&bpm=60">🔁 Am ↔ F</a>
<a class="btn" href="#/entrainement?chords=C,G7&bpm=60">🔁 C ↔ G7</a>
<a class="btn" href="#/entrainement?chords=C,F,G7&bpm=60">🔁 C → F → G7</a></p>
<h3>Des chansons pour toi</h3>
<p><a class="btn primary" href="#/chansons/au-clair-de-la-lune">▶ Au clair de la lune</a>
<a class="btn primary" href="#/chansons/sur-le-pont">▶ Sur le pont d’Avignon</a>
<a class="btn primary" href="#/chansons/ah-vous-dirai-je">▶ Ah ! vous dirai-je, maman</a></p>
<p class="tip">💡 Dans le lecteur, baisse la <b>vitesse</b> à 50-60 % au début, ou active le mode <b>Pas-à-pas</b> : l’accord suivant n’arrive que quand tu appuies sur la barre Espace.</p>`,
  },
  {
    id: 'rythmes',
    title: 'Les rythmes : vers le bas, vers le haut',
    icon: '🥁',
    minutes: 15,
    body: `
<p>Jusqu’ici tu grattais seulement vers le bas (↓). On peut aussi gratter vers le <b>haut</b> (↑) avec la pulpe de l’index, en remontant.</p>
<h3>Compter « 1 et 2 et 3 et 4 et »</h3>
<p>Une mesure contient 4 temps (on compte 1, 2, 3, 4). Entre deux temps, il y a un « et ».
La main fait un mouvement de balancier régulier : elle <b>descend sur les temps</b> (1, 2, 3, 4) et <b>remonte sur les « et »</b>.
Quand on ne doit pas gratter, la main continue son mouvement… mais dans le vide !</p>
<div data-w="strum:d8:C"></div>
<h3>Le rythme « Bas, Bas-Haut »</h3>
<div data-w="strum:ddu:C"></div>
<h3>Le rythme « Island », LE rythme du ukulélé</h3>
<p>Bas, Bas-Haut, (vide) Haut-Bas-Haut. Il paraît difficile au début, mais une fois dans la main, il ne te quitte plus !</p>
<div data-w="strum:island:C"></div>
<p class="tip">💡 Va voir la page <a href="#/rythme">Rythmes</a> pour t’entraîner avec tous les rythmes, et choisis le rythme de ton choix dans le lecteur de chansons.</p>`,
  },
  {
    id: 'sol',
    title: 'Sol (G) et les 4 accords magiques',
    icon: '✨',
    minutes: 15,
    learn: ['G'],
    body: `
<div class="two">
  <div data-w="chord:G"></div>
  <div><p><b>Sol majeur (G)</b> : un triangle de trois doigts : <b>index (1)</b> case 2 de la corde de Do,
  <b>majeur (2)</b> case 2 de la corde de La, <b>annulaire (3)</b> case 3 de la corde de Mi.</p>
  <p>C’est le plus difficile jusqu’ici : prends ton temps, c’est normal que ça prenne quelques jours.</p></div>
</div>
<h3>Les 4 accords magiques : C – G – Am – F</h3>
<p>Ces 4 accords, joués dans cet ordre, sont utilisés dans <b>des centaines de chansons pop</b> (Let It Be, Someone Like You, I’m Yours, Africa…).
Une fois que tu les enchaînes, un énorme répertoire s’ouvre à toi !</p>
<p><a class="btn" href="#/entrainement?chords=C,G,Am,F&bpm=60">🔁 Exercice C → G → Am → F</a>
<a class="btn primary" href="#/chansons/quatre-accords">▶ Les 4 accords magiques</a>
<a class="btn primary" href="#/chansons/kumbaya">▶ Kumbaya</a></p>`,
  },
  {
    id: 'tablature',
    title: 'Jouer des notes : la tablature',
    icon: '🎼',
    minutes: 15,
    body: `
<p>En plus des accords, on peut jouer une <b>mélodie</b> note par note. Pour ça, on utilise la <b>tablature</b> (ou « tab ») :
pas besoin de solfège !</p>
<ul>
  <li>Chaque ligne horizontale = une corde.</li>
  <li>Le chiffre posé sur la ligne = la <b>case</b> où appuyer. <b>0</b> = corde à vide.</li>
  <li>On lit de gauche à droite, comme un texte.</li>
</ul>
<p>Sur le manche ci-dessous, clique sur une case : tu entends la note et tu vois son nom.
Active « Afficher le nom des notes » pour voir où se trouvent Do, Ré, Mi…</p>
<div data-w="fretboard:notes"></div>
<p class="tip">⚠️ Sur les sites internet, les tablatures sont souvent dessinées avec la corde de <b>La en haut</b> (à l’inverse du manche ici).
Tu peux choisir cette présentation dans les <a href="#/reglages">Réglages</a>. Les noms des cordes sont toujours écrits à gauche pour t’aider.</p>
<p><a class="btn primary" href="#/melodies/frere-jacques">▶ Mélodie : Frère Jacques</a>
<a class="btn primary" href="#/melodies/twinkle">▶ Ah ! vous dirai-je, maman</a></p>
<p>Dans les mélodies, essaie le mode <b>🎤 J’attends ta note</b> : l’outil écoute avec le micro et n’avance que quand tu as joué la bonne note.</p>`,
  },
  {
    id: 'routine',
    title: 'Ta routine pour progresser',
    icon: '🌱',
    minutes: 5,
    body: `
<p>Bravo, tu as terminé le parcours de base ! 🎉 Voici comment continuer :</p>
<h3>Une séance type (15 minutes par jour)</h3>
<ol>
  <li><b>2 min</b> : accorder le ukulélé.</li>
  <li><b>3 min</b> : un exercice de changement d’accords (<a href="#/entrainement">Entraînement</a>).</li>
  <li><b>3 min</b> : un rythme avec le métronome (<a href="#/rythme">Rythmes</a>).</li>
  <li><b>7 min</b> : une chanson que tu aimes (<a href="#/chansons">Chansons</a>).</li>
</ol>
<p>Mieux vaut <b>15 minutes tous les jours</b> qu’une heure le dimanche !</p>
<h3>Les prochains accords à apprendre</h3>
<p>Em, Dm, D, A7, C7, E7… Tu les trouveras tous dans la page <a href="#/accords">Accords</a>, avec des conseils de doigté.</p>
<h3>Jouer les chansons que TU aimes</h3>
<p>Cherche le titre d’une chanson + « accords » ou « ukulele chords » sur internet (par exemple sur des sites comme
Ultimate Guitar, Boîte à chansons, Ukulele Tabs…), copie les paroles avec les accords et colle-les dans
<a href="#/importer">Ajouter une chanson</a> : l’outil la transforme en partition jouable, te montre les accords
et peut même la <b>transposer</b> pour la rendre plus facile.</p>`,
  },
];
