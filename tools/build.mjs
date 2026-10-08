// Static site builder. No dependencies: `node tools/build.mjs`
//
// src/layout.html         page shell ({{title}}, {{body}}, ...)
// src/partials/*.html     included with <!-- @include name -->
// src/pages/*.html        page bodies, each starting with a JSON front-matter comment
// src/data/products.json  rendered where a page contains <!-- @products -->
//
// Output: index.html, <page>/index.html, 404.html, sitemap.xml at the repo root.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src");
const SITE = "https://www.usindustries.pk";
const read = (p) => readFileSync(join(SRC, p), "utf8");

const layout = read("layout.html");
const products = JSON.parse(read("data/products.json"));

// --- Image dimensions straight from the WebP header ---
function webpSize(file) {
  const b = readFileSync(file);
  const chunk = b.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  if (chunk === "VP8L") {
    const bits = b.readUInt32LE(21);
    return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
  }
  if (chunk === "VP8X") return [b.readUIntLE(24, 3) + 1, b.readUIntLE(27, 3) + 1];
  throw new Error(`Unknown WebP format: ${file}`);
}

// Adds width/height, lazy loading and srcset to every local <img>.
function enhanceImages(html, root) {
  return html.replace(/<img\b([^>]*?)\/?>/g, (tag, attrs) => {
    const src = /src="([^"]+)"/.exec(attrs)?.[1];
    if (!src || !src.endsWith(".webp")) return tag;
    const rel = src.replace(root, "");
    const file = join(ROOT, rel);
    if (!existsSync(file)) throw new Error(`Missing image: ${rel}`);
    let out = attrs;
    if (!/\swidth=/.test(out)) {
      const [w, h] = webpSize(file);
      out += ` width="${w}" height="${h}"`;
    }
    const eager = /\sdata-eager/.test(out);
    out = out.replace(/\sdata-eager/, "");
    if (!/\sloading=/.test(out)) out += eager ? ` fetchpriority="high"` : ` loading="lazy"`;
    if (!/\sdecoding=/.test(out)) out += ` decoding="async"`;
    const small = file.replace(/\.webp$/, "-560.webp");
    if (existsSync(small) && !/\ssrcset=/.test(out)) {
      const [w] = webpSize(file);
      out += ` srcset="${src.replace(/\.webp$/, "-560.webp")} 560w, ${src} ${w}w"`;
      if (!/\ssizes=/.test(out)) out += ` sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"`;
    }
    return `<img${out}>`;
  });
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

function renderProducts() {
  return products.items
    .map((p) => {
      const cat = products.categories.find((c) => c.id === p.category).label;
      return `
      <li class="product" data-category="${p.category}" data-reveal>
        <figure>
          <div class="product-media" data-cursor="view">
            <img src="{{root}}assets/img/products/${p.image}.webp" alt="${esc(p.alt)}">
          </div>
          <figcaption>
            <p class="product-cat">${cat}</p>
            <h3 class="product-name">${p.name}</h3>
            <p class="product-spec">${p.fabric} · ${p.fit}</p>
            <p class="product-tags">${p.techniques.join(" / ")}</p>
          </figcaption>
        </figure>
      </li>`;
    })
    .join("");
}

function renderFilters() {
  const all = `<button class="filter is-active" data-filter="all" aria-pressed="true">All <sup>${products.items.length}</sup></button>`;
  return (
    all +
    products.categories
      .map((c) => {
        const n = products.items.filter((p) => p.category === c.id).length;
        return `<button class="filter" data-filter="${c.id}" aria-pressed="false">${c.label} <sup>${n}</sup></button>`;
      })
      .join("")
  );
}

function includePartials(html) {
  return html.replace(/<!-- @include ([\w-]+) -->/g, (_, name) => includePartials(read(`partials/${name}.html`)));
}

const pages = readdirSync(join(SRC, "pages")).filter((f) => f.endsWith(".html"));
const sitemap = [];

for (const file of pages) {
  const raw = read(`pages/${file}`);
  const fm = /^<!--\s*(\{[\s\S]*?\})\s*-->/.exec(raw);
  if (!fm) throw new Error(`No front matter in ${file}`);
  const meta = JSON.parse(fm[1]);
  const body = raw.slice(fm[0].length);
  const slug = meta.slug; // "" for home
  const outFile = slug === "404" ? "404.html" : slug ? `${slug}/index.html` : "index.html";
  const root = slug === "404" ? "/" : slug ? "../" : ""; // 404 can be served at any depth
  const url = slug === "404" ? `${SITE}/404.html` : `${SITE}/${slug ? slug + "/" : ""}`;

  const schema = [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "US Industries",
      url: `${SITE}/`,
      logo: `${SITE}/assets/img/logo.png`,
      description:
        "Apparel manufacturer and exporter based in Karachi, Pakistan, developing and producing premium knitwear, fleece and streetwear for international brands.",
      foundingDate: "2015",
      email: "saleemmemon@usindustries.pk",
      telephone: "+92-21-3258-0143",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Plot F-211 A/1, S.I.T.E.",
        addressLocality: "Karachi",
        addressCountry: "PK",
      },
      contactPoint: [
        { "@type": "ContactPoint", contactType: "sales", telephone: "+92-321-200-7175", email: "usmantalwani@usindustries.pk", areaServed: "Worldwide" },
        { "@type": "ContactPoint", contactType: "sales", telephone: "+1-469-673-8464", email: "usoffice@usindustries.pk", areaServed: "US", availableLanguage: "English" },
      ],
      location: [
        { "@type": "Place", name: "US Industries — Headquarters & Production", address: { "@type": "PostalAddress", streetAddress: "Plot F-211 A/1, S.I.T.E.", addressLocality: "Karachi", addressCountry: "PK" } },
        { "@type": "Place", name: "US Industries — US Office", address: { "@type": "PostalAddress", streetAddress: "3101 Glenwood Drive", addressLocality: "Wylie", addressRegion: "TX", postalCode: "75098", addressCountry: "US" } },
      ],
      knowsAbout: ["Apparel manufacturing", "Private label clothing", "Streetwear manufacturing", "Hoodie manufacturing", "Cut and sew", "Garment dyeing", "Screen printing", "Embroidery"],
    },
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: meta.title,
      description: meta.description,
      url,
      isPartOf: { "@type": "WebSite", name: "US Industries", url: `${SITE}/` },
      about: { "@id": `${SITE}/#organization` },
    },
  ];
  if (slug && slug !== "404") {
    schema.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: meta.crumb, item: url },
      ],
    });
  }

  let html = layout
    .replace("{{body}}", body)
    .replace(/{{title}}/g, esc(meta.title))
    .replace(/{{description}}/g, esc(meta.description))
    .replace(/{{canonical}}/g, url)
    .replace(/{{ogImage}}/g, `${SITE}/assets/img/og.jpg`)
    .replace("{{schema}}", JSON.stringify(schema))
    .replace(/{{page}}/g, slug || "home")
    .replace("{{robots}}", slug === "404" ? "noindex" : "index, follow");
  html = includePartials(html)
    .replace("<!-- @products -->", renderProducts())
    .replace("<!-- @filters -->", renderFilters())
    .replace(/{{year}}/g, String(new Date().getFullYear()));
  // Mark the current nav item.
  html = html.replace(new RegExp(`(<a[^>]*data-nav="${slug}")`, "g"), `$1 aria-current="page"`);
  html = html.replace(/{{root}}/g, root);
  html = enhanceImages(html, root);

  const leftover = /{{\w+}}/.exec(html);
  if (leftover) throw new Error(`Unreplaced ${leftover[0]} in ${file}`);

  mkdirSync(dirname(join(ROOT, outFile)), { recursive: true });
  writeFileSync(join(ROOT, outFile), html);
  if (slug !== "404") sitemap.push({ url, priority: slug ? "0.8" : "1.0" });
  console.log(`built ${outFile}`);
}

writeFileSync(
  join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
    .map((s) => `  <url><loc>${s.url}</loc><changefreq>monthly</changefreq><priority>${s.priority}</priority></url>`)
    .join("\n")}\n</urlset>\n`
);
console.log("built sitemap.xml");
