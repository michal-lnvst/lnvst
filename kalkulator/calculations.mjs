import { allItems, subscriptions, complexityLevels } from "./data.mjs";

export function calculate(selected, plans, rateText, adjustmentText, hosting = "webflow", languagesText = "0", components = []) {
  if (!["webflow", "export"].includes(hosting)) throw new Error(`Nieznany hosting: ${hosting}`);
  const items = allItems.filter(([id]) => selected.has(id));
  const languages = languagesText.trim() === "" ? NaN : Number(languagesText);
  const validLanguages = Number.isSafeInteger(languages) && languages >= 0 && languages <= 100;
  const languageMin = validLanguages ? languages * (hosting === "webflow" ? 2 : 4) : 0;
  const languageMax = validLanguages ? languages * (hosting === "webflow" ? 8 : 16) : 0;
  const componentErrors = components.some(component => !["animation", "cms"].includes(component.category) ||
    typeof component.name !== "string" || !component.name.trim() || !Object.hasOwn(complexityLevels, component.level));
  const componentMin = components.reduce((sum, component) => sum + (Object.hasOwn(complexityLevels, component.level) ? complexityLevels[component.level].min : 0), 0);
  const componentMax = components.reduce((sum, component) => sum + (Object.hasOwn(complexityLevels, component.level) ? complexityLevels[component.level].max : 0), 0);
  const rawMin = items.reduce((sum, item) => sum + item[3], 0) + languageMin + componentMin;
  const rawMax = items.reduce((sum, item) => sum + item[4], 0) + languageMax + componentMax;
  const adjustment = adjustmentText.trim() === "" ? 0 : Number(adjustmentText);
  const rate = rateText.trim() === "" ? null : Number(rateText);
  const errors = [];
  if (componentErrors) errors.push("Podaj nazwę i poprawny poziom złożoności każdej pozycji animacji i CMS.");
  if (!validLanguages) errors.push("Podaj liczbę dodatkowych wersji językowych od 0 do 100.");
  if (!Number.isFinite(adjustment)) errors.push("Podaj poprawną korektę czasu.");
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
  return { items, components, componentMin, componentMax, languages, languageMin, languageMax, rawMin, rawMax, min: rawMin + adjustment, max: rawMax + adjustment, rate, monthly, unknownCosts, errors };
}

export function getWarnings(selected, plans, hosting = "webflow", languages = 0, components = []) {
  const warnings = [];
  const has = id => selected.has(id);
  const hasCms = has("google-maps-cms") || components.some(component => component.category === "cms");
  if (has("form-worker") && (has("newsletter-worker") || has("sender-worker"))) warnings.push("Formularz i newsletter mogą korzystać ze wspólnego Workera. Sprawdź zakres i skoryguj godziny.");
  if (has("worker-setup") && (has("form-worker") || has("newsletter-worker") || has("sender-worker"))) warnings.push("Konfiguracja Workera może być już zawarta w wybranej integracji.");
  if (has("cookie-analytics") && (has("analytics-ga4") || has("analytics-gtm"))) warnings.push("CookieZen + GA4 + GTM zawiera już konfigurację analityki. Unikaj podwójnego liczenia.");
  if (has("ads") && has("marketing-extra")) warnings.push("Dodatkowy skrypt marketingowy może pokrywać się z wybranym tagiem Ads / Meta Pixel.");
  if (has("cloudflare-dns") && has("dns-domain")) warnings.push("Konfiguracja Cloudflare DNS może pokrywać się z podłączeniem domeny.");
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
  if (has("form-worker") || has("newsletter-worker") || has("sender-worker") || has("worker-setup")) warnings.push("Koszt Cloudflare Workers zależy od użycia i planu; nie został doliczony.");
  if (has("form-web3")) warnings.push("Koszt Web3Forms zależy od planu i limitów; nie został doliczony.");
  if (has("form-integration")) warnings.push("Koszt zewnętrznej integracji formularza nie został doliczony.");
  if ((selected.size > 0 || components.length > 0) && !has("qa")) warnings.push("Nie wybrano końcowych testów QA. Uwzględnij je w zakresie lub osobnej wycenie.");
  return warnings;
}

export function formatNumber(value) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 2 }).format(value);
}
