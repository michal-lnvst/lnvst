# Kalkulator wdrożenia Webflow

Wewnętrzny, statyczny kalkulator zakresu technicznego na podstawie przekazanego briefu „Webflow Development Framework 1.1”. Nie obejmuje pełnej wyceny projektu, projektowania, developmentu strony, VAT ani czasu oczekiwania na klienta.

## Uruchomienie

Uruchom lokalny serwer HTTP z katalogu repozytorium, korzystając z Express zainstalowanego dla istniejącej aplikacji:

```powershell
node -e "require('express')().use(require('express').static('kalkulator')).listen(4173,'127.0.0.1')"
```

Otwórz `http://127.0.0.1:4173/`. Przeglądarka może blokować moduły JavaScript przy bezpośrednim otwarciu pliku `index.html`. Serwer jest potrzebny tylko do podania plików, a nie do obliczeń.

Workflow `.github/workflows/calculator-pages.yml` publikuje wyłącznie zawartość katalogu `kalkulator` na GitHub Pages po zmianach w tym katalogu na gałęzi `main`. W ustawieniach repozytorium **Settings → Pages → Build and deployment → Source** wybierz **GitHub Actions**. Workflow można też uruchomić ręcznie z zakładki Actions. Publikacja z prywatnego repozytorium wymaga planu GitHub obsługującego GitHub Pages dla prywatnych repozytoriów.

Aplikacja nie wymaga backendu ani zmiennych środowiskowych. **GitHub Pages może być publiczny nawet dla prywatnego repozytorium**: nie umieszczaj w aplikacji poufnych stawek ani danych klientów. Stawka wpisana w przeglądarce nie jest wysyłana przez aplikację ani zapisywana; odświeżenie resetuje wybór.

## Zasady kalkulacji

- Animacje i CMS wycenia się jako osobne nazwane pozycje, np. „filtr wieloparametrowy” lub „animacja hero”. Dla każdej wybierz orientacyjną złożoność: prosta 1–3 h, średnia 4–8 h, zaawansowana 10–20 h. Uwzględnij testy, urządzenia mobilne, reduced motion i optymalizację w pozycjach lub dodaj je osobno. Poziomy to punkt wyjścia, nie gwarantowany zakres; dla wyższej złożoności użyj korekty godzin. Pusta nazwa blokuje wyliczenie. Przycisk wyczyszczenia usuwa również wszystkie dodane pozycje.
- Plany Webflow, GetResponse, Sender i CookieZen wybiera się przy odpowiednich kategoriach. Sender ma wariant formularza osadzonego (2,5–3,5 h) i API z Workerem (5–7 h): to wstępne założenia równe GetResponse, a nie zweryfikowane estymacje wdrożenia Sender. Plan i koszt Sender należy ustalić osobno; wybór „koszt do ustalenia” jest widoczny w podsumowaniu i nie jest doliczany do sumy.
- Szablon newslettera to projekt jednego szablonu bezpośrednio w kreatorze drag & drop GetResponse lub Sender (4–8 h). Jest opcjonalny i niezależny od sposobu zapisu. Część prac może pokrywać się z wiadomościami w module double opt-in; skoryguj godziny, jeśli zakres się pokrywa.
- Hosting określa metodę i czas lokalizacji. Zmiana hostingu zachowuje moduły i plany; ostrzeżenia wskazują potencjalne konflikty.
- Liczba dodatkowych wersji językowych nie obejmuje języka podstawowego. Każda wersja dodaje 2–8 h dla Webflow Localization z tłumaczeniem maszynowym lub 4–16 h dla ręcznego wdrożenia po eksporcie. To założenia robocze, które należy dostosować do zakresu strony; koszt usługi Localization nie jest doliczany.
- Wynik to suma dolnych i górnych granic zaznaczonych modułów oraz wersji językowych, skorygowana o tę samą liczbę godzin na obu końcach zakresu. Możliwe nakładanie się prac jest sygnalizowane; aplikacja nie odejmuje godzin automatycznie.
- Formularze obejmują podstawowy frontend, podłączenie i testy, bez projektowania UX/UI i rozbudowanych interakcji. Przy eksporcie natywne formularze Webflow nie działają, a CMS wymaga osobnego rozwiązania. Wybierz potrzebne prace eksportowe; koszt zewnętrznego hostingu, domeny i SSL nie jest doliczany.
- Google Maps ma trzy wzajemnie wykluczające się warianty: prosty embed (0,5–1 h), mapa API z własną stylizacją i kilkoma ręcznie dodanymi znacznikami, bez CMS (4–8 h), oraz zaawansowana mapa API z wpisami CMS jako znacznikami (10–20 h). Widełki są orientacyjne. Konfigurację CMS i dodatkowe funkcje, np. filtrowanie, wyceń osobno, sprawdzając nakładanie się prac. Koszty Maps API zależą od użycia i nie są doliczane; sprawdź cennik, ograniczenia klucza oraz wymagania dotyczące prywatności i zgód.
- Stawka godzinowa jest opcjonalna; koszt jednorazowy to zakres godzin razy stawka. Kwoty traktowane są jako netto.
- Abonamenty sumowane są osobno w PLN i USD, bez przeliczania walut. Plany roczne pokazują miesięczny ekwiwalent, nie miesięczny harmonogram płatności. Cenniki GetResponse dotyczą bazowego progu kontaktów z briefu.
- Nieznane koszty, w tym zależne od użycia plany Workers, Web3Forms i integracji, nie są doliczane. CookieZen Free może automatycznie przejść na płatny plan po przekroczeniu limitu. Sprawdź również pozostałe limity i wymagania planów.
- Ceny i czasy są założeniami z briefu, a nie aktualizowanym na bieżąco cennikiem. Zweryfikuj je przed użyciem: [Webflow](https://webflow.com/pricing), [GetResponse](https://www.getresponse.com/pricing), [CookieZen](https://cookiezen.pl/).
- Drukowanie korzysta z funkcji przeglądarki; można wybrać drukarkę PDF. Przed drukiem sprawdź ostrzeżenia i kompletność zakresu.

Dane modułów i planów znajdują się w `data.mjs`, a logika wyliczeń w `calculations.mjs`. Zmiany w cenniku należy wprowadzać świadomie w obu odpowiednich miejscach interfejsu i danych.

## Testy

Z katalogu repozytorium: `node --test kalkulator/calculations.test.mjs`.
