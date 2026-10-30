# Landing photo

The intro page (`/`) shows one photo under the greeting text.

Drop it here with **exactly** this name:

    client/public/photos/huslen.jpg

- Served at `/photos/huslen.jpg` (that's the path `Landing.tsx` uses — `PHOTO_URL`).
- Use `.jpg`. For another format, change `PHOTO_URL` in
  `client/src/pages/Landing.tsx` to match.
- If the file is missing the page just hides the image and shows text + button.
