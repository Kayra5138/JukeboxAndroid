import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import { oneOrMany } from '../write.ts';

export const lyrics: Strings['lyrics'] = {
  none: 'Nenhuma letra encontrada.',
  translating: 'Traduzindo…',
  seekTo: (seconds) => `Ir para ${seconds} ${seconds === '1' ? 'segundo' : 'segundos'}`,

  translation: {
    romaji:
      'Esta letra está em japonês com letras latinas, e não foi encontrada uma versão na escrita original para traduzir em seu lugar.',
    unsupported: 'Não há tradução para este idioma.',
    unavailable: 'A tradução não está disponível neste aparelho.',
    misaligned: 'A tradução não se alinhou com a letra.',
    failed: 'A tradução falhou.',
  },

  from: {
    file: 'Do arquivo',
    lrc: 'De um arquivo .lrc',
    lookup: 'Do LRCLIB',
  },

  stored: (timed, from, lines) =>
    `${timed ? 'Sincronizada' : 'Texto simples'}, ${from === 'file' ? 'do próprio arquivo' : 'de um arquivo .lrc ao lado'}` +
    (lines > 0 ? ` · ${oneOrMany(lines, '1 linha', `${format.number(lines)} linhas`)}` : ''),

  found: {
    file: 'Encontrada no próprio arquivo e salva.',
    lrc: 'Encontrada em um arquivo .lrc ao lado da música e salva.',
  },

  folders: {
    title: 'Ler arquivos .lrc ao lado das músicas',
    note: 'A letra de um arquivo .lrc com o mesmo nome da música aparece antes de qualquer consulta on-line. O Android só deixa um app ler esses arquivos em uma pasta que você escolher, por isso o app pede uma vez a pasta onde estão suas músicas.',
    add: 'Adicionar outra pasta',
    remove: 'Remover',
    removeLabel: (folder) => `Parar de ler arquivos .lrc em ${folder}`,
    elsewhere: 'Essa pasta não está no celular, então nenhuma das suas músicas está nela. Escolha a pasta do celular onde estão suas músicas.',
  },
};
