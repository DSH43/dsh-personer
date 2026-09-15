/**
 * dsh-personer —— 在 dsh Web 的「设置」页里直接编辑**全局提示词**。
 *
 * 全局提示词 = 用户级 `AGENTS.md`（默认 `~/.dsh/AGENTS.md`，可用 `$DSH_HOME`
 * 覆盖），由 dsh 的 agent-instructions 包在每个会话注入，作用于所有项目/会话。
 * 过去只能手动打开该文件编辑；本插件把它变成一处可读、可改、可保存的入口。
 *
 * 本文件是**真正干活的那一半**，由同目录的 index.js 启动壳在运行时动态加载
 * （见 index.js 顶部注释）。它不参与 dsh 的启动路径：这里抛错只让插件停用，
 * 不会让 dsh 起不来。所以升级打坏东西时，随便它坏在这里。
 *
 * 模式与 dsh-clip / dsh-md-preview / dsh-image-preview 一致：webServer 注册同源
 * 路由 + 持久化 token 门控，客户端从 index.html 的 <meta> 读取 token；读写路径
 * 由本插件决定（永远写 `$DSH_HOME/AGENTS.md`，绝不使用客户端传来的任意路径）。
 *
 * 工作方式：
 *  1. GET  /prompt           返回 { exists, path, displayPath, content }。
 *  2. POST /prompt {content} 写入全局 AGENTS.md（不存在则新建），返回 { path, bytes }。
 *  3. POST /open             用系统默认应用打开该文件（open / xdg-open）。
 */

export const name = 'dsh-personer'

/** 硬依赖：webServer 是路由载体。 */
export const inject = ['webServer']

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

const BASE_PATH = '/plugins/dsh-personer'
const PROMPT_PATH = BASE_PATH + '/prompt'
const OPEN_PATH = BASE_PATH + '/open'

/** DSH 用户数据根目录：$DSH_HOME，缺省 ~/.dsh。 */
function dshHome() {
  const env = process.env.DSH_HOME
  return env !== undefined && env.trim() !== '' ? env.trim() : join(homedir(), '.dsh')
}

/** 全局提示词文件的绝对路径。 */
function promptPath() {
  return join(dshHome(), 'AGENTS.md')
}

/** 用户友好的显示路径：~/.dsh/AGENTS.md 或 $DSH_HOME/AGENTS.md，否则绝对路径。 */
function displayPathFor(absPath) {
  const env = process.env.DSH_HOME
  if (env !== undefined && env.trim() !== '') return '$DSH_HOME/AGENTS.md'
  const tilde = join(homedir(), '.dsh')
  return dshHome() === tilde ? '~/.dsh/AGENTS.md' : absPath
}

/** 持久化 token：写入 $DSH_HOME/plugins/dsh-personer.token（600 权限）。 */
function loadOrCreateToken() {
  const file = join(dshHome(), 'plugins', 'dsh-personer.token')
  try {
    if (existsSync(file)) {
      const existing = readFileSync(file, 'utf8').trim()
      if (existing.length >= 16) return existing
    }
    const fresh = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, fresh, { mode: 0o600 })
    return fresh
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  }
}

/** 解析 query 字符串（兼容 + 号与 percent-encoding）。 */
function parseQuery(rawUrl) {
  const query = {}
  const at = String(rawUrl ?? '').indexOf('?')
  if (at === -1) return query
  for (const pair of String(rawUrl).slice(at + 1).split('&')) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    try { query[pair.slice(0, eq)] = decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, ' ')) } catch { /* skip */ }
  }
  return query
}

function authorized(query, token) {
  return typeof query.t === 'string' && query.t.length > 0 && query.t === token
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}

function sendText(res, status, contentType, text) {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

/** 读取并解析请求体 JSON（上限 1MB，足够容纳一份较大的 AGENTS.md）。 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    const limit = 1024 * 1024
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      total += chunk.length
      if (total > limit) { reject(new Error('body too large')); req.destroy(); return }
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (error) { reject(error) }
    })
    req.on('error', reject)
  })
}

/** /prompt：GET —— 读当前全局 AGENTS.md。 */
function handlePromptGet(req, res, token) {
  const query = parseQuery(req.url)
  if (!authorized(query, token)) { sendJson(res, 400, { error: 'bad request' }); return }
  const abs = promptPath()
  try {
    const exists = existsSync(abs)
    const content = exists ? readFileSync(abs, 'utf8') : ''
    sendJson(res, 200, {
      ok: true,
      exists,
      path: abs,
      displayPath: displayPathFor(abs),
      content,
    })
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}

/** /prompt：POST { content } —— 写全局 AGENTS.md（不存在则新建）。 */
async function handlePromptPost(req, res, token) {
  const query = parseQuery(req.url)
  if (!authorized(query, token)) { sendJson(res, 400, { error: 'bad request' }); return }
  let body
  try { body = await readJsonBody(req) } catch { sendJson(res, 400, { error: 'invalid json' }); return }
  const content = typeof body?.content === 'string' ? body.content : ''
  const abs = promptPath()
  try {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, content, 'utf8')
    sendJson(res, 200, {
      ok: true,
      path: abs,
      displayPath: displayPathFor(abs),
      bytes: Buffer.byteLength(content, 'utf8'),
    })
  } catch (error) {
    sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
  }
}

/** 用系统默认应用打开文件（detached，不阻塞请求）。 */
function openWithLocalApp(absPath) {
  const platform = process.platform
  let command
  let args
  if (platform === 'darwin') { command = 'open'; args = [absPath] }
  else if (platform === 'win32') { command = process.env.COMSPEC || 'cmd.exe'; args = ['/c', 'start', '', absPath] }
  else { command = 'xdg-open'; args = [absPath] }
  try {
    const child = spawn(command, args, { detached: true, stdio: 'ignore' })
    child.unref()
    return true
  } catch {
    return false
  }
}

/** /open：POST —— 用系统默认应用打开全局 AGENTS.md。 */
function handleOpen(req, res, token) {
  const query = parseQuery(req.url)
  if (!authorized(query, token)) { sendJson(res, 400, { error: 'bad request' }); return }
  const abs = promptPath()
  if (!existsSync(abs)) { sendJson(res, 404, { error: 'not found' }); return }
  const launched = openWithLocalApp(abs)
  sendJson(res, launched ? 200 : 500, launched ? { ok: true } : { error: 'failed to open' })
}

/**
 * 插件入口。注册路由 + 在 index.html 注入 <meta>（客户端读取 token 与路由前缀）。
 */
export function apply(ctx) {
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    console.warn('[dsh-personer] webServer 服务不可用，跳过挂载')
    return
  }
  const token = loadOrCreateToken()

  ctx.effect(() => webServer.tapIndex((html) => {
    const meta = '<meta name="dsh-personer-token" content="' + token + '">'
      + '<meta name="dsh-personer-base" content="' + BASE_PATH + '">'
    if (html.includes('</head>')) return html.replace('</head>', meta + '</head>')
    return html + meta
  }), 'dsh-personer: index meta tap')

  const routes = [
    [PROMPT_PATH, (req, res) => req.method === 'POST' ? void handlePromptPost(req, res, token) : void handlePromptGet(req, res, token)],
    [OPEN_PATH, (req, res) => void handleOpen(req, res, token)],
  ]
  for (const [path, handler] of routes) {
    ctx.effect(() => webServer.register({ kind: 'exact', path, handler }), 'dsh-personer: route ' + path)
  }
}
