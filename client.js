/**
 * dsh-personer 客户端模块（纯 DOM、无 React、无外部依赖）。
 *
 * 职责：
 *  1. 在 dsh Web 的「设置」页（设置弹窗）里注入一个「Persona」导航项，点击打开编辑弹窗；
 *  2. 编辑弹窗：读取当前全局 AGENTS.md（$DSH_HOME/AGENTS.md），用代码编辑器（等宽 + 行号 +
 *     Tab 缩进）编辑，可保存 / 撤销 / 重新加载 / 用系统默认应用打开；
 *  3. 所有操作反馈都在按钮自身位置上以变绿/变红 + 短文案呈现，不用 toast。
 *
 * i18n：界面文案跟随 dsh 的语言设置（ctx.locale 的 active locale，zh/en），切换时实时刷新。
 * 样式使用 DSH 设计 token，自动跟随明暗主题。无宿主侧插件时降级：meta 缺失 → 按钮提示未加载。
 *
 * dsh 的 client-modules 加载器用普通 <script> 标签拉取本文件，必须调用
 * window.__ModuleLoader__.load({ id, factory }) 完成注册（见
 * @deepseek-ai/dsh 的 packages/client/modules/src/client/system.ts），
 * 因此本文件不能用 ESM export/import，全部自包含。
 */
window.__ModuleLoader__.load({
  id: 'dsh-personer',
  factory: function () {
    var META_TOKEN = 'dsh-personer-token'
    var META_BASE = 'dsh-personer-base'

    var ICON_GEAR = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    var ICON_CLOSE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'
    var ICON_REFRESH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>'
    var ICON_SAVE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h11l5 5v13H5z"/><path d="M9 3v5h6V3"/><path d="M9 21v-6h6v6"/></svg>'
    var ICON_UNDO = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>'
    var ICON_OPEN = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4.5"/><path d="M9.5 14.5 14.5 9.5"/><path d="M10.5 9.5h4v4"/></svg>'
    var ICON_CHECK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12.5l4.5 4.5L19.5 7"/></svg>'
    var ICON_ERR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>'

    var STRINGS = {
      zh: {
        nav: 'Persona',
        title: 'Persona',
        desc: '作用于所有项目/会话的全局人设，写入文件：',
        hint: '保存后，新消息与新会话将使用新的人设。',
        load: '加载', save: '保存', revert: '撤销', open: '用系统应用打开', close: '关闭',
        loading: '加载中…',
        bytes: '{n} 字节',
        flashSaveOk: '已保存', flashSaveErr: '保存失败',
        flashLoadOk: '已加载', flashLoadErr: '加载失败',
        flashRevertOk: '已撤销',
        flashOpenOk: '已打开', flashOpenErr: '打开失败',
        flashPluginMissing: '插件未加载',
      },
      en: {
        nav: 'Persona',
        title: 'Persona',
        desc: 'The global persona for all projects/sessions; writes to:',
        hint: 'After saving, new messages and sessions use the new persona.',
        load: 'Reload', save: 'Save', revert: 'Revert', open: 'Open in system app', close: 'Close',
        loading: 'Loading…',
        bytes: '{n} bytes',
        flashSaveOk: 'Saved', flashSaveErr: 'Save failed',
        flashLoadOk: 'Loaded', flashLoadErr: 'Load failed',
        flashRevertOk: 'Reverted',
        flashOpenOk: 'Opened', flashOpenErr: 'Open failed',
        flashPluginMissing: 'Plugin not loaded',
      },
    }

    // 当前生效语言，跟随 dsh 的 locale 设置（ctx.locale），缺省 zh。
    // lang() 与 apply() 共用；locale 切换时在 apply 里更新它并刷新界面。
    var activeLocale = 'zh'
    // dsh i18n 的绑定翻译函数（把本插件词典注册进 locale 命名空间后 bind 得到）；非空优先于内置词典。
    var ts = null
    function lang() { return activeLocale === 'en' ? 'en' : 'zh' }
    function t(key, params) {
      // 优先走 dsh 的 i18n，绑定函数每次读取 active locale，天然跟随系统语言。
      if (ts != null) return ts(key, params)
      var dict = STRINGS[lang()]
      var value = dict[key] != null ? dict[key] : STRINGS.zh[key]
      if (typeof value !== 'string') return ''
      if (params === undefined) return value
      return value.replace(/\{(\w+)\}/g, function (_, name) { return params[name] != null ? String(params[name]) : '' })
    }

    function escapeHtml(text) {
      return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
    function byteLen(text) {
      var bytes = 0
      for (var i = 0; i < text.length; i++) {
        var code = text.charCodeAt(i)
        if (code < 0x80) bytes += 1
        else if (code < 0x800) bytes += 2
        else if (code >= 0xd800 && code <= 0xdbff) { bytes += 4; i++ }
        else bytes += 3
      }
      return bytes
    }

    function apply(ctx) {
      if (typeof document === 'undefined') return

      // 初始语言：优先 dsh 的 locale 设置（ctx.locale），否则退回文档 lang。
      if (ctx != null && ctx.locale != null && typeof ctx.locale.getSnapshot === 'function') {
        var snap = ctx.locale.getSnapshot()
        if (snap != null && (snap.active === 'zh' || snap.active === 'en')) activeLocale = snap.active
      } else {
        activeLocale = document.documentElement.lang === 'en' ? 'en' : 'zh'
      }
      // 用 dsh 的 i18n：把本插件词典注册进 locale 命名空间并绑定一个翻译函数，
      // 让按钮/文案始终跟随 dsh 的语言设置；失败（无 locale 服务或重复注册）退回内置词典。
      if (ctx != null && ctx.locale != null && typeof ctx.locale.bind === 'function') {
        try { ctx.locale.register('personer', STRINGS) } catch (e) { /* 已注册则忽略，走 bind 读已有词典 */ }
        try { ts = ctx.locale.bind('personer') } catch (e) { ts = null }
      }

      var state = { token: null, base: '/plugins/dsh-personer', loadedContent: '' }
      var editor = null    // 编辑弹窗根元素（懒创建）
      var navBtn = null    // 设置页导航项
      var style = null
      var localeUnsub = null    // dsh locale 服务订阅（语言切换时刷新界面）

      function readMeta() {
        var m = document.querySelector('meta[name="' + META_TOKEN + '"]')
        var b = document.querySelector('meta[name="' + META_BASE + '"]')
        state.token = m !== null ? m.getAttribute('content') : null
        state.base = b !== null ? b.getAttribute('content') : '/plugins/dsh-personer'
      }
      function api(path) {
        return state.base + path + '?t=' + encodeURIComponent(state.token || '')
      }
      function request(path, opts) {
        return fetch(api(path), opts).then(function (res) {
          return res.json().then(function (data) { return { status: res.status, data: data } })
        })
      }

      // ---------- 样式 ----------
      function ensureStyle() {
        if (style !== null) return
        style = document.createElement('style')
        style.textContent = [
          '/* ===== dsh-personer ===== */',
          '#dsh-personer-nav { display: inline-flex; align-items: center; gap: 6px; width: 100%; text-align: left; border: none; background: none; cursor: pointer; padding: 8px 10px; border-radius: 10px; color: var(--dsw-alias-label-secondary, #4b5563); font-family: inherit; font-size: 13px; line-height: 1; transition: background .12s ease, color .12s ease; }',
          '#dsh-personer-nav:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)); color: var(--dsw-alias-label-primary, #1f2328); }',
          '#dsh-personer-nav svg { flex: none; }',
          '#dsh-personer-nav span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',

          '#dsh-personer-panel .dg-btn[data-busy] { pointer-events: none; opacity: .6; }',
          '#dsh-personer-panel .dg-btn.dgpv-ok { color: var(--dsw-static-green-500, #16a34a) !important; }',
          '#dsh-personer-panel .dg-btn.dgpv-err { color: var(--dsw-static-red-500, #ef4444) !important; }',

          '#dsh-personer-overlay { position: fixed; inset: 0; z-index: 2147482400; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.4); }',
          '#dsh-personer-overlay[data-open="1"] { display: flex; }',
          '#dsh-personer-panel { display: flex; flex-direction: column; position: relative; z-index: 1; width: min(720px, calc(100vw - 48px)); height: min(560px, calc(100vh - 120px)); border-radius: 14px; overflow: hidden; background: var(--dsw-alias-bg-layer-2, #fff); color: var(--dsw-alias-label-primary, #1f2328); border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); box-shadow: 0 16px 48px rgba(0,0,0,.22); font-family: var(--dsw-font-family, system-ui); font-size: 14px; }',
          '#dsh-personer-panel .dg-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; flex: none; background: var(--dsw-alias-bg-layer-1, #fafafa); border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04)); }',
          '#dsh-personer-panel .dg-head b { font-size: 14px; font-weight: 600; flex: 1; }',
          '#dsh-personer-panel .dg-btn { display: inline-flex; align-items: center; gap: 4px; border: none; background: none; cursor: pointer; padding: 5px 8px; border-radius: 8px; color: var(--dsw-alias-label-secondary, #4b5563); font-size: 13px; font-family: inherit; white-space: nowrap; }',
          '#dsh-personer-panel .dg-btn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)); color: var(--dsw-alias-label-primary, #1f2328); }',
          '#dsh-personer-panel .dg-btn[data-busy] { pointer-events: none; opacity: .6; }',
          '#dsh-personer-panel .dg-meta { padding: 10px 14px; flex: none; border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04)); font-size: 12px; color: var(--dsw-alias-label-secondary, #4b5563); line-height: 1.7; }',
          '#dsh-personer-panel .dg-meta div { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
          '#dsh-personer-panel .dg-meta code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)); padding: 1px 5px; border-radius: 5px; }',
          '#dsh-personer-panel .dg-code { flex: 1; min-height: 0; margin: 12px 14px; display: flex; border: 1px solid var(--dsw-alias-border-l2, rgba(0,0,0,.1)); border-radius: 10px; overflow: hidden; background: var(--dsw-alias-bg-layer-1, #fafafa); }',
          '#dsh-personer-panel .dg-code:focus-within { border-color: var(--dsw-static-deepseek-400, #679efe); }',
          '#dsh-personer-panel .dg-gutter { flex: none; width: 48px; margin: 0; padding: 10px 8px 10px 0; text-align: right; border-right: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04)); background: var(--dsw-alias-bg-layer-2, #f6f7f9); color: var(--dsw-alias-label-tertiary, #6b7280); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.65; white-space: pre; overflow: hidden; user-select: none; }',
          '#dsh-personer-panel .dg-input { flex: 1; min-width: 0; border: none; resize: none; outline: none; padding: 10px 12px; background: transparent; color: var(--dsw-alias-label-primary, #1f2328); font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; line-height: 1.65; white-space: pre; overflow: auto; caret-color: var(--dsw-static-deepseek-500, #4176e6); }',
          '#dsh-personer-panel .dg-foot { display: flex; align-items: center; gap: 8px; padding: 10px 14px; flex: none; border-top: 1px solid var(--dsw-alias-border-l1, rgba(0,0,0,.04)); }',
          '#dsh-personer-panel .dg-foot .dg-bytes { margin-left: auto; font-size: 12px; color: var(--dsw-alias-label-tertiary, #6b7280); }',
          '#dsh-personer-panel .dg-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; color: var(--dsw-alias-label-tertiary, #6b7280); }',
        ].join('\n')
        document.head.appendChild(style)
      }

      // ---------- 按钮内联反馈（替代 toast）----------
      // 点击后在按钮自身位置短暂显示结果（按钮变绿/红 + 文字换成短文案），
      // 随后恢复为按钮原标签；恢复时按当前语言读取，避免语言切换后残留旧文案。
      function flashButton(btn, ok, textKey) {
        if (btn == null) return
        var span = btn.querySelector('span')
        if (span == null) return
        var restoreKey = btn.getAttribute('data-dsh-label') || ''
        btn.classList.add(ok ? 'dgpv-ok' : 'dgpv-err')
        span.textContent = t(textKey)
        clearTimeout(btn._dgFlash)
        btn._dgFlash = setTimeout(function () {
          span.textContent = restoreKey !== '' ? t(restoreKey) : ''
          btn.classList.remove('dgpv-ok')
          btn.classList.remove('dgpv-err')
        }, 1500)
      }

      // ---------- 编辑弹窗 ----------
      function ensureEditor() {
        if (editor !== null) return
        editor = document.createElement('div')
        editor.id = 'dsh-personer-overlay'
        editor.innerHTML = [
          '<div class="dg-mask" style="position:absolute;inset:0"></div>',
          '<div id="dsh-personer-panel" role="dialog" aria-modal="true" aria-label="' + escapeHtml(t('title')) + '">',
          '  <div class="dg-head">',
          '    <b data-dsh-label="title">' + escapeHtml(t('title')) + '</b>',
          '    <button type="button" class="dg-btn" data-dsh-label="open">' + ICON_OPEN + '<span>' + escapeHtml(t('open')) + '</span></button>',
          '    <button type="button" class="dg-btn" data-dsh-label="close">' + ICON_CLOSE + '<span>' + escapeHtml(t('close')) + '</span></button>',
          '  </div>',
          '  <div class="dg-meta">',
          '    <div data-dsh-label="desc"></div>',
          '    <div><code data-dsh-label="path"></code></div>',
          '    <div data-dsh-label="hint"></div>',
          '  </div>',
          '  <div class="dg-code">',
          '    <pre class="dg-gutter" data-dsh-gutter aria-hidden="true">1</pre>',
          '    <textarea class="dg-input" data-dsh-label="body" spellcheck="false" wrap="off"></textarea>',
          '  </div>',
          '  <div class="dg-foot">',
          '    <button type="button" class="dg-btn" data-dsh-label="load">' + ICON_REFRESH + '<span>' + escapeHtml(t('load')) + '</span></button>',
          '    <button type="button" class="dg-btn" data-dsh-label="revert">' + ICON_UNDO + '<span>' + escapeHtml(t('revert')) + '</span></button>',
          '    <button type="button" class="dg-btn" data-dsh-label="save">' + ICON_SAVE + '<span>' + escapeHtml(t('save')) + '</span></button>',
          '    <span class="dg-bytes" data-dsh-label="bytes"></span>',
          '  </div>',
          '</div>',
        ].join('')
        document.body.appendChild(editor)

        editor.querySelector('.dg-mask').addEventListener('click', function () { closeEditor() })
        editor.querySelector('[data-dsh-label="close"]').addEventListener('click', function () { closeEditor() })
        editor.querySelector('[data-dsh-label="load"]').addEventListener('click', function () { loadIntoEditor(true) })
        editor.querySelector('[data-dsh-label="save"]').addEventListener('click', function () { saveEditor() })
        editor.querySelector('[data-dsh-label="revert"]').addEventListener('click', function () {
          var body = editor.querySelector('[data-dsh-label="body"]')
          body.value = state.loadedContent
          refreshBytes()
          refreshGutter()
          flashButton(editor.querySelector('[data-dsh-label="revert"]'), true, 'flashRevertOk')
        })
        editor.querySelector('[data-dsh-label="open"]').addEventListener('click', function () { openInApp() })

        var gutter = editor.querySelector('[data-dsh-gutter]')
        var body = editor.querySelector('[data-dsh-label="body"]')
        // 实时字节数 + 行号
        body.addEventListener('input', function () { refreshBytes(); refreshGutter() })
        // 滚动时让行号跟随
        body.addEventListener('scroll', function () { if (gutter !== null) gutter.scrollTop = body.scrollTop })
        // Tab 缩进 + Ctrl/Cmd+S 保存
        body.addEventListener('keydown', function (e) {
          if (e.key === 'Tab') {
            e.preventDefault()
            var start = body.selectionStart
            var end = body.selectionEnd
            body.value = body.value.slice(0, start) + '  ' + body.value.slice(end)
            body.selectionStart = body.selectionEnd = start + 2
            refreshBytes()
            refreshGutter()
          } else if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) {
            e.preventDefault()
            saveEditor()
          }
        })
      }

      function refreshGutter() {
        if (editor === null) return
        var gutter = editor.querySelector('[data-dsh-gutter]')
        var body = editor.querySelector('[data-dsh-label="body"]')
        if (gutter == null || body == null) return
        var count = body.value.split('\n').length
        var s = ''
        for (var i = 1; i <= count; i++) s += i + '\n'
        gutter.textContent = s
      }

      function refreshBytes() {
        if (editor === null) return
        var body = editor.querySelector('[data-dsh-label="body"]')
        var el = editor.querySelector('[data-dsh-label="bytes"]')
        if (body == null || el == null) return
        el.textContent = t('bytes', { n: byteLen(body.value) })
      }

      function openEditor() {
        ensureEditor()
        editor.setAttribute('data-open', '1')
        loadIntoEditor(false)
      }
      function closeEditor() {
        if (editor !== null) editor.setAttribute('data-open', '0')
      }

      // fromClick=true 表示用户点了「加载」按钮（成功时闪一下「已加载」）；
      // 初始打开/自动加载时 fromClick=false，只在出错时反馈。
      function loadIntoEditor(fromClick) {
        if (editor === null) return
        var body = editor.querySelector('[data-dsh-label="body"]')
        var loadBtn = editor.querySelector('[data-dsh-label="load"]')
        var pathEl = editor.querySelector('[data-dsh-label="path"]')
        var descEl = editor.querySelector('[data-dsh-label="desc"]')
        var hintEl = editor.querySelector('[data-dsh-label="hint"]')
        if (body == null) return
        if (state.token === null || state.token === '') {
          body.value = ''
          flashButton(loadBtn, false, 'flashPluginMissing')
          return
        }
        body.value = t('loading')
        body.disabled = true
        refreshGutter()
        request('/prompt').then(function (result) {
          body.disabled = false
          if (result.status === 200 && result.data && result.data.ok) {
            state.loadedContent = result.data.content || ''
            body.value = result.data.content || ''
            if (descEl != null) descEl.textContent = t('desc')
            if (pathEl != null) pathEl.textContent = result.data.displayPath || result.data.path || ''
            if (hintEl != null) hintEl.textContent = t('hint')
            refreshBytes()
            refreshGutter()
            if (fromClick === true) flashButton(loadBtn, true, 'flashLoadOk')
          } else {
            body.value = ''
            refreshGutter()
            flashButton(loadBtn, false, 'flashLoadErr')
          }
        }, function () {
          body.disabled = false
          body.value = ''
          refreshGutter()
          flashButton(loadBtn, false, 'flashLoadErr')
        })
      }

      function saveEditor() {
        if (editor === null) return
        var saveBtn = editor.querySelector('[data-dsh-label="save"]')
        if (state.token === null || state.token === '') { flashButton(saveBtn, false, 'flashPluginMissing'); return }
        var body = editor.querySelector('[data-dsh-label="body"]')
        if (body == null || saveBtn == null) return
        saveBtn.setAttribute('data-busy', '1')
        request('/prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: body.value }),
        }).then(function (result) {
          saveBtn.removeAttribute('data-busy')
          if (result.status === 200 && result.data && result.data.ok) {
            state.loadedContent = body.value
            refreshBytes()
            flashButton(saveBtn, true, 'flashSaveOk')
          } else {
            flashButton(saveBtn, false, 'flashSaveErr')
          }
        }, function () {
          saveBtn.removeAttribute('data-busy')
          flashButton(saveBtn, false, 'flashSaveErr')
        })
      }

      function openInApp() {
        var openBtn = editor.querySelector('[data-dsh-label="open"]')
        if (state.token === null || state.token === '') { flashButton(openBtn, false, 'flashPluginMissing'); return }
        request('/open', { method: 'POST' }).then(function (result) {
          if (result.status === 200 && result.data && result.data.ok) flashButton(openBtn, true, 'flashOpenOk')
          else flashButton(openBtn, false, 'flashOpenErr')
        }, function () { flashButton(openBtn, false, 'flashOpenErr') })
      }

      function injectNav(dialog) {
        if (dialog == null) return
        if (dialog.querySelector('[data-dsh-personer-nav]') !== null) return
        var firstBtn = dialog.querySelector('button')
        var navList = firstBtn != null ? firstBtn.parentElement : null
        if (navList == null) return
        navBtn = document.createElement('button')
        navBtn.type = 'button'
        navBtn.id = 'dsh-personer-nav'
        navBtn.setAttribute('data-dsh-personer-nav', '1')
        navBtn.innerHTML = ICON_GEAR + '<span>' + escapeHtml(t('nav')) + '</span>'
        navBtn.addEventListener('click', function () { openEditor() })
        navList.appendChild(navBtn)
      }

      function scan() {
        if (typeof document === 'undefined') return
        var dialog = document.querySelector('body [role="dialog"][aria-modal="true"]')
        if (dialog === null) return
        // 只认「设置」弹窗：它必有当前选中项的 aria-current；排除自己的编辑弹窗。
        if (dialog.closest('#dsh-personer-overlay') !== null) return
        if (dialog.querySelector('button[aria-current="true"]') === null) return
        injectNav(dialog)
      }

      function refreshI18n() {
        if (navBtn !== null) {
          navBtn.innerHTML = ICON_GEAR + '<span>' + escapeHtml(t('nav')) + '</span>'
        }
        if (editor !== null) {
          var title = editor.querySelector('[data-dsh-label="title"]')
          if (title != null) title.textContent = t('title')
          var descEl = editor.querySelector('[data-dsh-label="desc"]')
          if (descEl != null) descEl.textContent = t('desc')
          var hintEl = editor.querySelector('[data-dsh-label="hint"]')
          if (hintEl != null) hintEl.textContent = t('hint')
          var closeSpan = editor.querySelector('[data-dsh-label="close"] span')
          if (closeSpan != null) closeSpan.textContent = t('close')
          var openSpan = editor.querySelector('[data-dsh-label="open"] span')
          if (openSpan != null) openSpan.textContent = t('open')
          var loadSpan = editor.querySelector('[data-dsh-label="load"] span')
          if (loadSpan != null) loadSpan.textContent = t('load')
          var saveSpan = editor.querySelector('[data-dsh-label="save"] span')
          if (saveSpan != null) saveSpan.textContent = t('save')
          var revertSpan = editor.querySelector('[data-dsh-label="revert"] span')
          if (revertSpan != null) revertSpan.textContent = t('revert')
        }
      }

      ensureStyle()

      var observer = null
      if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(function () { scan() })
        observer.observe(document.body, { childList: true, subtree: true })
      }
      var langObserver = null
      if (typeof MutationObserver !== 'undefined') {
        langObserver = new MutationObserver(function () {
          // 兜底路径：无 ctx.locale 时，跟随文档 lang；有 ctx.locale 时它与 locale 服务一致，收敛到同一值。
          var docLang = document.documentElement.lang
          var next = docLang === 'en' ? 'en' : 'zh'
          if (next !== activeLocale) { activeLocale = next; refreshI18n() }
        })
        langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
      }
      // 跟随 dsh 的 locale 设置：语言切换时更新 activeLocale 并刷新界面。
      if (ctx != null && ctx.locale != null && typeof ctx.locale.subscribe === 'function') {
        localeUnsub = ctx.locale.subscribe(function () {
          var snap = ctx.locale.getSnapshot()
          if (snap != null && (snap.active === 'zh' || snap.active === 'en') && snap.active !== activeLocale) {
            activeLocale = snap.active
            refreshI18n()
          }
        })
      }
      scan()
      refreshI18n()

      ctx.effect(function () {
        return function () {
          if (observer !== null) observer.disconnect()
          if (langObserver !== null) langObserver.disconnect()
          if (localeUnsub != null) localeUnsub()
          if (style !== null && style.parentNode !== null) style.parentNode.removeChild(style)
          if (editor !== null && editor.parentNode !== null) editor.parentNode.removeChild(editor)
          if (navBtn !== null && navBtn.parentNode !== null) navBtn.parentNode.removeChild(navBtn)
        }
      }, 'dsh-personer: ui')

      readMeta()
    }

    // inject: ctx.locale 必须在 inject 里声明 —— cordis 的 context 代理会对
    // 未声明的服务属性直接抛 "cannot get property \"locale\" without inject"，
    // 早于 apply 里的 null 兜底判断。locale 由 @deepseek-ai/dsh-client-locale 提供。
    return { name: 'dsh-personer', inject: ['locale'], apply: apply }
  },
})
