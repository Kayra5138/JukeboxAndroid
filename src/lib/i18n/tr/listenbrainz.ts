import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'ListenBrainz’e bağlan',
    note:
      'İsteğe bağlı. ListenBrainz, dinlediklerinin herkese açık bir kaydını tutabilir. Kullanıcı belirtecini buraya yapıştırana kadar hiçbir şey gönderilmez; yapıştırdıktan sonra da gönderimi sen açana kadar gönderilmez.',
    where: 'Kullanıcı belirtecin listenbrainz.org’da, hesap ayarlarında yazar.',
    openSite: 'listenbrainz.org/settings sayfasını aç',
    promptHeading: 'ListenBrainz kullanıcı belirteci',
    promptHint:
      'listenbrainz.org/settings sayfasından kopyalayıp buraya yapıştır. Yalnızca bu telefonda durur, yedeklere de girmez.',
    placeholder: 'Kullanıcı belirteci',
    confirm: 'Bağlan',
    checking: 'Belirteç doğrulanıyor…',
    invalid: 'ListenBrainz bu belirteci tanımıyor. Hiçbir şey kaydedilmedi.',
    unreachable: 'ListenBrainz’e ulaşılamadığı için belirteç doğrulanamadı. Hiçbir şey kaydedilmedi.',
  },

  connectedAs: (user) => `${user} olarak bağlısın`,
  revoked: (user) =>
    user
      ? `ListenBrainz, ${user} hesabının belirtecini artık kabul etmiyor; bu yüzden hiçbir şey gönderilmiyor. Devam etmek için yeni bir belirteç yapıştır. Bekleyenler duruyor.`
      : 'ListenBrainz belirteci artık kabul etmiyor; bu yüzden hiçbir şey gönderilmiyor. Devam etmek için yeni bir belirteç yapıştır. Bekleyenler duruyor.',
  newToken: 'Yeni belirteç yapıştır',
  openListens: 'Dinlemelerini ListenBrainz’de gör',
  refused: (user, why) =>
    `ListenBrainz ${user ? `${user} hesabının belirtecini` : 'belirteci'} tanıyor ama bu hesap için dinleme kabul etmedi${
      why ? `. Gerekçesi: “${why}”` : '.'
    } Hiçbir şey gönderilmedi, belirteç duruyor. Bunu ListenBrainz’de düzelttikten sonra yeniden gönder.`,

  sending: {
    title: 'Dinlediklerimi gönder',
    note:
      'Bundan sonra uygulamanın kaydettiği her dinleme, yani 30 saniyeyi geçen her şey, burada görünen şarkı adı, sanatçı ve albümle ListenBrainz hesabına gönderilir.',
    hint: 'Yeni dinlemeleri ListenBrainz’e gönderir',
  },

  waiting: (count) => `Gönderilmeyi bekleyen ${format.number(count)} dinleme var`,
  sendingNow: (count) => `Gönderiliyor · ${format.number(count)} dinleme kaldı`,
  lastSent: (when) => `Son gönderim: ${when}`,
  trouble: {
    offline: 'ListenBrainz’e ulaşılamadı. Bekleyenler duruyor, daha sonra yeniden denenecek.',
    busy: 'ListenBrainz daha az istek gönderilmesini istedi. Bekleyenler duruyor, daha sonra yeniden denenecek.',
    server: 'ListenBrainz’de bir sorun var. Bekleyenler duruyor, daha sonra yeniden denenecek.',
    failed: 'Gönderim bu sefer olmadı. Bekleyenler duruyor, daha sonra yeniden denenecek.',
  },

  past: {
    title: 'Geçmiş dinlemeleri gönder',
    start: 'Gönder',
    stop: 'Durdur',
    unsent: (count) =>
      `Geçmişindeki ${format.number(count)} dinleme henüz gönderilmedi. ListenBrainz her birini dinlendiği güne yazar.`,
    allSent: 'Geçmişindeki her şey gönderildi.',
    nothing: 'Geçmişinde henüz bir şey yok.',
    progress: (count) =>
      `Geçmişin gönderiliyor · ${format.number(count)} dinleme kaldı. Uygulama açıkken sürer, kaldığı yerden devam eder.`,
    leftOut: (count) =>
      `${format.number(count)} dinleme gönderilmedi: ya sanatçısı yok ya da ListenBrainz kabul etmedi. Parçaya sanatçı ekleyip yeniden gönderebilirsin.`,
    startLabel: 'Geçmiş dinlemeleri ListenBrainz’e gönder',
    stopLabel: 'Geçmiş dinlemelerin gönderimini durdur',
  },

  disconnect: {
    title: 'Bağlantıyı kes',
    note: 'Belirteci ve hangi dinlemelerin gönderildiğini unutur. ListenBrainz’e gönderilmiş olanlar silinmez.',
    question: (user) => `${user} hesabıyla bağlantı kesilsin mi?`,
    consequence:
      'Belirteç, bekleyenler ve gönderilenlerin kaydı unutulur. Bu telefondaki geçmişine dokunulmaz, ListenBrainz’deki hiçbir şey de silinmez.',
  },
};
