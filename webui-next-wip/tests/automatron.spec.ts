import { test, expect, Page } from '@playwright/test'

test('shows current time', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toHaveText(/\d\d:\d\d/)
})

test('can sign in', async ({ page }) => {
  await page.goto('/?backend=fake')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page.getByRole('button', { name: 'Automatron' })).toBeVisible()
})

test('can send message with error', async ({ page }) => {
  await page.goto('/?backend=fake')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.getByRole('button', { name: 'Automatron' }).click()
  await page.getByRole('textbox').fill('!error')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.locator('pre')).toHaveText(/SyntaxError/)
})

test('can display result', async ({ page }) => {
  await send(page, {
    type: 'text',
    text: 'Hello, world!',
  })
  await expect(page.locator('pre')).toHaveText(/Hello, world!/)
})

async function send(page: Page, ...results: any[]) {
  await page.goto('/?backend=fake')
  await page.getByRole('button', { name: 'Sign In' }).click()
  await page.getByRole('button', { name: 'Automatron' }).click()
  await page.getByRole('textbox').fill(
    JSON.stringify({
      ok: true,
      result: [...results],
    })
  )
  await page.getByRole('button', { name: 'Send' }).click()
}
