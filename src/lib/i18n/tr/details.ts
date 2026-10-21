import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

const files = (count: number) => `${format.number(count)} dosya`;

/** Hangi alanların yazıldığını söyleyen satırda, dosyadaki alanların adları. */
const FIELD_NAMES: Record<string, string> = {
  title: 'başlık',
  artist: 'sanatçı',
  album: 'albüm',
  albumArtist: 'albüm sanatçısı',
  genre: 'tür',
  year: 'yıl',
  track: 'parça numarası',
  disc: 'disk numarası',
  cover: 'kapak',
};

function listed(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`;
}

export const details: Strings['details'] = {
  screen: {
    tabs: { general: 'Genel', tags: 'Etiketler', lyrics: 'Sözler' },
    missing:
      'Bu parça artık kütüphanede değil. Silinmiş, taşınmış ya da Jukebox’ın okuduğu klasörün dışında kalmış olabilir.',
    goBack: 'Geri dön',
  },

  lookUp: 'Otomatik bul',
  searchFailed: 'Arama yapılamadı.',

  general: {
    fields: {
      title: 'Başlık',
      artist: 'Sanatçı',
      album: 'Albüm',
      albumArtist: 'Albüm sanatçısı',
      year: 'Çıkış yılı',
      trackNumber: 'Parça numarası',
      discNumber: 'Disk numarası',
    },
    notAYear: 'Bu bir yıl değil.',
    notAPlace: '1 ya da daha büyük bir tam sayı gir.',

    chooseCoverLabel: 'Galeriden kapak seç',
    noCover: 'Kapak yok',
    chooseFromGallery: 'Galeriden seç',
    removeCover: 'Kapağı kaldır',
    keepCover: 'Eski kapak kalsın',
    coverChosen: 'Kapak seçildi. Kalması için kaydet.',

    lookUpHint:
      'Başlığı ve sanatçıyı aşağıda yazdığı şekliyle arar ve bulduklarını doldurur: adlar, albüm, yıl, albümdeki sıra ve kapak.',
    nothingFound: 'Bu başlık ve sanatçı için hiçbir şey bulunamadı.',
    found: (sources, withCover) =>
      `${sources.join(' ve ')} üzerinde bulundu${withCover ? ', kapak dahil' : ''}. Kontrol et, kalması için kaydet.`,

    discard: 'Düzenlememi sil',
    saveHint:
      'Burada kaydettiklerin sana ait sayılır: kütüphane yeniden arandığında bu parçanın üzerine yazılmaz, olduğu gibi bırakılır.',
    editGone: 'Düzenlemen silindi. Otomatik arama burayı yeniden doldurabilir.',

    inFile: 'Dosyada',
    writeLabel: 'Bu bilgileri dosyaya yaz',
    writeToFile: 'Dosyaya yaz',
    saveFirst: 'Önce kaydet. Dosyaya yalnızca kaydedilmiş olanlar yazılır.',
    writeHint:
      'Başlığı, sanatçıyı, albümü, yılı, parça ve disk numarasını kütüphanede göründüğü ' +
      'şekliyle, ilk etiketi tür olarak ve burada kaydedilen kapağı dosyanın kendisine ' +
      'yazar; böylece başka oynatıcılar ve başka cihazlar da bunları görür. Android, ' +
      'herhangi bir şey değişmeden önce iznini ister. Dosyadaki diğer her şey olduğu ' +
      'gibi bırakılır; sözler yazılmaz.',
    cannotWrite: 'Yalnızca MP3 ve FLAC dosyalarına yazılabilir. Bu parçanın bilgileri uygulamada kalır.',
    nothingWritten: 'Hiçbir şey yazılmadı.',
    couldNotWrite: 'Yazılamadı.',

    listening: 'Dinleme',
    timesPlayed: 'Dinlenme sayısı',
    playedToEnd: 'Sonuna kadar dinlendi',
    timeSpent: 'Geçirilen süre',
    firstPlayed: 'İlk dinlenme',
    lastPlayed: 'Son dinlenme',
    never: 'hiç',
    listenedSeconds: (seconds) => `${format.number(seconds)} saniye`,
    listenedMinutes: (minutes) => `${format.number(minutes)} dakika`,
    listenedHours: (hours, minutes) => `${format.number(hours)} sa ${minutes} dk`,

    file: 'Dosya',
    name: 'Ad',
    folder: 'Klasör',
    length: 'Süre',
    detailsFrom: 'Bilgilerin kaynağı',
    unknown: 'bilinmiyor',
    from: {
      notLookedUp: 'aranmadı',
      yourEdit: 'senin düzenlemen',
      notFound: 'bulunamadı',
      lookup: 'otomatik arama',
    },
  },

  tags: {
    lookUpHint:
      'Bu parçanın etiketlerini arar. Senin yazdıkların kalır; önceki aramanın getirdikleri, şimdi bulunanlarla değiştirilir.',
    noneFound: 'Bu parça için etiket bulunamadı.',
    found: (count, source) =>
      `${source} kaynağından ${format.number(count)} etiket geldi. Sırala, kalması için kaydet.`,
    saveHint:
      'İlk etiket tür olarak sayılır. Senin yazdığın etiket sana ait sayılır: sonraki aramalar onu kaldırmaz.',
  },

  editor: {
    label: 'Etiketler',
    add: 'Etiket ekle',
    moveUp: (tag) => `${tag} etiketini yukarı taşı`,
    moveDown: (tag) => `${tag} etiketini aşağı taşı`,
    remove: (tag) => `${tag} etiketini kaldır`,
  },

  tagPrompt: {
    heading: (count) => `${format.number(count)} parçaya etiket ekle`,
    placeholder: 'Etiket',
  },

  lyrics: {
    lookUpHint:
      'Bu parçanın sözlerini, parça çalınırken yapıldığı gibi arar ve bulursa kayıtlı olanın yerine koyar.',
    nothingMatched: 'Bu parçayla eşleşen bir şey bulunamadı. Aşağıdaki arama hiçbir sonucu elemez.',
    foundAndSaved: 'Bulundu ve kaydedildi.',
    nothingCameBack: 'Bu arama için sonuç gelmedi.',
    cleared: 'Temizlendi. Sonraki otomatik arama yeniden arayacak.',
    notSeconds: 'Bu bir saniye değeri değil.',

    stored: 'Kayıtlı olan',
    none: 'Henüz yok',
    kept: (timed, byHand, lines) =>
      `${timed ? 'Zamanlı' : 'Düz metin'}, ${byHand ? 'elle seçildi' : 'LRCLIB’den'}` +
      (lines > 0 ? ` · ${format.number(lines)} satır` : ''),
    forget: 'Bunu unut ve yeniden ara',
    saveChanges: 'Değişiklikleri kaydet',
    timedHint:
      'Her satırın önünde kendi zamanı durur. Sözleri değiştir, köşeli parantezlere dokunma; yoksa satır yerini kaybeder.',
    plainHint:
      'İstediğini değiştir. Kaydedilen sözler sana ait sayılır ve hiçbir arama onların yerine başkasını koymaz.',

    timing: 'Zamanlama',
    timingHint:
      'Bütün satırları birlikte kaydırır. Sözler doğru ama erken ya da geç geliyorsa kullan — oynatıcıyı açıp sözler yerine oturana kadar kaydır ya da değere dokunup yaz. Artı değer sözleri geciktirir.',
    earlier: (seconds) => `−${format.decimal(seconds, 2)} sn`,
    later: (seconds) => `+${format.decimal(seconds, 2)} sn`,
    shiftedEarlier: (written) => `−${written} sn`,
    shiftedLater: (written) => `+${written} sn`,
    noShift: 'kaydırma yok',
    reset: 'Sıfırla',
    offsetHeading: 'Sözler ne kadar kayık?',
    offsetPlaceholder: 'Saniye, ör. 1,5 ya da -0,75',
    typeOffset: 'Kesin kaydırmayı yaz',
    wordsField: 'Şarkı sözleri',

    byHand: 'Elle ara',
    byHandHint:
      'Otomatik aramanın tersine burada hiçbir sonuç elenmez. Otomatik arama, süresi tutmayan her sonucu reddeder; bazı parçaların sözlerinin hiç bulunamamasının nedeni de budur.',
    queryPlaceholder: 'Sanatçı ve başlık',
    candidateTimed: 'zamanlı',
    candidatePlain: 'düz',

    paste: 'Yapıştır',
    pasteHint: 'LRC dosyası ya da düz metin kabul eder. Zaman damgaları varsa sözler zamanlı olur.',
    savePasted: 'Yapıştırılanı kaydet',
  },

  library: {
    coversSaved: (count) => `${format.number(count)} albüm kapağı eklendi.`,
    stoppedOffline: (matched) =>
      `Hiçbir yanıt gelmediği için arama, ${format.number(matched)} eşleşmeden sonra durdu. Geri kalanlar için hiçbir şey yazılmadı — hâlâ denenmeyi bekliyorlar.`,
    serviceUnreachable: (service) =>
      `${service} servisine ulaşılamadı, arama onsuz devam etti. Ona ihtiyacı olanlar olduğu gibi bırakıldı ve bir dahaki sefere denenecek.`,
    stoppedUnexpectedly: 'Arama beklenmedik şekilde durdu.',

    nothingAnswered: 'Hiçbir yanıt gelmedi. Durduruluyor.',
    rateLimited: 'Servislerden biri ara verilmesini istedi. Bir dakika sonra yeniden sorulacak.',
    lookingUp: 'Aranıyor…',
    lookingUpProgress: (done, total) =>
      `Aranıyor… ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    lookingUpAlbum: (album, done, total) =>
      `“${album}” aranıyor… ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    soFar: (matched, covers) =>
      `Şimdiye kadar ${format.number(matched)} eşleşme, ${format.number(covers)} kapak`,
    stop: 'Durdur',
    lookupChannel: 'Bilgi aramaları',

    selected: (count) => `${format.number(count)} seçili`,
    summary: (matched, edited, notFound, untried) =>
      [
        `${format.number(matched)} eşleşti`,
        edited > 0 ? `${format.number(edited)} düzenlendi` : null,
        `${format.number(notFound)} bulunamadı`,
        `${format.number(untried)} denenmedi`,
      ]
        .filter(Boolean)
        .join(' · '),
    reset: 'Sıfırla',
    lookUpMissing: 'Eksikleri ara',
    hint: 'Elle düzeltmek için bir parçaya dokun. Art arda seçmek için onay kutularının üzerinde aşağı sürükle.',
    searchPlaceholder: 'Bu parçalarda ara',

    noGenre: 'tür yok',
    noMatch: 'eşleşme bulunamadı',
    notLookedUp: 'henüz aranmadı',
    matchedSpoken: (artist, title) => `Eşleşti: ${artist} — ${title}`,
    manualSpoken: (artist, title) => `Elle girildi: ${artist} — ${title}`,
  },

  selection: {
    more: 'Daha fazla…',
    moreHint: 'Seçili parçalarla yapılabilecek her şey',
    heading: (count) => `${format.number(count)} parça seçili`,
    sections: { find: 'Otomatik bul', change: 'Düzenle', other: 'Diğer' },
    actions: {
      lookUp: {
        label: 'Bilgileri otomatik bul',
        hint: 'Daha önce bulunanları unutur ve kapaklar dahil yeniden arar. Senin düzenlemelerin kalır.',
      },
      covers: {
        label: 'Kapakları otomatik bul',
        hint: 'Yalnızca kapağı olmayanlara kapak arar. Başka hiçbir şey yeniden aranmaz; senin seçtiğin ya da kaldırdığın kapak olduğu gibi kalır.',
      },
      lyrics: {
        label: 'Sözleri otomatik bul',
        hint: 'Önce dosyalara ve .lrc dosyalarına, sonra LRCLIB’e bakar. Senin seçtiğin sözler kalır.',
      },
      edit: {
        label: 'Bilgileri birlikte düzenle',
        hint: 'Sanatçı, albüm sanatçısı, albüm ya da yıl; hepsine tek seferde',
      },
      addTag: { label: 'Etiket ekle', hint: 'Tek bir etiket, hepsine eklenir' },
      removeTag: { label: 'Etiket kaldır', hint: 'Etiketlerinden biri, hepsinden kaldırılır' },
      cover: { label: 'Kapak seç', hint: 'Galeriden bir resim, hepsi için' },
      write: {
        label: 'Dosyalara yaz',
        hint: 'Kütüphanede görünen bilgileri dosyaların kendisine yazar. Android önce sorar.',
      },
      addToList: { label: 'Listeye ekle', hint: 'Listelerinden birine koyar' },
      reset: {
        label: 'Sıfırla',
        hint: 'Aramaların bu parçalar için bulduklarını unutur. Senin düzenlemelerin kalır.',
      },
      delete: { label: 'Telefondan sil', hint: 'Dosyaları siler. Android önce sorar.' },
    },
    busy: 'Başka bir arama sürüyor. Bitmesini bekle ya da durdur.',

    editHeading: (count) => `${format.number(count)} parçayı düzenle`,
    editHint:
      'Yalnızca hepsinde aynı olması gerekeni doldur. Boş bırakılan kutu her parçayı olduğu gibi bırakır; bir alanı hepsinde boşaltmak için altındaki seçeneği işaretle. Başlıklara, parça ve disk numaralarına dokunulmaz.',
    keepEach: 'Her biri kendi değerini korur',
    empty: 'Boş',
    clearOn: { remove: 'Hepsinden kaldır', own: 'Dosyadaki sanatçıyı kullan' },
    cleared: { remove: 'Hepsinden kaldırılacak', own: 'Her parçanın dosyasındaki sanatçı' },
    edited: (count) =>
      count === 1
        ? 'Kaydedildi. Artık senin düzenlemen; aramalar ona dokunmaz.'
        : `${format.number(count)} parça için kaydedildi. Artık senin düzenlemelerin; aramalar onlara dokunmaz.`,

    tagAdded: (tag, count) => `“${tag}” artık ${format.number(count)} parçada.`,
    removeTagHeading: (count) => `${format.number(count)} parçadan etiket kaldır`,
    tagOption: (tag, count) => `${tag} · ${format.number(count)}`,
    noTags: 'Bu parçaların hiçbirinde etiket yok.',
    tagRemoved: (tag, count) => `“${tag}”, ${format.number(count)} parçadan kaldırıldı.`,

    resetQuestion: (count) => `${format.number(count)} parça sıfırlansın mı?`,
    resetBody:
      'Aramaların bu parçalar için bulduğu her şey unutulur ve hiç aranmamış sayılırlar. Senin düzenlemelerin kalır. Bu geri alınamaz.',

    coversProgress: (done, total) =>
      `Kapaklar aranıyor… ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    coversNone: 'Yeni kapak bulunamadı.',
    lyricsProgress: (done, total) =>
      `Sözler aranıyor… ${format.number(total)} parçadan ${format.number(done)} tanesi tamam`,
    lyricsSoFar: (found) => `Şimdiye kadar ${format.number(found)} tanesi bulundu`,
    lyricsFound: (found, wanted, had) =>
      [
        wanted > 0
          ? `${format.number(wanted)} parçanın ${format.number(found)} tanesi için söz bulundu.`
          : null,
        had > 0 ? `${format.number(had)} tanesinde zaten vardı.` : null,
      ]
        .filter(Boolean)
        .join(' ') || 'Aranacak bir şey yok: bu parçaların sözlerini elle seçmişsin.',
    lyricsOffline: 'LRCLIB’e ulaşılamadığı için arama durdu. Geri kalanlar daha sonra yeniden denenebilir.',
  },

  write: {
    heading: (count) => `Bilgiler ${files(count)}ya yazılsın mı?`,
    body: (count) =>
      `${files(count)} değiştirilecek: her biri için kütüphanede görünen başlık, sanatçı, albüm, ` +
      'yıl, parça ve disk numarası, tür olarak ilk etiket ve kaydedilmiş kapak dosyanın ' +
      'kendisine yazılır. Android senden izin isteyecek. Dosyadaki diğer her şey olduğu gibi ' +
      'bırakılır.',
    noneHeading: 'Bunların hiçbirine yazılamıyor',
    noneBody: 'Yalnızca MP3 ve FLAC dosyalarına yazılabilir; çalmakta olan parçaya da yazılamaz.',
    skipping: (otherKind, playing) =>
      otherKind > 0 && playing
        ? `Başka türden ${files(otherKind)} ve çalmakta olan parça atlanacak.`
        : otherKind > 0
          ? `Başka türden ${files(otherKind)} atlanacak.`
          : 'Çalmakta olan parça atlanacak.',
    confirmLabel: (count) => `Bilgileri ${files(count)}ya yaz`,
    confirm: 'Yaz',
    nothingWritten: 'Hiçbir şey yazılmadı.',
    couldNotStart: 'Başlatılamadı.',

    writing: 'Dosyalara yazılıyor',
    progressLabel: (done, total) => `${files(total)}dan ${format.number(done)} tanesi yazıldı`,
    progress: (done, total) => `${format.number(done)} / ${format.number(total)}`,
    stopping: 'Bu dosya bitince durdurulacak.',
    keepOpen: 'Her dosya, aslına dokunulmadan önce kontrol edilir. Uygulamayı açık tut.',
    stopLabel: 'Yazılmakta olan dosyadan sonra durdur',
    stop: 'Durdur',
    stoppedShort: (count) => `Durduruldu; ${files(count)} denenmedi.`,

    written: (changed) =>
      changed.length > 0
        ? `Yazıldı: ${listed(changed.map((name) => FIELD_NAMES[name] ?? name))}.`
        : 'Yazıldı.',
    unchanged: 'Zaten bunların hepsi yazılı. Olduğu gibi bırakıldı.',
    skippedPlaying: 'Atlandı: şu anda çalıyor. Çalmadığı bir zaman yeniden dene.',
    skippedFormat: 'Atlandı: yalnızca MP3 ve FLAC dosyalarına yazılabilir.',
    failed: (reason) => `Başarısız: ${reason}`,
    noReason: 'Yazılamadı. Dosyaya dokunulmadı.',

    summary: (counts) => {
      const parts: string[] = [];
      if (counts.written > 0) parts.push(`${files(counts.written)} yazıldı.`);
      if (counts.unchanged > 0) parts.push(`${files(counts.unchanged)} zaten aynıydı.`);
      if (counts.skipped > 0) parts.push(`${files(counts.skipped)} atlandı.`);
      if (counts.failed > 0) parts.push(`${files(counts.failed)} yazılamadı.`);
      return parts.length > 0 ? parts.join(' ') : 'Yazılacak bir şey yok.';
    },
  },

  same: {
    note:
      'Bunlar iki ayrı dosyadaki tek bir şarkıya benziyor. Birleştirince ilk dosyaya ait her şey ikincisine aktarılır: dinlemeleri, etiketleri, sözleri ve listelerdeki yerleri. Ayrı tutarsan ikisi de olduğu gibi kalır ve bu çift sana bir daha sorulmaz.',
    failed: (error) => `Bu yapılamadı ve hiçbir şey değişmedi. ${error}`,
    empty: 'Karar verilecek bir şey kalmadı.',
    from: 'Buradan',
    into: 'Buraya',
    keepApart: 'Ayrı tut',
    merge: 'Birleştir',
    bulk: {
      mergeDelete: 'Birleştir ve ilk dosyayı sil',
      deleteToo: 'Her çiftteki ilk dosyayı da sil',
      deleteNote: 'Bir şey silinmeden önce Android onay ister.',
      notDeleted: 'Dosyalar silinmedi.',
      deleted: (count) => `${format.number(count)} dosya silindi.`,
      choose: 'Bu çifti seç',
      chosen: (count) => `${format.number(count)} çift seçildi`,
      merge: (count) => `${format.number(count)} çifti birleştir`,
      keepApart: (count) => `${format.number(count)} çifti ayrı tut`,
      confirm: (count) =>
        count === 1
          ? 'Bu çift birleştirilsin mi? İlk dosyanın dinlemeleri, etiketleri, sözleri ve listelerdeki yerleri ikinciye geçer; bu geri alınamaz.'
          : `${format.number(count)} çift birleştirilsin mi? Her birinde ilk dosyanın dinlemeleri, etiketleri, sözleri ve listelerdeki yerleri ikinciye geçer; bu geri alınamaz.`,
      done: (done, skipped) =>
        skipped > 0
          ? `${format.number(done)} çift yanıtlandı; ${format.number(skipped)} tanesi başka bir yanıtla zaten çözülmüştü.`
          : `${format.number(done)} çift yanıtlandı.`,
    },
    unknown: 'Bilinmiyor',
    noFileName: 'Dosya adı bilinmiyor',
    holds: (side) => {
      const parts: string[] = [];
      if (side.listens > 0) parts.push(`${format.number(side.listens)} dinleme`);
      if (side.tags > 0) parts.push(`${format.number(side.tags)} etiket`);
      if (side.lyrics) parts.push('sözler');
      if (side.lists > 0) parts.push(`${format.number(side.lists)} listede`);
      return parts.length > 0 ? parts.join(' · ') : 'Henüz bir şey yok';
    },
  },
};
