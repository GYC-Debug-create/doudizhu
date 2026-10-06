<template>
  <view v-if="fx" :key="fx.key" class="fx-layer" :class="fx.kind">
    <view class="fx-burst"></view>
    <text class="fx-text">{{ fx.text }}</text>
    <text v-if="fx.sub" class="fx-sub">{{ fx.sub }}</text>
  </view>
</template>

<script>
/** 全屏特效（炸弹 / 王炸 / 飞机 / 顺子 / 春天）。fx = { key, kind, text, sub } | null */
export default {
  name: 'FxLayer',
  options: { virtualHost: true, styleIsolation: 'apply-shared' },
  props: {
    fx: { type: Object, default: null },
  },
}
</script>

<style>
.fx-layer {
  position: fixed; inset: 0; z-index: 900;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  pointer-events: none;
}
.fx-burst {
  position: absolute; left: 50%; top: 50%;
  width: 60vmin; height: 60vmin; margin: -30vmin 0 0 -30vmin;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255,214,120,0.55) 0%, rgba(255,140,60,0.25) 35%, rgba(255,80,40,0) 70%);
  animation: fx-burst 0.9s ease-out forwards;
}
.fx-text {
  position: relative;
  font-size: 88px; font-weight: 900; letter-spacing: 8px;
  color: #ffe08a;
  text-shadow: 0 0 18px rgba(255,170,60,0.9), 0 6px 0 #9c3d10, 0 10px 24px rgba(0,0,0,0.6);
  animation: fx-pop 0.55s cubic-bezier(.2,1.6,.4,1) both;
}
.fx-sub {
  position: relative; margin-top: 8px;
  padding: 4px 14px; border-radius: 999px;
  background: rgba(0,0,0,0.45); color: #fff; font-size: 18px; font-weight: 800;
  animation: fx-pop 0.55s 0.12s cubic-bezier(.2,1.6,.4,1) both;
}
.fx-layer.bomb { animation: fx-shake 0.5s linear; }
.fx-layer.bomb::before, .fx-layer.rocket::before {
  content: ''; position: absolute; inset: 0;
  background: rgba(255,90,40,0.28);
  animation: fx-flash 0.6s ease-out forwards;
}
.fx-layer.rocket { animation: fx-shake 0.6s 0.35s linear; }
.fx-layer.rocket .fx-text { color: #ffd1f0; text-shadow: 0 0 24px rgba(255,90,200,0.9), 0 6px 0 #7a1659, 0 10px 24px rgba(0,0,0,0.6); animation: fx-rise 0.8s cubic-bezier(.2,1.4,.4,1) both; }
.fx-layer.rocket .fx-burst { background: radial-gradient(circle, rgba(255,150,230,0.6) 0%, rgba(160,80,255,0.25) 40%, rgba(80,40,255,0) 70%); }
.fx-layer.plane .fx-text { color: #bfe8ff; text-shadow: 0 0 18px rgba(80,180,255,0.9), 0 6px 0 #154a73, 0 10px 24px rgba(0,0,0,0.6); animation: fx-fly 1.1s ease-in-out both; }
.fx-layer.plane .fx-burst { display: none; }
.fx-layer.combo .fx-text { font-size: 56px; color: #c8ffd8; text-shadow: 0 0 14px rgba(80,255,150,0.7), 0 4px 0 #1b5a33; }
.fx-layer.combo .fx-burst { display: none; }
.fx-layer.spring .fx-text { font-size: 104px; color: #ffef9a; }
.fx-layer.spring .fx-burst { width: 90vmin; height: 90vmin; margin: -45vmin 0 0 -45vmin; background: radial-gradient(circle, rgba(255,240,150,0.6) 0%, rgba(255,120,160,0.3) 40%, rgba(255,80,160,0) 70%); }

@keyframes fx-pop { 0% { transform: scale(0.2); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
@keyframes fx-rise { 0% { transform: translateY(40vh) scale(0.6); opacity: 0; } 60% { transform: translateY(-10px) scale(1.1); opacity: 1; } 100% { transform: translateY(0) scale(1); } }
@keyframes fx-fly { 0% { transform: translateX(-70vw) rotate(-8deg); opacity: 0; } 30% { transform: translateX(0) rotate(0); opacity: 1; } 75% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(70vw) rotate(8deg); opacity: 0; } }
@keyframes fx-burst { 0% { transform: scale(0.2); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
@keyframes fx-flash { 0% { opacity: 1; } 100% { opacity: 0; } }
@keyframes fx-shake {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-8px, 4px); }
  40% { transform: translate(7px, -5px); }
  60% { transform: translate(-5px, 3px); }
  80% { transform: translate(4px, -2px); }
}
@media (max-width: 760px) {
  .fx-text { font-size: 60px; }
  .fx-layer.spring .fx-text { font-size: 72px; }
}
</style>
