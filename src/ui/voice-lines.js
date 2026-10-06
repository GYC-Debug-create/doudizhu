/**
 * 语音台词表 —— 生成脚本（scripts/gen-voice.mjs）与游戏播放共用这一份。
 *
 * 每个台词 key 有若干变体，每个变体带一种情绪（mood），情绪决定生成时的语速/音高/音量。
 * 音频文件：static/voice/<声线>/<key>-<变体序号>.mp3
 * 改了台词或声线后重新运行：npm run voice
 */

// 三家（掼蛋四家）各自一个声线；按座位号取
export const VOICES = [
  { id: 'yunxi', name: 'zh-CN-YunxiNeural', desc: '你：阳光男声' },
  { id: 'xiaobei', name: 'zh-CN-liaoning-XiaobeiNeural', desc: 'AI·甲：东北话，幽默' },
  { id: 'yunjian', name: 'zh-CN-YunjianNeural', desc: 'AI·乙：激情男声' },
  { id: 'xiaoyi', name: 'zh-CN-XiaoyiNeural', desc: '掼蛋第四家：活泼女声' },
]

// 情绪 → 语速 / 音高 / 音量
export const MOODS = {
  normal: { rate: '+8%', pitch: '+0Hz', volume: '+0%' },
  excited: { rate: '+14%', pitch: '+7Hz', volume: '+10%' },
  cocky: { rate: '+4%', pitch: '+3Hz', volume: '+5%' },
  sad: { rate: '-10%', pitch: '-6Hz', volume: '-5%' },
  urgent: { rate: '+20%', pitch: '+9Hz', volume: '+10%' },
}

const RANK_WORDS = { 3: '三', 4: '四', 5: '五', 6: '六', 7: '七', 8: '八', 9: '九', 10: '十', 11: 'J', 12: 'Q', 13: 'K', 14: 'A', 15: '二', 16: '小王', 17: '大王' }

const line = (text, mood = 'normal') => ({ text, mood })

function rankLines() {
  const out = {}
  for (let r = 3; r <= 17; r++) out[`solo-${r}`] = [line(RANK_WORDS[r])]
  for (let r = 3; r <= 15; r++) {
    out[`pair-${r}`] = [line(`对${RANK_WORDS[r]}`)]
    out[`triple-${r}`] = [line(`三个${RANK_WORDS[r]}`)]
  }
  return out
}

export const LINES = {
  ...rankLines(),
  'triple-solo': [line('三带一')],
  'triple-pair': [line('三带一对')],
  straight: [line('顺子！', 'excited')],
  'straight-pair': [line('连对！', 'excited')],
  plane: [line('飞机！', 'excited'), line('飞机来咯！', 'excited')],
  bomb: [line('炸弹！', 'excited'), line('吃我一炸！', 'cocky'), line('炸！', 'excited')],
  rocket: [line('王炸！', 'excited'), line('王炸！谁敢不服？', 'cocky')],
  beat: [line('大你！', 'cocky'), line('管上！'), line('压死！', 'cocky')],
  pass: [line('要不起', 'sad'), line('不要'), line('过'), line('要不起呀……', 'sad')],
  'pass-mate': [line('不要'), line('你走你走'), line('交给你啦')],
  'bid-call': [line('叫地主！', 'excited'), line('我来叫地主！', 'excited')],
  'bid-pass': [line('不叫'), line('不叫了', 'sad')],
  'rob-call': [line('抢地主！', 'excited'), line('我抢！', 'cocky'), line('这地主我抢定了！', 'cocky')],
  'rob-pass': [line('不抢'), line('让给你吧')],
  'alarm-1': [line('我只剩一张牌啦！', 'urgent'), line('就剩一张喽！', 'cocky')],
  'alarm-2': [line('我只剩两张牌啦！', 'urgent'), line('还剩两张！', 'urgent')],
  win: [line('哈哈，赢啦！', 'excited'), line('承让承让！', 'cocky'), line('太爽了！', 'excited')],
  lose: [line('哎呀，输了……', 'sad'), line('手气太差了……', 'sad'), line('下把再来！')],
  hurry: [line('快点吧，我等得花儿都谢了！', 'cocky'), line('想好了没呀？'), line('快出牌呀！', 'urgent')],
  spring: [line('春天！', 'excited')],
  'anti-spring': [line('反春！', 'excited')],
  // 掼蛋特有牌型
  'gd-triple-pair': [line('三带二')],
  'gd-straight-pair': [line('三连对！', 'excited')],
  'gd-steel': [line('钢板！', 'excited')],
  'gd-straight-flush': [line('同花顺！', 'excited'), line('同花顺！厉害吧？', 'cocky')],
  'gd-rocket': [line('四王！', 'excited'), line('四个王！炸翻你们！', 'cocky')],
}

export function voiceOf(seat) {
  return VOICES[seat] || VOICES[0]
}

export function clipPath(voiceId, key, index) {
  return `voice/${voiceId}/${key}-${index}.mp3`
}

/** 随机挑一个变体：返回 { key, index, text, mood }；key 不存在返回 null */
export function pickLine(key, random = Math.random) {
  const variants = LINES[key]
  if (!variants || !variants.length) return null
  const index = Math.min(variants.length - 1, Math.floor(random() * variants.length))
  return { key, index, ...variants[index] }
}

/** 全部要生成的音频：[{ voice, key, index, text, mood, path }] */
export function allClips() {
  const out = []
  for (const voice of VOICES) {
    for (const [key, variants] of Object.entries(LINES)) {
      variants.forEach((v, index) => out.push({ voice, key, index, ...v, path: clipPath(voice.id, key, index) }))
    }
  }
  return out
}
