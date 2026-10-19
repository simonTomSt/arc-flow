import { test, expect } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "..", "..", "..", "packages", "core", "test", "fixtures", "plate-100x60.dxf");

test("Start → import DXF → Replace lands in CAM with the imported part", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();

  // Hidden <input type="file"> inside the drop zone.
  await page.locator(".start-card.drop input[type=file]").setInputFiles(fixture);

  await expect(page.getByText("Raport importu")).toBeVisible();
  await expect(page.getByText(/Plik plate-100x60\.dxf/)).toBeVisible();

  await page.getByRole("button", { name: "Zastąp projekt" }).click();

  // CAM: project title updates and three contours appear in the tree.
  await expect(page.locator(".menubar").getByText("plate-100x60")).toBeVisible();
  await expect(page.getByText("Otwór Ø8")).toBeVisible();
  await expect(page.getByText("Otwór Ø16")).toBeVisible();
  await expect(page.getByText("Obrys")).toBeVisible();
});

test("appending the same DXF twice does not trigger a bogus bridge warning", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();

  // First import — Replace.
  await page.locator(".start-card.drop input[type=file]").setInputFiles(fixture);
  await page.getByRole("button", { name: "Zastąp projekt" }).click();

  // Second import — Append.
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.locator(".start-card.drop input[type=file]").setInputFiles(fixture);
  await page.getByRole("button", { name: "Dołącz do arkusza" }).click();

  // Two part groups now exist (i1-c3 and i2-c3) and the sheet shows no warning chip.
  await expect(page.getByText(/i1-c3/)).toBeVisible();
  await expect(page.getByText(/i2-c3/)).toBeVisible();
  await expect(page.locator(".issues-chip")).toHaveCount(0);
});

test("SVG preview in the import report stays inside its viewBox", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();

  await page.locator(".start-card.drop input[type=file]").setInputFiles(fixture);
  const preview = page.locator("svg.import-preview");
  await expect(preview).toBeVisible();

  // Regression for the Y-flip pivot bug: the visible stroke bbox must sit
  // inside the viewBox, not above/below it.
  const info = await preview.evaluate((svg) => {
    const vb = svg.getAttribute("viewBox")!.split(" ").map(Number);
    const g = svg.querySelector("g")!;
    const b = g.getBBox();
    return { vb, b: { x: b.x, y: b.y, w: b.width, h: b.height } };
  });
  const [vbX, vbY, vbW, vbH] = info.vb as [number, number, number, number];
  const eps = 0.01;
  expect(info.b.x).toBeGreaterThanOrEqual(vbX - eps);
  expect(info.b.y).toBeGreaterThanOrEqual(vbY - eps);
  expect(info.b.x + info.b.w).toBeLessThanOrEqual(vbX + vbW + eps);
  expect(info.b.y + info.b.h).toBeLessThanOrEqual(vbY + vbH + eps);
});
