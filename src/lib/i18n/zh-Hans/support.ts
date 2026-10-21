import type { Strings } from '../en/index.ts';

export const support: Strings['support'] = {
  report: {
    row: {
      title: '报告问题',
      note: '打开一个已填好详细信息的 GitHub issue。在你提交之前，什么都不会发送。',
    },
    title: '报告问题',
    intro:
      '在这个页面上，不会有任何内容离开你的手机。点按“打开 GitHub”会新建一个 issue，并预先填好下面的文字；你可以在那里查看和修改，只有你提交后才会发送。',
    details: '会写进 issue 的内容',
    detailsNote: '版本和手机会填入表单中各自的栏，其余内容填入最后一栏。绝不会提及你的歌曲。',
    errors: {
      title: '附上最近的错误',
      note:
        'Jukebox 自行记下的问题，例如下载或搜索失败。歌曲名称、网址和文件路径在保存前已被去除。',
      none: '尚未记录任何错误。',
      trimmed: '为了让链接短到能够打开，最早的错误没有放进链接。“复制”会包含全部错误。',
    },
    open: '打开 GitHub',
    openHint: '在浏览器中打开一个已填好、尚未提交的新 issue',
    copy: '复制',
    copyNote: '没有 GitHub 账号？“复制”会把同样的文字放到剪贴板，可以粘贴到 issue 或消息中。',
    copied: '已复制',
    openFailed: '无法打开链接。请复制文字，并粘贴到 issue 中。',
    copyFailed: '这个版本的应用无法使用剪贴板。请选中上面的文字手动复制。',
  },

  update: {
    available: (version) => `Jukebox ${version} 已发布`,
    note: '如果你是通过 Obtainium 安装的，它会在那里提供更新。否则，点按这里打开发布页面并下载。',
    hint: '在浏览器中打开发布页面',
    tab: (settings) => `${settings}，有可用更新`,
    heading: '更新',
    check: {
      title: '检查 Jukebox 新版本',
      note: '每天最多一次，在你打开应用时，Jukebox 会向 GitHub 询问最新版本。不会发送任何关于你或你的音乐库的信息，也不会下载任何内容。',
    },
  },
};
