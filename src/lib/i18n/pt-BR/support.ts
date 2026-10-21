import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: 'Relatar um problema',
      note: 'Abre um relato no GitHub com os detalhes já preenchidos. Nada é enviado até você enviar.',
    },
    title: 'Relatar um problema',
    intro:
      'Nada sai do seu celular a partir desta tela. “Abrir o GitHub” começa um relato novo com o texto abaixo já preenchido; lá você pode ler e mudar o que quiser, e ele só é enviado se você enviar.',
    details: 'O que vai no relato',
    detailsNote: 'A versão e o celular vão para campos próprios do formulário, e o resto vai para o último campo. Suas músicas nunca são mencionadas.',
    errors: {
      title: 'Incluir erros recentes',
      note:
        'Problemas que o Jukebox percebeu sozinho, como um download ou uma busca que falhou. Nomes de músicas, endereços e caminhos de arquivo são removidos antes de cada erro ser guardado.',
      none: 'Nenhum erro foi registrado.',
      trimmed: 'Os erros mais antigos ficam de fora do link para ele continuar curto o bastante para abrir. “Copiar” inclui todos.',
    },
    open: 'Abrir o GitHub',
    openHint: 'Abre no navegador um relato novo, preenchido e ainda não enviado',
    copy: 'Copiar',
    copyNote: 'Não tem conta no GitHub? “Copiar” coloca o mesmo texto na área de transferência, para colar em um relato ou em uma mensagem.',
    copied: 'Copiado',
    openFailed: 'Não foi possível abrir o link. Copie o texto e cole em um relato.',
    copyFailed: 'Esta versão do app não consegue usar a área de transferência. Selecione o texto acima e copie manualmente.',
  },

  update: {
    available: (version) => `O Jukebox ${version} está disponível`,
    note: 'Se você instalou pelo Obtainium, ele vai oferecer a atualização por lá. Se não, toque para abrir a página da versão e baixar.',
    hint: 'Abre a página da versão no navegador',
    tab: (settings) => `${settings}, há uma atualização disponível`,
    heading: 'Atualizações',
    check: {
      title: 'Procurar uma versão nova do Jukebox',
      note: 'No máximo uma vez por dia, quando você abre o app, o Jukebox pergunta ao GitHub qual é a versão mais recente. Nada sobre você ou sua biblioteca é enviado, e nada é baixado.',
    },
  },
};
