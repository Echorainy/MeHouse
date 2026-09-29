const { test, expect } = require('@playwright/test');
const path = require('node:path');

test('adds, persists, replaces, and removes an item image on web', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '记录物品', exact: true }).click();
  await page.getByRole('textbox', { name: '物品名称', exact: true }).fill('带图片物品');
  await page.getByRole('radio', { name: '厨房', exact: true }).click();
  await page.getByRole('radio', { name: '消耗品', exact: true }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '添加图片', exact: true }).click();
  await (await chooser).setFiles(path.resolve('assets/app-icon.png'));
  await expect(page.getByTestId('item-image').last()).toBeVisible();
  await page.getByRole('button', { name: '保存物品', exact: true }).click();
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看物品 带图片物品', exact: true })).toBeVisible();
  await expect.poll(async () => await page.evaluate(() => {
    const snapshot = JSON.parse(localStorage.getItem('home-whereabouts.snapshot') || '{}');
    const item = snapshot.items?.find(item => item.name === '带图片物品');
    return typeof item?.imageUri === 'string' && item.imageUri.startsWith('data:image/');
  })).toBe(true);
  await page.reload();
  await page.getByRole('tab', { name: '物品', exact: true }).click();
  await page.getByRole('button', { name: '查看物品 带图片物品', exact: true }).click();
  await expect(page.getByTestId('item-image').last()).toBeVisible();
  await page.getByRole('button', { name: '编辑物品', exact: true }).click();
  await page.getByRole('button', { name: '移除图片', exact: true }).click();
  await page.getByRole('button', { name: '确认移除图片', exact: true }).click();
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('button', { name: '查看物品 带图片物品', exact: true })).toBeVisible();
  await expect.poll(async () => await page.evaluate(() => JSON.parse(localStorage.getItem('home-whereabouts.snapshot') || '{}').items?.find(item => item.name === '带图片物品')?.imageUri)).toBeUndefined();
});

