import { test, expect } from '@playwright/test'

test('shows current time', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toHaveText(/\d\d:\d\d/)
})

test('can sign in', async ({ page }) => {
  await page.goto('/?backend=fake')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('button', { name: 'Automatron' })).toBeVisible()
})
