import { format } from './format.ts';
import { one } from './grammar.ts';
import type { Strings } from '../en/index.ts';
import type { PeriodId, Which } from '../../stats/period.ts';
import { pad2 } from '../write.ts';

/*
  French can say every period as an adverb at the end of a sentence —
  « cette semaine », « hier », « ces 7 derniers jours », « jusqu’ici » — so the
  recap's leads are each one sentence ending in `saidAs`. The comparisons
  beside a percentage are their own lines, since « last week » is « la semaine
  dernière » there but « the week before » is « la semaine d’avant ».
*/
function saidAs(period: PeriodId, which: Which): string {
  if (period === 'all') return 'jusqu’ici';
  if (which === 'last') {
    return { day: 'hier', week: 'la semaine dernière', month: 'le mois dernier', year: 'l’an dernier' }[period];
  }
  if (which === 'rolling') {
    return {
      day: 'ces 24 dernières heures',
      week: 'ces 7 derniers jours',
      month: 'ces 30 derniers jours',
      year: 'ces 12 derniers mois',
    }[period];
  }
  return { day: 'aujourd’hui', week: 'cette semaine', month: 'ce mois-ci', year: 'cette année' }[period];
}

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/** Lower-case in running French; `capital` raises the first letter where a line starts with one. */
const weekdays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const stats: Strings['stats'] = {
  percent: (value) => `${value} %`,

  period: {
    labels: { day: 'Jour', week: 'Semaine', month: 'Mois', year: 'Année', all: 'Tout' },
    which: {
      day: { last: 'Hier', this: 'Aujourd’hui', rolling: '24 dernières heures' },
      week: { last: 'Semaine dernière', this: 'Cette semaine', rolling: '7 derniers jours' },
      month: { last: 'Mois dernier', this: 'Ce mois-ci', rolling: '30 derniers jours' },
      year: { last: 'Année dernière', this: 'Cette année', rolling: '12 derniers mois' },
    },
    allTime: 'Depuis le début',
    monthOf: (date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    versus: (period, which) => {
      if (period === 'all') return '';
      if (which === 'last') {
        return {
          day: 'vs la veille',
          week: 'vs la semaine d’avant',
          month: 'vs le mois d’avant',
          year: 'vs l’année d’avant',
        }[period];
      }
      if (which === 'rolling') {
        return {
          day: 'vs les 24 heures d’avant',
          week: 'vs les 7 jours d’avant',
          month: 'vs les 30 jours d’avant',
          year: 'vs les 12 mois d’avant',
        }[period];
      }
      return { day: 'vs hier', week: 'vs la semaine dernière', month: 'vs le mois dernier', year: 'vs l’an dernier' }[period];
    },
  },

  /*
    The way French writes a running time, as on a film's listing: `4 h 12`,
    `38 min`, `45 s`, the spaces narrow and unbreakable so they stay compact.
  */
  duration: {
    seconds: (seconds) => `${seconds} s`,
    minutes: (minutes) => `${minutes} min`,
    hours: (hours) => `${hours} h`,
    hoursMinutes: (hours, minutes) => `${hours} h ${pad2(minutes)}`,
  },

  figures: {
    plays: 'Écoutes',
    tracks: 'Titres',
    artists: 'Artistes',
    finished: 'Jusqu’au bout',
    aDay: 'Par jour',
    peakHour: 'Heure de pointe',
    streak: 'Série',
    days: (count) => `${count} ${one(count, 'jour', 'jours')}`,
  },

  chart: {
    day: (date) =>
      `${capital(weekdays[(date.getDay() + 6) % 7]!)} ${date.getDate() === 1 ? '1er' : date.getDate()} ${months[date.getMonth()]}`,
    month: (date) => `${capital(months[date.getMonth()]!)} ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Rien d’écouté pour l’instant.',
    emptyBody:
      'Un titre compte dès que tu en as écouté trente secondes, ou la moitié s’il dure moins d’une minute.',
    recap: 'Bilan',
    openRecap: 'Ouvrir ton bilan',
    changeFigure: (change) => `${arrow(change)} ${Math.abs(change)} %`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'Rien encore sur cette période',
    time: 'Durée',
    plays: 'Écoutes',
    playsCount: (count) => `${count} ${one(count, 'écoute', 'écoutes')}`,
    was: (before) => `avant : ${before}`,
    lists: { tracks: 'Titres', artists: 'Artistes', genres: 'Genres' },
    lookUpForGenres: 'Recherche les infos de tes titres pour collecter des genres.',
    nothingInPeriod: 'Rien sur cette période.',
  },

  report: {
    tracksHeading: 'Tes titres phares',
    tracksLead: (period, which) => `Ce que tu as le plus écouté ${saidAs(period, which)}`,
    artistsHeading: 'Tes artistes phares',
    artistsLead: (period, which) => `Ils t’ont tenu compagnie ${saidAs(period, which)}`,
    genresHeading: 'Ton son',
    genresLead: (period, which) => `Ta couleur musicale ${saidAs(period, which)}`,
    clockHeading: 'Tes heures',
    clockLead: (hour) => `Tu as le plus écouté vers ${hour}`,
    numbersHeading: 'En chiffres',
    streakDays: (count) => `${count} ${one(count, 'jour', 'jours')}`,
  },

  cards: {
    listenedFor: 'Tu as écouté pendant',
    change: (change, comparison) => `${arrow(change)} ${Math.abs(change)} % ${comparison}`,
    numberOne: 'NUMÉRO UN',
    plays: (count) => `${count} ${one(count, 'écoute', 'écoutes')}`,
    mostPlayed: 'Le plus écouté',
    mostPlayedArtist: 'Artiste le plus écouté',
    credit: (photographer, licence) => `Photo : ${photographer} / ${licence}`,
    creditUnnamed: (licence) => `Photo : ${licence}`,
  },

  viewer: {
    share: 'Partager',
    saved: 'Image enregistrée dans ta galerie.',
    cannotSave: 'Installe la version Android à jour pour enregistrer des images.',
    cannotShare: 'Installe la version Android à jour pour partager des images.',
    failed: 'Ça n’a pas marché. Réessaie.',
  },
};
