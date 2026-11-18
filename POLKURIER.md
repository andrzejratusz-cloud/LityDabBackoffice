# Polkurier w Lity Dąb Backoffice

Integracja korzysta z API Polkurier 1.14. Dokumentacja https://www.polkurier.pl/files/download/api_documentation_pdf

## Uruchomienie na komputerze

Wymagany Node.js 22 lub nowszy. W PowerShell otwórz folder tego wydania i uruchom:

    $env:POLKURIER_LOGIN = Read-Host 'ID konta Polkurier'
    $pkSecret = Read-Host 'Token API Polkurier' -AsSecureString
    $env:POLKURIER_TOKEN = [System.Net.NetworkCredential]::new('', $pkSecret).Password
    node ./polkurier-server.cjs

Otwórz http://127.0.0.1:8791 w Chrome lub Edge. Token pozostaje w pamięci procesu i jego środowisku. Zakończenie modułu Ctrl+C. Po zakończeniu usuń zmienną przez Remove-Item Env:POLKURIER_TOKEN.

Token generujesz w panelu Polkurier, Ustawienia, Token API. Login w API jest ID konta. W celu dostępu do sandboxa skontaktuj się z api@polkurier.pl. Dla testowego środowiska ustaw przed uruchomieniem:

    $env:POLKURIER_SANDBOX = '1'

Produkcja wymaga usunięcia tej zmiennej lub ustawienia jej na 0.

## Dane lokalne

Adres localhost ma osobną bazę przeglądarki. W dotychczasowej aplikacji wyeksportuj JSON. Pod lokalnym adresem wybierz tę samą przestrzeń i przywróć kopię. Pozostań przy stałym adresie 127.0.0.1 i porcie 8791. Nie uruchamiaj dwóch modułów na tym samym porcie.

## Nadawanie

1. Uzupełnij dane nadawcy w Ustawieniach, Polkurier.
2. Zapisz zamówienie i wybierz Przygotuj zlecenie Polkurier w jego sekcji Przesyłka.
3. Sprawdź odbiorcę i nadawcę. Wprowadź rzeczywiste wymiary oraz wagę każdej zapakowanej paczki. Pola paczek są listą JSON, przykład jest widoczny w formularzu. Wysokość i waga wymagają wpisania.
4. Ustaw termin podjazdu, ubezpieczenie i ewentualne pobranie. Przy pobraniu podaj rachunek do zwrotu środków. Kody typów paczek oraz pola specyficzne dla przewoźnika znajdziesz w dokumentacji API.
5. Pobierz ceny, wybierz usługę i potwierdź zlecenie. Cena ostateczna pochodzi z Polkurier.
6. Numer zlecenia, numery listów i link śledzenia zapisują się przy zamówieniu. Gdy list jeszcze oczekuje, opłać zlecenie w Polkurier i wybierz Pobierz numer przesyłki i status.
7. Możesz też wpisać numer zlecenia utworzonego wcześniej w panelu Polkurier i pobrać jego dane. Etykietę pobierzesz przyciskiem Pobierz etykietę PDF.

Przestrzeń demo blokuje utworzenie zlecenia. Zlecenia są składane wyłącznie po kliknięciu i potwierdzeniu przez użytkownika. Status odświeża się przyciskiem. Moduł jest dostępny lokalnie na komputerze.

## Niepewny wynik połączenia

Moduł zapisuje wynik tworzenia zlecenia w .polkurier-journal.json. Ponowienie tego samego zlecenia zwraca zapisany wynik. Po przerwaniu połączenia sprawdź panel Polkurier i podłącz numer istniejącego zlecenia. Nie kasuj dziennika w celu ponawiania bez sprawdzenia panelu, ponieważ API nie gwarantuje unikalności zewnętrznego identyfikatora.

Nie wykonano nadania na rzeczywistym koncie ani sandboxie. Wymagają one Twojego ID konta, tokenu i dostępu do środowiska.
