/* QA de recorridos con Chrome real (Playwright Core + Chrome instalado).
   Uso: node qa/run-journeys.js antes|despues
   No crea cuentas reales: el registro se corta antes de enviar. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-core");

const PHASE = process.argv[2] === "despues" ? "despues" : "antes";
const BASE = process.env.QA_BASE || "http://127.0.0.1:3400";
const OUT = path.join(__dirname, PHASE);
const LOG = { phase: PHASE, base: BASE, startedAt: new Date().toISOString(), journeys: {} };
fs.mkdirSync(OUT, { recursive: true });

let shotN = 0;
async function shot(page, name, fullPage = false) {
  shotN += 1;
  const file = path.join(OUT, `${String(shotN).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage }).catch(() => {});
  return path.basename(file);
}
function rec(journey, key, value) {
  LOG.journeys[journey] = LOG.journeys[journey] || [];
  LOG.journeys[journey].push({ key, value });
}
async function mark(page, journey, key, fn, fallback = null) {
  try {
    const v = await fn();
    rec(journey, key, v);
    return v;
  } catch (e) {
    rec(journey, key, { error: String(e.message || e) });
    return fallback;
  }
}
async function openRegister(page) {
  await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(900);
  const link = page.getByRole("link", { name: /Creá tu acceso/i }).first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(500);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });

  // A) El impaciente
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    const dialogs = [];
    const payApi = [];
    page.on("dialog", async (d) => { dialogs.push(d.message()); await d.dismiss().catch(() => {}); });
    page.on("response", async (r) => {
      if (r.url().includes("/api/create-preference")) {
        payApi.push({ status: r.status(), body: (await r.text().catch(() => "")).slice(0, 240) });
      }
    });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await mark(page, "a-impaciente", "primer-cta", async () => {
      const a = page.locator(".hero-actions a.btn-primary").first();
      return { text: (await a.textContent())?.trim(), href: await a.getAttribute("href") };
    });
    await shot(page, "impaciente-hero");
    await page.locator(".hero-actions a.btn-primary").first().click();
    await page.waitForTimeout(900);
    await shot(page, "impaciente-destino-cta");
    await page.locator("#planes").scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await shot(page, "impaciente-planes");
    const rutnut = page.locator(".btn-plan-wa").first();
    rec("a-impaciente", "plan-rutnut", {
      text: (await rutnut.textContent())?.trim(),
      href: await rutnut.getAttribute("href"),
    });
    const btn = page.locator('.btn-plan[data-plan="0"]').first();
    await mark(page, "a-impaciente", "primer-plan", async () => ({
      text: (await btn.textContent())?.trim(),
      dataPlan: await btn.getAttribute("data-plan"),
    }));
    await btn.click().catch(() => {});
    await page.waitForTimeout(4000);
    await shot(page, "impaciente-resultado-pago");
    rec("a-impaciente", "dialogos", dialogs);
    rec("a-impaciente", "api-pago", payApi);
    rec("a-impaciente", "url-final", page.url());
    rec("a-impaciente", "error-tecnico-visible", /MP_ACCESS_TOKEN|Groq|anamnesis|Web App/i.test(await page.locator("body").innerText()));
    await ctx.close();
  }

  // B) El escéptico
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.locator("#planes").scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    rec("b-esceptico", "precios", await page.locator(".price-card .plan-price").allTextContents());
    const legal = await page.locator('a[href="/privacidad"], a[href="/terminos"]').evaluateAll((els) =>
      els.map((e) => ({ text: e.textContent.trim(), href: e.getAttribute("href") }))
    );
    rec("b-esceptico", "links-legales-en-footer", legal);
    await shot(page, "esceptico-planes");
    for (const href of ["/privacidad", "/terminos"]) {
      const resp = await page.goto(BASE + href, { waitUntil: "domcontentloaded" }).catch(() => null);
      rec("b-esceptico", `status-${href}`, resp ? resp.status() : null);
      await shot(page, `esceptico${href.replace("/", "-")}`);
    }
    await openRegister(page);
    await shot(page, "esceptico-registro");
    const bInputs = page.locator(".auth-card input.input");
    await bInputs.nth(0).fill("QA Escéptico");
    await bInputs.nth(1).fill("qaesceptico");
    await bInputs.nth(2).fill("qa-esceptico@example.com");
    await bInputs.nth(3).fill("2615551234");
    await bInputs.nth(4).fill("1234");
    await bInputs.nth(5).fill("1234");
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.waitForTimeout(500);
    const bStep2 = page.locator(".auth-card input.input");
    await bStep2.nth(0).fill("30");
    await bStep2.nth(1).fill("175");
    await bStep2.nth(2).fill("75");
    for (let i = 0; i < 3; i++) {
      await page.getByRole("button", { name: /Continuar/i }).click();
      await page.waitForTimeout(450);
    }
    await shot(page, "esceptico-paso5");
    rec("b-esceptico", "checkboxes-registro", await page.locator('input[type="checkbox"]').count());
    rec("b-esceptico", "texto-acepto", await page.getByText(/Acepto los términos/i).count());
    rec("b-esceptico", "links-legales-registro", await page.locator('#reg-terms ~ label a, label[for="reg-terms"] a').evaluateAll((els) =>
      els.map((e) => ({ text: e.textContent.trim(), href: e.getAttribute("href") }))
    ));
    await page.getByRole("button", { name: /Crear cuenta y entrar/i }).click();
    await page.waitForTimeout(500);
    rec("b-esceptico", "error-sin-aceptar", await page.locator(".toast.err").allTextContents());
    await page.locator("#reg-terms").check();
    rec("b-esceptico", "checkbox-marcado", await page.locator("#reg-terms").isChecked());
    await shot(page, "esceptico-terminos-aceptados");
    await ctx.close();
  }

  // C) El móvil (375px + 3G lenta)
  {
    const ctx = await browser.newContext({
      viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2,
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false, latency: 400, downloadThroughput: 50000, uploadThroughput: 50000,
    });
    const t0 = Date.now();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90000 });
    rec("c-movil", "domcontentloaded-ms", Date.now() - t0);
    await page.waitForTimeout(1800);
    await shot(page, "movil-hero");
    rec("c-movil", "metricas-hero", await page.evaluate(() => {
      const a = document.querySelector(".hero-actions .btn-primary");
      const r = a ? a.getBoundingClientRect() : null;
      return {
        innerWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        cta: r ? { width: Math.round(r.width), height: Math.round(r.height) } : null,
      };
    }));
    await page.locator("#planes").scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(600);
    await shot(page, "movil-planes");
    await page.goto(BASE + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    await shot(page, "movil-app");
    rec("c-movil", "metricas-app", await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    })));
    await ctx.close();
  }

  // D) El no nativo (sigue solo lo que dice la interfaz)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.locator(".nav-actions a.nav-app").first().click();
    await page.waitForTimeout(900);
    await shot(page, "nonativo-login");
    await page.getByRole("link", { name: /Creá tu acceso/i }).first().click();
    await page.waitForTimeout(500);
    const user = "qanativo" + String(Date.now()).slice(-6);
    rec("d-nonativo", "labels-asociados", await page.getByLabel("Nombre completo").count());
    const inputs = page.locator(".auth-card input.input");
    await inputs.nth(0).fill("QA No Nativo");
    await inputs.nth(1).fill(user);
    await inputs.nth(2).fill("qa-nativo@example.com");
    await inputs.nth(3).fill("2615551234");
    await inputs.nth(4).fill("1234");
    await inputs.nth(5).fill("1234");
    await shot(page, "nonativo-paso1");
    await page.getByRole("button", { name: /Continuar/i }).click();
    await page.waitForTimeout(700);
    await shot(page, "nonativo-paso2");
    rec("d-nonativo", "paso2-visible", await page.locator(".wizard-label.active").allTextContents());
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1000);
    rec("d-nonativo", "url-tras-back-navegador", page.url());
    rec("d-nonativo", "wizard-tras-back", await page.locator(".auth-card input.input").count());
    rec("d-nonativo", "nombre-tras-back", await page.locator(".auth-card input.input").nth(0).inputValue().catch(() => null));
    await shot(page, "nonativo-back-navegador");
    await ctx.close();
  }

  // E) El que rompe todo
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.route("**/api/auth/register", (route) => route.abort());
    await openRegister(page);
    const inputs = page.locator(".auth-card input.input");
    await inputs.nth(0).fill("   ~~~~ 1234567890 " + "A".repeat(480));
    await inputs.nth(1).fill("!!!");
    await inputs.nth(2).fill("noesmail");
    await inputs.nth(3).fill("abc");
    await inputs.nth(4).fill("12");
    await inputs.nth(5).fill("9999");
    const cont = page.getByRole("button", { name: /Continuar/i });
    for (let i = 0; i < 4; i++) { await cont.click({ force: true }).catch(() => {}); await page.waitForTimeout(120); }
    await page.waitForTimeout(700);
    await shot(page, "rompe-junk");
    rec("e-rompe", "error-visible", await page.locator(".toast.err").allTextContents());
    rec("e-rompe", "longitud-nombre", await inputs.nth(0).inputValue().then((v) => v.length).catch(() => null));
    rec("e-rompe", "paso-activo", await page.locator(".wizard-label.active").allTextContents());
    await page.goBack().catch(() => {});
    await page.waitForTimeout(900);
    rec("e-rompe", "url-tras-back", page.url());
    await shot(page, "rompe-back");
    await ctx.close();
  }

  // F) Primer éxito real: login con cuenta de prueba
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(BASE + "/app", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(900);
    const inputs = page.locator(".auth-card input.input");
    await inputs.nth(0).fill("alumnotest");
    await inputs.nth(1).fill("0000");
    await page.getByRole("button", { name: /^Ingresar$/i }).click();
    await page.waitForTimeout(3500);
    await shot(page, "login-exitoso");
    rec("f-exito", "url", page.url());
    rec("f-exito", "login-ok", (await page.locator(".auth-card input.input").count()) === 0);
    rec("f-exito", "texto-inicio", (await page.locator("body").innerText()).slice(0, 500));
    await ctx.close();
  }

  LOG.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUT, "observaciones.json"), JSON.stringify(LOG, null, 2));
  await browser.close();
  console.log("OK", PHASE, OUT);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
