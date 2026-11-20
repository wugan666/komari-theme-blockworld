# Blockworld（Komari 主题）

方块游戏风格的 Komari 监控主题：首页背景是一个可以走进去的无限 3D 方块世界，每台服务器是一座信标塔。只有深色界面。

`src/game/`（引擎，不依赖 Vue 组件）：

- `blocks.ts`：方块表与程序化绘制的贴图图集（含挖掘裂纹）。**不要加入任何游戏原版素材。**
- `noise.ts`、`world.ts`：按区块惰性生成的无限地形（高度、群系、矿石、树、花草都是种子的纯函数），玩家改动和信标塔叠加在上面。
- `mesher.ts`：区块网格，三类（不透明 / 镂空 / 半透明），每个顶点带环境光遮蔽。
- `engine.ts`：three.js 渲染（自定义着色器：昼夜亮度、雾、水面起伏、花草摇摆）、区块按距离流式加载、玩家物理、挖掘 / 放置、信标塔、菜单与游戏之间的镜头过渡。
- `sky.ts`（天空色、日月、星、云）、`effects.ts`（粒子、手持方块、动物）、`audio.ts`（合成音效）。
- `state.ts`：引擎与界面共享的状态、访客的游戏选项。

界面在 `src/views/HomeView.vue`（标题 / 多人游戏 / 选项 / 暂停 / 物品栏 / 箱子界面，由 `game.screen` 切换）、`src/components/mc/`、`src/App.vue`；样式集中在 `src/styles/main.css` 的 `.mc-*`。数据层沿用 LiquidBounce 主题。

玩家搭建的方块存在 `localStorage`（`blockworld:edits`，按种子区分），选项在 `blockworld:options`。

发布：工作区的 `tools/release-theme.sh blockworld X.Y.Z`。
