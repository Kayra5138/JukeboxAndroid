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
  Glossary, held to everywhere in this folder and in
  modules/jukebox-audio/android/src/main/res/values-b+zh+Hans/strings.xml:

    track, song ............ 歌曲 (count: N 首歌曲)
    album .................. 专辑 (N 张专辑)
    artist ................. 艺人 (N 位艺人)
    list (the app's own) ... 歌单 (N 个歌单)
    playlist (YouTube's) ... 播放列表
    library ................ 音乐库
    library folder ......... 音乐库文件夹
    folder / file .......... 文件夹 / 文件 (N 个文件)
    queue (playback) ....... 播放队列; Up next 待播
    download queue ......... 下载队列
    play next .............. 下一首播放
    shuffle ................ 随机播放
    repeat / all / one ..... 循环播放 / 列表循环 / 单曲循环
    tag / genre ............ 标签 / 流派
    cover .................. 封面
    lyrics ................. 歌词; timed 同步歌词, plain 纯文本
    look up (a lookup) ..... 在线查询
    details (of a track) ... 信息; track number 音轨号, disc number 碟片号
    write to files ......... 写入文件
    listen (one heard) ..... 收听记录 (N 条收听记录), N 次收听
    play (a count) ......... 播放 N 次 / N 次播放
    crossfade .............. 交叉淡化
    equalizer .............. 均衡器; band 频段, preset 预设, preamp 前置增益,
                             gain 增益, frequency 频率, Q Q 值
    effects ................ 音效; width 宽度, crossfeed 交叉馈送, rotation 旋转,
                             level 电平, balance 声道平衡
    even out loudness ...... 音量均衡
    speed / pitch .......... 速度 / 音调
    sleep timer ............ 睡眠定时
    theme .................. 主题; System 跟随系统, light 浅色, dark 深色
    rack (cover flow) ...... 专辑唱片架
    heart .................. 爱心
    Discover ............... 发现 (quoted “发现” inside a sentence)
    keep (in Discover) ..... 保留; Not this song 不要这首
    exclude / block ........ 排除 / 屏蔽
    stats / recap .......... 统计 / 回顾 (听歌回顾)
    piano tiles ............ 钢琴块
    backup / import / export 备份 / 导入 / 导出; merge 合并, replace 替换
    token (ListenBrainz) ... 用户令牌
    "Install the updated
     Android build" ........ 请安装新版应用 (never "Android 版本", which reads
                             as the phone's Android version)

  Writing:
    - 你 throughout, warnings included.
    - Full-width punctuation in Chinese text: ，。：；！？（）“”、——…
      Names and titles inside a sentence are quoted “…”; artists, which read
      as names already, and brand names are not.
    - A half-width space between Chinese and Latin letters or digits:
      “12 首歌曲”, “从 Deezer 找到”. No space beside full-width punctuation, and
      none inside a calendar date (2026年9月, 9月24日, 1月), as dates are
      conventionally written, nor inside a duration figure in the stats
      (4小时12分), which has to fit a small card.
    - Complete sentences end in 。; buttons, labels, titles and short states
      do not.
    - Brand names stay in Latin script: Jukebox, YouTube, MusicBrainz,
      ListenBrainz, LRCLIB, Deezer, Apple, AutoEQ, yt-dlp, GitHub, Wi-Fi, MP3,
      FLAC, Android.
*/

/**
 * Everything the app says, in Simplified Chinese.
 *
 * Declared as a `Strings`, which is the shape of the English table: a line
 * missing here, or one here that English does not have, is a type error in the
 * area file it belongs to rather than a blank on somebody's screen.
 */
export const zhHans: Strings = {
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
