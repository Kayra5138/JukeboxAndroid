import type { Strings } from '../en/index.ts';
import type { PeriodId, Which } from '../../stats/period.ts';

/*
  A period goes at the front of a Chinese sentence, as its time: 本周你最常听的歌,
  "what you listened to most this week". The same words serve every card.
*/
function saidAs(period: PeriodId, which: Which): string {
  if (period === 'all') return '迄今为止';
  if (which === 'last') return { day: '昨天', week: '上周', month: '上个月', year: '去年' }[period];
  if (which === 'rolling') {
    return { day: '过去 24 小时', week: '过去 7 天', month: '过去 30 天', year: '过去 12 个月' }[period];
  }
  return { day: '今天', week: '本周', month: '本月', year: '今年' }[period];
}

const arrow = (change: number) => (change >= 0 ? '↑' : '↓');

/** Monday first. */
const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

export const stats: Strings['stats'] = {
  percent: (value) => `${value}%`,

  period: {
    labels: { day: '日', week: '周', month: '月', year: '年', all: '全部' },
    which: {
      day: { last: '昨天', this: '今天', rolling: '过去 24 小时' },
      week: { last: '上周', this: '本周', rolling: '过去 7 天' },
      month: { last: '上个月', this: '本月', rolling: '过去 30 天' },
      year: { last: '去年', this: '今年', rolling: '过去 12 个月' },
    },
    allTime: '全部时间',
    /** `2026年9月`: dates are written without spaces between their parts. */
    monthOf: (date) => `${date.getFullYear()}年${date.getMonth() + 1}月`,
    versus: (period, which) => {
      if (period === 'all') return '';
      if (which === 'last') {
        return { day: '较前一天', week: '较前一周', month: '较前一个月', year: '较前一年' }[period];
      }
      if (which === 'rolling') {
        return {
          day: '较之前 24 小时',
          week: '较之前 7 天',
          month: '较之前 30 天',
          year: '较之前 12 个月',
        }[period];
      }
      return { day: '较昨天', week: '较上周', month: '较上个月', year: '较去年' }[period];
    },
  },

  /*
    Written close, `4小时12分`, as a duration is in a figure: the cards it goes
    on hold about four characters at 17 points, and `4 小时 12 分钟` would be
    cut off where English's `4h 12m` fits.
  */
  duration: {
    seconds: (seconds) => `${seconds}秒`,
    minutes: (minutes) => `${minutes}分钟`,
    hours: (hours) => `${hours}小时`,
    hoursMinutes: (hours, minutes) => `${hours}小时${minutes}分`,
  },

  figures: {
    plays: '播放次数',
    tracks: '歌曲',
    artists: '艺人',
    finished: '完整播放',
    aDay: '日均',
    peakHour: '高峰时段',
    streak: '连续收听',
    days: (count) => `${count} 天`,
  },

  chart: {
    /** `9月24日 星期四`. */
    day: (date) => `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[(date.getDay() + 6) % 7]}`,
    /** `2026年9月`. */
    month: (date) => `${date.getFullYear()}年${date.getMonth() + 1}月`,
  },

  screen: {
    emptyTitle: '还没有收听记录。',
    emptyBody: '一首歌听满 30 秒才会被计入；不到一分钟的歌，听满一半即可。',
    recap: '回顾',
    openRecap: '查看你的听歌回顾',
    changeFigure: (change) => `${arrow(change)} ${Math.abs(change)}%`,
    against: (comparison, before) => (before ? `${comparison} · ${before}` : comparison),
    nothingYet: '此时段还没有记录',
    time: '时长',
    plays: '次数',
    playsCount: (count) => `${count} 次`,
    was: (before) => `之前 ${before}`,
    lists: { tracks: '歌曲', artists: '艺人', genres: '流派' },
    lookUpForGenres: '在线查询歌曲信息后即可统计流派。',
    nothingInPeriod: '此时段没有记录。',
  },

  report: {
    tracksHeading: '你的热门歌曲',
    tracksLead: (period, which) => `${saidAs(period, which)}你最常听的歌`,
    artistsHeading: '你的热门艺人',
    artistsLead: (period, which) => `${saidAs(period, which)}陪伴你最多的艺人`,
    genresHeading: '你的音乐风格',
    genresLead: (period, which) => `${saidAs(period, which)}你的曲风构成`,
    clockHeading: '你的听歌时间',
    clockLead: (hour) => `你最常在 ${hour} 前后听歌`,
    numbersHeading: '数据一览',
    streakDays: (count) => `${count} 天`,
  },

  cards: {
    listenedFor: '你一共听了',
    /** Chinese puts what is compared against first: `较昨天 ↑ 12%`. */
    change: (change, comparison) => `${comparison} ${arrow(change)} ${Math.abs(change)}%`,
    numberOne: '第一名',
    plays: (count) => `${count} 次播放`,
    mostPlayed: '最常播放',
    mostPlayedArtist: '最常播放的艺人',
    credit: (photographer, licence) => `照片：${photographer} / ${licence}`,
    creditUnnamed: (licence) => `照片：${licence}`,
  },

  viewer: {
    share: '分享',
    saved: '已保存到相册。',
    cannotSave: '请安装新版应用以保存图片。',
    cannotShare: '请安装新版应用以分享图片。',
    failed: '操作失败，请重试。',
  },
};
