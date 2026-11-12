import { groups, subscriptions, complexityLevels, interactiveTypes, projectTiers, allItems } from "./data.mjs";
import { calculate, formatNumber, getWarnings, getItemRange } from "./calculations.mjs";

const $ = selector => document.querySelector(selector);
const selected = new Set();
const plans = Object.fromEntries(subscriptions.map(service => [service.id, "none"]));

function renderService(id) {
  const service = subscriptions.find(entry => entry.id === id);
  return `<label class="subscription"><span><strong>${service.label}</strong><small>${service.detail}</small></span>
    <select data-service="${service.id}" aria-label="Plan ${service.label}">${service.options.map(option => `<option value="${option.id}">${option.label}</option>`).join("")}</select>
  </label>`;
}

function renderModules() {
  $("#modules").innerHTML = groups.map((group, groupIndex) => `
    <details class="module-group" ${group.external ? 'data-external hidden' : ""} ${groupIndex === 0 ? "open" : ""}>
      <summary><span class="group-title"><span class="group-index">${String(groupIndex + 1).padStart(2, "0")}</span><span>${group.title}<small>${group.description}</small></span></span><span class="group-right"><span class="group-count">0 wybranych</span><span class="chevron">+</span></span></summary>
      <div class="module-items">${(group.sections || [group]).map((section, sectionIndex) => section.items.map(([id, name, description, min, max]) => `
        <label class="module-item">
          <input type="checkbox" value="${id}" ${section.single ? `data-single="${groupIndex}-${sectionIndex}"` : ""}>
          <span class="checkbox"></span><span class="item-copy"><strong>${name}</strong><small>${description}</small></span>
          <span class="item-hours" data-item-hours="${id}">${formatNumber(min)}${min === max ? "" : `–${formatNumber(max)}`} h</span>
        </label>`).join("")).join("")}${group.custom ? `<div class="components" data-category="${group.custom}"><p class="component-hint">Dodatkowe pozycje liczą się ponad wybrany tier. Unikaj dublowania pracy; testy, mobile i reduced motion uwzględnij w zakresie lub dodaj osobno.</p><div class="component-list"></div><button type="button" class="add-component">+ Dodaj pozycję</button></div>` : ""}${group.interactive ? `<div class="interactive-list">${interactiveTypes.map(type => `<label class="interactive-item"><span><strong>${type.label}</strong><small>${type.detail} · ${type.min}–${type.max} h / typ</small></span><input type="number" min="0" max="100" step="1" value="0" inputmode="numeric" data-quantity="${type.id}" aria-label="Liczba: ${type.label}"></label>`).join("")}</div>` : ""}${group.services ? `<div class="group-subscriptions"><div class="subscription-heading">KOSZT NARZĘDZI / MIESIĄC</div>${group.services.map(renderService).join("")}</div>` : ""}</div>
    </details>`).join("");
}

function addComponent(container) {
  const row = document.createElement("div");
  row.className = "component-row";
  row.innerHTML = `<label>Nazwa pozycji<input class="component-name" type="text" maxlength="160" placeholder="Np. filtr z wieloma parametrami"></label>
    <label>Złożoność<select class="component-level">${Object.entries(complexityLevels).map(([id, level]) => `<option value="${id}">${level.label} · ${level.min}–${level.max} h</option>`).join("")}</select></label>
    <button class="remove-component" type="button" aria-label="Usuń pozycję">Usuń</button>`;
  container.querySelector(".component-list").append(row);
  row.querySelector(".component-name").focus();
}

function getComponents() {
  return [...document.querySelectorAll(".components")].flatMap(container =>
    [...container.querySelectorAll(".component-row")].map(row => ({
      category: container.dataset.category,
      name: row.querySelector(".component-name").value,
      level: row.querySelector(".component-level").value
    })));
}

function renderSubscriptions() {
  $("#hosting-subscription").innerHTML = renderService("webflow");
  $("#project-tier").innerHTML = `<option value="">Wybierz tier strony</option>${projectTiers.map(tier => `<option value="${tier.id}">${tier.label} — ${tier.detail}</option>`).join("")}`;
}

function update() {
  const rate = $("#rate").value;
  const adjustment = $("#adjustment").value;
  const hosting = $("#hosting").value;
  const mode = $("#implementation").value;
  const components = getComponents();
  const quantities = Object.fromEntries([...document.querySelectorAll("[data-quantity]")].map(input => [input.dataset.quantity, input.value]));
  const result = calculate(selected, plans, rate, adjustment, hosting, $("#languages").value, components, mode, quantities, $("#project-tier").value, $("#include-design").checked, $("#include-development").checked);
  if ($("#rate").validity.badInput || $("#adjustment").validity.badInput || $("#languages").validity.badInput || [...document.querySelectorAll("[data-quantity]")].some(input => input.validity.badInput)) result.errors.push("Podaj poprawne wartości liczbowe.");
  const valid = result.errors.length === 0;
  const languageUnit = result.tier ? `${formatNumber((hosting === "webflow" ? 2 : 4) * result.tier.scale)}–${formatNumber((hosting === "webflow" ? 8 : 16) * result.tier.scale)} h` : "wybierz tier strony";
  $("#language-estimate").textContent = `${hosting === "webflow" ? "Webflow Localization (tłumaczenie maszynowe)" : "Ręczne wdrożenie po eksporcie"}: ${languageUnit} za każdą dodatkową wersję.`;
  $("#tier-details").textContent = result.tier ? `${result.tier.detail}. Projekt: ${formatNumber(result.tier.design[0])}–${formatNumber(result.tier.design[1])} h; bazowe wdrożenie: ${formatNumber(result.tier.development[0])}–${formatNumber(result.tier.development[1])} h. Mnożnik animacji, języków i QA: ×${formatNumber(result.tier.scale)}; handoffu: ×${new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 3 }).format(result.tier.handoffScale)} względem tieru 4.` : "Wybierz tier, aby uwzględnić zakres strony i wycenić skalowane elementy.";
  $("#tier-summary").textContent = result.tier ? `Tier: ${result.tier.label}` : "Tier strony: nie wybrano";
  $("#include-development").disabled = mode === "external";
  document.querySelectorAll("[data-item-hours]").forEach(element => {
    const item = allItems.find(entry => entry[0] === element.dataset.itemHours);
    if (!item[0].startsWith("animation-") && item[0] !== "qa" && !item[0].startsWith("handoff-")) return;
    if (!result.tier) { element.textContent = "Wybierz tier"; return; }
    const range = getItemRange(item, result.tier);
    element.textContent = `${formatNumber(range.min)}${range.min === range.max ? "" : `–${formatNumber(range.max)}`} h`;
  });
  $("#hosting-summary").textContent = hosting === "webflow" ? "Hosting Webflow" : "Eksport poza Webflow";
  $("#mode-summary").textContent = mode === "internal" ? "Wdrożenie LNVST" : "Wdrożenie zewnętrzne";
  $("#languages-summary").textContent = Number.isSafeInteger(result.languages) && result.languages >= 0 && result.languages <= 100
    ? `Dodatkowe języki: ${result.languages} · ${!result.tier ? "wybierz tier" : mode === "external" ? "wdrożenie poza sumą" : `${formatNumber(result.languageMin)}–${formatNumber(result.languageMax)} h`}`
    : "Dodatkowe języki: sprawdź liczbę";
  $("#hours-total").innerHTML = valid ? `${formatNumber(result.min)}–${formatNumber(result.max)} <small>h</small>` : "— <small>h</small>";
  const range = value => `${formatNumber(value.min)}–${formatNumber(value.max)} h`;
  $("#design-total").textContent = valid ? range(result.design) : "Sprawdź dane";
  $("#handoff-row").hidden = mode !== "external";
  $("#handoff-total").textContent = valid ? range(result.handoff) : "Sprawdź dane";
  $("#development-label").textContent = mode === "internal" ? "Wdrożenie i moduły" : "Wdrożenie zewnętrzne";
  $("#development-total").textContent = mode === "internal" ? (valid ? range(result.development) : "Sprawdź dane") : "Nie doliczono";
  $("#adjustment-total").textContent = valid ? `${formatNumber(result.min - result.rawMin)} h` : "Sprawdź dane";
  $("#external-note").hidden = mode !== "external";
  document.querySelectorAll("[data-external]").forEach(group => { group.hidden = mode !== "external"; });
  const count = result.items.filter(([id]) => mode === "external" || !id.startsWith("handoff-")).length + result.completedComponents.length + Object.values(quantities).reduce((sum, value) => sum + (Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 100 ? Number(value) : 0), 0);
  $("#selected-count").textContent = `${count} ${count === 1 ? "pozycja" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "pozycje" : "pozycji"}`;
  $("#labor-total").textContent = !valid ? "Sprawdź dane" : result.rate === null ? "Podaj stawkę" : `${formatNumber(result.min * result.rate)}–${formatNumber(result.max * result.rate)} PLN`;
  $("#monthly-total").textContent = `${formatNumber(result.monthly.PLN)} PLN + ${formatNumber(result.monthly.USD)} USD${result.unknownCosts.length ? " + koszty nieustalone" : ""}`;
  $("#cost-note").textContent = "Miesięcznie, netto; przy planach rocznych to koszt w przeliczeniu na miesiąc.";
  $("#input-error").hidden = valid;
  $("#input-error").textContent = result.errors.join(" ");
  const warnings = getWarnings(selected, plans, hosting, result.languages, result.completedComponents);
  if (!result.tier) warnings.unshift("Nie wybrano tieru strony: projekt, baza, animacje, języki, końcowe QA i handoff nie są uwzględnione.");
  if (result.incompleteComponents) warnings.unshift(`Nieuzupełnione pozycje animacji lub CMS: ${result.incompleteComponents}. Nie są doliczone — wpisz nazwę lub usuń pozycję.`);
  if (![...selected].some(id => id.startsWith("cms-"))) warnings.unshift("Nie określono zakresu CMS. Wybierz również „Strona bez CMS”, jeśli nie jest potrzebny.");
  if (![...selected].some(id => id.startsWith("animation-"))) warnings.unshift("Nie określono poziomu animacji. Wybierz również „Bez animacji”, jeśli nie są potrzebne.");
  if (selected.has("cms-none") && (selected.has("google-maps-cms") || result.completedComponents.some(component => component.category === "cms"))) warnings.push("Wybrano stronę bez CMS i jednocześnie funkcje CMS. Zweryfikuj zakres.");
  if (result.completedComponents.some(component => component.category === "cms") && (selected.has("cms-small") || selected.has("cms-large"))) warnings.push("Dodatkowe pozycje CMS są doliczane do tieru. Sprawdź, czy nie obejmują tej samej konfiguracji.");
  if (result.completedComponents.some(component => component.category === "animation") && [...selected].some(id => id.startsWith("animation-") && id !== "animation-none")) warnings.push("Dodatkowe animacje są doliczane do tieru. Sprawdź, czy nie liczą tych samych efektów.");
  if (Number(quantities.filter) > 0 && (selected.has("google-maps-cms") || result.completedComponents.some(component => component.category === "cms"))) warnings.push("Filtry są doliczane osobno; sprawdź, czy nie występują już w wycenie mapy lub dodatkowych funkcji CMS.");
  if (Number(quantities.custom) > 0 && (result.completedComponents.some(component => component.category === "animation") || selected.has("animation-advanced"))) warnings.push("Unikalne komponenty i animacje są liczone osobno; nie dodawaj ponownie tego samego efektu.");
  $("#warnings").innerHTML = warnings.length ? `<strong>WARTO SPRAWDZIĆ</strong><ul>${warnings.map(warning => `<li>${warning}</li>`).join("")}</ul>` : "";
  document.querySelectorAll(".module-item input").forEach(input => {
    input.checked = selected.has(input.value);
    input.closest(".module-item").classList.toggle("is-selected", input.checked);
  });
  document.querySelectorAll(".module-group").forEach(group => {
    const count = group.querySelectorAll("input:checked, .component-row").length + [...group.querySelectorAll("[data-quantity]")].reduce((sum, input) => sum + (Number.isSafeInteger(Number(input.value)) && Number(input.value) > 0 ? Number(input.value) : 0), 0);
    group.querySelector(".group-count").textContent = `${count} pozycji`;
    const hasPlan = [...group.querySelectorAll("[data-service]")].some(select => plans[select.dataset.service] !== "none");
    group.classList.toggle("has-selection", count > 0 || hasPlan);
  });
  document.querySelectorAll("[data-service]").forEach(select => { select.value = plans[select.dataset.service]; });
}

renderModules();
renderSubscriptions();
update();

$("#modules").addEventListener("change", event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "checkbox") return;
  if (input.checked && input.dataset.single) {
    document.querySelectorAll(`input[data-single="${input.dataset.single}"]`).forEach(other => selected.delete(other.value));
  }
  if (input.checked) selected.add(input.value);
  else selected.delete(input.value);
  update();
});
$("#modules").addEventListener("click", event => {
  const add = event.target.closest(".add-component");
  const remove = event.target.closest(".remove-component");
  if (add) addComponent(add.closest(".components"));
  else if (remove) remove.closest(".component-row").remove();
  else return;
  update();
});
$("#modules").addEventListener("input", event => {
  if (event.target.matches(".component-name, [data-quantity]")) update();
});
$("#modules").addEventListener("change", event => {
  if (event.target.matches(".component-level")) update();
});
document.addEventListener("change", event => {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement) || !select.dataset.service) return;
  plans[select.dataset.service] = select.value;
  update();
});
$("#rate").addEventListener("input", update);
$("#adjustment").addEventListener("input", update);
$("#hosting").addEventListener("change", update);
$("#implementation").addEventListener("change", update);
$("#project-tier").addEventListener("change", update);
$("#include-design").addEventListener("change", update);
$("#include-development").addEventListener("change", update);
$("#languages").addEventListener("input", update);
$("#print").addEventListener("click", () => window.print());
let openBeforePrint = [];
window.addEventListener("beforeprint", () => {
  openBeforePrint = [...document.querySelectorAll(".module-group")].filter(group => group.open);
  document.querySelectorAll(".module-group").forEach(group => { group.open = true; });
});
window.addEventListener("afterprint", () => {
  document.querySelectorAll(".module-group").forEach(group => { group.open = openBeforePrint.includes(group); });
});
$("#reset").addEventListener("click", () => {
  selected.clear();
  document.querySelectorAll(".component-row").forEach(row => row.remove());
  subscriptions.forEach(service => { plans[service.id] = "none"; });
  $("#rate").value = "";
  $("#adjustment").value = "0";
  $("#hosting").value = "webflow";
  $("#implementation").value = "internal";
  $("#project-tier").value = "";
  $("#include-design").checked = true;
  $("#include-development").checked = true;
  document.querySelectorAll("[data-quantity]").forEach(input => { input.value = "0"; });
  $("#languages").value = "0";
  update();
});
