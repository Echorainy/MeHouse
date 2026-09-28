# MeHouse

咪的房 · 家里放哪儿

一个帮助记录家庭物品位置、搜索物品并管理保质期的 Expo React Native 原型。

## 运行

```bash
pnpm install
pnpm start
```

当前原型的数据保存在运行时内存中，重启 App 后会恢复示例数据。后续接入 SQLite 和本地通知。

## 多家庭版本

- 首页点击家名可新建、重命名或切换家。统计和普通物品列表仅查看当前家，搜索覆盖所有家。
- 房间页先显示卡片，点击后进入 8×8 布局。房间、橱柜、抽屉逐级返回。
- 新家从空房间列表开始；首页录入必须选择位置，布局内录入带入当前位置。
- 30 天和 7 天统计都包含今天，排除已过期物品，按本地日历日期计算。

## 验证与浏览器预览

```bash
pnpm test
pnpm typecheck
pnpm exec expo export --platform android --platform web
pnpm exec expo start --web --port 8083
pnpm exec playwright install chromium
pnpm test:ui
```

浏览器打开 http://localhost:8083。浏览器测试覆盖多家庭隔离、全局搜索、位置必选、空家庭、逐级返回、分类管理、午夜到期刷新与三种屏幕宽度的正方形网格。

当前仍不包含本地持久化、系统通知、逐格涂画与拖拽编辑、删除整个家、跨家搬移。
