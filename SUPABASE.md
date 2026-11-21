# Współdzielenie Lity Dąb przez Supabase

Dane są zapisywane lokalnie, a po świadomym utworzeniu lub dołączeniu do wspólnego backoffice również synchronizowane z projektem Supabase. Mechanizm opiera się na Fuel Trackerze. Dostęp mają właściciel i jedna zaproszona osoba.

## Konfiguracja

1. Utwórz osobny projekt Supabase dla Lity Dąb, najlepiej w regionie UE. Zachowaj oddzielny projekt i tabele Fuel Trackera.
2. W SQL Editor uruchom supabase-schema.sql z tej paczki jeden raz. Powstaną tabele i funkcje ld_*. Tabele mają RLS, a funkcje sprawdzają zalogowanego użytkownika i członkostwo.
3. Włącz logowanie e-mail. W szablonie Magic Link wstaw {{ .Token }}, aby użytkownik mógł wpisać kod w aplikacji.
4. Skonfiguruj własne SMTP w Supabase Auth do wysyłki kodów na konta użytkowników spoza zespołu projektu.
5. W ustawieniach aplikacji wpisz Project URL i PUBLICZNY klucz publishable lub anon. Zachowaj service_role, sekretny klucz i hasło bazy w panelu administratora.
6. Pobierz kopię danych. W sekcji współdzielenia zaloguj się kodem e-mail.
7. Właściciel wybiera Utwórz backoffice z moich danych i potwierdza przesłanie lokalnej bazy do Supabase.
8. Właściciel zapisuje zaproszenie na e-mail drugiej osoby. Przekazuje jej aplikację samodzielnie. Zaproszenie jest widoczne po zalogowaniu i ważne 7 dni.
9. Druga osoba konfiguruje TEN SAM Project URL i publiczny klucz na swoim urządzeniu, loguje się własnym e-mailem i dołącza.

Do zwykłego współdzielenia wystarczą pliki statyczne aplikacji pod HTTPS. API Polkurier wymaga uruchomienia lokalnego modułu na komputerze korzystającym z nadawania. Nie udostępniaj skryptu z tokenem Polkurier.

## Zapis i konflikty

Wspólna baza ma osobny zapis lokalny przypisany do użytkownika i backoffice. Baza prywatna pozostaje pod swoim kluczem. Po powrocie do danych lokalnych aplikacja otwiera prywatny zestaw.

Synchronizacja działa przy otwartej aplikacji co około 15 sekund i po zmianach. Otwarte formularze zamówienia, przesyłki, wiadomości, zadań i wydatków wstrzymują synchronizację. Wspólny zapis zawiera klientów, zamówienia, wydatki, zadania, cennik, podwykonawców, nadawców i szablony umów. Logo, preferencje wyglądu, uprawnienia do folderów i token Polkurier pozostają ustawieniami urządzenia.

Jednoczesne zmiany na obu urządzeniach pokazują konflikt. Użytkownik wybiera cały zestaw po pobraniu kopii. Numer rewizji chroni przed bezwarunkowym nadpisaniem. Przy utracie internetu zapis pozostaje lokalny. Wyczyścienie danych przeglądarki usuwa niewysłane zmiany, dlatego zapisuj kopie JSON.

Limit wspólnego dokumentu to 4 MB. Kopie CSV i JSON obejmują dane biznesowe. Konfigurację i logowanie Supabase ustawiasz osobno na urządzeniu.

## Sprawdzenie przed użyciem

Nie wykonano testu na rzeczywistym projekcie Supabase. Po konfiguracji sprawdź na danych próbnych logowanie dwóch osób, utworzenie bazy, zaproszenie, zapis w obie strony, offline i konflikt po równoczesnej edycji. Trzecie konto i wywołania anonimowe powinny otrzymać odmowę dostępu.

Dokumentacja
https://supabase.com/docs/guides/auth/auth-email-passwordless
https://supabase.com/docs/guides/auth/auth-smtp
https://supabase.com/docs/guides/database/postgres/row-level-security
