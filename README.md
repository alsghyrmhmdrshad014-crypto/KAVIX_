# KAVIX

An original 3D block-games platform: browse games, make an account, build a block avatar, walk and jump in 3D worlds, build maps in the Studio, publish them, and play together online.

## Run it
```
node server/server.js        # needs Node 18+, no npm install
```
Open http://localhost:8080. The same server hosts the site and the multiplayer rooms.
(Opening `index.html` directly also works for solo play; use the server for online play.)
Set `PORT`, `HOST=0.0.0.0` (to allow other devices on your network) and `KAVIX_ORIGINS=https://yoursite.com` (allowed web origins for online play) as needed.

## Test it
```
npm test
```

## Pages
| page | what it does |
| --- | --- |
| index.html | home, search, genre filters, community maps |
| auth.html | sign in / create account |
| avatar.html | 3D avatar editor |
| play.html?g=ID | the world: WASD/arrows + Space, or the on-screen stick and Jump button; "Go online" joins the room for that map |
| studio.html | map builder: Place, Erase, Move, Spawn, Undo/Redo, Save, Publish, Test play |

## Known limits (and what to do next)
- **Accounts and maps live in each browser's localStorage.** Passwords are hashed, but anyone with access to the browser can edit that data. "Publish" shows a map on the home page of the same browser only. To share maps and accounts between people, add a database and real login on the server and keep the same function names in `js/api.js` and `js/maps.js`.
- **Online identity is not verified.** Names in rooms are whatever the client sends. Do not trust them for anything that matters.
- The room server relays positions only (no game rules, no chat, 20 players per room, rate-limited).
- Fonts and Three.js (r128) load from Google Fonts and cdnjs, so the browser needs internet.
