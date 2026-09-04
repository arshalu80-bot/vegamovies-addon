const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://vegamovies.im";

const client = axios.create({
    timeout: 10000,
    headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
    }
});

const manifest = {
    id: "org.vegamovies.directcatalog",
    version: "1.0.2",
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

builder.defineCatalogHandler(async ({ type, extra }) => {
    let targetUrl = `${BASE_URL}/`;
    if (extra && extra.search) {
        targetUrl = `${BASE_URL}/?s=${encodeURIComponent(extra.search)}`;
    } else {
        targetUrl = `${BASE_URL}/category/${type === "series" ? "web-series" : "movies"}/`;
    }

    try {
        const res = await client.get(targetUrl);
        const $ = cheerio.load(res.data);
        const metas = [];

        // Catch multiple possible card elements on VegaMovies
        $("article, div.post-item, div.blog-item, div.post").each((_, el) => {
            const anchor = $(el).find("a").first();
            const link = anchor.attr("href");
            const title = $(el).find("h2, .entry-title, a.title").first().text().trim() || anchor.attr("title");
            const img = $(el).find("img").first();
            const poster = img.attr("src") || img.attr("data-src") || "";

            if (link && title) {
                const encodedId = "vega:" + Buffer.from(link).toString("base64");
                metas.push({
                    id: encodedId,
                    type: type,
                    name: title,
                    poster: poster
                });
            }
        });

        return { metas: metas.slice(0, 25) };
    } catch (err) {
        return { metas: [] };
    }
});

builder.defineMetaHandler(async ({ type, id }) => {
    try {
        const pageUrl = Buffer.from(id.replace("vega:", ""), "base64").toString("ascii");
        const res = await client.get(pageUrl);
        const $ = cheerio.load(res.data);

        const title = $("h1.entry-title, h1").first().text().trim() || "Vega Stream";
        const poster = $(".entry-content img").first().attr("src") || "";

        return {
            meta: {
                id: id,
                type: type,
                name: title,
                poster: poster
            }
        };
    } catch (err) {
        return { meta: { id, type, name: "Vega Stream" } };
    }
});

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
                    title: text || "Play Video",
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
