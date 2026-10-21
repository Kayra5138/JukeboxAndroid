import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';
import type { PeriodId, Which } from '../../stats/period.ts';

/*
  A period takes a different preposition and article in each sentence it
  goes into ("oggi", "rispetto a ieri", "dell’anno scorso"), so every
  sentence is written out for every period, as the Turkish file does.
*/
type Said = Record<Exclude<PeriodId, 'all'>, string>;

/** One wording for each reading of each period, and one for all time, which has a single reading. */
const by = (period: PeriodId, which: Which, said: Record<Which, Said> & { all: string }) =>
  period === 'all' ? said.all : said[which][period];

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/* Lower case in running text, as Italian writes them; raised where a line starts with one. */
const weekdays = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const months = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];
const capital = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

export const stats: Strings['stats'] = {
  percent: (value) => `${value}%`,

  period: {
    /* Five to a bar on a narrow phone, about 60 points each: "Settimana" does not fit, so it is shortened. */
    labels: { day: 'Giorno', week: 'Sett.', month: 'Mese', year: 'Anno', all: 'Tutto' },
    which: {
      day: { last: 'Ieri', this: 'Oggi', rolling: 'Ultime 24 ore' },
      week: { last: 'Settimana scorsa', this: 'Questa settimana', rolling: 'Ultimi 7 giorni' },
      month: { last: 'Mese scorso', this: 'Questo mese', rolling: 'Ultimi 30 giorni' },
      year: { last: 'Anno scorso', this: 'Quest’anno', rolling: 'Ultimi 12 mesi' },
    },
    allTime: 'Da sempre',
    monthOf: (date) => `${format.monthsShort[date.getMonth()]} ${date.getFullYear()}`,
    versus: (period, which) =>
      period === 'all'
        ? ''
        : by(period, which, {
            this: {
              day: 'rispetto a ieri',
              week: 'rispetto alla settimana scorsa',
              month: 'rispetto al mese scorso',
              year: 'rispetto all’anno scorso',
            },
            last: {
              day: 'rispetto al giorno prima',
              week: 'rispetto alla settimana prima',
              month: 'rispetto al mese prima',
              year: 'rispetto all’anno prima',
            },
            rolling: {
              day: 'rispetto alle 24 ore precedenti',
              week: 'rispetto ai 7 giorni precedenti',
              month: 'rispetto ai 30 giorni precedenti',
              year: 'rispetto ai 12 mesi precedenti',
            },
            all: '',
          }),
  },

  duration: {
    seconds: (seconds) => `${seconds} s`,
    minutes: (minutes) => `${minutes} min`,
    hours: (hours) => `${hours} h`,
    hoursMinutes: (hours, minutes) => `${hours} h ${minutes} min`,
  },

  figures: {
    plays: 'Ascolti',
    tracks: 'Brani',
    artists: 'Artisti',
    finished: 'Completati',
    aDay: 'Al giorno',
    peakHour: 'Ora di punta',
    streak: 'Serie',
    days: (count) => `${count} ${oneOrMany(count, 'giorno', 'giorni')}`,
  },

  chart: {
    day: (date) =>
      `${capital(weekdays[(date.getDay() + 6) % 7]!)} ${date.getDate()} ${months[date.getMonth()]}`,
    month: (date) => `${capital(months[date.getMonth()]!)} ${date.getFullYear()}`,
  },

  screen: {
    emptyTitle: 'Ancora nessun ascolto.',
    emptyBody:
      'Un brano conta quando ne hai ascoltato trenta secondi, o metà se dura meno di un minuto.',
    recap: 'Riepilogo',
    openRecap: 'Apri il tuo riepilogo',
    changeFigure: (change) => `${arrow(change)} ${Math.abs(change)}%`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'Ancora niente in questo periodo',
    time: 'Tempo',
    plays: 'Ascolti',
    playsCount: (count) => `${count} ${oneOrMany(count, 'ascolto', 'ascolti')}`,
    was: (before) => `prima: ${before}`,
    lists: { tracks: 'Brani', artists: 'Artisti', genres: 'Generi' },
    lookUpForGenres: 'Cerca le informazioni dei brani per raccogliere i generi.',
    nothingInPeriod: 'Niente in questo periodo.',
  },

  report: {
    tracksHeading: 'I tuoi brani top',
    tracksLead: (period, which) =>
      by(period, which, {
        this: {
          day: 'Quello che hai ascoltato di più oggi',
          week: 'Quello che hai ascoltato di più questa settimana',
          month: 'Quello che hai ascoltato di più questo mese',
          year: 'Quello che hai ascoltato di più quest’anno',
        },
        last: {
          day: 'Quello che hai ascoltato di più ieri',
          week: 'Quello che hai ascoltato di più la settimana scorsa',
          month: 'Quello che hai ascoltato di più il mese scorso',
          year: 'Quello che hai ascoltato di più l’anno scorso',
        },
        rolling: {
          day: 'Quello che hai ascoltato di più nelle ultime 24 ore',
          week: 'Quello che hai ascoltato di più negli ultimi 7 giorni',
          month: 'Quello che hai ascoltato di più negli ultimi 30 giorni',
          year: 'Quello che hai ascoltato di più negli ultimi 12 mesi',
        },
        all: 'Quello che hai ascoltato di più finora',
      }),
    artistsHeading: 'I tuoi artisti top',
    artistsLead: (period, which) =>
      by(period, which, {
        this: {
          day: 'Con chi hai passato la giornata',
          week: 'Con chi hai passato la settimana',
          month: 'Con chi hai passato il mese',
          year: 'Con chi hai passato l’anno',
        },
        last: {
          day: 'Con chi hai passato la giornata di ieri',
          week: 'Con chi hai passato la settimana scorsa',
          month: 'Con chi hai passato il mese scorso',
          year: 'Con chi hai passato l’anno scorso',
        },
        rolling: {
          day: 'Con chi hai passato le ultime 24 ore',
          week: 'Con chi hai passato gli ultimi 7 giorni',
          month: 'Con chi hai passato gli ultimi 30 giorni',
          year: 'Con chi hai passato gli ultimi 12 mesi',
        },
        all: 'Con chi hai passato il tempo finora',
      }),
    genresHeading: 'Il tuo suono',
    genresLead: (period, which) =>
      by(period, which, {
        this: {
          day: 'I generi di oggi',
          week: 'I generi di questa settimana',
          month: 'I generi di questo mese',
          year: 'I generi di quest’anno',
        },
        last: {
          day: 'I generi di ieri',
          week: 'I generi della settimana scorsa',
          month: 'I generi del mese scorso',
          year: 'I generi dell’anno scorso',
        },
        rolling: {
          day: 'I generi delle ultime 24 ore',
          week: 'I generi degli ultimi 7 giorni',
          month: 'I generi degli ultimi 30 giorni',
          year: 'I generi degli ultimi 12 mesi',
        },
        all: 'I generi di sempre',
      }),
    clockHeading: 'Le tue ore',
    /* [hour] is `21:00`; one o'clock takes the elided article, "all’01:00". */
    clockLead: (hour) =>
      `Hai ascoltato di più intorno ${hour.startsWith('01:') ? 'all’' : 'alle '}${hour}`,
    numbersHeading: 'In numeri',
    streakDays: (count) => oneOrMany(count, '1 giorno', `${count} giorni`),
  },

  cards: {
    listenedFor: 'Hai ascoltato per',
    change: (change, comparison) => `${arrow(change)} ${Math.abs(change)}% ${comparison}`,
    numberOne: 'NUMERO UNO',
    plays: (count) => oneOrMany(count, '1 ascolto', `${count} ascolti`),
    mostPlayed: 'Brano più ascoltato',
    mostPlayedArtist: 'Artista più ascoltato',
    credit: (photographer, licence) => `Foto: ${photographer} / ${licence}`,
    creditUnnamed: (licence) => `Foto: ${licence}`,
  },

  viewer: {
    share: 'Condividi',
    saved: 'Salvato nella galleria.',
    cannotSave: 'Installa la versione Android aggiornata per salvare le immagini.',
    cannotShare: 'Installa la versione Android aggiornata per condividere le immagini.',
    failed: 'Non ha funzionato. Riprova.',
  },
};
