import { test } from "node:test";
import assert from "node:assert/strict";
import { allItems, groups, subscriptions, interactiveTypes, projectTiers } from "./data.mjs";
import { calculate, getWarnings } from "./calculations.mjs";

const noPlans = Object.fromEntries(subscriptions.map(service => [service.id, "none"]));

test("pięć tierów dolicza projekt, bazę oraz właściwie skaluje animacje, języki i QA", () => {
  const tiers = [
    ["landing", [14, 24.5], [7.2, 14.4], 1],
    ["landing-long", [21, 35], [13.2, 24], 1.25],
    ["company-small", [24.5, 42], [16.8, 30], 1.5],
    ["company", [31.5, 56], [21, 39], 2],
    ["service", [63, 105], [36, 66], 2.5]
  ];
  assert.equal(projectTiers.length, 5);
  for (const [id, design, development, factor] of tiers) {
    const result = calculate(new Set(["animation-scroll", "qa", "form-native"]), noPlans, "", "0", "webflow", "2", [], "internal", {}, id);
    assert.deepEqual(result.design, { min: design[0], max: design[1] }, id);
    assert.deepEqual(result.development, { min: development[0] + 11.5 * factor + 2, max: development[1] + 31.5 * factor + 3 }, id);
    assert.deepEqual([result.languageMin, result.languageMax], [4 * factor, 16 * factor], id);
    const exclude = calculate(new Set(), noPlans, "", "0", "webflow", "0", [], "internal", {}, id, false, false);
    assert.deepEqual([exclude.min, exclude.max], [0, 0], id);
  }
  const noTier = calculate(new Set(["animation-scroll", "qa", "form-native"]), noPlans, "", "0", "webflow", "2");
  assert.deepEqual([noTier.min, noTier.max], [2, 3]);
  assert.throws(() => calculate(new Set(), noPlans, "", "0", "webflow", "0", [], "internal", {}, "unknown"));
});

test("warianty CMS i animacji zachowują poprawne widełki", () => {
  for (const [id, min, max] of [["cms-none", 0, 0], ["cms-small", 6, 14], ["cms-large", 14, 30], ["animation-none", 0, 0], ["animation-basic", 2, 5], ["animation-scroll", 6, 14], ["animation-advanced", 15, 30]]) {
    const result = calculate(new Set([id]), noPlans, "", "0", "webflow", "0", [], "internal", {}, "landing", false, false);
    assert.deepEqual([result.min, result.max], [min, max], id);
    assert.equal(groups.find(entry => entry.items && entry.items.some(item => item[0] === id)).single, true, id);
  }
});

test("serwis skaluje każdy poziom animacji, oba warianty języków i QA bez zmiany dodatkowych pozycji", () => {
  for (const [id, min, max] of [["animation-none", 0, 0], ["animation-basic", 5, 12.5], ["animation-scroll", 15, 35], ["animation-advanced", 37.5, 75]]) {
    const result = calculate(new Set([id]), noPlans, "", "0", "webflow", "0", [], "internal", {}, "service", false, false);
    assert.deepEqual([result.min, result.max], [min, max], id);
  }
  const extra = [{ category: "animation", name: "Hero", level: "advanced" }];
  const webflow = calculate(new Set(["qa"]), noPlans, "", "0", "webflow", "2", extra, "internal", {}, "service", false, false);
  assert.deepEqual([webflow.languageMin, webflow.languageMax, webflow.componentMin, webflow.componentMax, webflow.min, webflow.max], [10, 40, 10, 20, 23.75, 63.75]);
  const exported = calculate(new Set(["qa"]), noPlans, "", "0", "export", "2", extra, "internal", {}, "service", false, false);
  assert.deepEqual([exported.languageMin, exported.languageMax, exported.min, exported.max], [20, 80, 33.75, 103.75]);
  const designOnly = calculate(new Set(), noPlans, "", "0", "webflow", "0", [], "internal", {}, "service", true, false);
  assert.deepEqual([designOnly.min, designOnly.max], [63, 105]);
  const baseOnly = calculate(new Set(), noPlans, "", "0", "webflow", "0", [], "internal", {}, "service", false, true);
  assert.deepEqual([baseOnly.min, baseOnly.max], [36, 66]);
});

test("liczy poszczególne komponenty i odrzuca błędne liczby", () => {
  const quantities = { slider: "2", tabs: "3", filter: "1", custom: "2" };
  const result = calculate(new Set(), noPlans, "", "0", "webflow", "0", [], "internal", quantities);
  assert.deepEqual(result.interactive, { min: 31, max: 69 });
  assert.deepEqual([result.min, result.max], [31, 69]);
  for (const type of interactiveTypes) {
    for (const value of ["", "-1", "1.5", "101", "abc", "Infinity"]) {
      assert.ok(calculate(new Set(), noPlans, "", "0", "webflow", "0", [], "internal", { [type.id]: value }).errors.length, `${type.id}: ${value}`);
    }
    for (const value of ["0", "100"]) {
      assert.deepEqual(calculate(new Set(), noPlans, "", "0", "webflow", "0", [], "internal", { [type.id]: value }).errors, []);
    }
  }
});

test("tryb zewnętrzny zachowuje zakres i koszty, dolicza projekt i handoff, wyklucza cały development", () => {
  const selected = new Set(["newsletter-template", "cms-small", "animation-scroll", "google-maps-cms", "form-native", "handoff-components", "handoff-qa"]);
  const components = [{ category: "animation", name: "Hero", level: "advanced" }];
  const quantities = { slider: "2", tabs: "1", filter: "1", custom: "1" };
  const plans = { ...noPlans, webflow: "cms", sender: "unknown" };
  const external = calculate(selected, plans, "200", "-2", "export", "2", components, "external", quantities, "landing");
  assert.deepEqual(external.design, { min: 18, max: 32.5 });
  assert.deepEqual(external.handoff, { min: 12, max: 28 });
  assert.deepEqual(external.development, { min: 68.2, max: 160.4 });
  assert.deepEqual([external.rawMin, external.rawMax, external.min, external.max], [30, 60.5, 28, 58.5]);
  assert.deepEqual([external.min * external.rate, external.max * external.rate], [5600, 11700]);
  assert.deepEqual(external.monthly, { PLN: 0, USD: 25 });
  assert.deepEqual(external.unknownCosts, ["Sender"]);
  assert.deepEqual(external.errors, []);
  const internal = calculate(selected, plans, "200", "-2", "export", "2", components, "internal", quantities, "landing");
  assert.deepEqual(internal.handoff, { min: 0, max: 0 });
  assert.deepEqual([internal.rawMin, internal.rawMax, internal.min, internal.max], [86.2, 192.9, 84.2, 190.9]);
  assert.deepEqual(calculate(selected, plans, "200", "-2", "export", "2", components, "external", quantities, "landing"), external);
  assert.throws(() => calculate(selected, plans, "", "", "export", "0", [], "invalid"));
});

test("wszystkie opcje handoffu są naliczane tylko przy wdrożeniu zewnętrznym", () => {
  const expected = [["handoff-components", 6, 14], ["handoff-interactions", 4, 12], ["handoff-prototype", 3, 10], ["handoff-meeting", 3, 8], ["handoff-qa", 6, 14]];
  for (const [id, min, max] of expected) {
    const selected = new Set([id]);
    assert.deepEqual([calculate(selected, noPlans, "", "0").min, calculate(selected, noPlans, "", "0").max], [0, 0]);
    const external = calculate(selected, noPlans, "", "0", "webflow", "0", [], "external");
    assert.deepEqual([external.min, external.max], [min, max]);
  }
});

test("tiery CMS wpływają na ostrzeżenia planów i eksportu", () => {
  for (const id of ["cms-small", "cms-large"]) {
    assert.ok(getWarnings(new Set([id]), noPlans, "export").some(text => text.includes("natywnej obsługi Webflow CMS")));
    assert.ok(getWarnings(new Set([id]), { ...noPlans, webflow: "basic" }).some(text => text.includes("funkcje CMS")));
  }
  assert.ok(!getWarnings(new Set(["cms-none"]), noPlans, "export").some(text => text.includes("natywnej obsługi Webflow CMS")));
});

test("sumuje zakresy, korektę, stawkę i osobne waluty", () => {
  const result = calculate(new Set(["marketing-test", "form-native"]), { ...noPlans, webflow: "basic", getresponse: "starter-yearly", cookiezen: "starter" }, "200", "-0.5");
  assert.equal(result.rawMin, 3.5);
  assert.equal(result.rawMax, 4.5);
  assert.equal(result.min, 3);
  assert.equal(result.max, 4);
  assert.equal(result.rate * result.min, 600);
  assert.deepEqual(result.monthly, { PLN: 49, USD: 30.58 });
  assert.deepEqual(result.errors, []);
});

test("puste dane i zerowa stawka nie są ze sobą mylone", () => {
  assert.equal(calculate(new Set(), noPlans, "", "").rate, null);
  assert.equal(calculate(new Set(), noPlans, "0", "0").rate, 0);
});

test("odrzuca ujemną stawkę, błędne liczby i zbyt dużą korektę", () => {
  assert.equal(calculate(new Set(["marketing-test"]), noPlans, "-1", "-2").errors.length, 2);
  assert.equal(calculate(new Set(), noPlans, "abc", "abc").errors.length, 2);
  assert.throws(() => calculate(new Set(), { ...noPlans, webflow: "nieznany" }, "", "0"));
});

test("identyfikatory modułów są unikalne", () => {
  const ids = allItems.map(item => item[0]);
  assert.equal(new Set(ids).size, ids.length);
});

test("drobne moduły i CookieZen mają stały czas, a QA skaluje się z tierem", () => {
  const fixed = [
    ["cookie-basic", 1], ["cookie-analytics", 4], ["clarity", 1.25], ["marketing-extra", 0.75], ["marketing-test", 1.5],
    ["google-maps", 0.75], ["seo-global", 0.75], ["seo-meta", 0.75], ["seo-og", 0.5], ["seo-sitemap", 0.5],
    ["seo-schema", 1], ["dns-domain", 0.75], ["ssl", 0.5], ["redirects", 0.75], ["search-console", 0.5],
    ["qa", 1.5], ["export-assets", 0.75], ["export-scripts", 1], ["export-routing", 1.25]
  ];
  for (const [id, hours] of fixed) {
    const result = calculate(new Set([id]), noPlans, "", "0", "webflow", "0", [], "internal", {}, "landing", false, false);
    assert.deepEqual([result.min, result.max], [hours, hours], id);
  }
  const qa = calculate(new Set(["qa"]), noPlans, "", "0", "webflow", "0", [], "internal", {}, "service", false, false);
  assert.deepEqual([qa.min, qa.max], [3.75, 3.75]);
  const result = calculate(new Set(["cookie-basic", "google-maps", "seo-og"]), noPlans, "", "0");
  assert.deepEqual([result.min, result.max], [2.25, 2.25]);
  assert.ok(getWarnings(new Set(["cookie-analytics", "analytics-ga4"]), noPlans).some(text => text.includes("podwójnego liczenia")));
});

test("infrastruktura nie jest osobną sekcją, a Workery pozostają częścią integracji", () => {
  assert.ok(!groups.some(group => group.title === "Fundamenty i infrastruktura"));
  for (const id of ["lumos", "custom-code", "cloudflare-dns", "worker-setup"]) {
    assert.ok(!allItems.some(item => item[0] === id));
  }
  for (const [id, min, max] of [["form-worker", 5, 8], ["newsletter-worker", 5, 7], ["sender-worker", 5, 7]]) {
    const result = calculate(new Set([id]), noPlans, "", "0");
    assert.deepEqual([result.min, result.max], [min, max]);
    assert.ok(getWarnings(new Set([id]), noPlans).some(text => text.includes("Koszt Cloudflare Workers")));
  }
});

test("ostrzega o wspólnej infrastrukturze i możliwych konfliktach", () => {
  const warnings = getWarnings(new Set(["form-worker", "newsletter-worker", "cookie-analytics", "analytics-ga4"]), { ...noPlans, cookiezen: "free" });
  assert.ok(warnings.some(text => text.includes("wspólnego Workera")));
  assert.ok(warnings.some(text => text.includes("podwójnego liczenia")));
  assert.ok(warnings.some(text => text.includes("nie wybrano planu GetResponse")));
  assert.ok(warnings.some(text => text.includes("przekroczenie limitu")));
  assert.ok(warnings.some(text => text.includes("Cloudflare Workers zależy")));
  assert.ok(warnings.some(text => text.includes("testów QA")));
});

test("sygnalizuje ograniczenia planów oraz nieznane koszty", () => {
  const warnings = getWarnings(new Set(["form-native", "form-integration"]), { ...noPlans, webflow: "basic" }, "webflow", 0, [{ category: "cms", name: "Filtr", level: "advanced" }]);
  assert.ok(warnings.some(text => text.includes("funkcje CMS")));
  assert.ok(warnings.some(text => text.includes("Koszt zewnętrznej integracji")));
  assert.ok(getWarnings(new Set(["form-native"]), noPlans).some(text => text.includes("własnej domenie")));
  assert.ok(getWarnings(new Set(["form-web3"]), noPlans).some(text => text.includes("Web3Forms zależy")));
});

test("dolicza każdą dodatkową wersję językową według hostingu", () => {
  const selected = new Set(["google-maps"]);
  const webflow = calculate(selected, noPlans, "200", "-1", "webflow", "2", [], "internal", {}, "landing", false, false);
  assert.deepEqual([webflow.languageMin, webflow.languageMax, webflow.min, webflow.max], [4, 16, 3.75, 15.75]);
  const exported = calculate(selected, noPlans, "200", "-1", "export", "2", [], "internal", {}, "landing", false, false);
  assert.deepEqual([exported.languageMin, exported.languageMax, exported.min, exported.max], [8, 32, 7.75, 31.75]);
  assert.equal(exported.min * exported.rate, 1550);
  assert.deepEqual(calculate(selected, noPlans, "", "0", "export", "0").errors, []);
});

test("sprawdza liczbę języków i wariant hostingu", () => {
  for (const value of ["", "-1", "1.5", "101", "abc", "Infinity"]) {
    assert.ok(calculate(new Set(), noPlans, "", "0", "webflow", value).errors.length, value);
  }
  assert.throws(() => calculate(new Set(), noPlans, "", "0", "invalid", "0"));
});

test("ostrzega o konsekwencjach hostingu i kosztach lokalizacji", () => {
  const selected = new Set(["form-native", "google-maps"]);
  const plans = { ...noPlans, webflow: "cms" };
  const exported = getWarnings(selected, plans, "export", 2, [{ category: "cms", name: "Filtr", level: "advanced" }]);
  assert.ok(exported.some(text => text.includes("nie działają po eksporcie")));
  assert.ok(exported.some(text => text.includes("natywnej obsługi Webflow CMS")));
  assert.ok(exported.some(text => text.includes("plan Webflow nadal")));
  assert.ok(exported.some(text => text.includes("Koszt zewnętrznego hostingu")));
  assert.ok(exported.some(text => text.includes("prace związane z eksportem")));
  assert.ok(exported.some(text => text.includes("prywatności") && text.includes("mapy")));
  const hosted = getWarnings(new Set(["export-routing"]), noPlans, "webflow", 1);
  assert.ok(hosted.some(text => text.includes("Localization nie jest doliczony")));
  assert.ok(hosted.some(text => text.includes("przy hostingu Webflow")));
});

test("Sender ma widełki implementacji i jawnie nieustalony abonament", () => {
  const embedded = calculate(new Set(["sender-embed"]), { ...noPlans, sender: "unknown" }, "", "0");
  assert.deepEqual([embedded.min, embedded.max], [2.5, 3.5]);
  assert.deepEqual(embedded.unknownCosts, ["Sender"]);
  assert.deepEqual(embedded.monthly, { PLN: 0, USD: 0 });
  const api = calculate(new Set(["sender-worker"]), { ...noPlans, sender: "unknown" }, "", "0");
  assert.deepEqual([api.min, api.max], [5, 7]);
  const warnings = getWarnings(new Set(["form-worker", "sender-worker", "newsletter-optin"]), { ...noPlans, sender: "unknown" });
  assert.ok(warnings.some(text => text.includes("wspólnego Workera")));
  assert.ok(warnings.some(text => text.includes("Koszt Sender nie jest doliczony")));
  assert.ok(!warnings.some(text => text.includes("Rozszerzenie newslettera wymaga")));
  assert.ok(getWarnings(new Set(["sender-embed"]), noPlans).some(text => text.includes("nie określono jego kosztu")));
  assert.ok(getWarnings(new Set(["sender-embed"]), { ...noPlans, getresponse: "free" }).some(text => text.includes("plan GetResponse")));
});

test("szablon newslettera dodaje 4–8 h niezależnie od metody zapisu", () => {
  for (const plans of [{ ...noPlans, getresponse: "free" }, { ...noPlans, sender: "unknown" }]) {
    const result = calculate(new Set(["newsletter-template"]), plans, "200", "0");
    assert.deepEqual([result.min, result.max], [4, 8]);
    assert.deepEqual([result.min * result.rate, result.max * result.rate], [800, 1600]);
    assert.ok(!getWarnings(new Set(["newsletter-template"]), plans).some(text => text.includes("nie wybrano planu GetResponse ani Sender")));
  }
  const selected = new Set(["newsletter-template", "newsletter-optin"]);
  const combined = calculate(selected, noPlans, "", "0");
  assert.deepEqual([combined.min, combined.max], [6.5, 13]);
  const warnings = getWarnings(selected, noPlans);
  assert.ok(warnings.some(text => text.includes("nie wybrano planu GetResponse ani Sender")));
  assert.ok(warnings.some(text => text.includes("częściowo pokrywać")));
});

test("sumuje wiele indywidualnych animacji i funkcji CMS oraz korektę", () => {
  const components = [
    { category: "animation", name: "Animacja hero", level: "advanced" },
    { category: "animation", name: "Hover", level: "simple" },
    { category: "cms", name: "Filtr wieloparametrowy", level: "medium" }
  ];
  const result = calculate(new Set(["marketing-test"]), noPlans, "200", "-1", "webflow", "0", components);
  assert.deepEqual([result.componentMin, result.componentMax, result.min, result.max], [15, 31, 15.5, 31.5]);
  assert.equal(result.min * result.rate, 3100);
  assert.deepEqual(result.errors, []);
});

test("niepełne pozycje nie blokują wyliczenia i nie są doliczane", () => {
  for (const category of ["cms", "animation"]) {
    const draft = { category, name: " ", level: "advanced" };
    const complete = { category, name: "Hero", level: "medium" };
    const result = calculate(new Set(["form-native"]), noPlans, "", "0", "webflow", "0", [draft, complete]);
    assert.deepEqual([result.min, result.max], [6, 11]);
    assert.equal(result.incompleteComponents, 1);
    assert.equal(result.completedComponents.length, 1);
    assert.deepEqual(result.errors, []);
  }
});

test("odrzuca nieprawidłowe poziomy i kategorie oraz aktualizuje ostrzeżenia CMS", () => {
  for (const component of [
    { category: "cms", name: "Filtr", level: "unknown" },
    { category: "other", name: "Filtr", level: "simple" }
  ]) {
    assert.ok(calculate(new Set(), noPlans, "", "0", "webflow", "0", [component]).errors.length);
  }
  const cms = [{ category: "cms", name: "Filtr", level: "advanced" }];
  assert.ok(getWarnings(new Set(), { ...noPlans, webflow: "basic" }, "webflow", 0, cms).some(text => text.includes("funkcje CMS")));
  assert.ok(!getWarnings(new Set(), { ...noPlans, webflow: "basic" }, "webflow", 0, []).some(text => text.includes("funkcje CMS")));
  assert.ok(getWarnings(new Set(), noPlans, "export", 0, cms).some(text => text.includes("natywnej obsługi Webflow CMS")));
  assert.ok(getWarnings(new Set(), noPlans, "webflow", 0, cms).some(text => text.includes("testów QA")));
});

test("mapa ma trzy rozłączne warianty i właściwe widełki", () => {
  const group = groups.find(entry => entry.title === "Mapa");
  assert.equal(group.single, true);
  for (const [id, min, max] of [["google-maps", 0.75, 0.75], ["google-maps-custom", 4, 8], ["google-maps-cms", 10, 20]]) {
    const result = calculate(new Set([id]), noPlans, "200", "0");
    assert.deepEqual([result.min, result.max], [min, max]);
    assert.ok(getWarnings(new Set([id]), noPlans).some(text => text.includes("prywatności") && text.includes("mapy")));
  }
  const api = getWarnings(new Set(["google-maps-custom"]), noPlans);
  assert.ok(api.some(text => text.includes("Koszty Google Maps API")));
  assert.ok(!getWarnings(new Set(["google-maps"]), noPlans).some(text => text.includes("Koszty Google Maps API")));
  const cms = getWarnings(new Set(["google-maps-cms"]), { ...noPlans, webflow: "basic" });
  assert.ok(cms.some(text => text.includes("funkcje CMS")));
  assert.ok(cms.some(text => text.includes("dodatkowe filtrowanie")));
  assert.ok(getWarnings(new Set(["google-maps-cms"]), noPlans, "export").some(text => text.includes("natywnej obsługi Webflow CMS")));
});
