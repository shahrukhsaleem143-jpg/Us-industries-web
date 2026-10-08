# US Industries Website

A responsive, single-page company website built with plain HTML, CSS and JavaScript. It needs no build step and no dependencies.

## Structure

```
index.html        Main page (hero, about, services, industries, process, contact)
css/styles.css    All styles
js/main.js        Mobile menu, scroll animations, counters, contact form validation
assets/           Logo / favicon and images
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Customize

- **Contact details:** update phone, email and address in the `#contact` section of `index.html`.
- **Stats:** change the `data-count` values in the hero.
- **Colors:** edit the CSS variables at the top of `css/styles.css` (`--navy`, `--red`, ...).
- **Contact form:** it currently validates on the client only. To receive messages, point the form at a service such as Formspree or Netlify Forms, or at your own backend.

## Deploy

Any static host works: GitHub Pages, Netlify, Vercel or Cloudflare Pages.
