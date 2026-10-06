# 家庭斗地主

本地自玩的斗地主 / 掼蛋小游戏（uni-app + Vue 3，H5 优先，也可编译成微信小程序）。一个真人对两个（掼蛋为三个）AI，不联网，不对外开放。

## 怎么玩

- **双击 `start-game.bat`**：自动启动并打开 <http://localhost:5179>
- 或者命令行：

  ```bash
  npm install        # 第一次运行前
  npm run dev:h5     # 开发模式（默认端口 5173，可加 -- --port 5179）
  npm test           # 跑单元测试（Node 自带测试框架，无需浏览器）
  npm run build:h5   # 打包到 dist/build/h5
  ```

### 玩法与功能

| 类别 | 内容 |
| --- | --- |
| 模式 | 普通斗地主 · 超级多炸弹（每家保底 2 组炸弹）· 掼蛋（4 人 108 张 2v2，打级升级） |
| 规则 | 叫/抢地主（首叫者最后表态）、炸弹/王炸翻倍、春天/反春 ×2、无人叫地主自动重发 |
| 辅助 | 提示（连按循环不同出法）、记牌器、托管、"要不起"、滑动多选手牌 |
| 反馈 | 出牌语音播报（三家音色不同）、音效、炸弹/王炸/飞机/春天全屏特效、报单报双提醒 |
| 档案 | 欢乐豆、战绩与连胜、豆子不足自动补发；本地保存 |
| 设置 | 声音开关、AI 出牌速度（慢/中/快）、记牌器开关 |

**电脑快捷键**：空格/回车 出牌（没选牌时先提示）、P 不出、H 提示、Esc 清空选牌；叫牌阶段空格/回车 = 叫/抢，P = 不叫/不抢。

电脑上牌桌会按窗口大小等比缩放铺满屏幕；手机/窄屏用原响应式布局。

## 目录结构

依赖只能自上而下：页面 → 组件 → 应用层 → 规则层。规则层不知道界面存在，应用层不依赖 Vue（`presenter.js` 除外），都能在 Node 里单测。

```
src/
├─ game/                    规则层：纯 JS，引擎 + AI
│  ├─ cards.js              54 张牌的表示、洗牌、排序
│  ├─ patterns.js           斗地主牌型识别与比较
│  ├─ rules.js              斗地主对局状态机（叫抢 / 出牌 / 结算 / 春天）
│  ├─ modes.js              模式枚举
│  ├─ ai.js                 AI 门面（对外导出）
│  ├─ ai/moves.js           能出什么：着法枚举
│  ├─ ai/evaluate.js        好不好：手牌强度、着法代价
│  ├─ ai/strategy.js        出哪个：叫牌 / 领出 / 跟牌 / 提示决策
│  └─ guandan/              掼蛋：牌型、对局状态机、AI
├─ ui/                      应用层：纯 JS
│  ├─ game-controllers.js   执行动作、对比快照，把"发生了什么"作为事件发出
│  ├─ event-bus.js          事件总线
│  ├─ turn-scheduler.js     AI 什么时候行动（思考时间 + 等声音播完）
│  ├─ sound.js              WebAudio 合成音效 + 浏览器中文语音
│  ├─ feedback.js           事件 → 音效 / 语音 / 特效
│  ├─ presenter.js          事件 → 牌桌动画状态（底牌翻开、终局揭示等）
│  ├─ doudizhu-view.js      快照 → 牌桌文案、可出判定、记牌器、结算行
│  ├─ profile.js            欢乐豆 / 战绩 / 设置的规则与存档
│  ├─ keyboard.js           按键 → 操作意图
│  ├─ viewport.js           电脑端缩放计算
│  ├─ drag-select.js        手牌滑动多选
│  ├─ cards-display.js      牌面文字
│  └─ table-config.js       座位与模式配置
├─ components/              纯展示组件（数据由上层算好传入，操作一律 emit）
│  ├─ TopBar / ModeSwitch / FxLayer / PlayingCard / SeatPanel / SettleDialog / ConfirmDialog
│  ├─ doudizhu/             DoudizhuBoard（牌桌）· ActionBar（操作区）· CardCounter（记牌器）
│  └─ guandan/              GuandanBoard
└─ pages/index/             唯一页面：只做装配（创建控制器、调度、反馈，用事件总线连起来）
   ├─ index.vue
   ├─ index.css             牌桌主样式
   └─ stage.css             电脑端缩放舞台
tests/                      单元测试（npm test）
```

### 一次出牌是怎么流动的

1. 组件 emit `play` → 页面调用 `dz.play(0, cards)`
2. 控制器执行引擎动作，对比前后快照，发出 `snap`、`play`、`trick`、`refreshed` 等事件
3. 订阅者各自处理：页面更新快照，`presenter` 播动画，`feedback` 播音效、语音和特效，
   `turn-scheduler` 在思考时间到、且上一句语音播完后，让下一家 AI 行动

想加新反馈（比如新特效），只改 `feedback.js`；想调 AI，只改 `game/ai/`；引擎和界面互不影响。

## 家庭规则说明

- 叫地主按座位轮流；有人叫后其他人依次抢，首叫者最后表态；每抢一次倍数 ×2
- 三家都不叫 → 本局作废，自动重发
- 炸弹、王炸每出一次 ×2
- 春天（地主赢且农民一张没出）或反春（农民赢且地主只出了第一手）再 ×2
- 结算：底分 100 × 叫抢倍数 × 炸弹倍数 × 春天倍数；地主收/赔两家，三家总和为 0
- 三带一、飞机带单不要求带的牌互不相同；2 和王不能进顺子、连对、飞机

## 注意

- 这是一个**独立仓库**，没有配置远程。上级目录 `D:\GYC\project` 是另一个项目（团队的迷你抖音）的仓库，不要把本项目提交或推送到那里。
- `.gitignore` 已忽略 `node_modules/`、`dist/`、日志、截图和调试用的浏览器临时目录。
