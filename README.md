# Lity Dąb Backoffice v0.1.11

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









## Zmiany w v0.1.23

Lista zamówień ma edytowalne statusy i podsumowanie zgodne z filtrem. Koszt szacowany pochodzi z formularza. Rzeczywiste wydatki pokazane są osobno. W Koszty i przychody przycisk Dodaj wydatek rzeczywisty otwiera formularz z datą, opisem, kwotą, numerem faktury i sprzedawcą. Wydatek można podzielić kwotowo lub równo na zaznaczone zamówienia. Pozostała część jest kosztem ogólnym. Podział zachowuje sumę co do grosza. Dostępna jest edycja wcześniejszych wydatków.

Historia zmian pojawia się w ustawieniach od tej wersji. Zawiera czas, lokalnego użytkownika albo zalogowany e-mail, rodzaj danych i wartości przed/po. Kopie bazy JSON i CSV obejmują historię. Sama historia ma eksport JSON i CSV do Excela oraz import JSON.

Folder faktur wybiera się w ustawieniach. Wybierz folder z dysku Google Drive synchronizowanego przez aplikację Google Drive na komputerze. W przeglądarce udziel dostępu do folderu. Załączniki PDF/JPG/PNG/WebP do 25 MB zapisują się lokalnie w IndexedDB oraz w wybranym folderze. Opisy faktur są w bazie i jej kopiach. Pliki binarne zachowaj także w Google Drive, ponieważ nie są zawarte w kopiach JSON/CSV ani w synchronizacji Supabase. Na iOS pobrany plik można zapisać do Google Drive przez systemowy wybór miejsca.

Na iOS Safari i aplikacja z ikony mają oddzielny zapis. W Ustawienia / Skrót na pulpit i przeniesienie danych przycisk Dodaj skrót na pulpit pobiera kopię przed instalacją. Na iPhonie kończysz instalację przez Udostępnij / Dodaj do ekranu głównego. Przy pierwszym uruchomieniu z ikony pojawia się ekran przeniesienia danych. Wczytaj plik w tej sekcji albo otwórz wspólną bazę przez logowanie Supabase. Kopia przeniesienia obejmuje ustawienia wyglądu, publiczną konfigurację Supabase i bieżącą bazę. Dotychczasowe dane pozostają w Safari. Instalacja i synchronizacja na fizycznym iPhonie wymagają testu użytkownika.

Usunięcie klienta zachowuje dane klienta w historycznych zamówieniach. Usunięte dane są także w lokalnej kopii archiwalnej.


Wersja 0.1.23 używa tych samych lokalnych baz i ustawień przeglądarki. Uruchom na dotychczasowym adresie http://127.0.0.1:8791, aby zachować dostęp do lokalnej bazy. Dane klienta synchronizują się po zapisaniu formularza.

Pełne ścieżki folderów wpisz w ustawieniach po skopiowaniu z Eksploratora. Przeglądarka przekazuje aplikacji nazwę i uchwyt wybranego folderu. Daty w formularzach wpisuj w formacie DD.MM.YYYY.
