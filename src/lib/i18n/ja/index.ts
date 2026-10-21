import type { Strings } from '../en/index.ts';
import { backup } from './backup.ts';
import { common } from './common.ts';
import { details } from './details.ts';
import { discover } from './discover.ts';
import { downloads } from './downloads.ts';
import { format } from './format.ts';
import { languages } from './languages.ts';
import { library } from './library.ts';
import { listenbrainz } from './listenbrainz.ts';
import { lists } from './lists.ts';
import { lyrics } from './lyrics.ts';
import { nav } from './nav.ts';
import { player } from './player.ts';
import { search } from './search.ts';
import { settings } from './settings.ts';
import { sound } from './sound.ts';
import { stats } from './stats.ts';
import { support } from './support.ts';
import { themes } from './themes.ts';
import { tiles } from './tiles.ts';
import { welcome } from './welcome.ts';

/*
  Glossary — one Japanese word for each English one, everywhere it appears,
  native strings (values-ja/strings.xml) included.

    track, song ............ 曲 (counter 曲: 3曲); "track number" トラック番号
    album .................. アルバム (counter 枚: アルバム3枚)
    artist ................. アーティスト (counter 人: アーティスト3人)
    list (the app's own) ... リスト (counter 件); a YouTube playlist プレイリスト
    file ................... ファイル (counter 件: ファイル3件, 3件のファイル)
    library ................ ライブラリ
    folder ................. フォルダ
    queue / up next ........ キュー / 次に再生
    play / pause / resume .. 再生 / 一時停止 / 再開
    shuffle / repeat ....... シャッフル / リピート
    a listen (one play) .... 再生 (counter 回: 再生3回); listens kept or sent: 再生記録 (件)
    history ................ 再生履歴
    tag / genre ............ タグ / ジャンル
    cover (of a record) .... ジャケット; a list's own picture カバー画像
    lyrics ................. 歌詞; timed lyrics 同期歌詞, plain テキスト
    look up / a lookup ..... 自動取得 (in progress: 取得中…)
    search / by hand ....... 検索 / 手動で検索
    Discover ............... ディスカバー
    keep (in Library) ...... ライブラリに保存 (swipe panel: 保存)
    exclude / Not this song  除外 / この曲は不要 (swipe panel: 不要)
    preview (30 s clip) .... 試聴
    download / waiting ..... ダウンロード / 待機中
    recap .................. まとめ
    stats .................. 統計
    theme .................. テーマ
    equalizer / effects .... イコライザー / エフェクト
    crossfade / crossfeed .. クロスフェード / クロスフィード
    preamp / band / gain ... プリアンプ / バンド / ゲイン
    backup / import / export バックアップ / インポート / エクスポート
    merge / replace ........ 統合 / 置き換え
    piano tiles; a "key" ... ピアノタイル; タイル (counter 枚)
    phone, device .......... 端末
    write to file .......... ファイルに書き込む
    the updated build ...... 更新版のAndroidアプリ

  Style: sentences and notes in です/ます, buttons and labels as plain nouns
  or short verb phrases with no 。. Full-width （）「」、。：？ in Japanese text.
  No space between Japanese and Latin words or figures (YouTubeで検索, 3曲);
  Latin unit symbols keep their space (20 ms, 3.5 dB). Headings are not
  raised: see `format.upper`.
*/

/**
 * Everything the app says, in Japanese.
 *
 * Declared as a `Strings`, which is the shape of the English table: a line
 * missing here, or one here that English does not have, is a type error in the
 * area file it belongs to rather than a blank on somebody's screen.
 */
export const ja: Strings = {
  format,
  common,
  nav,
  themes,
  languages,
  settings,
  player,
  library,
  lists,
  search,
  downloads,
  stats,
  details,
  sound,
  lyrics,
  discover,
  backup,
  tiles,
  listenbrainz,
  welcome,
  support,
};
