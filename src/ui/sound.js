/**
 * 音效与语音播报 —— 全部用 WebAudio 现场合成（无需音频资源），语音走浏览器 speechSynthesis。
 * 非 H5 环境（小程序 / Node 单测）下所有方法静默降级为空操作。
 *
 * 节奏同步：每次播放都会登记“声音忙到什么时候”，audioIdle() 在语音与音效都播完后才 resolve，
 * 页面据此推迟下一家行动，保证“谁的动作配谁的声音”，不会互相打断或叠在一起。
 */
import { RANK_CHARS } from '../game/cards.js'
import { T } from '../game/patterns.js'

let ctx = null
let enabled = true

// ---------- 忙碌状态（语音队列 + 音效余音） ----------
let sfxBusyUntil = 0
let speechPending = 0
let idleWaiters = []
let idleTimer = null

function now() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

function isBusy() {
  return speechPending > 0 || now() < sfxBusyUntil
}

function flushIdle() {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
  if (!idleWaiters.length) return
  if (speechPending > 0) return // 语音结束回调会再次触发
  const rest = sfxBusyUntil - now()
  if (rest > 0) {
    idleTimer = setTimeout(flushIdle, rest + 5)
    return
  }
  const waiters = idleWaiters
  idleWaiters = []
  waiters.forEach((resolve) => resolve())
}

function markSfxBusy(seconds) {
  sfxBusyUntil = Math.max(sfxBusyUntil, now() + seconds * 1000)
}

/**
 * 等到当前所有语音与音效播完（最长 maxWait 毫秒，防止浏览器语音卡住导致对局停住）
 * @returns {Promise<void>}
 */
export function audioIdle(maxWait = 4500) {
  if (!enabled || !isBusy()) return Promise.resolve()
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      clearTimeout(cap)
      resolve()
    }
    const cap = setTimeout(() => {
      idleWaiters = idleWaiters.filter((fn) => fn !== done)
      done()
    }, maxWait)
    idleWaiters.push(done)
    flushIdle()
  })
}

function audio() {
  if (!enabled) return null
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    try {
      ctx = new AC()
    } catch (e) {
      return null
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone({ freq = 440, to = null, dur = 0.12, type = 'sine', gain = 0.18, delay = 0 }) {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(g).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

function noise({ dur = 0.3, gain = 0.3, delay = 0, lowpass = 800 }) {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const len = Math.floor(ac.sampleRate * dur)
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
  const src = ac.createBufferSource()
  src.buffer = buf
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = lowpass
  const g = ac.createGain()
  g.gain.value = gain
  src.connect(filter).connect(g).connect(ac.destination)
  src.start(t0)
}

const SFX = {
  select() {
    tone({ freq: 900, dur: 0.04, type: 'triangle', gain: 0.06 })
  },
  play() {
    noise({ dur: 0.08, gain: 0.25, lowpass: 3000 })
    tone({ freq: 320, to: 180, dur: 0.08, type: 'triangle', gain: 0.1 })
  },
  pass() {
    tone({ freq: 260, to: 200, dur: 0.12, type: 'sine', gain: 0.07 })
  },
  turn() {
    tone({ freq: 660, dur: 0.1, type: 'sine', gain: 0.12 })
    tone({ freq: 990, dur: 0.16, type: 'sine', gain: 0.12, delay: 0.1 })
  },
  bomb() {
    noise({ dur: 0.9, gain: 0.7, lowpass: 600 })
    tone({ freq: 140, to: 35, dur: 0.8, type: 'sawtooth', gain: 0.25 })
  },
  rocket() {
    tone({ freq: 200, to: 1800, dur: 0.45, type: 'sawtooth', gain: 0.12 })
    noise({ dur: 1.1, gain: 0.8, lowpass: 700, delay: 0.42 })
    tone({ freq: 120, to: 30, dur: 0.9, type: 'square', gain: 0.18, delay: 0.42 })
  },
  plane() {
    tone({ freq: 300, to: 900, dur: 0.6, type: 'triangle', gain: 0.12 })
    noise({ dur: 0.6, gain: 0.15, lowpass: 1500 })
  },
  combo() {
    ;[523, 659, 784].forEach((f, i) => tone({ freq: f, dur: 0.1, type: 'triangle', gain: 0.1, delay: i * 0.06 }))
  },
  alarm() {
    tone({ freq: 1200, dur: 0.09, type: 'square', gain: 0.06 })
    tone({ freq: 1200, dur: 0.09, type: 'square', gain: 0.06, delay: 0.16 })
  },
  landlord() {
    ;[392, 523, 659].forEach((f, i) => tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.12, delay: i * 0.09 }))
  },
  win() {
    ;[523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.22, type: 'triangle', gain: 0.14, delay: i * 0.12 }))
    tone({ freq: 1568, dur: 0.5, type: 'sine', gain: 0.08, delay: 0.5 })
  },
  lose() {
    ;[523, 466, 392, 311].forEach((f, i) => tone({ freq: f, dur: 0.26, type: 'sine', gain: 0.12, delay: i * 0.16 }))
  },
  spring() {
    ;[784, 988, 1175, 1568, 1976].forEach((f, i) => tone({ freq: f, dur: 0.16, type: 'triangle', gain: 0.1, delay: i * 0.07 }))
  },
}

// 各音效的可听时长（秒），用于节奏同步
const SFX_DURATION = {
  select: 0.05,
  play: 0.1,
  pass: 0.14,
  turn: 0.28,
  bomb: 0.95,
  rocket: 1.4,
  plane: 0.65,
  combo: 0.3,
  alarm: 0.28,
  landlord: 0.4,
  win: 1.0,
  lose: 0.75,
  spring: 0.5,
}

export function sfx(name) {
  if (!enabled || !SFX[name]) return
  try {
    if (!audio()) return
    SFX[name]()
    markSfxBusy(SFX_DURATION[name] || 0.2)
  } catch (e) {}
}

// 每个座位一个声线（音高/语速微调），让三家听起来不一样
const SEAT_VOICE = [
  { pitch: 1.05, rate: 1.15 },
  { pitch: 0.75, rate: 1.1 },
  { pitch: 1.45, rate: 1.2 },
  { pitch: 1.2, rate: 1.15 },
]

let zhVoice = null
let voiceWatch = false
function pickVoice() {
  if (zhVoice || typeof speechSynthesis === 'undefined') return zhVoice
  if (!voiceWatch && speechSynthesis.addEventListener) {
    // 语音列表是异步加载的，加载完再挑一次
    voiceWatch = true
    speechSynthesis.addEventListener('voiceschanged', () => {
      zhVoice = null
      pickVoice()
    })
  }
  const voices = speechSynthesis.getVoices() || []
  zhVoice = voices.find((v) => /zh[-_]CN/i.test(v.lang)) || voices.find((v) => /^zh/i.test(v.lang)) || null
  return zhVoice
}

/** 一句话大约能听到多久（毫秒）：中文约 4 字/秒，再按语速缩放 */
function audibleMs(text, rate) {
  return 160 + (text.length * 250) / rate
}

/**
 * 语音播报。默认会打断正在说的话（新动作优先）；queue=true 时排在后面（如出牌后紧跟的“报单”）。
 */
export function say(text, seat = 0, { queue = false } = {}) {
  if (!enabled || !text) return
  if (typeof window === 'undefined' || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'zh-CN'
    // 没有中文语音（或语音列表还没加载好）就不播：否则要么读成乱码，要么永远等不到播完
    const v = pickVoice()
    if (!v) return
    u.voice = v
    const style = SEAT_VOICE[seat] || SEAT_VOICE[0]
    u.pitch = style.pitch
    u.rate = style.rate
    u.volume = 0.9
    if (!queue) speechSynthesis.cancel()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(guard)
      speechPending = Math.max(0, speechPending - 1)
      flushIdle()
    }
    // 兜底：部分浏览器偶尔连 onstart 都不触发
    const guard = setTimeout(finish, 1600 + (text.length * 450) / style.rate)
    // Windows 本地语音在念完后还有约 1 秒静音才触发 onend：开始发声后按字数估算可听时长，到点即视为播完
    u.onstart = () => {
      clearTimeout(guard)
      setTimeout(finish, audibleMs(text, style.rate))
    }
    u.onend = finish
    u.onerror = finish
    speechPending += 1
    speechSynthesis.speak(u)
  } catch (e) {}
}

function rankWord(rank) {
  return RANK_CHARS[rank] || ''
}

/** 出牌 → 播报文案（欢乐斗地主风格） */
export function patternCallout(pattern) {
  if (!pattern) return ''
  switch (pattern.type) {
    case T.SOLO:
      return rankWord(pattern.rank)
    case T.PAIR:
      return `对${rankWord(pattern.rank)}`
    case T.TRIPLE:
      return `三个${rankWord(pattern.rank)}`
    case T.TRIPLE_SOLO:
      return '三带一'
    case T.TRIPLE_PAIR:
      return '三带一对'
    case T.STRAIGHT:
      return '顺子'
    case T.STRAIGHT_PAIR:
      return '连对'
    case T.PLANE:
    case T.PLANE_SOLO:
    case T.PLANE_PAIR:
      return '飞机'
    case T.BOMB:
      return '炸弹'
    case T.ROCKET:
      return '王炸'
    default:
      return ''
  }
}

const PASS_WORDS = ['不要', '要不起', '过']
export function passCallout(seq = 0) {
  return PASS_WORDS[Math.abs(seq) % PASS_WORDS.length]
}

export function setSoundEnabled(on) {
  enabled = !!on
  if (!enabled) {
    if (typeof speechSynthesis !== 'undefined') {
      try {
        speechSynthesis.cancel()
      } catch (e) {}
    }
    // 关声音后不再让任何人等声音
    speechPending = 0
    sfxBusyUntil = 0
    const waiters = idleWaiters
    idleWaiters = []
    waiters.forEach((resolve) => resolve())
  }
}

/** 浏览器要求音频在用户手势里解锁：首次点击时调用 */
export function unlockAudio() {
  const ac = audio()
  if (ac && ac.state === 'suspended') ac.resume().catch(() => {})
  pickVoice()
}
