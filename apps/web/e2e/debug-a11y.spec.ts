/**
 * Debug script to find color-contrast violations on the home page
 */
import { test } from '@playwright/test';
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3401";

test('debug color contrast violations', async ({ page }) => {
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious"
  );
  
  console.log(`Total violations: ${results.violations.length}`);
  console.log(`Serious violations: ${serious.length}`);
  
  for (const v of serious) {
    console.log(`\nViolation: ${v.id} - ${v.description}`);
    console.log(`Help: ${v.helpUrl}`);
    for (const node of v.nodes) {
      console.log(`  Element: ${node.html.substring(0, 200)}`);
      console.log(`  Target: ${node.target}`);
      const ccData = node.any?.[0]?.data as any;
      if (ccData?.contrastRatio) {
        console.log(`  Contrast ratio: ${ccData.contrastRatio} (required: ${ccData.expectedContrastRatio})`);
      }
    }
  }
});
