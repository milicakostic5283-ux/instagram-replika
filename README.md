## Quickstart bez Docker-a (preporuceno za tvoj racunar sada)
Ako Docker ne moze da se instalira zbog manjka prostora na `C:`, koristi lokalni quickstart:

1. Pokreni `D:\Documents\instagram-replika\quickstart\start-local.bat`
2. Otvori:
- `http://localhost:3000`
- `http://localhost:8080/health`

Za gasenje pokreni `D:\Documents\instagram-replika\quickstart\stop-local.bat`.

Napomena: quickstart koristi mock API (in-memory) da mozes odmah da radis frontend i funkcionalni flow.
# Instagram Replika (Mikroservisna Aplikacija)

Implementirana je mikroservisna aplikacija (backend + osnovni frontend) koja pokriva kljucne zahteve zadatka:
- registracija/login/refresh/logout (JWT + refresh token)
- public/private profili
- follow i follow request (pending/accept/reject)
- blokiranje korisnika i prekid follow relacija nakon bloka
- objave sa karuselom (max 20), validacija media tipa i velicine (max 50MB)
- like/unlike i komentari (create/update/delete)
- feed (objave profila koje korisnik prati)
- pretraga korisnika po imenu/username uz filtriranje blokiranih

## Servisi
- gateway-service (`:8080`)
- frontend-service (`:3000`)
- auth-service (`:8081`)
- user-service (`:8082`)
- social-service (`:8083`)
- post-service (`:8084`)
- engagement-service (`:8085`)
- feed-service (`:8086`)
- media-service (`:8087`)

Infra:
- PostgreSQL
- RabbitMQ (placeholder)
- MinIO (placeholder)

Frontend URL: `http://localhost:3000`

## Pokretanje
```bash
docker compose up --build
```

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

## CI
- PR workflow: sintaksna validacija service entrypoint-a
- Main workflow: build image za svaki servis sa timestamp tag-om (`yyyymmdd-hhmmss`)

## Sledeci koraci za punu predaju
1. Dodati unit testove i pokrivenost >= 70%.
2. Dodati API/UI integracione testove.
3. Implementirati real upload fajlova u MinIO i vezu sa post-service.
4. Ojacati gateway auth middleware (validacija JWT na svim protected rutama).
5. Doterati frontend UX i kompletirati sve ekrane iz specifikacije.


## Demo i predaja (quickstart)
- Koraci demonstracije: `DEMO_CHECKLIST.md`
- Export stanja: dugme `Preuzmi snapshot (JSON)` u sekciji `Log`
