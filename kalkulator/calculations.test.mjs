import { test } from "node:test";
import assert from "node:assert/strict";
import { allItems, groups, subscriptions } from "./data.mjs";
import { calculate, getWarnings } from "./calculations.mjs";

const noPlans = Object.fromEntries(subscriptions.map(service => [service.id, "none"]));

test("sumuje zakresy, korektę, stawkę i osobne waluty", () => {
  const result = calculate(new Set(["lumos", "form-native"]), { ...noPlans, webflow: "basic", getresponse: "starter-yearly", cookiezen: "starter" }, "200", "-0.5");
  assert.equal(result.rawMin, 3);
  assert.equal(result.rawMax, 5);
  assert.equal(result.min, 2.5);
  assert.equal(result.max, 4.5);
  assert.equal(result.rate * result.min, 500);
  assert.deepEqual(result.monthly, { PLN: 49, USD: 30.58 });
  assert.deepEqual(result.errors, []);
});

test("puste dane i zerowa stawka nie są ze sobą mylone", () => {
  assert.equal(calculate(new Set(), noPlans, "", "").rate, null);
  assert.equal(calculate(new Set(), noPlans, "0", "0").rate, 0);
});

test("odrzuca ujemną stawkę, błędne liczby i zbyt dużą korektę", () => {
  assert.equal(calculate(new Set(["lumos"]), noPlans, "-1", "-2").errors.length, 2);
  assert.equal(calculate(new Set(), noPlans, "abc", "abc").errors.length, 2);
  assert.throws(() => calculate(new Set(), { ...noPlans, webflow: "nieznany" }, "", "0"));
});

test("identyfikatory modułów są unikalne", () => {
  const ids = allItems.map(item => item[0]);
  assert.equal(new Set(ids).size, ids.length);
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
  const webflow = calculate(selected, noPlans, "200", "-1", "webflow", "2");
  assert.deepEqual([webflow.languageMin, webflow.languageMax, webflow.min, webflow.max], [4, 16, 3.5, 16]);
  const exported = calculate(selected, noPlans, "200", "-1", "export", "2");
  assert.deepEqual([exported.languageMin, exported.languageMax, exported.min, exported.max], [8, 32, 7.5, 32]);
  assert.equal(exported.min * exported.rate, 1500);
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
  const result = calculate(new Set(["lumos"]), noPlans, "200", "-1", "webflow", "0", components);
  assert.deepEqual([result.componentMin, result.componentMax, result.min, result.max], [15, 31, 15, 32]);
  assert.equal(result.min * result.rate, 3000);
  assert.deepEqual(result.errors, []);
});

test("wymaga nazw i prawidłowych poziomów oraz aktualizuje ostrzeżenia CMS", () => {
  for (const component of [
    { category: "cms", name: " ", level: "simple" },
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
  for (const [id, min, max] of [["google-maps", 0.5, 1], ["google-maps-custom", 4, 8], ["google-maps-cms", 10, 20]]) {
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
