// Estimates and subscription prices are working assumptions.
export const complexityLevels = {
  simple: { label: "Prosty", min: 1, max: 3 },
  medium: { label: "Średni", min: 4, max: 8 },
  advanced: { label: "Zaawansowany", min: 10, max: 20 }
};

export const groups = [
  { title: "Fundamenty i infrastruktura", description: "Podstawowe elementy środowiska i konfiguracji.", items: [
    ["lumos", "Lumos", "Konfiguracja frameworka", 1, 2],
    ["custom-code", "Custom CSS / JS", "Podstawowe rozwiązania własne", 1, 3],
    ["cloudflare-dns", "Cloudflare DNS", "Konfiguracja DNS", 0.5, 1],
    ["worker-setup", "Cloudflare Worker", "Podstawowa konfiguracja infrastruktury", 1, 3]
  ]},
  { title: "Formularz kontaktowy", description: "Wybierz jeden sposób obsługi formularza.", single: true, items: [
    ["form-native", "Webflow Native Forms", "Podstawowy frontend, konfiguracja i testy", 2, 3],
    ["form-integration", "Webflow + integracja", "Podstawowy frontend i przekazanie danych do systemu", 3, 5],
    ["form-web3", "Web3Forms", "Podstawowy frontend i zewnętrzna obsługa formularza", 2, 3.5],
    ["form-worker", "Cloudflare Worker + API", "Podstawowy frontend, własny przepływ i walidacja", 5, 8]
  ]},
  { title: "Newsletter", description: "Wybierz usługę, metodę zapisu i opcjonalne rozszerzenia.", services: ["getresponse", "sender"], sections: [
    { single: true, items: [
      ["newsletter-embed", "GetResponse Embedded Form", "Osadzony formularz", 2.5, 3.5],
      ["newsletter-worker", "GetResponse API + Worker", "Własny formularz i integracja API", 5, 7],
      ["sender-embed", "Sender — formularz osadzony", "Wstępne założenie, jak dla GetResponse", 2.5, 3.5],
      ["sender-worker", "Sender API + Worker", "Wstępne założenie, jak dla GetResponse", 5, 7]
    ]},
    { items: [
      ["newsletter-template", "Szablon newslettera", "Projekt jednego szablonu w kreatorze drag & drop GetResponse lub Sender", 4, 8],
      ["newsletter-optin", "Double opt-in + welcome", "Potwierdzenie, wiadomość powitalna i testy", 2.5, 5],
      ["newsletter-automation", "Zaawansowane automatyzacje", "Dodatkowe workflow i segmentacja", 2, 5]
    ]}
  ]},
  { title: "Cookie consent", description: "Wybierz jedną konfigurację CookieZen.", services: ["cookiezen"], single: true, items: [
    ["cookie-basic", "CookieZen — standard", "Baner, skan i podstawowa konfiguracja", 2, 2.5],
    ["cookie-analytics", "CookieZen + GA4 + GTM", "W tym Consent Mode v2 i testy zgód", 5, 7.5]
  ]},
  { title: "Analityka i marketing", description: "Konfiguracja i testy narzędzi pomiarowych.", sections: [
    { single: true, items: [
      ["analytics-ga4", "GA4 bezpośrednio", "Podstawowe zdarzenia", 1.75, 2.25],
      ["analytics-gtm", "GA4 + GTM", "Event tracking przez Google Tag Manager", 2.75, 4.25]
    ]},
    { items: [
      ["clarity", "Microsoft Clarity", "Instalacja i konfiguracja zgód", 1, 1.5],
      ["ads", "Google Ads / Meta Pixel", "Konfiguracja jednego tagu", 2, 3],
      ["marketing-extra", "Dodatkowy skrypt marketingowy", "Jedna integracja z CookieZen", 0.5, 1],
      ["marketing-test", "Testy zestawu skryptów", "Testy różnych stanów zgody", 1, 2]
    ]}
  ]},
  { title: "Mapa", description: "Wybierz jeden wariant mapy.", single: true, items: [
    ["google-maps", "Google Maps — prosta mapa", "Osadzona mapa bez własnej integracji API", 0.5, 1],
    ["google-maps-custom", "Google Maps API — mapa personalizowana", "Własna stylizacja i kilka ręcznie dodanych znaczników, bez CMS", 4, 8],
    ["google-maps-cms", "Google Maps API — mapa z CMS", "Zaawansowana integracja: wpisy CMS jako znaczniki na mapie", 10, 20]
  ]},
  { title: "Animacje i interakcje", description: "Dodaj osobno każdą animację, komponent lub zadanie testowe.", custom: "animation", items: [] },
  { title: "CMS i Finsweet", description: "Dodaj osobno konfigurację, kolekcje, filtry i inne funkcje.", custom: "cms", items: [] },
  { title: "SEO i publikacja", description: "Końcowa konfiguracja, wdrożenie i kontrola jakości.", items: [
    ["seo-global", "Global SEO setup", "Ustawienia globalne", 0.5, 1],
    ["seo-meta", "Meta titles / descriptions", "Podstawowe metadane", 0.5, 1],
    ["seo-og", "Open Graph", "Podgląd w mediach społecznościowych", 0.25, 0.5],
    ["seo-sitemap", "Sitemap / robots", "Mapa strony i indeksowanie", 0.25, 0.5],
    ["seo-schema", "Schema.org", "Dane strukturalne", 0.5, 1.5],
    ["dns-domain", "DNS / domena", "Podłączenie domeny", 0.5, 1],
    ["ssl", "SSL / hosting", "Konfiguracja publikacji", 0.25, 0.5],
    ["redirects", "Redirects", "Przekierowania", 0.5, 1],
    ["search-console", "Search Console", "Konfiguracja i weryfikacja", 0.25, 0.5],
    ["qa", "Final QA", "Końcowe testy strony", 1, 2],
    ["export-assets", "Eksport i assety", "Przy hostingu zewnętrznym", 0.5, 1],
    ["export-forms", "Formularze przy eksporcie", "Dodatkowe prace przy hostingu zewnętrznym", 1, 3],
    ["export-scripts", "Weryfikacja skryptów po eksporcie", "Testy integracji", 0.5, 1.5],
    ["export-routing", "Serwer i routing", "Konfiguracja hostingu zewnętrznego", 0.5, 2]
  ]}
];

export const subscriptions = [
  { id: "webflow", label: "Webflow", detail: "Hosting i plan strony", options: [
    { id: "none", label: "Brak / hosting zewnętrzny", currency: "USD", price: 0 },
    { id: "starter", label: "Starter — staging", currency: "USD", price: 0 },
    { id: "basic", label: "Basic — 15 USD / mies. (rocznie)", currency: "USD", price: 15 },
    { id: "cms", label: "CMS / Premium — 25 USD / mies. (rocznie)", currency: "USD", price: 25 }
  ]},
  { id: "getresponse", label: "GetResponse", detail: "Newsletter i automatyzacje", options: [
    { id: "none", label: "Nie korzystam", currency: "USD", price: 0 },
    { id: "free", label: "Free — 0 USD / mies.", currency: "USD", price: 0 },
    { id: "starter", label: "Starter — 19 USD / mies.", currency: "USD", price: 19 },
    { id: "starter-yearly", label: "Starter — 15,58 USD / mies. (rocznie)", currency: "USD", price: 15.58 },
    { id: "marketer", label: "Marketer — 59 USD / mies.", currency: "USD", price: 59 },
    { id: "marketer-yearly", label: "Marketer — 48,38 USD / mies. (rocznie)", currency: "USD", price: 48.38 }
  ]},
  { id: "sender", label: "Sender", detail: "Koszt zależny od planu i wielkości listy", options: [
    { id: "none", label: "Nie korzystam", currency: "USD", price: 0 },
    { id: "unknown", label: "Korzystam — koszt do ustalenia", currency: "USD", price: null }
  ]},
  { id: "cookiezen", label: "CookieZen", detail: "Zarządzanie zgodami", options: [
    { id: "none", label: "Nie korzystam", currency: "PLN", price: 0 },
    { id: "free", label: "Free — 0 PLN / mies.", currency: "PLN", price: 0 },
    { id: "starter", label: "Starter — 49 PLN / mies.", currency: "PLN", price: 49 },
    { id: "pro", label: "Pro — 129 PLN / mies.", currency: "PLN", price: 129 },
    { id: "business", label: "Business — 249 PLN / mies.", currency: "PLN", price: 249 }
  ]}
];

export const allItems = groups.flatMap(group => (group.sections || [group]).flatMap(section => section.items));
