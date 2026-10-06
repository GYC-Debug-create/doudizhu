<template>
  <view class="table">
    <view class="stage" :class="{ zoomed: stage.zoom !== 1 }" :style="stageStyle">
      <TopBar
        :guandan="isGuandan"
        :title="isGuandan ? '家庭掼蛋' : '家庭斗地主'"
        :subtitle="isGuandan ? '你 · AI 左 · 队友 · AI 右' : '你 · AI 甲 · AI 乙'"
        :total-mul="totalMul"
        :level-label="guandanLevelLabel"
        :bottom-cards="pres.bottomCards"
        :bottom-flip="pres.bottomFlip"
        :stats="stats"
        :sound-on="soundOn"
        :speed-label="speedLabel"
        :show-counter="showCounter"
        @toggle-sound="toggleSound"
        @cycle-speed="cycleSpeed"
        @toggle-counter="toggleCounter"
        @restart="askRestart(null)"
      />
      <ModeSwitch :modes="modeOptions" :active="gameMode" @select="selectMode" />

      <DoudizhuBoard
        v-if="!isGuandan"
        :snap="snap"
        :seat-names="seatNames"
        :ai-turn-seat="aiTurnSeat"
        :anim="pres"
        :trick-key="trickKey"
        :bean-balance="beanBalance"
        :bean-delta="beanDelta"
        :hint-result="hintResult"
        :auto-play="autoPlay"
        :show-counter="showCounter"
        :can-follow="canFollow"
        @bid="dz.bid(0)"
        @bid-pass="dz.bidPass(0)"
        @rob="dz.rob(0)"
        @rob-pass="dz.robPass(0)"
        @play="(cards) => dz.play(0, cards)"
        @pass="dz.pass(0)"
        @hint="showHint(dz.hint(0))"
        @restart="newGame"
        @toggle-auto="toggleAutoPlay"
      />
      <GuandanBoard
        v-else
        :snap="guandanSnap"
        :ai-turn-seat="aiTurnSeat"
        :play-anim-seat="pres.playAnimSeat"
        :trick-key="trickKey"
        :finish-reveal-active="pres.finishActive"
        :finish-reveal-done="pres.finishDone"
        :bean-balance="beanBalance"
        :bean-delta="beanDelta"
        :hint-result="hintResult"
        @play="(cards) => gd.play(0, cards)"
        @pass="gd.pass(0)"
        @hint="(ids) => showHint(gd.hint(0, ids))"
        @next="nextGuandanHand"
      />
    </view>

    <FxLayer :fx="fx" />

    <ConfirmDialog
      v-if="confirm"
      :title="confirm.mode ? `切换到${modeName(confirm.mode)}？` : '确定要重新开始？'"
      :subtitle="confirm.mode ? '当前牌局进度将丢失，并按新模式重新发牌' : '当前牌局进度将丢失，重新发牌'"
      :action-label="confirm.mode ? '确认切换' : '确认重开'"
      @cancel="confirm = null"
      @confirm="confirmRestart"
    />
  </view>
</template>

<script>
/**
 * 页面 = 装配层：创建控制器 / 节奏调度 / 反馈 / 展示动画，用事件总线把它们连起来，
 * 再持有需要渲染的状态（快照、档案、设置）。具体规则都在各自模块里：
 *   game/*                 引擎与 AI
 *   ui/game-controllers    动作执行 + 快照 diff → 事件
 *   ui/turn-scheduler      AI 什么时候行动
 *   ui/feedback            事件 → 音效 / 语音 / 特效
 *   ui/presenter           事件 → 牌桌动画状态
 *   ui/profile             豆子 / 战绩 / 设置的规则与存档
 *   ui/viewport            电脑端缩放
 */
import './index.css'
import './stage.css'
import { RANK_CHARS } from '../../game/cards.js'
import { GAME_MODES } from '../../game/modes.js'
import { GD_LEVELS } from '../../game/guandan/rules.js'
import { createBus } from '../../ui/event-bus.js'
import { createPresentation } from '../../ui/presenter.js'
import { createDoudizhuController, createGuandanController } from '../../ui/game-controllers.js'
import { createTurnScheduler } from '../../ui/turn-scheduler.js'
import { createFeedback } from '../../ui/feedback.js'
import { sfx, say, audioIdle, setSoundEnabled, unlockAudio } from '../../ui/sound.js'
import { computeStage } from '../../ui/viewport.js'
import { totalMul } from '../../ui/doudizhu-view.js'
import { DOUDIZHU_SEATS, GUANDAN_SEATS, MODE_OPTIONS, modeLabel } from '../../ui/table-config.js'
import {
  SPEEDS,
  speedOf,
  normalizeProfile,
  loadProfileStorage,
  saveProfileStorage,
  recordResult,
  applyRelief,
  settleBeans,
} from '../../ui/profile.js'
import TopBar from '../../components/TopBar.vue'
import ModeSwitch from '../../components/ModeSwitch.vue'
import FxLayer from '../../components/FxLayer.vue'
import DoudizhuBoard from '../../components/doudizhu/DoudizhuBoard.vue'
import GuandanBoard from '../../components/guandan/GuandanBoard.vue'
import ConfirmDialog from '../../components/ConfirmDialog.vue'

const EMPTY_DZ_SNAP = { players: [], history: [], actions: [], bidMul: 1, bombMul: 1, baseBet: 100, seq: 0 }
const EMPTY_GD_SNAP = { phase: 'play', level: 15, teamLevels: [15, 15], players: [], history: [], actions: [], current: null, settle: null, seq: 0 }

export default {
  components: { TopBar, ModeSwitch, FxLayer, DoudizhuBoard, GuandanBoard, ConfirmDialog },

  data() {
    const profile = normalizeProfile(loadProfileStorage(), {
      modes: MODE_OPTIONS.map((item) => item.key),
      levels: GD_LEVELS,
    })
    return {
      // 档案与设置
      gameMode: profile.mode || GAME_MODES.NORMAL,
      guandanLevel: profile.guandanLevel || 15,
      beanBalance: profile.beans,
      soundOn: profile.soundOn,
      speed: profile.speed,
      showCounter: profile.showCounter,
      stats: profile.stats,
      // 对局
      snap: EMPTY_DZ_SNAP,
      guandanSnap: EMPTY_GD_SNAP,
      aiTurnSeat: null,
      canFollow: true,
      autoPlay: false,
      beanDelta: 0,
      roundSettled: false,
      hintResult: null,
      trickKey: 0,
      // 展示
      pres: createPresentation({ onBottomRevealed: () => this.scheduler.schedule() }),
      fx: null,
      confirm: null, // { mode } 待确认的重开/切换
      stage: { zoom: 1, width: 1180 },
    }
  },

  computed: {
    modeOptions: () => MODE_OPTIONS,
    seatNames: () => DOUDIZHU_SEATS.map((seat) => seat.name),
    isGuandan() {
      return this.gameMode === GAME_MODES.GUANDAN
    },
    activeGame() {
      return this.isGuandan ? 'guandan' : 'doudizhu'
    },
    totalMul() {
      return totalMul(this.snap)
    },
    guandanLevelLabel() {
      return RANK_CHARS[this.guandanSnap.level] || String(this.guandanSnap.level || 15)
    },
    speedLabel() {
      return speedOf(this.speed).label
    },
    stageStyle() {
      return this.stage.zoom === 1 ? {} : { zoom: this.stage.zoom, '--stage-w': `${this.stage.width}px` }
    },
  },

  onLoad() {
    setSoundEnabled(this.soundOn)
    const bus = createBus()
    // 控制器持有引擎实例，刻意不放进 data：引擎保持在响应式图之外，snapshot 是唯一数据通道
    this.dz = createDoudizhuController({ seats: DOUDIZHU_SEATS, emit: bus.emit })
    this.gd = createGuandanController({ seats: GUANDAN_SEATS, emit: bus.emit })
    this.feedback = createFeedback({ sfx, say, waitAudio: audioIdle, showFx: this.showFx })
    this.scheduler = createTurnScheduler({
      currentSeat: () => this.ctrl().currentAISeat(),
      step: (seat) => this.ctrl().aiStep(seat),
      pacing: (seat) => {
        const speed = speedOf(this.speed)
        // 托管时自己的回合出得快一些
        return { delay: seat === 0 ? Math.min(speed.delay, 600) : speed.delay, gap: speed.gap }
      },
      waitAudio: audioIdle,
      isBlocked: () => this.pres.bottomPending,
    })
    this.wire(bus)
    this.bindWindow()
    this.newGame()
  },

  onUnload() {
    this.unbindWindow()
    this.scheduler.cancel()
    this.pres.reset()
    clearTimeout(this.fxTimer)
    clearTimeout(this.redealTimer)
  },

  methods: {
    ctrl() {
      return this.isGuandan ? this.gd : this.dz
    },

    /** 事件总线接线：每类事件交给对应的模块处理 */
    wire(bus) {
      const active = (handler) => (e) => e.game === this.activeGame && handler(e)
      bus.on('snap', ({ game, snap }) => {
        if (game === 'guandan') this.guandanSnap = snap
        else this.snap = snap
      })
      bus.on('play', active(({ game, action, seq }) => {
        this.pres.playAction(action.seat)
        this.feedback.play({ game, action, seq, totalMul: this.totalMul })
      }))
      bus.on('bid', active(({ seat, kind }) => {
        this.pres.bidAction(seat)
        this.feedback.bid({ seat, kind })
      }))
      bus.on('trick', active(({ game }) => {
        this.trickKey += 1
        if (game === 'doudizhu') this.pres.bumpTrick()
      }))
      bus.on('bottom', active(({ cards }) => {
        this.pres.beginBottomReveal(cards)
        this.feedback.landlord()
      }))
      bus.on('no-bid', active(() => {
        uni.showToast({ title: '无人叫地主，重新发牌', icon: 'none' })
        this.redealTimer = setTimeout(() => this.newGame(), 1500)
      }))
      bus.on('finish', active(() => this.pres.beginFinishReveal()))
      bus.on('level', active(({ level }) => {
        this.guandanLevel = level
      }))
      bus.on('settle', active((e) => this.settleRound(e)))
      bus.on('refreshed', active(({ game, snap }) => {
        if (game === 'doudizhu') this.canFollow = this.dz.canFollow(0)
        this.aiTurnSeat = this.ctrl().currentAISeat()
        this.feedback.alarms(snap)
        this.feedback.turn(snap, { autoPlay: this.autoPlay })
        this.scheduler.schedule()
      }))
      bus.on('error', ({ error }) => uni.showToast({ title: error.message || '出错了', icon: 'none' }))
    },

    // ---------- 对局生命周期 ----------

    newGame() {
      this.scheduler.cancel()
      clearTimeout(this.redealTimer)
      this.pres.reset()
      this.feedback.reset()
      this.fx = null
      this.confirm = null
      this.beanDelta = 0
      this.roundSettled = false
      this.hintResult = null
      this.trickKey = 0
      this.canFollow = true
      this.setAutoPlay(false)
      const relief = applyRelief(this.beanBalance)
      if (relief.granted) {
        this.beanBalance = relief.beans
        uni.showToast({ title: `欢乐豆不足，已补发 ${relief.granted}`, icon: 'none' })
      }
      this.saveProfile()
      if (this.isGuandan) this.gd.start({ level: this.guandanLevel })
      else this.dz.start({ mode: this.gameMode })
    },

    nextGuandanHand() {
      this.scheduler.cancel()
      this.pres.reset()
      this.feedback.reset()
      this.beanDelta = 0
      this.roundSettled = false
      const result = this.gd.nextHand()
      if (result.outcome === 'restart') {
        if (result.matchWinner) this.guandanLevel = 15
        this.newGame()
        return
      }
      this.guandanLevel = result.level
      this.saveProfile()
    },

    settleRound({ game, settle, snap }) {
      if (this.roundSettled || !Array.isArray(settle)) return
      const mine = settle.find((row) => row.seat === 0)
      if (!mine) return
      const delta = Number(mine.delta) || 0
      const result = settleBeans(this.beanBalance, delta)
      this.beanBalance = result.beans
      this.beanDelta = result.delta
      this.roundSettled = true
      this.stats = recordResult(this.stats, delta)
      this.feedback.settle({ won: delta > 0, spring: game === 'doudizhu' ? snap.spring : null })
      this.saveProfile()
    },

    showHint(cards) {
      this.hintResult = { ids: cards ? cards.map((c) => c.id) : [], nonce: Date.now() }
    },

    // ---------- 模式切换 / 重开 ----------

    selectMode(mode) {
      if (mode !== this.gameMode) this.askRestart(mode)
    },
    askRestart(mode) {
      this.confirm = { mode }
    },
    confirmRestart() {
      if (this.confirm && this.confirm.mode) this.gameMode = this.confirm.mode
      this.newGame()
    },
    modeName: modeLabel,

    // ---------- 设置 ----------

    toggleSound() {
      this.soundOn = !this.soundOn
      setSoundEnabled(this.soundOn)
      if (this.soundOn) {
        unlockAudio()
        sfx('turn')
      }
      this.saveProfile()
    },
    cycleSpeed() {
      const idx = SPEEDS.findIndex((item) => item.key === this.speed)
      this.speed = SPEEDS[(idx + 1) % SPEEDS.length].key
      uni.showToast({ title: `AI 出牌速度：${this.speedLabel}`, icon: 'none' })
      this.saveProfile()
    },
    toggleCounter() {
      this.showCounter = !this.showCounter
      this.saveProfile()
    },
    setAutoPlay(on) {
      this.autoPlay = on
      this.dz.setAutoPlay(on)
    },
    toggleAutoPlay() {
      this.setAutoPlay(!this.autoPlay)
      uni.showToast({ title: this.autoPlay ? '已托管，AI 帮你出牌' : '已取消托管', icon: 'none' })
      this.aiTurnSeat = this.ctrl().currentAISeat()
      this.scheduler.schedule()
    },
    saveProfile() {
      saveProfileStorage({
        mode: this.gameMode,
        beans: this.beanBalance,
        guandanLevel: this.guandanLevel,
        soundOn: this.soundOn,
        speed: this.speed,
        showCounter: this.showCounter,
        stats: this.stats,
      })
    },

    // ---------- 展示 ----------

    showFx(kind, text, sub = '', dur = 1200) {
      clearTimeout(this.fxTimer)
      this.fx = { kind, text, sub, key: Date.now() }
      this.fxTimer = setTimeout(() => {
        this.fx = null
      }, dur)
    },

    bindWindow() {
      if (typeof window === 'undefined') return
      this.onResize = () => {
        this.stage = computeStage(window.innerWidth, window.innerHeight)
      }
      // 浏览器要求在用户手势内解锁音频
      this.onPointer = () => unlockAudio()
      window.addEventListener('resize', this.onResize)
      document.addEventListener('pointerdown', this.onPointer, { passive: true })
      this.onResize()
    },
    unbindWindow() {
      if (typeof window === 'undefined' || !this.onResize) return
      window.removeEventListener('resize', this.onResize)
      document.removeEventListener('pointerdown', this.onPointer)
    },
  },
}
</script>
