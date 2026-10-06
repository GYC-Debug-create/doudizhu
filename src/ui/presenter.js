import { reactive } from 'vue'

/**
 * 流程级展示状态机 —— 底牌翻牌 / 终局揭示 / 出牌·叫牌动画 / 台面切换闪烁。
 * 页面里散落的 6 个动画 timer 字段全部收编到这里；引擎与编排逻辑不感知动画，
 * 只在事件发生时调用对应方法。onBottomRevealed 用于底牌翻完后恢复 AI 调度。
 */
export function createPresentation({ onBottomRevealed = () => {} } = {}) {
  const timers = {}
  const clear = (key) => {
    if (timers[key]) {
      clearTimeout(timers[key])
      timers[key] = null
    }
  }

  return reactive({
    playAnimSeat: null, // 最近一次出牌的座位（出牌入场动画）
    bidAnimSeat: null, // 最近一次叫/抢的座位（气泡弹出动画）
    trickEnter: false, // 台面出牌区切换闪烁
    bottomPending: false, // 底牌翻开中（手牌隐藏 + AI 暂停）
    bottomCards: [],
    bottomFlip: false,
    finishActive: false, // 终局剩余手牌揭示中
    finishDone: false, // 揭示完毕（结算弹窗解锁）

    playAction(seat) {
      clear('play')
      this.playAnimSeat = seat
      timers.play = setTimeout(() => {
        this.playAnimSeat = null
      }, 560)
    },

    bidAction(seat) {
      clear('bid')
      this.bidAnimSeat = seat
      timers.bid = setTimeout(() => {
        this.bidAnimSeat = null
      }, 560)
    },

    bumpTrick() {
      clear('trick')
      this.trickEnter = true
      timers.trick = setTimeout(() => {
        this.trickEnter = false
      }, 360)
    },

    beginBottomReveal(cards) {
      clear('bottom')
      this.bottomPending = true
      this.bottomCards = []
      this.bottomFlip = false
      timers.bottom = setTimeout(() => {
        this.bottomCards = (cards || []).slice()
        this.bottomFlip = true
        timers.bottom = setTimeout(() => {
          this.bottomFlip = false
          this.bottomPending = false
          onBottomRevealed()
        }, 680)
      }, 460)
    },

    beginFinishReveal() {
      clear('finish')
      this.finishActive = true
      this.finishDone = false
      timers.finish = setTimeout(() => {
        this.finishActive = false
        this.finishDone = true
      }, 1900)
    },

    reset() {
      for (const key of Object.keys(timers)) clear(key)
      this.playAnimSeat = null
      this.bidAnimSeat = null
      this.trickEnter = false
      this.bottomPending = false
      this.bottomCards = []
      this.bottomFlip = false
      this.finishActive = false
      this.finishDone = false
    },
  })
}
