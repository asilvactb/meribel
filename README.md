# Méribel 2027

Trip planner for the January 2027 ski trip (5–10 Jan, Méribel · Les 3 Vallées), 9 people in 5 families.

- **Resumo** — countdown, quick expense bar, balances, what each family still has to sort out.
- **Tratar** — per-person matrix of things to sort (accommodation, travel, transfer, ski pass, rental, lessons, insurance). Optional items start as "por decidir". Plus group to-dos.
- **Despesas** — Splitwise-style. Type expenses in plain Portuguese (`120 sherpa, 45 jantar pago pelo miguel, 300 aulas só miguel e daniel, 60 portagens por família`), review and save. Balances per family and the fewest transfers to settle.
- **Viagem** — accommodation details and flights / cars / transfers.
- **Plano** — day by day.
- **Mala** — shared packing list, ticked per person.
- **Info** — ski pass prices, transfers, practical notes.

## Stack

Static site (no build) on Render + Supabase (tables prefixed `trip_`, RLS limited to the emails in `trip_people`). `logic.js` holds the parser and balance maths with no DOM, so it can be tested in Node.

## Logins

Adults log in by picking their name and typing their password. Children have no login. Passwords are not stored in this repo.
