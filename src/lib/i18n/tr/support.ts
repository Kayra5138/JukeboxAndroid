import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: 'Sorun bildir',
      note: 'Bilgileri önceden doldurulmuş bir GitHub hata kaydı açar. Sen göndermedikçe hiçbir şey gönderilmez.',
    },
    title: 'Sorun bildir',
    intro:
      'Bu ekran telefonundan dışarıya hiçbir şey göndermez. “GitHub’ı aç”, aşağıdaki metinle önceden doldurulmuş yeni bir hata kaydı başlatır; metni orada okuyup değiştirebilirsin, kayıt da ancak sen gönderirsen gönderilir.',
    details: 'Kayda girecek olanlar',
    detailsNote: 'Sürüm ve telefon formdaki kendi kutularına, geri kalanı en sondakine yazılır. Şarkılarının adı hiçbir zaman geçmez.',
    errors: {
      title: 'Son hataları ekle',
      note:
        'Jukebox’ın kendiliğinden fark ettiği sorunlar; örneğin başarısız olan bir indirme ya da arama. Şarkı adları, adresler ve dosya yolları kaydedilmeden önce çıkarıldı.',
      none: 'Henüz bir hata kaydedilmedi.',
      trimmed: 'Bağlantı açılabilecek kadar kısa kalsın diye en eski hatalar bağlantıya eklenmedi. “Kopyala” ise hepsini içerir.',
    },
    open: 'GitHub’ı aç',
    openHint: 'Tarayıcında, doldurulmuş ama henüz gönderilmemiş yeni bir hata kaydı açar',
    copy: 'Kopyala',
    copyNote: 'GitHub hesabın yok mu? “Kopyala” aynı metni panoya alır; bir hata kaydına ya da bir mesaja yapıştırabilirsin.',
    copied: 'Kopyalandı',
    openFailed: 'Bağlantı açılamadı. Metni kopyalayıp bir hata kaydına yapıştırabilirsin.',
    copyFailed: 'Uygulamanın bu sürümü panoyu kullanamıyor. Yukarıdaki metni seçip elle kopyala.',
  },

  update: {
    available: (version) => `Jukebox ${version} çıktı`,
    note: 'Obtainium ile kurduysan güncellemeyi orada görürsün. Kurmadıysan sürüm sayfasını açmak için dokun ve oradan indir.',
    hint: 'Sürüm sayfasını tarayıcında açar',
    tab: (settings) => `${settings}, güncelleme var`,
    heading: 'Güncellemeler',
    check: {
      title: 'Yeni sürümleri denetle',
      note: 'Jukebox günde en çok bir kez, uygulamayı açtığında GitHub’a en yeni sürümü sorar. Senin ya da kütüphanen hakkında hiçbir şey gönderilmez, hiçbir şey de indirilmez.',
    },
  },
};
