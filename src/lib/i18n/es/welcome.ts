import type { Strings } from '../en/index.ts';
import { format } from './format.ts';

export const welcome: Strings['welcome'] = {
  language: {
    heading: 'Elige tu idioma',
    note: 'Puedes cambiarlo cuando quieras en Ajustes.',
    go: 'Continuar',
    made:
      'Jukebox lo desarrolla una sola persona. Salvo el inglés, los idiomas los ha traducido una IA y nadie que los hable los ha revisado todavía. Si algo suena mal, avisa en GitHub.',
  },

  setup: {
    step: (at: number, of: number) =>
      `Paso ${format.number(at)} de ${format.number(of)}`,
    skip: 'Omitir',
    skipHint: 'Deja el resto como está y abre Jukebox',
    back: 'Atrás',
    next: 'Continuar',
    done: 'Listo',
    update:
      'Algunos ajustes nuevos en esta versión. Puedes cambiarlos cuando quieras en Ajustes.',
    look: {
      heading: 'Elige un aspecto',
      note: 'Toca uno para probarlo.',
      more:
        'Hay más temas, y la elección de los dos que se usan al seguir el sistema, en Ajustes → Aspecto.',
    },
    discover: {
      heading: 'Descubrir',
      note:
        'Descubrir encuentra canciones que todavía no tienes, de los artistas de tu biblioteca y otros parecidos, y las descarga de YouTube cuando las reproduces.',
      more:
        'La longitud de la lista, cada cuánto se renueva y más están en Ajustes de Descubrir.',
    },
  },

  offer: {
    heading: '¿Buscar portadas y detalles?',
    body: (count) =>
      `Aún no se han buscado los datos de ${format.number(count)} de tus canciones. Jukebox puede encontrar sus portadas, artistas y álbumes en MusicBrainz y en el catálogo iTunes de Apple.`,
    privacy:
      'A esos dos solo se envían los nombres de las canciones, nada más. Funciona en segundo plano mientras escuchas, y también puedes hacerlo más tarde desde Ajustes → Biblioteca → Etiquetas.',
    accept: 'Buscarlas',
    decline: 'Ahora no',
  },

  progress: {
    starting: 'Buscando portadas y detalles…',
    counting: (done, total) =>
      `Buscando portadas y detalles · ${format.number(done)} de ${format.number(total)}`,
    album: (album, done, total) =>
      `Buscando «${album}» · ${format.number(done)} de ${format.number(total)}`,
    covers: (done, total) =>
      `Buscando portadas · ${format.number(done)} de ${format.number(total)}`,
    lyrics: (done, total) =>
      `Buscando letras · ${format.number(done)} de ${format.number(total)}`,
    hint: 'Abre la pantalla Etiquetas, donde se puede seguir y detener la búsqueda',
  },

  tips: {
    library:
      'Mantén pulsada una canción para ver su menú: añadirla a una lista, editar sus detalles o jugar con ella a piano tiles. Desliza una canción a la derecha para que suene a continuación, o a la izquierda para añadirla a la cola.',
    player:
      'Bajo los controles, el botón de la letra la muestra mientras suena la canción, y cuando está a la vista, el botón que aparece a su lado la traduce. El engranaje reúne la velocidad y el tono, los efectos y el temporizador de apagado.',
    discover:
      'Descubrir encuentra canciones que aún no tienes. Hasta que hayas escuchado un tiempo, parte de los artistas de los que más canciones tienes, y aprende de lo que escuchas.',
    dismiss: 'Entendido',
    dismissHint: 'Oculta este consejo para siempre',
  },

  settings: {
    title: 'Primer inicio',
    note:
      'Vuelve a mostrar Jukebox como el día en que lo instalaste: los primeros ajustes, la propuesta de buscar portadas y los consejos. Tu música, tus listas y tus ajustes se quedan como están.',
    again: 'Mostrar de nuevo',
  },

  discoverEarly:
    'Como aún has escuchado poco, Descubrir parte de los artistas de los que más canciones tienes, y aprende de lo que escuchas.',
};
