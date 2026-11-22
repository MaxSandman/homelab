// Carnet de chansons intégré : chansons traditionnelles / du domaine public.
// Format ChordPro : [Accord]paroles. [C:2] = l'accord dure 2 temps (sinon 1 mesure).
// Les chansons perso ajoutées via « Ajouter une chanson » sont stockées dans le navigateur.

export const BUILTIN_SONGS = [
  {
    id: 'frere-jacques',
    source: `{title: Frère Jacques}
{artist: Traditionnel}
{tempo: 80}
{time: 4/4}
{strum: d4}
{note: Ta toute première chanson : un seul accord ! Concentre-toi sur un grattage bien régulier.}
[C]Frère Jacques, [C]frère Jacques,
[C]Dormez-vous ? [C]Dormez-vous ?
[C]Sonnez les matines, [C]sonnez les matines,
[C]Ding, dang, dong ! [C]Ding, dang, dong !`,
  },
  {
    id: 'quatre-accords',
    source: `{title: Les 4 accords magiques}
{artist: Exercice}
{tempo: 70}
{time: 4/4}
{strum: d4}
{note: C – G – Am – F : cette suite d'accords est utilisée dans des centaines de tubes pop. Compte 1, 2, 3, 4 sur chaque accord.}
{c: Tour 1}
[C]1, 2, 3, 4 [G]1, 2, 3, 4 [Am]1, 2, 3, 4 [F]1, 2, 3, 4
{c: Tour 2}
[C]1, 2, 3, 4 [G]1, 2, 3, 4 [Am]1, 2, 3, 4 [F]1, 2, 3, 4
{c: Tour 3}
[C]1, 2, 3, 4 [G]1, 2, 3, 4 [Am]1, 2, 3, 4 [F]1, 2, 3, 4
{c: Fin}
[C]Dernier accord… laisse sonner !`,
  },
  {
    id: 'au-clair-de-la-lune',
    source: `{title: Au clair de la lune}
{artist: Traditionnel}
{tempo: 76}
{time: 4/4}
{strum: d4}
{note: Deux accords : C et G7. Le changement C → G7 arrive souvent : anticipe-le !}
{c: Couplet 1}
[C]Au clair de la [C:2]lu-[G7:2]ne, [C:2]mon a-[G7:2]mi Pier-[C]rot,
[C]Prête-moi ta [C:2]plu-[G7:2]me [C:2]pour é-[G7:2]crire un [C]mot.
[G7]Ma chandelle est [F]morte, [G7]je n'ai plus de [G7]feu,
[C]Ouvre-moi ta [C:2]por-[G7:2]te [C:2]pour l'a-[G7:2]mour de [C]Dieu.
{c: Couplet 2}
[C]Au clair de la [C:2]lu-[G7:2]ne, [C:2]Pierrot ré-[G7:2]pon-[C]dit :
[C]« Je n'ai pas de [C:2]plu-[G7:2]me, [C:2]je suis dans [G7:2]mon [C]lit.
[G7]Va chez la voi-[F]sine, [G7]je crois qu'elle y [G7]est,
[C]Car dans sa cui-[C:2]si-[G7:2]ne [C:2]on bat le [G7:2]bri-[C]quet. »`,
  },
  {
    id: 'ah-vous-dirai-je',
    source: `{title: Ah ! vous dirai-je, maman}
{artist: Traditionnel}
{tempo: 84}
{time: 4/4}
{strum: d4}
{note: Trois accords : C, F et G7. Les changements arrivent tous les 2 temps : commence lentement (vitesse 60 %).}
[C]Ah ! vous dirai-[F:2]je, ma-[C:2]man,
[F:2]Ce qui [C:2]cause [G7:2]mon tour-[C:2]ment ?
[C:2]Papa [F:2]veut que [C:2]je rai-[G7:2]sonne
[C:2]Comme une [F:2]grande [C:2]per-[G7:2]sonne.
[C]Moi je dis que [F:2]les bon-[C:2]bons
[F:2]Valent [C:2]mieux que [G7:2]la rai-[C:2]son.`,
  },
  {
    id: 'sur-le-pont',
    source: `{title: Sur le pont d'Avignon}
{artist: Traditionnel}
{tempo: 96}
{time: 4/4}
{strum: d4}
{note: Une chanson joyeuse à deux accords : C et G7.}
{c: Refrain}
[C]Sur le pont d'Avi-[G7]gnon,
[C]L'on y danse, [G7]l'on y danse,
[C]Sur le pont d'Avi-[G7]gnon,
[G7]L'on y danse tous en [C]rond.
{c: Couplet}
[C]Les beaux messieurs font [G7]comme ça,
[G7]Et puis encore [C]comme ça.`,
  },
  {
    id: 'alouette',
    source: `{title: Alouette}
{artist: Traditionnel}
{tempo: 96}
{time: 4/4}
{strum: d8}
{note: C et G7, avec un rythme Bas-Haut régulier.}
{c: Refrain}
[C]Alouette, gentille alou-[G7]ette,
[C]Alouette, [G7]je te plume-[C]rai.
{c: Couplet}
[C]Je te plumerai la [G7]tête,
[G7]Je te plumerai la [C]tête,
[C]Et la tête, [G7]et la tête,
[C]Alouette, [G7]alouette… [C]Ohhh !`,
  },
  {
    id: 'claire-fontaine',
    source: `{title: À la claire fontaine}
{artist: Traditionnel}
{tempo: 80}
{time: 4/4}
{strum: ddu}
{note: C, F et G7. Une jolie mélodie douce, idéale pour travailler le rythme Bas, Bas-Haut.}
{c: Couplet}
[C]À la claire fon-[G7]taine,
[C]M'en allant prome-[G7]ner,
[C]J'ai trouvé l'eau si [F]belle
[C]Que je m'y [G7:2]suis bai-[C:2]gnée.
{c: Refrain}
[C]Il y a longtemps que je [F]t'aime,
[C]Jamais je ne [G7:2]t'oubli-[C:2]erai.`,
  },
  {
    id: 'joyeux-anniversaire',
    source: `{title: Joyeux anniversaire}
{artist: Traditionnel}
{tempo: 100}
{time: 3/4}
{strum: waltz}
{note: Une valse en 3 temps : compte « 1, 2, 3 ». Accords C, G7, C7 et F.}
[C]Joyeux anniver-[G7]saire,
[G7]Joyeux anniver-[C]saire,
[C7]Joyeux anniver-[F]saire (prénom),
[C]Joyeux anni-[G7]ver-[C]saire !`,
  },
  {
    id: 'kumbaya',
    source: `{title: Kumbaya}
{artist: Traditionnel (gospel)}
{tempo: 76}
{time: 4/4}
{strum: ddu}
{note: C, F et G : idéal pour apprendre l'accord de G en douceur.}
[C]Kumbaya, my [F]Lord, kumba-[C]ya,
[C]Kumbaya, my [F]Lord, kumba-[G]ya,
[C]Kumbaya, my [F]Lord, kumba-[C]ya,
Oh [F]Lord, [G]kumba-[C]ya.

[C]Someone's singing, [F]Lord, kumba-[C]ya,
[C]Someone's singing, [F]Lord, kumba-[G]ya,
[C]Someone's singing, [F]Lord, kumba-[C]ya,
Oh [F]Lord, [G]kumba-[C]ya.`,
  },
  {
    id: 'saints',
    source: `{title: When the Saints Go Marching In}
{artist: Traditionnel (jazz New Orleans)}
{tempo: 110}
{time: 4/4}
{strum: d8}
{note: Un grand classique : C, C7, F et G7.}
[C]Oh when the saints, [C]go marching in,
[C]Oh when the saints go [G7]marching in,
[C]Oh Lord, I [C7]want to be in that [F]number,
[F]When the [C]saints go [G7]marching [C]in.`,
  },
  {
    id: 'amazing-grace',
    source: `{title: Amazing Grace}
{artist: John Newton (1779)}
{tempo: 84}
{time: 3/4}
{strum: waltz}
{note: Une valse lente en 3 temps. Accords C, C7, F et G.}
A-[C]mazing grace, how [C7]sweet the [F]sound,
That [C]saved a wretch like [G]me.
I [C]once was lost, but [C7]now am [F]found,
Was [C]blind, but [G]now I [C]see.`,
  },
  {
    id: 'jingle-bells',
    source: `{title: Jingle Bells}
{artist: James Lord Pierpont (1857)}
{tempo: 112}
{time: 4/4}
{strum: d8}
{note: Le refrain de Noël, avec C, F, G7 et D7 (un D7 facile à deux doigts).}
[C]Jingle bells, jingle bells, [C]jingle all the way,
[F]Oh what fun it [C]is to ride
In a [D7]one-horse open [G7]sleigh, hey !
[C]Jingle bells, jingle bells, [C]jingle all the way,
[F]Oh what fun it [C]is to ride
In a [G7]one-horse open [C]sleigh !`,
  },
  {
    id: 'oh-susanna',
    source: `{title: Oh! Susanna}
{artist: Stephen Foster (1848)}
{tempo: 100}
{time: 4/4}
{strum: island}
{note: Parfait pour le rythme « Island » : C, F et G7.}
{c: Couplet}
I [C]come from Alabama with my [G7]banjo on my knee,
I'm [C]going to Louisiana, my [G7]true love for to [C]see.
{c: Refrain}
Oh, Su-[F]sanna, oh [C]don't you cry for [G7]me,
For I [C]come from Alabama with my [G7]banjo on my [C]knee.`,
  },
];
