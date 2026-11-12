// Estimates and subscription prices are working assumptions.
export const complexityLevels = {
  simple: { label: "Prosty", min: 1, max: 3 },
  medium: { label: "Średni", min: 4, max: 8 },
  advanced: { label: "Zaawansowany", min: 10, max: 20 }
};

export const interactiveTypes = [
  { id: "slider", label: "Slider", detail: "Jeden typ slidera, bez złożonych animacji", min: 2, max: 5 },
  { id: "tabs", label: "Taby / akordeon", detail: "Jeden typ komponentu", min: 1, max: 3 },
  { id: "filter", label: "Lista z filtrowaniem", detail: "Jedna lista; złożone zależności wyceń osobno", min: 4, max: 10 },
  { id: "custom", label: "Unikalny komponent", detail: "Jedno niestandardowe rozwiązanie", min: 10, max: 20 }
];

export const projectTiers = [
  { id: "landing", label: "Landing", detail: "Jeden widok, do 6 sekcji", design: [14, 24.5], development: [7.25, 14.5], scale: 1, handoffScale: 0.25 },
  { id: "landing-long", label: "Rozbudowany landing", detail: "Jeden widok, 7–12 sekcji", design: [21, 35], development: [13.25, 24], scale: 1.25, handoffScale: 0.375 },
  { id: "company-small", label: "Mała strona firmowa", detail: "2–3 unikalne widoki", design: [24.5, 42], development: [16.75, 30], scale: 1.5, handoffScale: 0.75 },
  { id: "company", label: "Rozbudowana strona firmowa", detail: "4–7 unikalnych widoków", design: [31.5, 56], development: [21, 39], scale: 2, handoffScale: 1 },
  { id: "service", label: "Serwis", detail: "8–12 unikalnych widoków i szablonów", design: [63, 105], development: [36, 66], scale: 2.5, handoffScale: 1.25 }
];

export const groups = [
  { title: "Handoff i design QA", description: "Nasza praca przy wdrożeniu przez zewnętrzny zespół; godziny zależą od tieru strony.", external: true, items: [
    ["handoff-components", "Komponentowanie i przygotowanie pliku", "Porządkowanie i stany do przekazania", 6, 14],
    ["handoff-interactions", "Projekt i opis interakcji", "Specyfikacja zachowań i stanów", 4, 12],
    ["handoff-prototype", "Prototypowanie", "Istotne przepływy i zachowania", 3, 10],
    ["handoff-meeting", "Przekazanie i konsultacje", "Omówienie projektu i pytania zespołu", 3, 8],
    ["handoff-qa", "Design QA", "Przegląd wdrożenia i weryfikacja poprawek", 6, 14]
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
    ["cookie-basic", "CookieZen — standard", "Baner, skan i podstawowa konfiguracja", 1, 1],
    ["cookie-analytics", "CookieZen + GA4 + GTM", "W tym Consent Mode v2 i testy zgód", 4, 4]
  ]},
  { title: "Analityka i marketing", description: "Konfiguracja i testy narzędzi pomiarowych.", sections: [
    { single: true, items: [
      ["analytics-ga4", "GA4 bezpośrednio", "Podstawowe zdarzenia", 1.75, 2.25],
      ["analytics-gtm", "GA4 + GTM", "Event tracking przez Google Tag Manager", 2.75, 4.25]
    ]},
    { items: [
      ["clarity", "Microsoft Clarity", "Instalacja i konfiguracja zgód", 1.25, 1.25],
      ["ads", "Google Ads / Meta Pixel", "Konfiguracja jednego tagu", 2, 3],
      ["marketing-extra", "Dodatkowy skrypt marketingowy", "Jedna integracja z CookieZen", 0.75, 0.75],
      ["marketing-test", "Testy zestawu skryptów", "Testy różnych stanów zgody", 1.5, 1.5]
    ]}
  ]},
  { title: "Mapa", description: "Wybierz jeden wariant mapy.", single: true, items: [
    ["google-maps", "Google Maps — prosta mapa", "Osadzona mapa bez własnej integracji API", 0.75, 0.75],
    ["google-maps-custom", "Google Maps API — mapa personalizowana", "Własna stylizacja i kilka ręcznie dodanych znaczników, bez CMS", 4, 8],
    ["google-maps-cms", "Google Maps API — mapa z CMS", "Zaawansowana integracja: wpisy CMS jako znaczniki na mapie", 10, 20]
  ]},
  { title: "Animacje", description: "Wybierz poziom dla całej strony. Godziny zależą od tieru; bardziej złożone elementy dodaj osobno.", custom: "animation", single: true, items: [
    ["animation-none", "Bez animacji", "Bez osobnego nakładu na animacje", 0, 0],
    ["animation-basic", "Podstawowe", "Typowe hover i drobne przejścia", 2, 5],
    ["animation-scroll", "Scroll + appear", "Podstawowe animacje oraz powtarzalne wejścia i scroll", 6, 14],
    ["animation-advanced", "Zaawansowane", "Podstawowe i scroll + bardziej złożone sekwencje; unikalne komponenty osobno", 15, 30]
  ]},
  { title: "CMS i Finsweet", description: "Wybierz zakres bazowej konfiguracji CMS; dodatkowe funkcje wyceń osobno.", custom: "cms", single: true, items: [
    ["cms-none", "Strona bez CMS", "Bez konfiguracji kolekcji", 0, 0],
    ["cms-small", "CMS — do 5 kolekcji", "Kolekcje, pola i podłączenie danych; bez projektowania widoków, filtrów i migracji", 6, 14],
    ["cms-large", "CMS — powyżej 5 kolekcji", "Orientacyjnie 6–10 kolekcji; więcej wymaga dodatkowej wyceny", 14, 30]
  ]},
  { title: "Komponenty interaktywne", description: "Podaj liczbę różnych typów komponentów, nie liczbę powtórzeń.", interactive: true, items: [] },
  { title: "SEO i publikacja", description: "Końcowa konfiguracja, wdrożenie i kontrola jakości.", items: [
    ["seo-global", "Global SEO setup", "Ustawienia globalne", 0.75, 0.75],
    ["seo-meta", "Meta titles / descriptions", "Podstawowe metadane", 0.75, 0.75],
    ["seo-og", "Open Graph", "Podgląd w mediach społecznościowych", 0.5, 0.5],
    ["seo-sitemap", "Sitemap / robots", "Mapa strony i indeksowanie", 0.5, 0.5],
    ["seo-schema", "Schema.org", "Dane strukturalne", 1, 1],
    ["dns-domain", "DNS / domena", "Podłączenie domeny", 0.75, 0.75],
    ["ssl", "SSL / hosting", "Konfiguracja publikacji", 0.5, 0.5],
    ["redirects", "Redirects", "Przekierowania", 0.75, 0.75],
    ["search-console", "Search Console", "Podstawowa konfiguracja i weryfikacja, bez diagnozy problemów indeksowania", 0.5, 0.5],
    ["qa", "Final QA", "Końcowe testy strony; czas zależy od tieru", 1.5, 1.5],
    ["export-assets", "Eksport i assety", "Przy hostingu zewnętrznym", 0.75, 0.75],
    ["export-forms", "Formularze przy eksporcie", "Dodatkowe prace przy hostingu zewnętrznym", 1, 3],
    ["export-scripts", "Weryfikacja skryptów po eksporcie", "Testy integracji", 1, 1],
    ["export-routing", "Serwer i routing", "Konfiguracja hostingu zewnętrznego", 1.25, 1.25]
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
