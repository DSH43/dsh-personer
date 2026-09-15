/**
 * dsh-personer host 逻辑验证（不触碰真实 ~/.dsh/AGENTS.md）。
 *
 * 直接加载 host.js（真正干活的那一半，由 index.js 启动壳在运行时加载），
 * 把 DSH_HOME 指到临时目录，stub webServer，验证 apply() 注册的路由：
 *  - GET  /prompt：不存在 → exists=false, content=''
 *  - POST /prompt：写内容 → 文件生成、返回 bytes；再次 GET 读到内容
 *  - /open：返回 404（文件存在时 200）
 *  - index.html 注入 token/base <meta>
 *  - token 文件已生成
 *
 * 启动壳本身的行为由 test-shell.mjs 覆盖。
 */
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'dsh-personer-test-'))
process.env.DSH_HOME = home

const handlers = {}
const tapped = []
const webServer = {
  tapIndex(fn) { const out = fn('<html><head></head></html>'); tapped.push(out); return out },
  register(entry) { handlers[entry.path] = entry.handler },
}
const cleanups = []
const ctx = {
  get(name) { return name === 'webServer' ? webServer : undefined },
  effect(fn, label) { const r = fn(); if (typeof r === 'function') cleanups.push(r); return cleanups.length },
}

const mod = await import('./host.js')
const app = mod.apply(ctx)

function makeRes() {
  let status = 0
  let body = ''
  let resolveDone
  const done = new Promise(resolve => { resolveDone = resolve })
  const res = {
    writeHead(s) { status = s; return res },
    end(b) { body = typeof b === 'string' ? b : String(b); resolveDone() },
  }
  return { res, done, get status() { return status }, get body() { return body } }
}
function makeReq(url, method, payload) {
  const req = { url, method }
  if (payload === undefined) return req
  const json = JSON.stringify(payload)
  req.on = function (ev, cb) {
    if (ev === 'data') cb(Buffer.from(json))
    else if (ev === 'end') cb()
    else if (ev === 'error') cb(new Error('no error'))
    return req
  }
  return req
}

const tokenPath = join(home, 'plugins', 'dsh-personer.token')
const token = existsSync(tokenPath) ? readFileSync(tokenPath, 'utf8').trim() : ''
const BASE = '/plugins/dsh-personer'
const promptHandler = handlers[BASE + '/prompt']
const openHandler = handlers[BASE + '/open']

let failed = 0
function check(name, cond) {
  if (cond) console.log('  ✓ ' + name)
  else { failed++; console.log('  ✗ ' + name) }
}

// 1. token 与 meta 注入
check('token 文件已生成', token.length >= 16)
check('index.html 注入了 token/base meta', tapped.some(h => h.includes('dsh-personer-token') && h.includes('dsh-personer-base')))

// 2. GET 未存在
let r = makeRes()
promptHandler(makeReq(BASE + '/prompt?t=' + token, 'GET'), r.res)
let d = JSON.parse(r.body)
check('GET 未创建：exists=false', d.ok === true && d.exists === false && d.content === '')
check('GET 返回 displayPath=$DSH_HOME/AGENTS.md', d.displayPath === '$DSH_HOME/AGENTS.md')

// 3. 未授权被拒
r = makeRes()
promptHandler(makeReq(BASE + '/prompt?t=wrong', 'GET'), r.res)
check('错误 token 被拒（400）', r.status === 400)

// 4. POST 写内容（异步 handler，await 响应完成）
r = makeRes()
promptHandler(makeReq(BASE + '/prompt?t=' + token, 'POST', { content: '# 全局\n\n规则一。\n' }), r.res)
await r.done
d = JSON.parse(r.body)
const abs = join(home, 'AGENTS.md')
check('POST 返回 ok+bytes', d.ok === true && d.bytes > 0)
check('文件写入 $DSH_HOME/AGENTS.md', existsSync(abs))

// 5. GET 读回
r = makeRes()
promptHandler(makeReq(BASE + '/prompt?t=' + token, 'GET'), r.res)
d = JSON.parse(r.body)
check('GET 读回 content', d.content === '# 全局\n\n规则一。\n')
check('GET 读回 exists=true', d.exists === true)

// 6. /open：文件存在时返回 200
r = makeRes()
openHandler(makeReq(BASE + '/open?t=' + token, 'POST'), r.res)
await r.done
check('/open 文件存在返回 200', r.status === 200)

// 7. 清理（不删真实文件）
for (const fn of cleanups) fn()
rmSync(home, { recursive: true, force: true })

if (failed > 0) {
  console.error('\n共 ' + failed + ' 项失败')
  process.exit(1)
}
console.log('\nhost 校验全部通过')
