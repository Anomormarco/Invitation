# Event poster images

The invitation event cards use the images in this folder as their background.

Drop the two posters here with **exactly** these names:

| File                            | Card           |
| ------------------------------- | -------------- |
| `client/public/posters/the-lemons.jpg`     | The Lemons     |
| `client/public/posters/mc-collection.jpg`  | MC Collection  |

- Anything in `client/public/` is served at the site root, so the card
  references them as `/posters/the-lemons.jpg` (see `INVITE_EVENTS_JSON` in
  `server/.env`, or the fallback list in `client/src/pages/Invite.tsx`).
- Use `.jpg`. If you have `.png`/`.webp`, either convert, or change the
  `imageUrl` value in `server/.env` to match your extension.
- Portrait posters are fine — the card crops to a centre band and lays a dark
  gradient over the bottom so the white title/date text stays readable.
- If a file is missing the card silently falls back to its plain colour style.
