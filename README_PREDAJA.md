# Instagram Projekat

Ovaj projekat predstavlja web aplikaciju inspirisanu Instagram platformom.  
Aplikacija omogucava osnovne funkcionalnosti drustvene mreze kroz moderan korisnicki interfejs i lokalni mock API.

## Osnovne funkcionalnosti

- registracija i prijava korisnika
- prikaz profila sa profilnom slikom, biografijom i statistikama
- stories i highlights prikaz
- pretraga korisnika
- pracenje javnih i privatnih profila
- follow request sistem za privatne profile
- direktne poruke kroz DM panel
- kreiranje objava sa slikom ili videom
- prikaz feed-a
- lajkovi i komentari
- notifikacije

## Korisnici za demonstraciju

- `milica@example.com / 123456`
- `tamara@example.com / 123456`
- `aleksandra@example.com / 123456`
- `natalija@example.com / 123456`
- `marija@example.com / 123456`

## Pokretanje projekta

U `Command Prompt` ili `PowerShell` terminalu:

```bat
cd /d D:\Documents\instagram-replika
run-local.bat
```

Zatim otvoriti:

- `http://localhost:3000`

Preporuceno je uraditi:

```text
Ctrl + F5
```

## Predlog demonstracije na odbrani

1. Prijava na sistem kao demo korisnik
2. Prikaz profila, stories i highlights
3. Pretraga korisnika
4. Slanje zahteva za pracenje privatnom profilu
5. Prihvatanje zahteva iz naloga primaoca
6. Slanje direktne poruke
7. Kreiranje nove objave
8. Prikaz feed-a
9. Lajk i komentar na objavu
10. Prikaz notifikacija

## Tehnicka napomena

Frontend radi na:

- `http://localhost:3000`

Mock API radi na:

- `http://localhost:8081`

Projekat je prilagodjen za lokalno pokretanje i demonstraciju bez dodatne baze podataka ili Docker okruzenja.
