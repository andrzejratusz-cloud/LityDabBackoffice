# Lity Dąb Backoffice v0.1.5

Otwórz index.html w Edge lub Chrome, aby wypróbować wersję demonstracyjną. Zapis danych dla plików otwieranych bezpośrednio zależy od przeglądarki. Do stałego użytku uruchom aplikację pod stałym adresem localhost lub HTTPS. Service worker działa na localhost/HTTPS. Zmiana adresu, portu lub profilu przeglądarki zmienia miejsce przechowywania danych.

## Test

1. Aplikacja zaczyna od 10 fikcyjnych zamówień. Otwórz dowolne, zmień status lub wymiar, zapisz, a potem odśwież stronę.
2. W zapisanym zamówieniu wybierz Umowa / PDF, potem Drukuj / zapisz PDF i jako drukarkę wybierz Zapisz jako PDF. Wyłącz nagłówki i stopki przeglądarki.
3. Wybierz Przygotuj e-mail, wskaż szablon i otwórz szkic w swoim programie pocztowym. Plik PDF dołącz ręcznie. Adresy przykładowe mają domenę example.invalid.
4. Sprawdź filtr dat w finansach oraz eksport i przywracanie kopii JSON oraz CSV w ustawieniach.
5. Przełącz na Firmowa. To odrębna, początkowo pusta baza. Przywrócenie kopii z innej przestrzeni jest blokowane.

## Zakres

Dane aplikacji są zapisywane w localStorage danego profilu i adresu. Rób kopie JSON lub CSV przed czyszczeniem danych witryny i przenoszeniem aplikacji. Wersja nie synchronizuje danych między osobami. Polkurier działa jako ręczna ewidencja numeru, linku i statusu. Dane sprzedawcy na umowie firmowej pochodzą z dostarczonego wzoru. Dokument demonstracyjny używa zastępczych danych sprzedawcy. Stawki sprzedaży i kosztu stelaża, podcięcia i przesyłki zaczynają od tych samych wartości i można je zmienić niezależnie.

Koszt zamówienia to suma wydatków przypisanych do niego w finansach. Dochód to wartość oferty pomniejszona o ten koszt. CSV Lity Dąb jest pełną kopią bazy w formacie aplikacji, z rekordami JSON w wierszach CSV. Przywracanie przyjmuje kopie wyeksportowane przez aplikację.





