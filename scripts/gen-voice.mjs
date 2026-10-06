/**
 * 语音包生成：把 src/ui/voice-lines.js 里的台词用 edge-tts（微软神经网络语音）合成为 mp3。
 *
 * 准备：pip install edge-tts
 * 运行：npm run voice            只生成缺少的文件
 *       npm run voice -- --force  全部重新生成
 *
 * 只有台词文字会发给微软语音服务；生成后游戏完全离线播放。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { allClips, MOODS } from '../src/ui/voice-lines.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'static')
const FORCE = process.argv.includes('--force')
const PARALLEL = 6
const RETRIES = 3

function synth(clip, file) {
  const mood = MOODS[clip.mood] || MOODS.normal
  const args = [
    '--voice', clip.voice.name,
    `--rate=${mood.rate}`, `--pitch=${mood.pitch}`, `--volume=${mood.volume}`,
    '--text', clip.text,
    '--write-media', file,
  ]
  return new Promise((resolve, reject) => {
    const p = spawn('edge-tts', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 && existsSync(file) && statSync(file).size > 0 ? resolve() : reject(new Error(err.trim() || `exit ${code}`))))
  })
}

async function run() {
  const clips = allClips()
  const todo = clips.filter((c) => FORCE || !existsSync(join(OUT, c.path)))
  console.log(`共 ${clips.length} 条台词，需要生成 ${todo.length} 条`)
  let done = 0
  const failed = []
  const queue = todo.slice()
  async function worker() {
    while (queue.length) {
      const clip = queue.shift()
      const file = join(OUT, clip.path)
      mkdirSync(dirname(file), { recursive: true })
      let ok = false
      for (let i = 0; i < RETRIES && !ok; i++) {
        try {
          await synth(clip, file)
          ok = true
        } catch (e) {
          if (i === RETRIES - 1) failed.push(`${clip.path}: ${e.message}`)
        }
      }
      done += 1
      if (done % 20 === 0 || done === todo.length) console.log(`  ${done}/${todo.length}`)
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, worker))

  // 清理台词表里已经不存在的旧文件
  const wanted = new Set(clips.map((c) => join(OUT, c.path)))
  const voiceDir = join(OUT, 'voice')
  let removed = 0
  for (const dir of existsSync(voiceDir) ? readdirSync(voiceDir) : []) {
    for (const f of readdirSync(join(voiceDir, dir))) {
      const full = join(voiceDir, dir, f)
      if (!wanted.has(full)) {
        rmSync(full)
        removed += 1
      }
    }
  }
  if (removed) console.log(`清理旧文件 ${removed} 个`)
  if (failed.length) {
    console.error(`失败 ${failed.length} 条：\n${failed.map((f) => '  ' + f).join('\n')}`)
    process.exit(1)
  }
  console.log('完成')
}

run()
