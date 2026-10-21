import { format } from './format.ts';
import type { Strings } from '../en/index.ts';
import type { PeriodId, Which } from '../../stats/period.ts';

/*
  A period is said two ways in the recap's lines: as a time word that stands
  before a verb (今週よく聴いた曲, 過去7日間でよく聴いた曲, これまでによく聴いた曲)
  and as a noun before の (今週の傾向). Words like 今日 and 先週 take no particle
  before a verb, a span such as 過去7日間 takes で, and これまで takes に, so
  each form is written out rather than made from one word.
*/
type Said = Record<Exclude<PeriodId, 'all'>, string>;

const by = (period: PeriodId, which: Which, said: Record<Which, Said> & { all: string }) =>
  period === 'all' ? said.all : said[which][period];

/** Before a verb. */
const when = (period: PeriodId, which: Which) =>
  by(period, which, {
    this: { day: '今日', week: '今週', month: '今月', year: '今年' },
    last: { day: '昨日', week: '先週', month: '先月', year: '昨年' },
    rolling: { day: '過去24時間で', week: '過去7日間で', month: '過去30日間で', year: '過去12か月間で' },
    all: 'これまでに',
  });

/** Before の. */
const named = (period: PeriodId, which: Which) =>
  by(period, which, {
    this: { day: '今日', week: '今週', month: '今月', year: '今年' },
    last: { day: '昨日', week: '先週', month: '先月', year: '昨年' },
    rolling: { day: '過去24時間', week: '過去7日間', month: '過去30日間', year: '過去12か月間' },
    all: 'これまで',
  });

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/** Monday first. */
const weekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];

export const stats: Strings['stats'] = {
  percent: (value) => `${value}%`,

  period: {
    labels: { day: '日', week: '週', month: '月', year: '年', all: 'すべて' },
    which: {
      day: { last: '昨日', this: '今日', rolling: '過去24時間' },
      week: { last: '先週', this: '今週', rolling: '過去7日間' },
      month: { last: '先月', this: '今月', rolling: '過去30日間' },
      year: { last: '昨年', this: '今年', rolling: '過去12か月' },
    },
    allTime: 'すべての期間',
    monthOf: (date) => `${date.getFullYear()}年${format.monthsShort[date.getMonth()]}`,
    /*
      Japanese says a comparison with a period as one word ending in 比:
      前日比 is "against the day before", whichever day that is.
    */
    versus: (period, which) =>
      by(period, which, {
        this: { day: '前日比', week: '前週比', month: '前月比', year: '前年比' },
        last: { day: '前日比', week: '前週比', month: '前月比', year: '前年比' },
        rolling: {
          day: '直前24時間比',
          week: '直前7日間比',
          month: '直前30日間比',
          year: '直前12か月比',
        },
        all: '',
      }),
  },

  duration: {
    seconds: (seconds) => `${seconds}秒`,
    minutes: (minutes) => `${minutes}分`,
    hours: (hours) => `${hours}時間`,
    hoursMinutes: (hours, minutes) => `${hours}時間${minutes}分`,
  },

  figures: {
    plays: '再生回数',
    tracks: '曲数',
    artists: 'アーティスト数',
    finished: '完走率',
    aDay: '1日平均',
    peakHour: 'ピーク時間帯',
    streak: '連続記録',
    days: (count) => `${count}日`,
  },

  chart: {
    day: (date) =>
      `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[(date.getDay() + 6) % 7]}`,
    month: (date) => `${date.getFullYear()}年${date.getMonth() + 1}月`,
  },

  screen: {
    emptyTitle: 'まだ何も再生していません。',
    emptyBody:
      '曲は30秒聴くと再生としてカウントされます。1分未満の曲は半分聴くとカウントされます。',
    recap: 'まとめ',
    openRecap: 'まとめを開く',
    changeFigure: (change) => `${arrow(change)} ${Math.abs(change)}%`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: 'この期間はまだ何もありません',
    time: '再生時間',
    plays: '再生回数',
    playsCount: (count) => `${count}回再生`,
    was: (before) => `前回：${before}`,
    lists: { tracks: '曲', artists: 'アーティスト', genres: 'ジャンル' },
    lookUpForGenres: 'ジャンルを集めるには、曲の情報を自動取得してください。',
    nothingInPeriod: 'この期間には何もありません。',
  },

  report: {
    tracksHeading: 'トップ曲',
    tracksLead: (period, which) => `${when(period, which)}よく聴いた曲`,
    artistsHeading: 'トップアーティスト',
    artistsLead: (period, which) => `${when(period, which)}一緒に過ごしたアーティスト`,
    genresHeading: 'あなたのサウンド',
    genresLead: (period, which) => `${named(period, which)}の音楽の傾向`,
    clockHeading: 'リスニングの時間帯',
    clockLead: (hour) => `${hour}ごろに最もよく聴いていました`,
    numbersHeading: '数字で振り返る',
    streakDays: (count) => `${count}日`,
  },

  cards: {
    listenedFor: '合計再生時間',
    /* 前日比 ↑ 12%: Japanese puts the comparison first. */
    change: (change, comparison) =>
      `${comparison ? `${comparison} ` : ''}${arrow(change)} ${Math.abs(change)}%`,
    numberOne: '第1位',
    plays: (count) => `${count}回再生`,
    mostPlayed: '最も再生した曲',
    mostPlayedArtist: '最も再生したアーティスト',
    credit: (photographer, licence) => `写真：${photographer} / ${licence}`,
    creditUnnamed: (licence) => `写真：${licence}`,
  },

  viewer: {
    share: '共有',
    saved: 'ギャラリーに保存しました。',
    cannotSave: '画像を保存するには、更新版のAndroidアプリをインストールしてください。',
    cannotShare: '画像を共有するには、更新版のAndroidアプリをインストールしてください。',
    failed: 'うまくいきませんでした。もう一度お試しください。',
  },
};
