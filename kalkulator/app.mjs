import { groups, subscriptions, complexityLevels } from "./data.mjs";
import { calculate, formatNumber, getWarnings } from "./calculations.mjs";

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
    <details class="module-group" ${groupIndex === 0 ? "open" : ""}>
      <summary><span class="group-title"><span class="group-index">${String(groupIndex + 1).padStart(2, "0")}</span><span>${group.title}<small>${group.description}</small></span></span><span class="group-right"><span class="group-count">0 wybranych</span><span class="chevron">+</span></span></summary>
      <div class="module-items">${(group.sections || [group]).map((section, sectionIndex) => section.items.map(([id, name, description, min, max]) => `
        <label class="module-item">
          <input type="checkbox" value="${id}" ${section.single ? `data-single="${groupIndex}-${sectionIndex}"` : ""}>
          <span class="checkbox"></span><span class="item-copy"><strong>${name}</strong><small>${description}</small></span>
          <span class="item-hours">${formatNumber(min)}${min === max ? "" : `–${formatNumber(max)}`} h</span>
        </label>`).join("")).join("")}${group.custom ? `<div class="components" data-category="${group.custom}"><p class="component-hint">Poziomy są orientacyjne i dotyczą pojedynczej pozycji. Uwzględnij testy, mobile, reduced motion i optymalizację w zakresie pozycji lub dodaj je osobno.</p><div class="component-list"></div><button type="button" class="add-component">+ Dodaj pozycję</button></div>` : ""}${group.services ? `<div class="group-subscriptions"><div class="subscription-heading">KOSZT NARZĘDZI / MIESIĄC</div>${group.services.map(renderService).join("")}</div>` : ""}</div>
    </details>`).join("");
}

function addComponent(container) {
  const row = document.createElement("div");
  row.className = "component-row";
  row.innerHTML = `<label>Nazwa pozycji<input class="component-name" type="text" maxlength="160" placeholder="Np. filtr z wieloma parametrami" required></label>
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
}

function update() {
  const rate = $("#rate").value;
  const adjustment = $("#adjustment").value;
  const hosting = $("#hosting").value;
  const components = getComponents();
  const result = calculate(selected, plans, rate, adjustment, hosting, $("#languages").value, components);
  if ($("#rate").validity.badInput || $("#adjustment").validity.badInput || $("#languages").validity.badInput) result.errors.push("Podaj poprawne wartości liczbowe.");
  const valid = result.errors.length === 0;
  const languageUnit = hosting === "webflow" ? "2–8 h" : "4–16 h";
  $("#language-estimate").textContent = `${hosting === "webflow" ? "Webflow Localization (tłumaczenie maszynowe)" : "Ręczne wdrożenie po eksporcie"}: ${languageUnit} za każdą dodatkową wersję.`;
  $("#hosting-summary").textContent = hosting === "webflow" ? "Hosting Webflow" : "Eksport poza Webflow";
  $("#languages-summary").textContent = Number.isSafeInteger(result.languages) && result.languages >= 0 && result.languages <= 100
    ? `Dodatkowe języki: ${result.languages} · ${formatNumber(result.languageMin)}–${formatNumber(result.languageMax)} h`
    : "Dodatkowe języki: sprawdź liczbę";
  $("#hours-total").innerHTML = valid ? `${formatNumber(result.min)}–${formatNumber(result.max)} <small>h</small>` : "— <small>h</small>";
  const count = result.items.length + components.length;
  $("#selected-count").textContent = `${count} ${count === 1 ? "pozycja" : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? "pozycje" : "pozycji"}`;
  $("#labor-total").textContent = !valid ? "Sprawdź dane" : result.rate === null ? "Podaj stawkę" : `${formatNumber(result.min * result.rate)}–${formatNumber(result.max * result.rate)} PLN`;
  $("#monthly-total").textContent = `${formatNumber(result.monthly.PLN)} PLN + ${formatNumber(result.monthly.USD)} USD${result.unknownCosts.length ? " + koszty nieustalone" : ""}`;
  $("#cost-note").textContent = "Miesięcznie, netto; przy planach rocznych to koszt w przeliczeniu na miesiąc.";
  $("#input-error").hidden = valid;
  $("#input-error").textContent = result.errors.join(" ");
  const warnings = getWarnings(selected, plans, hosting, result.languages, components);
  $("#warnings").innerHTML = warnings.length ? `<strong>WARTO SPRAWDZIĆ</strong><ul>${warnings.map(warning => `<li>${warning}</li>`).join("")}</ul>` : "";
  document.querySelectorAll(".module-item input").forEach(input => {
    input.checked = selected.has(input.value);
    input.closest(".module-item").classList.toggle("is-selected", input.checked);
  });
  document.querySelectorAll(".module-group").forEach(group => {
    const count = group.querySelectorAll("input:checked, .component-row").length;
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
  if (event.target.matches(".component-name")) update();
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
  $("#languages").value = "0";
  update();
});
