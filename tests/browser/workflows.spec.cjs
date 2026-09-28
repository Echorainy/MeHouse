const { test, expect } = require('@playwright/test');

test('multiple homes, global search, scoped navigation and empty last room', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: '全部物品 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '30 天内过期 1', exact: true }).click();
  const monthCard = page.getByTestId('expiry-card-month');
  const weekCard = page.getByTestId('expiry-card-week');
  await expect(page.getByRole('button', { name: '30 天内过期 1', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: '7 天内过期 0', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => monthCard.evaluate(element => getComputedStyle(element).transform)).not.toBe('none');
  await expect.poll(() => weekCard.evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(1);
  await expect(page.getByTestId('expiry-items-panel-month')).toBeVisible();
  const statsBox = await page.getByTestId('expiry-stats-grid').boundingBox();
  const expiryPanel = page.getByTestId('expiry-items-panel-month');
  const panelBox = await expiryPanel.boundingBox();
  const expiryHeading = expiryPanel.getByText('到期物品 · 30 天内过期', { exact: true });
  const headingBox = await expiryHeading.boundingBox();
  const expiryItem = expiryPanel.getByRole('button', { name: '查看物品 乌龙茶', exact: true });
  const itemBox = await expiryItem.boundingBox();
  expect(statsBox && panelBox && panelBox.y - (statsBox.y + statsBox.height)).toBeGreaterThanOrEqual(23);
  expect(headingBox && itemBox && itemBox.y - (headingBox.y + headingBox.height)).toBeGreaterThanOrEqual(11);
  await expect(page.getByText('到期物品 · 30 天内过期', { exact: true })).toBeVisible();
  await expect(page.getByText('到期提醒', { exact: true })).toBeVisible();
  await expect(page.getByText('家里的物品', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '查看物品 乌龙茶' })).toBeVisible();
  await expect(page.getByRole('button', { name: '查看物品 创可贴' })).toHaveCount(0);
  await page.getByRole('button', { name: '30 天内过期 1', exact: true }).click();
  await expect(page.getByRole('button', { name: '30 天内过期 1', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('到期物品 · 30 天内过期', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '7 天内过期 0', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 天内过期 0', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('到期物品 · 7 天内过期', { exact: true })).toBeVisible();
  await expect(page.getByText('暂无物品', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '全部物品 2', exact: true }).click();
  await expect(page.getByText('家里的物品', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('tab', { name: '房间', exact: true }).click();
  await expect(page.getByText(/把每个角落都放回它该在的地方/)).toBeVisible();
  await expect(page.getByRole('button', { name: '打开房间 厨房' })).toBeVisible();
  await expect(page.getByText(/件物品 · 点击进入/).first()).toBeVisible();
  await expect(page.getByTestId('layout-grid')).toHaveCount(0);
  await page.getByRole('button', { name: '打开房间 厨房' }).click();
  await expect(page.getByRole('button', { name: '打开模块 第二层抽屉' })).toHaveCount(0);
  await page.getByRole('button', { name: '打开模块 左侧橱柜' }).click();
  await page.getByRole('button', { name: '打开模块 第二层抽屉' }).click();
  await expect(page.getByText('我的家 → 厨房 → 左侧橱柜 → 第二层抽屉', { exact: true }).first()).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: '返回上一级' }).click();
  await expect(page.getByRole('button', { name: '打开房间 厨房' })).toBeVisible();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('button', { name: '选择家庭' }).click();
  await page.getByRole('button', { name: '新建家', exact: true }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill(' 我的家 ');
  await page.getByRole('button', { name: '保存名称' }).click();
  await expect(page.getByRole('alert')).toContainText('已经存在');
  await page.getByRole('textbox', { name: '名称', exact: true }).fill(' 周末小屋 ');
  await page.getByRole('button', { name: '保存名称' }).click();
  await expect(page.getByRole('button', { name: '全部物品 0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await expect(page.getByText('新增房间', { exact: true }).last()).toBeVisible();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('厨房');
  await page.getByRole('button', { name: '保存名称' }).click();
  await page.getByRole('button', { name: '打开房间 厨房' }).click();
  await page.getByRole('button', { name: '在此位置记录物品' }).click();
  await page.getByRole('textbox', { name: '物品名称', exact: true }).fill('乌龙茶');
  await page.getByRole('button', { name: '保存物品' }).click();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expect(page.getByRole('button', { name: '全部物品 1', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '搜索所有家的物品' }).fill('乌龙茶');
  await expect(page.getByRole('button', { name: '查看物品 乌龙茶' })).toHaveCount(2);
  await expect(page.getByText('周末小屋 → 厨房', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '搜索所有家的物品' }).fill('');
  await page.getByRole('button', { name: '选择家庭' }).click();
  await page.getByRole('button', { name: '重命名家庭 周末小屋' }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('山间小屋');
  await page.getByRole('button', { name: '保存名称' }).click();
  await expect(page.getByRole('button', { name: '选择家庭' })).toContainText('山间小屋');
  await page.getByRole('tab', { name: '房间', exact: true }).click();
  await page.getByRole('button', { name: '打开房间 厨房' }).click();
  await page.getByRole('button', { name: '删除房间', exact: true }).click();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByTestId('layout-grid')).toBeVisible();
  await page.getByRole('button', { name: '删除房间', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByText('这个家还没有房间', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expect(page.getByRole('button', { name: '全部物品 0', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '选择家庭' }).click();
  await page.getByRole('button', { name: '切换到 我的家', exact: true }).click();
  await expect(page.getByRole('button', { name: '全部物品 2', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await page.getByRole('textbox', { name: '物品名称', exact: true }).fill('钥匙');
  await page.getByRole('button', { name: '保存物品' }).click();
  await expect(page.getByRole('alert')).toContainText('请选择房间');
  await page.getByRole('radio', { name: '卧室', exact: true }).click();
  await page.getByRole('button', { name: '保存物品' }).click();
  await expect(page.getByRole('button', { name: '全部物品 3', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('today expiry becomes expired across midnight without a reload', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-24T23:58:00') });
  await page.goto('/');
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await page.getByRole('textbox', { name: '物品名称', exact: true }).fill('今日牛奶');
  await page.getByRole('radio', { name: '厨房', exact: true }).click();
  await page.getByRole('radio', { name: '设置保质期', exact: true }).click();
  await page.getByRole('textbox', { name: '过期日期', exact: true }).fill('2026-09-24');
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await expect(page.getByRole('button', { name: '7 天内过期 1', exact: true })).toBeVisible();
  await page.clock.fastForward(180000);
  await expect(page.getByRole('button', { name: '7 天内过期 0', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '已过期 1', exact: true })).toBeVisible();
});

test('category rename and deletion preserve item and update global search', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '修改分类 饮品', exact: true }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('茶饮');
  await page.getByRole('button', { name: '保存名称' }).click();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索所有家的物品' }).fill('茶饮');
  await expect(page.getByRole('button', { name: '查看物品 乌龙茶' })).toBeVisible();
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '删除分类 茶饮', exact: true }).click();
  await page.getByRole('button', { name: '确认删除' }).click();
  await expect(page.getByRole('button', { name: '删除分类 未分类', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索所有家的物品' }).fill('未分类');
  await expect(page.getByRole('button', { name: '查看物品 乌龙茶' })).toBeVisible();
});

test('items and settings use layered sections', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await expect(page.getByText('家里的物品', { exact: true })).toBeVisible();
  await expect(page.getByText('筛选范围', { exact: true })).toBeVisible();
  await expect(page.getByText('全部物品', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await expect(page.getByText('家庭管理', { exact: true })).toBeVisible();
  await expect(page.getByText('分类标签', { exact: true })).toBeVisible();
  await expect(page.getByText('到期提醒', { exact: true })).toBeVisible();
});

test('long pressing the home card opens editable copy', async ({ page }) => {
  await page.goto('/');
  const card = page.getByRole('button', { name: '编辑首页问候语' });
  await card.dispatchEvent('contextmenu');
  await expect(page.getByText('编辑首页文案', { exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: '主标题', exact: true }).fill('欢迎回家');
  await page.getByRole('textbox', { name: '副标题', exact: true }).fill('每件物品都有自己的位置');
  await page.getByRole('button', { name: '保存文案', exact: true }).click();
  await expect(page.getByText('欢迎回家', { exact: true })).toBeVisible();
  await expect(page.getByText('每件物品都有自己的位置', { exact: true })).toBeVisible();
});

test('home actions appear before expiry reminders', async ({ page }) => {
  await page.goto('/');
  const order = await page.locator('body *').evaluateAll(nodes => nodes
    .filter(node => ['记录物品', '搜索所有家的物品', '到期提醒'].includes((node.textContent || '').trim()) || node.getAttribute('aria-label') === '搜索所有家的物品')
    .map(node => (node.textContent || node.getAttribute('aria-label') || '').trim())
    .filter((value, index, values) => values.indexOf(value) === index));
  expect(order.indexOf('记录物品')).toBeLessThan(order.indexOf('搜索所有家的物品'));
  expect(order.indexOf('搜索所有家的物品')).toBeLessThan(order.indexOf('到期提醒'));
});

test('creates a room with a preset grid size', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '房间', exact: true }).click();
  await page.getByRole('button', { name: '新增房间', exact: true }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('大储物间');
  await page.getByRole('radio', { name: '10×10', exact: true }).click();
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await page.getByRole('button', { name: '打开房间 大储物间', exact: true }).click();
  await expect(page.locator('[data-testid^="cell-"]')).toHaveCount(100);
  await expect(page.getByText(/10×10/).first()).toBeVisible();
});

test('record item form keeps balanced group spacing', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  const form = page.getByTestId('item-form-stack');
  const roomSection = page.getByTestId('item-form-section-room');
  await expect(form).toBeVisible();
  await expect(roomSection).toBeVisible();
  await expect(form).toHaveCSS('gap', '16px');
  await expect(roomSection).toHaveCSS('gap', '8px');
  await page.getByRole('radio', { name: '厨房', exact: true }).click();
  await expect(page.getByTestId('item-form-section-location')).toBeVisible();
  await expect(page.getByTestId('item-form-section-location')).toHaveCSS('gap', '8px');
  await expect(page.getByTestId('item-form-section-category')).toHaveCSS('gap', '8px');
  await expect(page.getByTestId('item-form-section-expiry')).toHaveCSS('gap', '8px');
});

test('manages clothing subcategories and records an item with a child category', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await expect(page.getByText('食物', { exact: true })).toBeVisible();
  await expect(page.getByText('衣物', { exact: true })).toBeVisible();
  await expect(page.getByText('上衣', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '展开二级分类 衣物', exact: true }).click();
  await expect(page.getByText('上衣', { exact: true })).toBeVisible();
  await expect(page.getByText('上衣', { exact: true })).toHaveCSS('color', 'rgb(61, 34, 15)');
  await expect(page.getByText('上衣', { exact: true }).locator('..')).toHaveCSS('background-color', 'rgb(255, 250, 244)');
  await page.getByRole('button', { name: '收起二级分类 衣物', exact: true }).click();
  await expect(page.getByText('上衣', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: '展开二级分类 衣物', exact: true }).click();
  await page.getByRole('button', { name: '新增衣物二级分类', exact: true }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('袜类');
  await page.getByRole('button', { name: '保存二级分类', exact: true }).click();
  await expect(page.getByText('袜类', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '修改二级分类 袜类', exact: true }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('袜子');
  await page.getByRole('button', { name: '保存二级分类', exact: true }).click();
  await expect(page.getByText('袜子', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await page.getByRole('textbox', { name: '物品名称', exact: true }).fill('白色上衣');
  await page.getByRole('radio', { name: '卧室', exact: true }).click();
  await page.getByRole('radio', { name: '衣物', exact: true }).click();
  await page.getByRole('radio', { name: '上衣', exact: true }).click();
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await page.getByRole('radio', { name: '衣物', exact: true }).click();
  await page.getByRole('radio', { name: '上衣', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看物品 白色上衣', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索所有家的物品' }).fill('上衣');
  await expect(page.getByRole('button', { name: '查看物品 白色上衣', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '删除二级分类 上衣', exact: true }).click();
  await page.getByRole('button', { name: '确认删除', exact: true }).click();
  await expect(page.getByRole('button', { name: '删除二级分类 上衣', exact: true })).toHaveCount(0);
  for (const name of ['下衣', '连体', '配饰', '袜子']) {
    await page.getByRole('button', { name: `删除二级分类 ${name}`, exact: true }).click();
    await page.getByRole('button', { name: '确认删除', exact: true }).click();
  }
  await expect(page.getByText('衣物', { exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByRole('textbox', { name: '搜索所有家的物品' }).fill('衣物');
  await expect(page.getByRole('button', { name: '查看物品 白色上衣', exact: true })).toHaveCount(0);
});

test('category titles and arrows toggle the same group and settings reuse secondary chips', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '设置', exact: true }).click();

  const clothingToggle = page.getByRole('button', { name: '展开二级分类 衣物', exact: true });
  await page.getByTestId('category-toggle-arrow-clothes').click();
  await expect(page.getByLabel('上衣', { exact: true })).toBeVisible();
  await expect(page.getByLabel('上衣', { exact: true })).toHaveCSS('background-color', 'rgb(255, 250, 244)');
  await expect(page.getByLabel('上衣', { exact: true })).toHaveCSS('border-color', 'rgb(232, 220, 203)');

  const collapseToggle = page.getByRole('button', { name: '收起二级分类 衣物', exact: true });
  await collapseToggle.getByText('衣物', { exact: true }).click();
  await expect(page.getByLabel('上衣', { exact: true })).toBeHidden();
});

test('record form exposes child categories and clears them when changing the parent', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await page.getByRole('radio', { name: '食物', exact: true }).click();
  const staple = page.getByRole('radio', { name: '主食', exact: true });
  await expect(staple).toBeVisible();
  await staple.click();
  await expect(staple).toHaveAttribute('aria-checked', 'true');
  await expect(staple).toHaveCSS('border-width', '2px');
  await expect(staple).toHaveCSS('background-color', 'rgb(230, 210, 208)');
  await expect(staple).toHaveCSS('border-color', 'rgb(172, 133, 132)');
  await page.getByRole('radio', { name: '衣物', exact: true }).click();
  await expect(staple).toHaveCount(0);
  await expect(page.getByRole('radio', { name: '上衣', exact: true })).toBeVisible();
});

test('category editor controls whether an empty category can add children', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '修改分类 饮品', exact: true }).click();
  const capability = page.getByLabel('允许添加二级分类', { exact: true });
  await expect(capability).toBeChecked();
  await capability.click();
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(page.getByRole('button', { name: '展开二级分类 饮品', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '新增饮品二级分类', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '修改分类 饮品', exact: true }).click();
  await page.getByLabel('允许添加二级分类', { exact: true }).click();
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await page.getByRole('button', { name: '展开二级分类 饮品', exact: true }).click();
  await page.getByRole('button', { name: '新增饮品二级分类', exact: true }).click();
  await page.getByRole('textbox', { name: '名称', exact: true }).fill('茶类');
  await page.getByRole('button', { name: '保存二级分类', exact: true }).click();
  await expect(page.getByText('茶类', { exact: true })).toBeVisible();
});

test('category editor prevents disabling a category that still has children', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.getByRole('button', { name: '修改分类 食物', exact: true }).click();
  await page.getByLabel('允许添加二级分类', { exact: true }).click();
  await page.getByRole('button', { name: '保存名称', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('请先删除全部二级分类');
});

for (const width of [320, 390, 1200]) test(`square grid and screenshots at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 850 }); await page.goto('/');
  await expect(page.getByRole('button', { name: '选择家庭' })).toBeVisible();
  await expect(page.getByLabel('猫咪助手').first()).toBeVisible();
  await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await page.screenshot({ path: `test-results/items-${width}.png`, fullPage: true });
  await page.getByRole('tab', { name: '设置', exact: true }).click();
  await page.screenshot({ path: `test-results/settings-${width}.png`, fullPage: true });
  await page.getByRole('tab', { name: '房间', exact: true }).click();
  await page.screenshot({ path: `test-results/rooms-${width}.png`, fullPage: true });
  const roomBoxes = await page.getByTestId('grid-preview').evaluateAll(nodes => nodes.map(node => {
    const box = node.getBoundingClientRect();
    return { x: box.x, y: box.y, right: box.right };
  }));
  expect(roomBoxes).toHaveLength(2);
  expect(Math.abs(roomBoxes[0].y - roomBoxes[1].y)).toBeLessThan(1);
  expect(roomBoxes[1].x).toBeGreaterThan(roomBoxes[0].right);
  expect(roomBoxes[1].right).toBeLessThanOrEqual(width);
  await page.getByRole('button', { name: '打开房间 厨房' }).click();
  await expect(page.getByTestId('cell-63')).toBeVisible();
  const boxes = await page.locator('[data-testid^="cell-"]').evaluateAll(nodes => nodes.map(n => { const b = n.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }));
  expect(boxes).toHaveLength(64);
  for (const b of boxes) expect(Math.abs(b.w - b.h)).toBeLessThan(1);
  expect(boxes[0].y).toBe(boxes[7].y); expect(boxes[8].y).toBeGreaterThan(boxes[7].y);
  await page.screenshot({ path: `test-results/layout-${width}.png`, fullPage: true });
});
