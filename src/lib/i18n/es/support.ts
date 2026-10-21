import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: 'Informar de un problema',
      note: 'Abre una incidencia en GitHub con los datos ya rellenados. No se envía nada hasta que tú la envíes.',
    },
    title: 'Informar de un problema',
    intro:
      'Desde esta pantalla no sale nada de tu teléfono. «Abrir GitHub» empieza una incidencia nueva con el texto de abajo ya escrito; allí puedes leerlo y cambiarlo, y solo se envía si tú la envías.',
    details: 'Lo que va en la incidencia',
    detailsNote: 'La versión y el teléfono van en sus propios campos del formulario, y el resto en el último. Tus canciones nunca se nombran.',
    errors: {
      title: 'Incluir errores recientes',
      note:
        'Problemas que la app ha detectado por su cuenta, como una descarga o una búsqueda que ha fallado. Los nombres de canciones, las direcciones y las rutas de archivo se han quitado antes de guardarlos.',
      none: 'No se ha anotado ningún error.',
      trimmed: 'Los errores más antiguos se quedan fuera del enlace para que sea lo bastante corto como para abrirse. «Copiar» los incluye todos.',
    },
    open: 'Abrir GitHub',
    openHint: 'Abre en tu navegador una incidencia nueva, rellenada y aún sin enviar',
    copy: 'Copiar',
    copyNote: '¿No tienes cuenta de GitHub? «Copiar» pone el mismo texto en el portapapeles, para pegarlo en una incidencia o en un mensaje.',
    copied: 'Copiado',
    openFailed: 'No se ha podido abrir el enlace. Copia el texto y pégalo en una incidencia.',
    copyFailed: 'Esta versión de la app no puede usar el portapapeles. Selecciona el texto de arriba y cópialo a mano.',
  },

  update: {
    available: (version) => `Jukebox ${version} ya está disponible`,
    note: 'Si la instalaste con Obtainium, te ofrecerá la actualización allí. Si no, toca para abrir la página de la versión y descargarla.',
    hint: 'Abre la página de la versión en tu navegador',
    tab: (settings) => `${settings}, hay una actualización disponible`,
    heading: 'Actualizaciones',
    check: {
      title: 'Buscar una versión nueva de Jukebox',
      note: 'Como mucho una vez al día, al abrir la app, Jukebox pregunta a GitHub cuál es la última versión. No se envía nada sobre ti ni sobre tu biblioteca, y no se descarga nada.',
    },
  },
};
