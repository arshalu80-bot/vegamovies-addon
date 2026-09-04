const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

// Updated fast mirror domain
const BASE_URL = "https://vegamovies.im";

const client = axios.create({
    timeout: 8000,
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5"
    }
});

const manifest = {
    id: "org.vegamovies.directcatalog",
    version: "1.0.1",
    name: "VegaMovies Direct",
    description: "VegaMovies Catalog & Search Addon",
    resources: ["catalog", "meta", "stream"],
    types: ["series", "movie"],
    catalogs: [
        {
            type: "series",
            id: "vega_series",
            name: "Vega Web Series",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "movie",
            id: "vega_movies",
            name: "Vega Movies",
            extra: [{ name: "search", isRequired: false }]
        }
    ],
    idPrefixes: ["vega:"]
};

const builder = new addonBuilder(manifest);

// 1. Catalog & Search Handler
builder.defineCatalogHandler(async ({ type, extra }) => {
    let targetUrl = `${BASE_URL}/category/${type === "series" ? "web-series" : "movies"}/`;
    if (extra && extra.search) {
        targetUrl = `${BASE_URL}/?s=${encodeURIComponent(extra.search)}`;
    }

    try {
        const res = await client.get(targetUrl);
        const $ = cheerio.load(res.data);
        const metas = [];

        $("article, .post-item, .blog-item, div.item").each((_, el) => {
            const titleEl = $(el).find("h2, .entry-title, a.title").first();
            const title = titleEl.text().trim();
            const link = $(el).find("a").attr("href");
            const imgEl = $(el).find("img");
            const poster = imgEl.attr("data-src") || imgEl.attr("src") || "";

            if (title && link) {
                const encodedId = "vega:" + Buffer.from(link).toString("base64");
                metas.push({
                    id: encodedId,
                    type: type,
                    name: title,
                    poster: poster
                });
            }
        });
        return { metas: metas.slice(0, 20) };
    } catch (err) {
        console.error("Catalog fetch error:", err.message);
        return { metas: [] };
    }
});

// 2. Meta Handler
builder.defineMetaHandler(async ({ type, id }) => {
    try {
        const pageUrl = Buffer.from(id.replace("vega:", ""), "base64").toString("ascii");
        const res = await client.get(pageUrl);
        const $ = cheerio.load(res.data);

        const title = $("h1.entry-title, h1").first().text().trim() || "Vega Series";
        const img = $(".entry-content img").first();
        const poster = img.attr("data-src") || img.attr("src") || "";

        return {
            meta: {
                id: id,
                type: type,
                name: title,
                poster: poster
            }
        };
    } catch (err) {
        return { meta: { id, type, name: "Vega Series" } };
    }
});

// 3. Stream Handler
builder.defineStreamHandler(async ({ id }) => {
    try {
        const pageUrl = Buffer.from(id.replace("vega:", ""), "base64").toString("ascii");
        const res = await client.get(pageUrl);
        const $ = cheerio.load(res.data);
        const streams = [];

        $("a").each((_, el) => {
            const href = $(el).attr("href");
            const text = $(el).text().trim();
            if (href && (href.includes("fastdl") || href.includes("hubcloud") || href.includes("drive") || href.includes("download") || href.includes("v-cloud"))) {
                streams.push({
                    title: text || "Vega 1080p Stream",
                    url: href
                });
            }
        });
        return { streams };
    } catch (err) {
        return { streams: [] };
    }
});

serveHTTP(builder.getInterface(), { port: process.env.PORT || 7000 });
