# US Industries — website

Marketing site for US Industries, apparel manufacturing and export (Karachi, Pakistan, with a US office in Wylie, Texas).

It is static HTML, CSS and JavaScript with no runtime dependencies. A small Node script assembles the pages from shared partials, and the built HTML is committed, so the site deploys to any static host as it is.

## Pages

| URL | Source |
| --- | --- |
| `/` | `src/pages/home.html` — hero, introduction, development story, what we make, craft, manufacturing, quality, global, principles, standard, CTA |
| `/about/` | `src/pages/about.html` |
| `/capabilities/` | `src/pages/capabilities.html` — range, fabrics, techniques, machine floor, capacity |
| `/products/` | `src/pages/products.html` + `src/data/products.json` (filterable grid) |
| `/process/` | `src/pages/process.html` |
| `/quality/` | `src/pages/quality.html` |
| `/contact/` | `src/pages/contact.html` — project inquiry form and offices |
| `/404.html` | `src/pages/404.html` |

## Editing

**Edit files in `src/`, then rebuild.** The `.html` files at the repo root and in the page folders are generated, so don't edit them directly.

```bash
node tools/build.mjs          # builds every page plus sitemap.xml
python3 -m http.server 8000   # preview at http://localhost:8000
```

- **Copy and sections:** `src/pages/*.html`. Each file starts with a JSON comment holding its URL slug, SEO title and meta description.
- **Header, menu and footer:** `src/partials/`.
- **Products:** `src/data/products.json`. Each entry needs an image name from `assets/img/products/`, a category, fabric, fit and techniques.
- **Design:** `assets/css/main.css`. Colours, fonts and spacing are CSS variables at the top of the file.
- **Interactions:** `assets/js/main.js` covers page transitions, the cursor, reveals, the sticky development story, the pinned horizontal manufacturing section, product filters and the form.

The build adds `width`/`height`, lazy loading and `srcset` to every image automatically. Mark above-the-fold images with `data-eager`.

## Images

`assets/img/` is generated from the two company decks by `tools/process_images.py` (Pillow and NumPy). The script crops the factory process sheet and campaign collage, grades factory photography to black and white, converts everything to WebP, and paints out the corner sparkle mark on catalogue shots where it sits on plain backdrop.

```bash
python3 tools/process_images.py <profile.pptx>/ppt/media <catalogue.pptx>/ppt/media
```

To use new photography, drop WebP files into `assets/img/…` and point the `src` attributes at them. For full-bleed and hero use, supply images at least 2000px wide. The current factory panels are small (about 380px originals), which is why they are used blurred, graded, or at modest sizes.

## Before launch

- **Contact form:** set `data-endpoint` on `#inquiry-form` in `src/pages/contact.html` to a form service URL (Formspree, Basin, or your own endpoint) to receive submissions and tech-pack uploads. Until then, submitting opens the visitor's email app with the brief pre-filled and addressed to `usoffice@usindustries.pk`.
- **Placeholders:** office hours on the contact page, and the "Labels" photograph in the craft section on the home page.
- **Domain:** canonical URLs, the sitemap and Open Graph tags assume `https://www.usindustries.pk`. Change `SITE` in `tools/build.mjs` and the sitemap line in `robots.txt` if the site launches on another domain.

## Content sources

All company facts come from the supplied company profile deck: Karachi headquarters, US office, established 2015, 240+ team, 40,000+ sq ft, 200 production machines plus 6 sampling machines, monthly capacity, fabrics, techniques, BSCI certification, and quality and packing procedures. Nothing else (clients, awards, countries served) has been added. Product pages show catalogue developments and note that artwork belongs to the respective brands. Catalogue slides whose artwork carries obvious third-party marks or characters were left out.

## Deploy

Any static host works. For **GitHub Pages**, go to Settings → Pages, set the source to "Deploy from a branch", and choose the branch with the root folder. `.nojekyll` is included. Links are relative, so the site also works from a project sub-path, except for the 404 page, which expects to be served from the domain root.
