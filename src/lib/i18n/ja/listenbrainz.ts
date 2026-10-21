import { format } from './format.ts';
import type { Strings } from '../en/index.ts';

export const listenbrainz: Strings['listenbrainz'] = {
  heading: 'ListenBrainz',

  connect: {
    title: 'ListenBrainzに接続',
    note:
      '任意です。ListenBrainzでは、聴いた曲の記録を公開できます。ここにユーザートークンを貼り付けるまでは何も送信されず、貼り付けた後も送信をオンにするまでは何も送信されません。',
    where: 'ユーザートークンは、listenbrainz.orgのアカウント設定で確認できます。',
    openSite: 'listenbrainz.org/settingsを開く',
    promptHeading: 'ListenBrainzのユーザートークン',
    promptHint:
      'listenbrainz.org/settingsからコピーして、ここに貼り付けてください。トークンはこの端末にのみ保存され、バックアップには含まれません。',
    placeholder: 'ユーザートークン',
    confirm: '接続',
    checking: 'トークンを確認しています…',
    invalid: 'ListenBrainzがこのトークンを認識しませんでした。何も保存されていません。',
    unreachable: 'ListenBrainzに接続できなかったため、トークンを確認できませんでした。何も保存されていません。',
  },

  connectedAs: (user) => `${user}として接続中`,
  revoked: (user) =>
    user
      ? `ListenBrainzが${user}のトークンを受け付けなくなったため、送信を停止しています。続けるには新しいトークンを貼り付けてください。送信待ちの記録は保持されています。`
      : 'ListenBrainzがトークンを受け付けなくなったため、送信を停止しています。続けるには新しいトークンを貼り付けてください。送信待ちの記録は保持されています。',
  newToken: '新しいトークンを貼り付け',
  openListens: 'ListenBrainzで再生記録を見る',
  refused: (user, why) =>
    `ListenBrainzは${user ? `${user}の` : ''}トークンを認識していますが、再生記録を受け付けませんでした${
      why ? `（ListenBrainzからのメッセージ：「${why}」）` : ''
    }。何も送信されておらず、トークンは保持されています。ListenBrainz側で問題を解決してから、もう一度送信してください。`,

  sending: {
    title: '再生記録を送信',
    note:
      '今後、アプリが記録する再生（30秒を超えて再生したもの）はすべて、ここに表示されているタイトル、アーティスト、アルバムでListenBrainzのアカウントに送信されます。',
    hint: '新しい再生記録をListenBrainzに送信します',
  },

  waiting: (count) => `送信待ちの再生記録：${format.number(count)}件`,
  sendingNow: (count) => `送信中 · 残り${format.number(count)}件`,
  lastSent: (when) => `最終送信：${when}`,
  trouble: {
    offline: 'ListenBrainzに接続できませんでした。送信待ちの記録は保持され、後で再送信されます。',
    busy: 'ListenBrainzからリクエストを減らすよう求められました。送信待ちの記録は保持され、後で再送信されます。',
    server: 'ListenBrainzで問題が発生しています。送信待ちの記録は保持され、後で再送信されます。',
    failed: '今回は送信できませんでした。送信待ちの記録は保持され、後で再送信されます。',
  },

  past: {
    title: '過去の再生記録を送信',
    start: '送信',
    stop: '停止',
    unsent: (count) =>
      `履歴にある${format.number(count)}件の再生記録が未送信です。ListenBrainzでは、それぞれ再生した日の記録として登録されます。`,
    allSent: '履歴はすべて送信済みです。',
    nothing: '履歴はまだありません。',
    progress: (count) =>
      count === 1
        ? '履歴を送信中 · 残り1件。'
        : `履歴を送信中 · 残り${format.number(count)}件。アプリを開いている間は送信が続き、中断しても続きから再開します。`,
    leftOut: (count) =>
      `${format.number(count)}件の再生記録は送信されませんでした。アーティストが設定されていないか、ListenBrainzに受け付けられなかったためです。曲にアーティストを設定してから、もう一度送信してください。`,
    startLabel: '過去の再生記録をListenBrainzに送信',
    stopLabel: '過去の再生記録の送信を停止',
  },

  disconnect: {
    title: '接続を解除',
    note: 'トークンと送信済みの記録の情報を消去します。ListenBrainzにすでにある記録は削除されません。',
    question: (user) => `${user}との接続を解除しますか？`,
    consequence:
      'トークンと、送信待ちおよび送信済みの記録の情報が消去されます。この端末の再生履歴はそのまま残り、ListenBrainz上の記録も削除されません。',
  },
};
