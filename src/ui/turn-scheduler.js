/**
 * AI 回合节奏：最短思考时间与“上一个动作的声音播完 + gap”并行等待，两者都满足才让下一家行动，
 * 保证谁的动作配谁的声音。每次重新调度都会作废之前的等待（令牌机制），过期的回调醒来后自行放弃。
 *
 * 纯 JS，计时器与音频等待均可注入，便于单测。
 */
export function createTurnScheduler({
  currentSeat, // () => 当前该行动的 AI 座位，无则 null
  step, // (seat) => void  让该座位行动一步
  pacing, // (seat) => { delay, gap }  思考时间 / 声音后的停顿（毫秒）
  waitAudio = () => Promise.resolve(), // () => Promise  声音播完
  isBlocked = () => false, // () => boolean  动画进行中等暂停条件
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  let token = 0
  let timer = null

  const sleep = (ms) =>
    new Promise((resolve) => {
      timer = setTimer(resolve, ms)
    })

  function cancel() {
    token += 1
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  function schedule() {
    cancel()
    if (isBlocked()) return
    const seat = currentSeat()
    if (seat === null || seat === undefined) return
    const mine = token
    const { delay, gap } = pacing(seat)
    const heard = waitAudio().then(
      () =>
        new Promise((resolve) => {
          setTimer(resolve, gap)
        })
    )
    Promise.all([sleep(delay), heard]).then(() => {
      if (mine !== token) return
      timer = null
      if (isBlocked() || currentSeat() !== seat) return
      step(seat)
    })
  }

  return { schedule, cancel }
}
