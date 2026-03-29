# Instagram Replika

Mikroservisna aplikacija koja simulira osnovne Instagram funkcionalnosti kroz odvojene servise za autentikaciju, korisnike, drustvene relacije, objave, engagement i feed.

![Architecture](https://img.shields.io/badge/architecture-microservices-1d9bf0)
![Frontend](https://img.shields.io/badge/frontend-JavaScript-111827)
![Database](https://img.shields.io/badge/database-PostgreSQL-336791)
![Containerization](https://img.shields.io/badge/containerization-Docker-2496ED)

## Sadrzaj
- [Funkcionalnosti](#funkcionalnosti)
- [Arhitektura](#arhitektura)
- [Pokretanje aplikacije](#pokretanje-aplikacije)
- [Tok izvrsavanja funkcionalnosti](#tok-izvrsavanja-funkcionalnosti)
- [Glavne gateway rute](#glavne-gateway-rute)
- [Baza](#baza)
- [CI](#ci)
- [Moguca unapredjenja](#moguca-unapredjenja)
- [Clanovi tima i uloge](#clanovi-tima-i-uloge)

## Funkcionalnosti
- registracija, login, refresh i logout uz JWT i refresh token
- javni i privatni profili
- follow i follow request tokovi (`pending`, `accept`, `reject`)
- blokiranje korisnika i prekid follow relacija nakon bloka
- objave sa vise medija i validacijom tipa i velicine fajla
- like / unlike i komentari
- personalizovani feed
- pretraga korisnika po imenu i username-u uz filtriranje blokiranih profila

## Arhitektura

Projekat je organizovan kao skup zasebnih servisa sa jasno podeljenim odgovornostima. Frontend komunicira sa sistemom preko `gateway-service`, koji prosledjuje zahteve odgovarajucim backend servisima.

### Servisi
- `gateway-service` (`:8080`)
- `frontend-service` (`:3000`)
- `auth-service` (`:8081`)
- `user-service` (`:8082`)
- `social-service` (`:8083`)
- `post-service` (`:8084`)
- `engagement-service` (`:8085`)
- `feed-service` (`:8086`)
- `media-service` (`:8087`)

### Infrastruktura
- PostgreSQL
- RabbitMQ (`placeholder`)
- MinIO (`placeholder`)

## Pokretanje aplikacije

```bash
docker compose up --build
```

Frontend je dostupan na: `http://localhost:3000`

Za lokalno pokretanje potrebno je da Docker servis bude aktivan i da su potrebni portovi slobodni.

## Tok izvrsavanja funkcionalnosti
- korisnik se registruje ili prijavljuje preko `auth-service`
- gateway prosledjuje zahteve odgovarajucim servisima
- `user-service` upravlja podacima o profilima
- `social-service` obradjuje follow, follow request i blokiranje
- `post-service` upravlja objavama i medijskim stavkama
- `engagement-service` obradjuje lajkove i komentare
- `feed-service` sastavlja korisnikov feed na osnovu relacija pracenja

## Glavne gateway rute
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `GET /api/users/search?q=ana`
- `GET /api/users/{username}`
- `POST /api/users/{id}/block`
- `DELETE /api/users/{id}/block`
- `POST /api/social/follow/{userId}`
- `DELETE /api/social/follow/{userId}`
- `GET /api/social/requests`
- `POST /api/social/requests/{followerId}/accept`
- `POST /api/social/requests/{followerId}/reject`
- `GET /api/social/stats/{userId}`
- `POST /api/posts`
- `GET /api/posts`
- `GET /api/posts/{id}`
- `PATCH /api/posts/{id}`
- `DELETE /api/posts/{id}`
- `DELETE /api/posts/{id}/media/{mediaId}`
- `POST /api/engagement/posts/{id}/like`
- `DELETE /api/engagement/posts/{id}/like`
- `GET /api/engagement/posts/{id}/comments`
- `POST /api/engagement/posts/{id}/comments`
- `PATCH /api/engagement/comments/{id}`
- `DELETE /api/engagement/comments/{id}`
- `GET /api/feed`
- `POST /api/media/upload`

## Baza
- `db/schema.sql`
- `db/seed.sql`

SQL skripte definisu osnovnu strukturu podataka i demo podatke potrebne za inicijalno testiranje aplikacije.

## CI
- PR workflow: sintaksna validacija service entrypoint-a
- Main workflow: build image za svaki servis sa timestamp tag-om (`yyyymmdd-hhmmss`)

## Moguca unapredjenja
- potpuna integracija upload servisa sa trajnim skladistenjem fajlova
- prosirenje automatizovanih testova
- dodatno unapredjenje UI i UX tokova

## Clanovi tima i uloge
- Milica Kostic - backend engineer A, razvoj poslovne logike, definisanje modela podataka, integracija servisa, CI, Docker konfiguracija i priprema projekta za demonstraciju
- Aleksandra Acimovic - frontend engineer, razvoj i dorada grafickog korisnickog interfejsa
- Tamara Majdak - backend engineer B, razvoj poslovne logike i API integracioni testovi
- Natalija Ristovic - backend engineer C, razvoj poslovne logike i UI integracioni testovi
- Marija Stevic - validacija funkcionalnosti, priprema demonstracionih scenarija i projektna dokumentacija
