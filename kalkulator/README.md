# Kalkulator wdrożenia Webflow

Wewnętrzny, statyczny kalkulator wstępnej estymacji UX/UI, developmentu i integracji, oparty częściowo na briefie „Webflow Development Framework 1.1”. Nie stanowi kompletnej oferty; nie obejmuje VAT ani czasu oczekiwania na klienta.

## Uruchomienie

Uruchom lokalny serwer HTTP z katalogu repozytorium, korzystając z Express zainstalowanego dla istniejącej aplikacji:

```powershell
node -e "require('express')().use(require('express').static('kalkulator')).listen(4173,'127.0.0.1')"
```

Otwórz `http://127.0.0.1:4173/`. Przeglądarka może blokować moduły JavaScript przy bezpośrednim otwarciu pliku `index.html`. Serwer jest potrzebny tylko do podania plików, a nie do obliczeń.

Workflow `.github/workflows/calculator-pages.yml` publikuje wyłącznie zawartość katalogu `kalkulator` na GitHub Pages po zmianach w tym katalogu na gałęzi `main`. W ustawieniach repozytorium **Settings → Pages → Build and deployment → Source** wybierz **GitHub Actions**. Workflow można też uruchomić ręcznie z zakładki Actions. Publikacja z prywatnego repozytorium wymaga planu GitHub obsługującego GitHub Pages dla prywatnych repozytoriów.

Aplikacja nie wymaga backendu ani zmiennych środowiskowych. **GitHub Pages może być publiczny nawet dla prywatnego repozytorium**: nie umieszczaj w aplikacji poufnych stawek ani danych klientów. Stawka wpisana w przeglądarce nie jest wysyłana przez aplikację ani zapisywana; odświeżenie resetuje wybór.

## Zasady kalkulacji

- Nowe widełki projektu, wdrożenia, CMS, animacji, komponentów i handoffu są **roboczymi propozycjami wymagającymi kalibracji**, a nie pomiarami czy automatycznym odwzorowaniem dawnych wycen. Przykładowe realizacje w interfejsie pokazują całkowity development z integracjami, nie bazowy frontend.
- Widełki UX/UI wszystkich pięciu tierów obniżono o 30%, a bazowego wdrożenia o 40% względem poprzednich założeń, z zaokrągleniem do kwadransa. Mnożniki animacji, języków i QA pozostają bez zmian.
- Drobne moduły o wcześniejszej górnej granicy do 2 h mają stały orientacyjny czas zamiast widełek; końcowe QA ma stałą podstawę 1,5 h i nadal skaluje się z tierem. CookieZen standard to 1 h, a wariant z GA4 i GTM 4 h. Poważniejsze problemy, w tym diagnozę indeksowania w Search Console, należy wycenić osobno.
- Wybierz jeden z pięciu tierów strony: landing do 6 sekcji, landing do 12 sekcji, mała strona firmowa 2–3 widoki, rozbudowana strona firmowa 4–7 widoków lub serwis 8–12 widoków i szablonów. Jeden wybór określa zakres UX/UI i bazowego wdrożenia; każdy z tych zakresów można oddzielnie wyłączyć. Baza obejmuje frontend, responsywność i standardową konfigurację Lumos; nie obejmuje osobno doliczanych CMS, animacji, interakcji, integracji, języków ani publikacji. Cloudflare Workers uwzględnia się tylko w konkretnych integracjach. CMS obejmuje konfigurację danych i ich podłączenie, a nie powtórne budowanie frontendowych widoków.
- Tier skaluje godziny animacji, każdej dodatkowej wersji językowej i końcowego QA odpowiednio mnożnikami 1, 1,25, 1,5, 2 i 2,5. Handoff i design QA skalują się mnożnikami 0,25, 0,375, 0,75, 1 i 1,25 względem poprzednich widełek przypisanych do tieru 4. Każdy skalowany zakres jest zaokrąglany do najbliższego kwadransa przed zsumowaniem; połowa kwadransa jest zaokrąglana w górę. Korekta musi być wielokrotnością 0,25 h. Pozostałe moduły, liczba komponentów oraz indywidualne pozycje nie są mnożone. To robocze założenie, które nie zastępuje indywidualnej oceny złożoności; przy większych stronach i nietypowym zakresie konieczna może być korekta. Bez wybranego tieru wynik pomija projekt, bazę oraz powyższe skalowane elementy i pokazuje ostrzeżenie.
- CMS ma wariant bez CMS, do 5 kolekcji i powyżej 5 (orientacyjnie 6–10). Większy lub bardziej skomplikowany zakres, migracja i niestandardowe funkcje wymagają dodatkowej wyceny. Animacje są jednym wyborem dla całej strony: brak, hover, scroll + appear lub zaawansowane; kolejne poziomy zawierają poprzednie. Brak wyboru nie oznacza braku CMS ani animacji.
- Liczba sliderów, tabów, list z filtrami i unikalnych komponentów oznacza różne typy rozwiązań, a nie powtórzenia tej samej implementacji. Każdy typ jest doliczany do developmentu. Dopuszczalna jest liczba całkowita od 0 do 100; złożone filtry i komponenty mogą wymagać dodatkowej wyceny.
- Animacje i CMS można dodatkowo wyceniać jako osobne nazwane pozycje, np. „filtr wieloparametrowy” lub „animacja hero”. Są doliczane ponad wybrany tier i komponenty: nie dodawaj dwukrotnie tej samej pracy. Dla każdej wybierz orientacyjną złożoność: prosta 1–3 h, średnia 4–8 h, zaawansowana 10–20 h. Uwzględnij testy, urządzenia mobilne, reduced motion i optymalizację w pozycjach lub dodaj je osobno. Poziomy to punkt wyjścia, nie gwarantowany zakres; dla wyższej złożoności użyj korekty godzin. Pozycja bez nazwy nie blokuje obliczeń, ale nie jest doliczana i wyświetlane jest ostrzeżenie. Przycisk wyczyszczenia usuwa również wszystkie dodane pozycje i zeruje liczby komponentów.
- Przy wdrożeniu zewnętrznym wybory techniczne, języki i koszty narzędzi pozostają widoczne jako zakres, lecz godziny developmentu nie są doliczane do naszej pracy. Można osobno zaznaczyć nasze komponentowanie, opis interakcji, prototypowanie, przekazanie i design QA. Szablon newslettera w kreatorze jest traktowany jako nasza praca projektowa także w tym trybie. Wdrożenie i jego cena u zewnętrznego wykonawcy nie są wyceniane. Przełączanie wykonawcy zachowuje wybory; handoff jest doliczany wyłącznie w trybie zewnętrznym.
- Plany Webflow, GetResponse, Sender i CookieZen wybiera się przy odpowiednich kategoriach. Sender ma wariant formularza osadzonego (2,5–3,5 h) i API z Workerem (5–7 h): to wstępne założenia równe GetResponse, a nie zweryfikowane estymacje wdrożenia Sender. Plan i koszt Sender należy ustalić osobno; wybór „koszt do ustalenia” jest widoczny w podsumowaniu i nie jest doliczany do sumy.
- Szablon newslettera to projekt jednego szablonu bezpośrednio w kreatorze drag & drop GetResponse lub Sender (4–8 h). Jest opcjonalny i niezależny od sposobu zapisu. Część prac może pokrywać się z wiadomościami w module double opt-in; skoryguj godziny, jeśli zakres się pokrywa.
- Hosting określa metodę i czas lokalizacji. Zmiana hostingu zachowuje moduły i plany; ostrzeżenia wskazują potencjalne konflikty.
- Liczba dodatkowych wersji językowych nie obejmuje języka podstawowego. Dla najmniejszego tieru każda wersja dodaje 1–4 h dla Webflow Localization z tłumaczeniem maszynowym lub 2–8 h dla ręcznego wdrożenia po eksporcie. Większe tiery mnożą ten czas według skali powyżej. Koszt usługi Localization nie jest doliczany.
- Wynik to suma dolnych i górnych granic naszej pracy w wybranym trybie, skorygowana o tę samą liczbę godzin na obu końcach zakresu. Podsumowanie pokazuje kategorie przed korektą i osobno jej wartość. Możliwe nakładanie się prac jest sygnalizowane; aplikacja nie odejmuje godzin automatycznie.
- Formularze obejmują podstawowy frontend, podłączenie i testy, bez projektowania UX/UI i rozbudowanych interakcji. Przy eksporcie natywne formularze Webflow nie działają, a CMS wymaga osobnego rozwiązania. Wybierz potrzebne prace eksportowe; koszt zewnętrznego hostingu, domeny i SSL nie jest doliczany.
- Google Maps ma trzy wzajemnie wykluczające się warianty: prosty embed (0,75 h), mapa API z własną stylizacją i kilkoma ręcznie dodanymi znacznikami, bez CMS (4–8 h), oraz zaawansowana mapa API z wpisami CMS jako znacznikami (10–20 h). Czasy są orientacyjne. Konfigurację CMS i dodatkowe funkcje, np. filtrowanie, wyceń osobno, sprawdzając nakładanie się prac. Koszty Maps API zależą od użycia i nie są doliczane; sprawdź cennik, ograniczenia klucza oraz wymagania dotyczące prywatności i zgód.
- Stawka godzinowa jest opcjonalna; koszt jednorazowy to zakres godzin razy stawka. Kwoty traktowane są jako netto.
- Abonamenty sumowane są osobno w PLN i USD, bez przeliczania walut. Plany roczne pokazują miesięczny ekwiwalent, nie miesięczny harmonogram płatności. Cenniki GetResponse dotyczą bazowego progu kontaktów z briefu.
- Nieznane koszty, w tym zależne od użycia plany Workers, Web3Forms i integracji, nie są doliczane. CookieZen Free może automatycznie przejść na płatny plan po przekroczeniu limitu. Sprawdź również pozostałe limity i wymagania planów.
- Ceny i czasy są założeniami z briefu, a nie aktualizowanym na bieżąco cennikiem. Zweryfikuj je przed użyciem: [Webflow](https://webflow.com/pricing), [GetResponse](https://www.getresponse.com/pricing), [CookieZen](https://cookiezen.pl/).
- Drukowanie korzysta z funkcji przeglądarki; można wybrać drukarkę PDF. Przed drukiem sprawdź ostrzeżenia i kompletność zakresu.

Dane modułów i planów znajdują się w `data.mjs`, a logika wyliczeń w `calculations.mjs`. Zmiany w cenniku należy wprowadzać świadomie w obu odpowiednich miejscach interfejsu i danych.

## Testy

Z katalogu repozytorium: `node --test kalkulator/calculations.test.mjs`.
