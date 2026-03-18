const { chromium } = require('@playwright/test');

const API = 'http://127.0.0.1:3402/api';
const BASE = 'http://127.0.0.1:3403';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    console.log('CONSOLE', msg.type(), msg.text());
  });

  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log('NAV', frame.url());
    }
  });

  page.on('response', (res) => {
    const url = res.url();
    if (url.includes('/api/') || url.includes('/auth/')) {
      console.log('RESP', res.status(), url);
    }
  });

  const loginRes = await page.request.post(`${API}/auth/dev-login`, {
    data: { email: 'renter@test.com', role: 'USER', secret: 'dev-secret-123' },
  });
  const payload = await loginRes.json();
  console.log('LOGIN', loginRes.status(), JSON.stringify(payload.user));

  await page.addInitScript((authPayload) => {
    const rawRole = (authPayload.user.role ?? '').toUpperCase();
    const normalizedRole =
      rawRole === 'HOST'
        ? 'owner'
        : rawRole === 'ADMIN' || rawRole === 'SUPER_ADMIN'
          ? 'admin'
          : 'renter';
    const normalizedUser = { ...authPayload.user, role: normalizedRole };
    const state = JSON.stringify({
      state: {
        user: normalizedUser,
        accessToken: authPayload.accessToken,
        refreshToken: authPayload.refreshToken,
      },
      version: 0,
    });
    localStorage.setItem('auth-storage', state);
    localStorage.setItem('accessToken', authPayload.accessToken);
    localStorage.setItem('refreshToken', authPayload.refreshToken);
    localStorage.setItem('user', JSON.stringify(normalizedUser));
  }, payload);

  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  console.log('AFTER_DASHBOARD', page.url());

  await page.goto(`${BASE}/disputes/new/not-a-uuid`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('FINAL_URL', page.url());
  const bodyText = await page.locator('body').textContent();
  console.log('BODY_TEXT', JSON.stringify((bodyText || '').slice(0, 400)));

  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
