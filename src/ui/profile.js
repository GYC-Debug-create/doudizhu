/**
 * 玩家档案 —— 欢乐豆、模式、掼蛋等级、设置、战绩。
 * 读写走 H5 localStorage / 小程序 uni storage；规则部分（校验、战绩、救济豆）是纯函数。
 */
const PROFILE_STORAGE_KEY = 'family-card-game-profile'

export const INITIAL_BEANS = 1000
// 欢乐豆低于此数时开局自动补发（本地娱乐，不让人“破产”）
export const RELIEF_THRESHOLD = 300
export const RELIEF_AMOUNT = 1000

export const SPEEDS = [
  // delay：AI 最短思考时间；gap：上一个动作的声音播完后，下一家至少再等多久
  { key: 'slow', label: '慢', delay: 1350, gap: 450 },
  { key: 'normal', label: '中', delay: 850, gap: 260 },
  { key: 'fast', label: '快', delay: 420, gap: 120 },
]

export function speedOf(key) {
  return SPEEDS.find((item) => item.key === key) || SPEEDS[1]
}

export function emptyStats() {
  return { games: 0, wins: 0, streak: 0, best: 0, maxWin: 0 }
}

export function defaultProfile() {
  return {
    mode: null,
    beans: INITIAL_BEANS,
    guandanLevel: null,
    soundOn: true,
    speed: 'normal',
    showCounter: true,
    stats: emptyStats(),
  }
}

const count = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : 0)

/** 存档可能损坏或来自旧版本：逐字段校验，坏字段回退默认值 */
export function normalizeProfile(raw, { modes = [], levels = [] } = {}) {
  const base = defaultProfile()
  if (!raw || typeof raw !== 'object') return base
  if (modes.includes(raw.mode)) base.mode = raw.mode
  if (levels.includes(Number(raw.guandanLevel))) base.guandanLevel = Number(raw.guandanLevel)
  if (Number.isFinite(Number(raw.beans))) base.beans = count(raw.beans)
  if (typeof raw.soundOn === 'boolean') base.soundOn = raw.soundOn
  if (typeof raw.showCounter === 'boolean') base.showCounter = raw.showCounter
  if (SPEEDS.some((item) => item.key === raw.speed)) base.speed = raw.speed
  if (raw.stats && typeof raw.stats === 'object') {
    const st = raw.stats
    base.stats = { games: count(st.games), wins: count(st.wins), streak: count(st.streak), best: count(st.best), maxWin: count(st.maxWin) }
  }
  return base
}

/** 记一局输赢：delta > 0 为胜 */
export function recordResult(stats, delta) {
  const won = delta > 0
  const streak = won ? stats.streak + 1 : 0
  return {
    games: stats.games + 1,
    wins: stats.wins + (won ? 1 : 0),
    streak,
    best: Math.max(stats.best, streak),
    maxWin: Math.max(stats.maxWin, delta),
  }
}

/** 开局救济：豆不够就补发。返回 { beans, granted } */
export function applyRelief(beans) {
  if (beans >= RELIEF_THRESHOLD) return { beans, granted: 0 }
  return { beans: beans + RELIEF_AMOUNT, granted: RELIEF_AMOUNT }
}

/** 结算后余额（不允许为负） */
export function settleBeans(beans, delta) {
  const after = Math.max(0, beans + (Number(delta) || 0))
  return { beans: after, delta: after - beans }
}

export function winRate(stats) {
  return stats.games ? `${Math.round((stats.wins / stats.games) * 100)}%` : '—'
}

export function loadProfileStorage() {
  let profile = null
  try {
    if (typeof uni !== 'undefined' && uni.getStorageSync) profile = uni.getStorageSync(PROFILE_STORAGE_KEY)
    else if (typeof localStorage !== 'undefined') profile = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null')
  } catch (e) {
    profile = null
  }
  if (typeof profile === 'string') {
    try {
      profile = JSON.parse(profile)
    } catch (e) {
      profile = null
    }
  }
  return profile && typeof profile === 'object' ? profile : null
}

export function saveProfileStorage(profile) {
  try {
    if (typeof uni !== 'undefined' && uni.setStorageSync) uni.setStorageSync(PROFILE_STORAGE_KEY, profile)
    else if (typeof localStorage !== 'undefined') localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
  } catch (e) {}
}

export function formatBeans(value) {
  return String(Math.max(0, Math.round(Number(value) || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
