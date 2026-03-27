# Webflow GDPR Cookie Consent Integration

This guide assumes your backend runs this project and is reachable at:

- `https://your-service.koyeb.app`

Use this flow to satisfy GDPR expectations for cookie consent:

- no non-essential cookies before consent
- granular category controls
- explicit accept/reject/save action
- consent proof (timestamp, policy version, preferences)
- easy withdrawal (same effort as accept)

## 1. Webflow Modal Structure

Create a modal with these element attributes/classes:

- modal wrapper: `id="cookie-modal"`
- tab buttons:
  - `data-consent-tab="overview"`
  - `data-consent-tab="settings"`
- tab panels:
  - `data-consent-panel="overview"`
  - `data-consent-panel="settings"`
- category toggles in settings panel:
  - analytics toggle checkbox: `id="consent-analytics"`
  - marketing toggle checkbox: `id="consent-marketing"`
  - personalization toggle checkbox: `id="consent-personalization"`
- actions outside tabs:
  - accept all button: `id="consent-accept-all"`
  - reject all button: `id="consent-reject-all"`
  - save settings button: `id="consent-save-settings"`
  - withdraw button (e.g. footer link): `id="consent-withdraw"`

Keep "Necessary" category always enabled and not editable.

## 2. Add This Script In Webflow Footer Code

Replace `API_BASE_URL` with your backend URL.

```html
<script>
(function () {
  const API_BASE_URL = "https://your-service.koyeb.app";
  const CONSENT_STORAGE_KEY = "lnvst_cookie_consent_id";
  const CONSENT_CACHE_KEY = "lnvst_cookie_preferences";
  const POLICY_VERSION = "2026-03";
  const BANNER_VERSION = "v1";

  const modal = document.getElementById("cookie-modal");
  const acceptAllBtn = document.getElementById("consent-accept-all");
  const rejectAllBtn = document.getElementById("consent-reject-all");
  const saveBtn = document.getElementById("consent-save-settings");
  const withdrawBtn = document.getElementById("consent-withdraw");

  const analyticsInput = document.getElementById("consent-analytics");
  const marketingInput = document.getElementById("consent-marketing");
  const personalizationInput = document.getElementById("consent-personalization");
  const tabButtons = document.querySelectorAll("[data-consent-tab]");
  const tabPanels = document.querySelectorAll("[data-consent-panel]");

  function getConsentId() {
    let id = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CONSENT_STORAGE_KEY, id);
    }
    return id;
  }

  function getCachedPreferences() {
    const raw = localStorage.getItem(CONSENT_CACHE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function cachePreferences(preferences) {
    localStorage.setItem(CONSENT_CACHE_KEY, JSON.stringify(preferences));
  }

  function openModal() {
    if (!modal) return;
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    if (!modal) return;
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function applyScriptsByConsent(preferences) {
    if (preferences.analytics) {
      enableAnalyticsScripts();
    } else {
      disableAnalyticsScripts();
    }

    if (preferences.marketing) {
      enableMarketingScripts();
    } else {
      disableMarketingScripts();
    }

    if (preferences.personalization) {
      enablePersonalizationScripts();
    } else {
      disablePersonalizationScripts();
    }
  }

  async function saveConsent(action, preferences) {
    const payload = {
      consentId: getConsentId(),
      action,
      preferences,
      consentSource: "webflow_modal",
      policyVersion: POLICY_VERSION,
      bannerVersion: BANNER_VERSION,
      locale: navigator.language || "en",
      region: "EEA"
    };

    const response = await fetch(`${API_BASE_URL}/api/consent/preferences`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Consent save failed");
    }

    const result = await response.json();
    cachePreferences(result.preferences);
    applyScriptsByConsent(result.preferences);
    closeModal();
  }

  async function withdrawConsent() {
    const payload = {
      consentId: getConsentId(),
      consentSource: "webflow_modal",
      policyVersion: POLICY_VERSION,
      bannerVersion: BANNER_VERSION,
      locale: navigator.language || "en",
      region: "EEA"
    };

    const response = await fetch(`${API_BASE_URL}/api/consent/withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error("Consent withdraw failed");
    }

    const result = await response.json();
    cachePreferences(result.preferences);
    applyScriptsByConsent(result.preferences);
    openModal();
  }

  function readFormPreferences() {
    return {
      necessary: true,
      analytics: Boolean(analyticsInput && analyticsInput.checked),
      marketing: Boolean(marketingInput && marketingInput.checked),
      personalization: Boolean(personalizationInput && personalizationInput.checked)
    };
  }

  function hydrateToggles(preferences) {
    if (analyticsInput) analyticsInput.checked = Boolean(preferences.analytics);
    if (marketingInput) marketingInput.checked = Boolean(preferences.marketing);
    if (personalizationInput) personalizationInput.checked = Boolean(preferences.personalization);
  }

  function enableAnalyticsScripts() {
    // Load GA/Matomo/etc only after analytics consent
  }

  function disableAnalyticsScripts() {
    // Disable or anonymize analytics where possible
  }

  function enableMarketingScripts() {
    // Load ad pixels only after marketing consent
  }

  function disableMarketingScripts() {
    // Remove/disable marketing scripts where possible
  }

  function enablePersonalizationScripts() {
    // Load recommendation/A-B testing scripts after consent
  }

  function disablePersonalizationScripts() {
    // Disable personalization scripts
  }

  function setActiveTab(target) {
    tabPanels.forEach((panel) => {
      panel.style.display = panel.getAttribute("data-consent-panel") === target ? "block" : "none";
    });

    if (saveBtn) {
      saveBtn.style.display = target === "settings" ? "inline-flex" : "none";
    }
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.getAttribute("data-consent-tab");
      setActiveTab(target);
    });
  });

  if (acceptAllBtn) {
    acceptAllBtn.addEventListener("click", () => {
      closeModal();
      saveConsent("accept_all", {
        necessary: true,
        analytics: true,
        marketing: true,
        personalization: true
      }).catch((error) => {
        console.error(error);
        openModal();
      });
    });
  }

  if (rejectAllBtn) {
    rejectAllBtn.addEventListener("click", () => {
      closeModal();
      saveConsent("reject_all", {
        necessary: true,
        analytics: false,
        marketing: false,
        personalization: false
      }).catch((error) => {
        console.error(error);
        openModal();
      });
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      closeModal();
      saveConsent("save_preferences", readFormPreferences()).catch((error) => {
        console.error(error);
        openModal();
      });
    });
  }

  if (withdrawBtn) {
    withdrawBtn.addEventListener("click", () => {
      openModal();
      withdrawConsent().catch(console.error);
    });
  }

  const cached = getCachedPreferences();
  setActiveTab("overview");
  if (cached) {
    hydrateToggles(cached);
    applyScriptsByConsent(cached);
  } else {
    openModal();
  }
})();
</script>
```

## 3. Script Blocking Rules

Do not include analytics or marketing scripts directly in page head if they set cookies immediately. Load them only through `enableAnalyticsScripts` and `enableMarketingScripts`.

## 4. Endpoints Used

- `POST /api/consent/preferences`
- `POST /api/consent/withdraw`
- `GET /api/consent/preferences/:consentId`

## 5. Minimal Compliance Checklist

- consent banner shown before non-essential tracking
- reject all available at first layer
- categories explained clearly
- consent change and withdrawal available any time
- consent records include policy/banner version and timestamp
- records retained only as long as needed
