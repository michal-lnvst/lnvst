# Slider 3D z kartami tekstowymi

Otwórz `index.html` w przeglądarce. Przykład działa samodzielnie, bez jQuery, serwera i pliku JSON.

Podgląd jest publikowany przez GitHub Pages pod ścieżką `/slider-3d/`; kalkulator pozostaje w katalogu głównym strony.

Zawartość pięciu kart można zmieniać bezpośrednio w HTML. Wygląd znajduje się w `slider.css`, a czas pełnego obrotu (`revolutionDuration`) w `slider.js`.

Karty poruszają się powoli i ciągle po zamkniętej trajektorii, bez przeskoku przy pełnym obrocie. Ich perspektywa odwraca się płynnie po przekroczeniu boków koła, a tylna część jest stopniowo przyciemniana. Najechanie kursorem lub przejście klawiszem Tab na kartę wstrzymuje ruch i pokazuje ją na pierwszym planie, frontalnie i bez przyciemnienia. Po opuszczeniu karty ruch jest wznawiany. Przy włączonej systemowej opcji ograniczenia ruchu autoplay i animacja przejścia są wyłączone.
