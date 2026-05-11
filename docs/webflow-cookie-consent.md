# Webflow GDPR Cookie Consent Integration

This guide assumes your backend runs this project and is reachable at:

- `https://your-service.koyeb.app`

Use this flow to satisfy GDPR expectations for cookie consent:

- no non-essential cookies before consent
- granular category controls
- explicit accept/reject/save action
- consent proof (timestamp, policy version, preferences)
- easy withdrawal (same effort as accept)

If you use multiple domains (for example Webflow staging + `lnv.st` production), keep in mind consent is stored per domain in browser storage.

## 1. Webflow Modal Structure

Create a modal with these element attributes/classes:

- modal wrapper: `class="cookies_banner_component"`
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

## 2. Prevent Modal Flash On Reload

To avoid the cookie modal flashing briefly for returning users, keep it hidden by default in Webflow and decide visibility as early as possible in the page head.

Add this in Webflow `Inside <head>` custom code.

This hides the modal at the CSS level before anything renders, so there is no flash on reload:

```html
<style>
  .cookies_banner_component {
    opacity: 0;
    transform: translateY(40px);
    pointer-events: none;
  }
</style>
```

GSAP handles all visibility from this point. No JavaScript needed in the head.

## 3. Add This Script In Webflow Footer Code

Replace `API_BASE_URL` with your backend URL.

Important for GA: remove any static Google Analytics snippet from Webflow head/footer. GA should be loaded only through `enableAnalyticsScripts` below.

```html
<script>
(function () {
  const API_BASE_URL = "https://your-service.koyeb.app";
  const GA_MEASUREMENT_ID = "G-X0DE6CZ79D";
  const CONSENT_STORAGE_KEY = "lnvst_cookie_consent_id";
  const CONSENT_CACHE_KEY = "lnvst_cookie_preferences";
  const CONSENT_ACTION_KEY = "lnvst_cookie_consent_action";
  const POLICY_VERSION = "2026-03";
  const BANNER_VERSION = "v1";

  const modal = document.querySelector(".cookies_banner_component");
  const acceptAllBtn = document.getElementById("consent-accept-all");
  const rejectAllBtn = document.getElementById("consent-reject-all");
  const saveBtn = document.getElementById("consent-save-settings");
  const withdrawBtn = document.getElementById("consent-withdraw");

  const analyticsInput = document.getElementById("consent-analytics");
  const marketingInput = document.getElementById("consent-marketing");
  const personalizationInput = document.getElementById("consent-personalization");
  const tabButtons = document.querySelectorAll("[data-consent-tab]");
  const tabPanels = document.querySelectorAll("[data-consent-panel]");
  let isGaLoaded = false;

  function getStoredConsentId() {
    return localStorage.getItem(CONSENT_STORAGE_KEY);
  }

  function getConsentId() {
    let id = getStoredConsentId();
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

  function getCachedAction() {
    return localStorage.getItem(CONSENT_ACTION_KEY);
  }

  function cacheAction(action) {
    localStorage.setItem(CONSENT_ACTION_KEY, action);
  }

  async function fetchSavedConsent(consentId) {
    if (!consentId) return null;

    const response = await fetch(`${API_BASE_URL}/api/consent/preferences/${consentId}`);
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Consent fetch failed");
    }

    return response.json();
  }

  function openModal() {
    if (!modal) return;
    modal.style.pointerEvents = "auto";
    modal.setAttribute("aria-hidden", "false");
    gsap.to(modal, {
      y: 0,
      opacity: 1,
      duration: 0.6,
      ease: "power2.out"
    });
  }

  function closeModal() {
    if (!modal) return;
    gsap.to(modal, {
      y: 40,
      opacity: 0,
      duration: 0.4,
      ease: "power2.in",
      onComplete: () => {
        modal.style.pointerEvents = "none";
        modal.setAttribute("aria-hidden", "true");
      }
    });
  }

  function openModalAfterPreloader() {
    const checkPreloaderInterval = setInterval(() => {
      const preloader = document.querySelector(".preloader_component");

      if (
        !preloader ||
        window.getComputedStyle(preloader).opacity === "0" ||
        window.getComputedStyle(preloader).height === "0px"
      ) {
        clearInterval(checkPreloaderInterval);
        openModal();
      }
    }, 50);
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
    cacheAction(result.action || action);
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
    cacheAction(result.action || "withdraw");
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

  function sendAnalyticsPageView() {
    if (!window.gtag || !GA_MEASUREMENT_ID) return;

    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: `${window.location.pathname}${window.location.search}`,
      page_title: document.title
    });
  }

  function enableAnalyticsScripts() {
    if (!GA_MEASUREMENT_ID) return;

    window[`ga-disable-${GA_MEASUREMENT_ID}`] = false;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag() {
      window.dataLayer.push(arguments);
    };

    const configureGa = () => {
      window.gtag("js", new Date());
      window.gtag("config", GA_MEASUREMENT_ID, {
        anonymize_ip: true,
        send_page_view: false
      });
      sendAnalyticsPageView();
    };

    if (!isGaLoaded) {
      const existingGaScript = document.querySelector(
        `script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`
      );

      if (existingGaScript) {
        isGaLoaded = true;
        configureGa();
        return;
      }

      const gaScript = document.createElement("script");
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      gaScript.onload = configureGa;
      document.head.appendChild(gaScript);

      isGaLoaded = true;
      return;
    }

    // If GA is already loaded, still send a page_view when analytics is re-enabled.
    sendAnalyticsPageView();
  }

  function disableAnalyticsScripts() {
    if (!GA_MEASUREMENT_ID) return;
    window[`ga-disable-${GA_MEASUREMENT_ID}`] = true;
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

  async function initializeConsent() {
    const cached = getCachedPreferences();
    const cachedAction = getCachedAction();
    setActiveTab("overview");

    if (cached) {
      hydrateToggles(cached);
      applyScriptsByConsent(cached);

      if (cachedAction === "withdraw") {
        openModalAfterPreloader();
        return;
      }

      // Modal stays hidden via CSS — no action needed for returning consented users
      return;
    }

    const existingConsentId = getStoredConsentId();
    if (!existingConsentId) {
      openModalAfterPreloader();
      return;
    }

    try {
      const savedConsent = await fetchSavedConsent(existingConsentId);
      if (savedConsent && savedConsent.preferences) {
        cachePreferences(savedConsent.preferences);
        cacheAction(savedConsent.action || "save_preferences");
        hydrateToggles(savedConsent.preferences);
        applyScriptsByConsent(savedConsent.preferences);

        if (savedConsent.action === "withdraw") {
          openModalAfterPreloader();
          return;
        }

        // Modal stays hidden via CSS — no action needed
        return;
      }
    } catch (error) {
      console.error(error);
    }

    openModalAfterPreloader();
  }

  initializeConsent().catch(console.error);
})();
</script>
```

## 4. Script Blocking Rules

Do not include analytics or marketing scripts directly in page head if they set cookies immediately. Load them only through `enableAnalyticsScripts` and `enableMarketingScripts`.

For GA specifically, do not paste the default gtag snippet in Webflow head. The consent script above loads GA only after analytics consent is granted.

## 5. Endpoints Used

- `POST /api/consent/preferences`
- `POST /api/consent/withdraw`
- `GET /api/consent/preferences/:consentId`

## 6. Minimal Compliance Checklist

- consent banner shown before non-essential tracking
- reject all available at first layer
- categories explained clearly
- consent change and withdrawal available any time
- consent records include policy/banner version and timestamp
- records retained only as long as needed

## 7. Staging + Production Domains

If you use both Webflow staging and production domain (`lnv.st`), no script logic change is required.

You should:

- keep the same `API_BASE_URL` on both domains
- set Koyeb `CORS_ALLOWED_ORIGINS` to include all frontend origins, for example:
  - `https://your-site.webflow.io`
  - `https://lnv.st`
  - `https://www.lnv.st`

Note: browser localStorage is origin-scoped, so staging and production users will have separate consent IDs and separate local consent state.

## 8. How To Check Current Consents In Koyeb

For a specific user/session:

1. Get consent ID in browser console:
  - `localStorage.getItem("lnvst_cookie_consent_id")`
2. Query backend:
  - `GET /api/consent/preferences/:consentId`

PowerShell example:

```powershell
$consentId = "PASTE_ID"
$baseUrl = "https://your-service.koyeb.app"
Invoke-RestMethod -Uri "$baseUrl/api/consent/preferences/$consentId" -Method Get
```

For all consents on `lnv.st`, current API does not expose a listing endpoint. Use Koyeb logs for event confirmation, or add a protected admin endpoint for filtered history.
