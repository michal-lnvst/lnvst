import { allItems, subscriptions, complexityLevels, interactiveTypes, projectTiers } from "./data.mjs";

export function getItemRange(item, tier) {
  const scaled = item[0].startsWith("animation-") || item[0] === "qa" || item[0].startsWith("handoff-");
  const factor = scaled ? (tier ? (item[0].startsWith("handoff-") ? tier.handoffScale : tier.scale) : 0) : 1;
  return { min: Math.round(item[3] * factor * 4) / 4, max: Math.round(item[4] * factor * 4) / 4 };
}

export function getLanguageUnitRange(hosting, tier) {
  if (!["webflow", "export"].includes(hosting)) throw new Error(`Nieznany hosting: ${hosting}`);
  const scale = tier ? tier.scale : 0;
  return { min: (hosting === "webflow" ? 1 : 2) * scale, max: (hosting === "webflow" ? 4 : 8) * scale };
}

export function calculate(selected, plans, rateText, adjustmentText, hosting = "webflow", languagesText = "0", components = [], mode = "internal", quantities = {}, tierId = "", includeDesign = true, includeDevelopment = true) {
  if (!["webflow", "export"].includes(hosting)) throw new Error(`Nieznany hosting: ${hosting}`);
  if (!["internal", "external"].includes(mode)) throw new Error(`Nieznany wykonawca: ${mode}`);
  const tier = projectTiers.find(entry => entry.id === tierId);
  if (tierId && !tier) throw new Error(`Nieznany tier strony: ${tierId}`);
  const items = allItems.filter(([id]) => selected.has(id));
  const languages = languagesText.trim() === "" ? NaN : Number(languagesText);
  const validLanguages = Number.isSafeInteger(languages) && languages >= 0 && languages <= 100;
  const languageUnit = getLanguageUnitRange(hosting, tier);
  const languageMin = validLanguages ? languages * languageUnit.min : 0;
  const languageMax = validLanguages ? languages * languageUnit.max : 0;
  const componentErrors = components.some(component => !["animation", "cms"].includes(component.category) ||
    typeof component.name !== "string" || !Object.hasOwn(complexityLevels, component.level));
  const completedComponents = components.filter(component => typeof component.name === "string" && component.name.trim() && Object.hasOwn(complexityLevels, component.level) && ["animation", "cms"].includes(component.category));
  const incompleteComponents = components.filter(component => typeof component.name === "string" && !component.name.trim()).length;
  const componentMin = completedComponents.reduce((sum, component) => sum + complexityLevels[component.level].min, 0);
  const componentMax = completedComponents.reduce((sum, component) => sum + complexityLevels[component.level].max, 0);
  const designItems = items.filter(([id]) => id === "newsletter-template");
  const handoffItems = items.filter(([id]) => id.startsWith("handoff-"));
  const devItems = items.filter(item => !designItems.includes(item) && !handoffItems.includes(item));
  const sumRange = entries => entries.reduce((sum, item) => { const range = getItemRange(item, tier); sum.min += range.min; sum.max += range.max; return sum; }, { min: 0, max: 0 });
  const design = sumRange(designItems);
  if (tier && includeDesign) { design.min += tier.design[0]; design.max += tier.design[1]; }
  const handoff = mode === "external" ? sumRange(handoffItems) : { min: 0, max: 0 };
  const quantityErrors = interactiveTypes.some(type => {
    const raw = quantities[type.id] === undefined ? "0" : String(quantities[type.id]);
    const value = raw.trim() === "" ? NaN : Number(raw);
    return !Number.isSafeInteger(value) || value < 0 || value > 100;
  });
  const interactive = interactiveTypes.reduce((sum, type) => {
    const raw = quantities[type.id] === undefined ? "0" : String(quantities[type.id]);
    const n = raw.trim() === "" ? NaN : Number(raw);
    if (Number.isSafeInteger(n) && n >= 0 && n <= 100) {
      sum.min += n * type.min;
      sum.max += n * type.max;
    }
    return sum;
  }, { min: 0, max: 0 });
  const development = sumRange(devItems);
  if (tier && includeDevelopment) { development.min += tier.development[0]; development.max += tier.development[1]; }
  development.min += componentMin + languageMin + interactive.min;
  development.max += componentMax + languageMax + interactive.max;
  const rawMin = design.min + handoff.min + (mode === "internal" ? development.min : 0);
  const rawMax = design.max + handoff.max + (mode === "internal" ? development.max : 0);
  const adjustment = adjustmentText.trim() === "" ? 0 : Number(adjustmentText);
  const rate = rateText.trim() === "" ? null : Number(rateText);
  const errors = [];
  if (quantityErrors) errors.push("Podaj liczbę komponentów od 0 do 100 dla każdej kategorii.");
  if (componentErrors) errors.push("Nieprawidłowa kategoria, nazwa lub poziom pozycji animacji i CMS.");
  if (!validLanguages) errors.push("Podaj liczbę dodatkowych wersji językowych od 0 do 100.");
  if (!Number.isFinite(adjustment)) errors.push("Podaj poprawną korektę czasu.");
  if (Number.isFinite(adjustment) && !Number.isInteger(adjustment * 4)) errors.push("Korekta czasu musi być wielokrotnością 0,25 h.");
  if (Number.isFinite(adjustment) && rawMin + adjustment < 0) errors.push("Korekta nie może zmniejszyć dolnej granicy czasu poniżej zera.");
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) errors.push("Stawka musi być liczbą nieujemną.");
  const monthly = { PLN: 0, USD: 0 };
  const unknownCosts = [];
  for (const service of subscriptions) {
    const option = service.options.find(entry => entry.id === plans[service.id]);
    if (!option) throw new Error(`Nieznany plan: ${service.id}`);
    if (option.price === null) unknownCosts.push(service.label);
    else monthly[option.currency] += option.price;
  }
  return { items, components, completedComponents, incompleteComponents, tier, componentMin, componentMax, design, handoff, development, interactive, languages, languageUnit, languageMin, languageMax, rawMin, rawMax, min: rawMin + adjustment, max: rawMax + adjustment, rate, monthly, unknownCosts, errors };
}

export function getWarnings(selected, plans, hosting = "webflow", languages = 0, components = []) {
  const warnings = [];
  const has = id => selected.has(id);
  const hasCms = has("google-maps-cms") || has("cms-small") || has("cms-large") || components.some(component => component.category === "cms");
  if (has("form-worker") && (has("newsletter-worker") || has("sender-worker"))) warnings.push("Formularz i newsletter mogą korzystać ze wspólnego Workera. Sprawdź zakres i skoryguj godziny.");
  if (has("cookie-analytics") && (has("analytics-ga4") || has("analytics-gtm"))) warnings.push("CookieZen + GA4 + GTM zawiera już konfigurację analityki. Unikaj podwójnego liczenia.");
  if (has("ads") && has("marketing-extra")) warnings.push("Dodatkowy skrypt marketingowy może pokrywać się z wybranym tagiem Ads / Meta Pixel.");
  if (has("export-forms") && (has("form-web3") || has("form-worker"))) warnings.push("Prace nad formularzem po eksporcie mogą pokrywać się z wybranym wariantem formularza.");
  if (hosting === "export") {
    warnings.push("Koszt zewnętrznego hostingu, domeny i SSL nie jest doliczony. Sprawdź zakres eksportu, konfigurację serwera i publikację.");
    if (has("form-native") || has("form-integration")) warnings.push("Natywne formularze Webflow i integracje oparte na nich nie działają po eksporcie. Wybierz zewnętrzną obsługę formularza.");
    if (plans.webflow !== "none") warnings.push("Wybrano eksport, ale plan Webflow nadal jest uwzględniany w kosztach. Sprawdź, czy jest potrzebny.");
    if (hasCms) warnings.push("Eksport nie zapewnia natywnej obsługi Webflow CMS. Zweryfikuj alternatywę i wyceń ją osobno.");
    if (!has("export-assets") || !has("export-scripts") || !has("export-routing")) warnings.push("Sprawdź, czy wybrano potrzebne prace związane z eksportem, skryptami i hostingiem zewnętrznym.");
  } else {
    if (plans.webflow === "none" && (selected.size > 0 || languages > 0 || components.length > 0)) warnings.push("Wybrano hosting Webflow, ale nie wybrano planu Webflow.");
    if (["export-assets", "export-forms", "export-scripts", "export-routing"].some(has)) warnings.push("Wybrano prace związane z eksportem przy hostingu Webflow. Sprawdź ich zasadność.");
    if (languages > 0) warnings.push("Koszt Webflow Localization nie jest doliczony. Sprawdź plan, limity języków i dostępność tłumaczenia maszynowego.");
  }
  if (["google-maps", "google-maps-custom", "google-maps-cms"].some(has)) warnings.push("Sprawdź wymagania prywatności i zgody przed załadowaniem mapy Google.");
  if (has("google-maps-custom") || has("google-maps-cms")) warnings.push("Koszty Google Maps API zależą od użycia i konfiguracji rozliczeń; nie zostały doliczone. Sprawdź aktualny cennik i ograniczenia klucza API.");
  if (has("google-maps-cms")) warnings.push("Mapa z CMS obejmuje integrację danych z mapą. Konfigurację CMS oraz dodatkowe filtrowanie lub funkcje wyceń osobno; sprawdź ewentualne nakładanie się prac.");
  if (has("form-native") && (plans.webflow === "none" || plans.webflow === "starter")) warnings.push("Natywny formularz na własnej domenie wymaga odpowiedniego planu Webflow; nie działa po eksporcie.");
  if (hasCms && plans.webflow === "basic" && hosting === "webflow") warnings.push("Wybrane funkcje CMS mogą wymagać odpowiedniego planu Webflow CMS lub wyższego. Sprawdź zakres.");
  if ((has("newsletter-embed") || has("newsletter-worker")) && plans.getresponse === "none") warnings.push("Wybrano newsletter, ale nie wybrano planu GetResponse.");
  if ((has("sender-embed") || has("sender-worker")) && plans.sender === "none") warnings.push("Wybrano Sender, ale nie określono jego kosztu w sekcji newslettera.");
  if ((has("sender-embed") || has("sender-worker")) && plans.getresponse !== "none") warnings.push("Wybrano Sender, ale plan GetResponse jest nadal doliczany. Sprawdź, czy potrzebne są obie usługi.");
  if ((has("newsletter-embed") || has("newsletter-worker")) && plans.sender !== "none") warnings.push("Wybrano GetResponse, ale koszt Sender jest nadal uwzględniony jako nieustalony. Sprawdź, czy potrzebne są obie usługi.");
  if (plans.sender === "unknown") warnings.push("Koszt Sender nie jest doliczony. Sprawdź aktualny plan, walutę i wielkość listy.");
  if (has("newsletter-template") && plans.sender === "none" && plans.getresponse === "none") warnings.push("Wybrano szablon newslettera, ale nie wybrano planu GetResponse ani Sender.");
  if (has("newsletter-template") && has("newsletter-optin")) warnings.push("Szablon newslettera może częściowo pokrywać się z szablonem wiadomości w konfiguracji double opt-in. Sprawdź zakres i skoryguj godziny.");
  if ((has("newsletter-optin") || has("newsletter-automation")) && !["newsletter-embed", "newsletter-worker", "sender-embed", "sender-worker"].some(has)) warnings.push("Rozszerzenie newslettera wymaga osobnego wyboru metody zapisu.");
  if ((has("sender-embed") || has("sender-worker")) && (has("newsletter-optin") || has("newsletter-automation"))) warnings.push("Dostępność double opt-in i automatyzacji w Sender zależy od wybranego planu; sprawdź zakres i estymację.");
  if ((has("cookie-basic") || has("cookie-analytics")) && plans.cookiezen === "none") warnings.push("Wybrano CookieZen, ale nie wybrano jego planu.");
  if (plans.cookiezen === "free") warnings.push("CookieZen Free według briefu wymaga karty; przekroczenie limitu może podnieść plan i koszt.");
  if (has("form-worker") || has("newsletter-worker") || has("sender-worker")) warnings.push("Koszt Cloudflare Workers zależy od użycia i planu; nie został doliczony.");
  if (has("form-web3")) warnings.push("Koszt Web3Forms zależy od planu i limitów; nie został doliczony.");
  if (has("form-integration")) warnings.push("Koszt zewnętrznej integracji formularza nie został doliczony.");
  if ((selected.size > 0 || components.length > 0) && !has("qa")) warnings.push("Nie wybrano końcowych testów QA. Uwzględnij je w zakresie lub osobnej wycenie.");
  return warnings;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
}
