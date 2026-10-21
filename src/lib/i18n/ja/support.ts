import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: '問題を報告',
      note: '詳細を入力済みのGitHubのIssueを開きます。送信するまで何も送られません。',
    },
    title: '問題を報告',
    intro:
      'この画面から端末の外へ送られるものはありません。「GitHubを開く」を押すと、下のテキストが入力された新しいIssueの作成画面が開きます。そこで内容を確認・編集でき、送信したときだけ送られます。',
    details: 'Issueに入る内容',
    detailsNote: 'バージョンと端末はフォームのそれぞれの欄に、残りは最後の欄に入ります。曲名が含まれることはありません。',
    errors: {
      title: '最近のエラーを含める',
      note:
        'ダウンロードや検索の失敗など、Jukeboxが自動で記録した問題です。曲名、アドレス、ファイルパスは保存する前に取り除かれています。',
      none: '記録されたエラーはありません。',
      trimmed: 'リンクを開ける長さに収めるため、古いエラーはリンクから省いています。「コピー」にはすべて含まれます。',
    },
    open: 'GitHubを開く',
    openHint: '入力済みでまだ送信されていない新しいIssueをブラウザで開きます',
    copy: 'コピー',
    copyNote: 'GitHubのアカウントがない場合は、「コピー」で同じテキストをクリップボードにコピーし、Issueやメッセージに貼り付けられます。',
    copied: 'コピーしました',
    openFailed: 'リンクを開けませんでした。テキストをコピーしてIssueに貼り付けてください。',
    copyFailed: 'このバージョンのアプリではクリップボードを使えません。上のテキストを選択して手動でコピーしてください。',
  },

  update: {
    available: (version) => `Jukebox ${version}が利用できます`,
    note: 'Obtainiumでインストールした場合は、Obtainiumに更新が表示されます。それ以外の場合は、タップしてリリースページを開き、ダウンロードしてください。',
    hint: 'リリースページをブラウザで開きます',
    tab: (settings) => `${settings}、アップデートがあります`,
    heading: 'アップデート',
    check: {
      title: 'Jukeboxの新しいバージョンを確認',
      note: '1日に1回まで、アプリを開いたときに、最新のバージョンをGitHubに問い合わせます。ユーザーやライブラリに関する情報は送信されず、何もダウンロードされません。',
    },
  },
};
