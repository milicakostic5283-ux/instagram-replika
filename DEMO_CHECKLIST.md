# DEMO CHECKLIST - Instagram Replika (Quickstart)

## Pokretanje
1. `cd /d D:\Documents\instagram-replika && quickstart\start-local.bat`
2. Otvori:
- `http://localhost:3000`
- `http://localhost:8080/health`

## 0) Brzi start (opciono)
1. Klikni `Reset demo state` da vratis pocetno stanje.
2. U sekciji Login klikni `Popuni Ana` i zatim `Login`.
3. Klikni `Seed demo data` za automatske objave i aktivnost.

## 1) Registracija i login
1. U Registraciji unesi novi nalog i klikni `Register`.
2. Proveri da se prikaze `Ulogovan kao userId=...`.
3. Odjavi i ponovo se prijavi preko Login sekcije.

## 2) Public/Private profil
1. U sekciji `Moj profil` ukljuci `Privatni profil` i sacuvaj.
2. Proveri da se `private: true` vidi u statistikama.
3. Iskljuci i sacuvaj nazad po potrebi.

## 3) Pretraga korisnika
1. U `Pretraga korisnika` unesi `ana` i klikni `Pretrazi`.
2. Prikazuju se rezultati sa `@username` i `private` statusom.

## 4) Follow / Unfollow / Follow request
1. Klikni `Follow` na javnom profilu i proveri log (`accepted`).
2. Ako je profil private, status ide `pending`.
3. Uloguj se kao vlasnik private profila, otvori `Zahtevi za pracenje`, pa `Accept` ili `Reject`.
4. Vrati se na prvi nalog i proveri notifikaciju `request_accepted`.

## 5) Blokiranje
1. U pretrazi klikni `Block` na korisniku.
2. Pokusaj follow ili pregled profila (treba da bude ograniceno).
3. Klikni `Unblock` i ponovi akciju.

## 6) Objave
1. U `Kreiranje objave` unesi caption i media pa klikni `Kreiraj objavu`.
2. U `Moje objave` proveri da se vidi objava.
3. Testiraj `Izmeni caption`, `Obrisi prvi media`, `Obrisi objavu`.

## 7) Like i komentari
1. U `Feed` ucitaj objave i klikni `Like` / `Unlike`.
2. Dodaj komentar na objavu.
3. Klikni `Prikazi komentare`, pa `Edit` / `Delete` na svom komentaru.

## 8) Feed i osvezavanje
1. Klikni `Ucitaj feed`.
2. Proveri da se prikazuje status osvezavanja i broj objava.

## 9) Notifikacije
1. Klikni `Ucitaj notifikacije`.
2. Proveri dogadjaje: follow request, accept, like, komentar.
3. Klikni `Oznaci sve kao procitano`.

## 10) Pregled profila
1. U pretrazi klikni `Profil` na korisniku.
2. Proveri prikaz podataka, followers i following liste.

## 11) Export stanja za prilog
1. Klikni `Preuzmi snapshot (JSON)` u sekciji `Log`.
2. Sacuvani JSON mozes priloziti kao dokaz stanja pri demou.

## Gasenje
`cd /d D:\Documents\instagram-replika && quickstart\stop-local.bat`
