import { common } from './common.ts';
import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

const months = (count: number) => `${format.number(count)} ${oneOrMany(count, 'mese', 'mesi')}`;
const times = (count: number) => oneOrMany(count, 'una volta', `${format.number(count)} volte`);

export const space: Strings['space'] = {
  title: 'Libera spazio',
  rowNote: 'Canzoni che non ascolti mai, salti o hai due volte, e i file più grandi',
  note: 'Canzoni che potrebbero andarsene per fare posto sul telefono, ognuna con il motivo. Spunta quelle da togliere; Android chiede ancora una volta prima di eliminare qualcosa.',
  groups: {
    copy: 'Copie della stessa canzone',
    skipped: 'Saltate spesso',
    neverPlayed: 'Mai ascoltate',
    forgotten: 'Non ascoltate da tempo',
    large: 'File più grandi',
  },
  groupSize: (count, size) => `${common.songs(count)} · ${size}`,
  megabytes: (mb) => `${format.decimal(mb, 1)} MB`,
  gigabytes: (gb) => `${format.decimal(gb, 1)} GB`,
  why: {
    copy: 'Resta un’altra copia di questa canzone, che riceve i suoi ascolti',
    skipped: (skips, heard, after) =>
      heard === 0
        ? `Saltata ${times(skips)}, in media dopo ${format.number(after)} s, mai ascoltata fino alla fine`
        : `Saltata ${times(skips)}, in media dopo ${format.number(after)} s, ascoltata fino alla fine ${times(heard)}`,
    neverPlayed: (added) => `Mai ascoltata, sul telefono dal ${format.date(new Date(added))}`,
    forgotten: (last) => `Ascoltata l’ultima volta il ${format.date(new Date(last))}`,
    large: 'Uno dei file più grandi',
  },
  listSeparator: ', ',
  inLists: (names) => `In ${names}`,
  showHint: 'Mostra o nasconde le canzoni di questo gruppo',
  tickGroup: (group) => `Tutto ${group}`,
  delete: (count, size) => `Elimina ${common.songs(count)} (${size})`,
  freed: (count, size) => `${common.songs(count)} ${oneOrMany(count, 'eliminata', 'eliminate')}, ${size} liberati.`,
  notDeleted: 'Non è stato eliminato niente.',
  empty: 'Niente da liberare: ogni canzone è stata ascoltata di recente, nessuna viene saltata spesso e nessuna è presente due volte.',
  auto: {
    heading: 'Da solo',
    title: 'Elimina i download non ascoltati',
    off: 'Disattivato. Le canzoni scaricate da Jukebox stessa possono essere eliminate da sole quando nessuno le ascolta da un po’. I file arrivati in altro modo non vengono mai toccati.',
    after: (count) =>
      `Le canzoni scaricate da Jukebox stessa vengono eliminate dopo ${months(count)} senza un ascolto; il controllo avviene una volta al giorno. Mai la canzone in riproduzione, né un file arrivato in altro modo.`,
    months: 'Mesi senza ascolti',
    monthCount: (count) => months(count),
    favorites: 'Anche le canzoni nei Preferiti',
    lists: 'Anche le canzoni nelle liste',
  },
};
