# Blockworld（Komari 主题）

方块游戏风格的 Komari 监控主题：首页背景是一个可以走进去的 3D 方块世界，每台服务器是一座信标塔。只有深色界面。

- `src/game/`：引擎。`blocks.ts`（方块与程序化生成的贴图图集，不含任何游戏素材）、`world.ts`（地形）、`mesher.ts`（区块网格）、`engine.ts`（three.js 渲染、玩家、挖/放方块、节点信标塔）、`state.ts`（引擎与界面共享的状态）。
- `src/components/mc/`、`src/views/HomeView.vue`、`src/App.vue`：界面（多人游戏列表、游戏内 HUD、箱子界面）；样式集中在 `src/styles/main.css` 的 `.mc-*`。
- 数据层（`src/stores`、`src/utils`、`InstanceDetail`、图表）沿用 LiquidBounce 主题。
- 玩家搭建的方块存在浏览器 `localStorage`（`blockworld:edits`），按世界种子区分。
- 发布：工作区的 `tools/release-theme.sh blockworld X.Y.Z`。
- 不要加入 Mojang 的贴图、字体、音效或商标；这是非官方的同人风格作品。
