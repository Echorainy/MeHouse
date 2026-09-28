const { test, expect } = require('@playwright/test');
const path = require('node:path');
const os = require('node:os');

const date = (offset = 0) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const fixture = () => ({
  homes: [{ id: 'home', name: '我的家' }, { id: 'away', name: '另一个家' }],
  rooms: [{ id: 'kitchen', name: '厨房', homeId: 'home', layout: { rows: 8, cols: 8 } }, { id: 'away-room', name: '厨房', homeId: 'away', layout: { rows: 8, cols: 8 } }],
  containers: [], categories: [{ id: 'other', name: '其他', isSystem: false, allowSubcategories: true }, { id: 'uncategorized', name: '未分类', isSystem: true, allowSubcategories: false }], subcategories: [],
  items: [
    { id: 'soap', name: '洗手液', roomId: 'kitchen', categoryId: 'other', inventoryType: 'consumable', quantity: 3, unit: '瓶', restockThreshold: 3, expiry: date(2), reminderDays: 7 },
    { id: 'drill', name: '电钻', roomId: 'kitchen', categoryId: 'other', inventoryType: 'durable', quantity: 1, unit: '件', maintenanceDate: date(2), maintenanceLeadDays: 3, reminderDays: 7 },
    { id: 'legacy', name: '旧物品', roomId: 'kitchen', categoryId: 'other', reminderDays: 7 },
    { id: 'away-item', name: '外地洗手液', roomId: 'away-room', categoryId: 'other', inventoryType: 'consumable', quantity: 0, unit: '瓶', restockThreshold: 1, reminderDays: 7 },
  ],
});
async function seed(page) {
  await page.addInitScript(snapshot => {
    if (!sessionStorage.getItem('inventory-seeded')) {
      localStorage.setItem('home-whereabouts.snapshot', JSON.stringify(snapshot)); sessionStorage.setItem('inventory-seeded', '1');
    }
  }, fixture());
  await page.goto('/');
  await expect(page.getByTestId('restock-reminders')).toContainText('暂无需要补货');
}
const stored = page => page.evaluate(() => JSON.parse(localStorage.getItem('home-whereabouts.snapshot')));
test('consume, undo, replenish, empty stock, reload and household isolation', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await seed(page);
  await expect(page.getByTestId('maintenance-reminders')).toContainText('电钻');
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await page.getByRole('button', { name: '消耗一份 洗手液', exact: true }).click();
  await page.getByRole('button', { name: '补货 洗手液', exact: true }).click();
  await page.getByRole('textbox', { name: '增加数量', exact: true }).fill('2');
  await page.getByRole('button', { name: '确认补货', exact: true }).click();
  await page.getByRole('button', { name: '撤销消耗 洗手液', exact: true }).click();
  await expect.poll(async () => (await stored(page)).items.find(i => i.id === 'soap').quantity).toBe(5);
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: '消耗一份 洗手液', exact: true }).click();
  await expect(page.getByRole('button', { name: '消耗一份 洗手液', exact: true })).toBeDisabled();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expect(page.getByTestId('restock-soap')).toContainText('已用完');
  await expect(page.getByRole('button', { name: '7 天内过期 0', exact: true })).toBeVisible();
  await expect(page.getByTestId('restock-away-item')).toHaveCount(0);
  await page.reload(); await expect(page.getByTestId('restock-soap')).toContainText('0 瓶');
  await page.getByRole('button', { name: '补货 洗手液', exact: true }).click();
  await page.getByRole('textbox', { name: '增加数量', exact: true }).fill('3');
  await page.getByRole('button', { name: '确认补货', exact: true }).click();
  await expect(page.getByTestId('restock-soap')).toHaveCount(0);
  await page.getByRole('button', { name: '选择家庭', exact: true }).click();
  await page.getByRole('button', { name: '切换到 另一个家', exact: true }).click();
  await expect(page.getByTestId('restock-away-item')).toContainText('外地洗手液');
  await expect(page.getByTestId('maintenance-drill')).toHaveCount(0);
  expect(errors).toEqual([]);
});
test('record validation, unfiltered inventory list, maintenance completion and legacy setup', async ({ page }) => {
  await seed(page);
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await page.getByRole('textbox', { name: '物品名称', exact: true }).fill('纸巾');
  await page.getByRole('radio', { name: '厨房', exact: true }).click();
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('请选择消耗品或耐用品');
  await page.getByRole('radio', { name: '消耗品', exact: true }).click();
  await page.getByRole('textbox', { name: '数量', exact: true }).fill('1.5');
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('非负整数');
  await page.getByRole('textbox', { name: '数量', exact: true }).fill('0');
  await page.getByRole('textbox', { name: '单位', exact: true }).fill('包');
  await page.getByRole('textbox', { name: '库存线', exact: true }).fill('0');
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('库存线必须是正整数');
  await page.getByRole('textbox', { name: '库存线', exact: true }).fill('2');
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await expect(page.getByTestId('restock-reminders')).toContainText('纸巾');
  await page.getByRole('button', { name: '完成检修 电钻', exact: true }).click();
  await page.getByRole('textbox', { name: '下一次检修日期（可选）', exact: true }).fill(date(30));
  await page.getByRole('button', { name: '确认完成检修', exact: true }).click();
  await expect(page.getByTestId('maintenance-drill')).toHaveCount(0);
  await expect.poll(async () => (await stored(page)).items.find(i => i.id === 'drill').lastMaintenanceDate).toBe(date());
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await expect(page.getByRole('radio', { name: '待设置', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '查看物品 洗手液', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看物品 旧物品', exact: true }).click();
  await page.getByRole('button', { name: '设置库存类型', exact: true }).click();
  await page.getByTestId('item-form-inventory').getByRole('radio', { name: '耐用品', exact: true }).click();
  await page.getByRole('radio', { name: '设置检修', exact: true }).click();
  await page.getByRole('textbox', { name: '检修日期', exact: true }).fill(date());
  await page.getByRole('textbox', { name: '提前提醒天数', exact: true }).fill('0');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await expect(page.getByTestId('maintenance-legacy')).toContainText('今天检修');
  await page.getByRole('button', { name: '完成检修 旧物品', exact: true }).click();
  await page.getByRole('button', { name: '确认完成检修', exact: true }).click();
  await expect(page.getByTestId('maintenance-legacy')).toHaveCount(0);
});
for (const width of [320, 390, 1200]) test(`inventory layout and actions at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await seed(page);
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await page.getByRole('button', { name: '消耗一份 洗手液', exact: true }).click();
  await page.getByRole('tab', { name: '首页', exact: true }).click();
  await page.getByTestId('restock-soap').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('restock-soap')).toContainText('2 瓶');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(os.tmpdir(), `inventory-${width}.png`) });
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await expect(page.getByTestId('item-form-inventory')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
