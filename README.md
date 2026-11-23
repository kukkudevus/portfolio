# Devika K S — portfolio

A static site built with plain HTML, CSS and JavaScript. It has no build step and no dependencies.

## Run it

Open `index.html` in a browser, or serve the folder (recommended, so the videos stream properly):

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.

To deploy, upload the whole folder to any static host (GitHub Pages, Netlify, Vercel, S3, and so on).

## Structure

```
index.html                     Landing: hero, work shelf, profile, experience, education, skillset, contact envelope
work/
  ai-video-production-system.html            01
  investor-persona-usability-research.html   02
  learn-by-doing.html                        03
  ai-knowledge-layer.html                    04
  visual-design.html                         05  (depth reel)
  motion-showreel.html                       06  (custom video player)
assets/
  css/base.css         Tokens, page basics, square cursor, torn menu, block wipe, page-entry blocks
  css/home.css         Landing page
  css/case-study.css   Everything shared by the pages in /work
  css/depth-reel.css   Visual Design reel, swipe carousel and lightbox
  css/showreel.css     Showreel player
  js/site.js           Shared: scroll/resize measure loop, cursor, menu, wipes, reveal-on-enter, table row fade
  js/home.js           Hero intro and name cycle, shelf scroll and books, contact envelope, #section landing
  js/case-study.js     Entry blocks and the next-project glitch
  js/depth-reel.js     Visual Design reel
  js/showreel.js       Showreel player
  media/               Covers, portrait, case-study images and videos
```

## Conventions

- **Markup carries the content.** Every project, row and label is written in the HTML. The scripts only add behaviour.
- **Hooks are classes and `data-` attributes**, not IDs:
  - `data-cursor="open | view | next | peek | play | pause"` sets the custom cursor's label over that element.
  - `data-reveal` / `data-clip` (landing) and `data-enter` (case studies) reveal an element once it scrolls into view.
  - `data-rowfade` fades a table row in as it reaches the middle of the screen.
  - `<div class="wipe">` with five `<span>`s, placed as the first child of a section, makes the stepped block wipe in that section's colour (`--wipe-color`, optional `--strength`). Add `data-wipe="footer"` on a footer so the wipe finishes as the page ends.
  - `data-menu-block="end"` on a section makes menu links and `#hash` links land at the end of that section (used by the contact envelope).
- **Motion respects `prefers-reduced-motion`.** Animations, the custom cursor and the autoplaying loops all switch off.
- **Section links work across pages.** `index.html#work`, `#about` and `#contact` land on those sections. The case-study menus and "Back to projects" use them.

## Editing content

- **Add or change a project on the shelf:** copy one `.shelf-item` block in `index.html`, then update its number, tag, spine title, cover, title, one-line problem and links. Set `--i` to its position; it controls the stagger.
- **Change the next-project card** at the bottom of a case study: edit the `.cs-next` link in that page's footer.
- **Add an artwork to the Visual Design reel:** copy a `.dr-piece`, a `.dr-thumb`, a `.dr-fig` and a `.dr-dot` in `work/visual-design.html`. Set `data-ratio` / `--r` to the artwork's width ÷ height, and raise `--dr-n` on the `.dr` section.
- **Contact details** are in the `.env-rows` links near the end of `index.html`.

## Deploy: GitHub Pages at devikasunil.com

The repo is ready for GitHub Pages: `CNAME` holds the domain and `.nojekyll` makes Pages serve the files as they are.

1. Push this repo to GitHub, then go to **Settings → Pages**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
2. At your domain registrar, add these DNS records for `devikasunil.com`:
   - Four `A` records on `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - One `CNAME` record on `www` pointing to `<your-github-username>.github.io`
3. Back in **Settings → Pages**, confirm the custom domain reads `devikasunil.com`. Once the DNS check passes, tick **Enforce HTTPS**.
