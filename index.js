const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

// Exact working domain aapke browser se
const BASE_URL = "https://new2.vegamovies.futbol";

const client = axios.create({
    timeout: 7000,
    headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        "Referer": `${BASE_URL}/`
    }
});

const manifest = {
    id: "org.vegamovies.directcatalog",
    version: "1.0.3",
    name: "VegaMovies Direct",
    description: "Search and stream directly from VegaMovies",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    catalogs: [
        {
            type: "movie",
            id: "vega_movies",
            name: "Vega Movies",
            extra: [{ name: "search", isRequired: false }]
        },
        {
            type: "series",
            id: "vega_series",
            name: "Vega Web Series",
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

        // Exact VegaMovies cards match
        $("article, div.item, div.post-item, div.blog-item").each((_, el) => {
            const anchor = $(el).find("a").first();
            const link = anchor.attr("href");
            const title = $(el).find("h2, .entry-title, p").first().text().trim() || anchor.attr("title");
            const img = $(el).find("img").first();
            const poster = img.attr("data-src") || img.attr("src") || "";

            if (link && title && !title.toLowerCase().includes("page")) {
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
        return { metas: [] };
    }
});

builder.defineMetaHandler(async ({ type, id }) => {
    try {
        const pageUrl = Buffer.from(id.replace("vega:", ""), "base64").toString("ascii");
        const res = await client.get(pageUrl);
        const $ = cheerio.load(res.data);

        const title = $("h1.entry-title, h1").first().text().trim() || "Vega Video";
        const poster = $(".entry-content img, .post-content img").first().attr("src") || "";

        return {
            meta: {
                id: id,
                type: type,
                name: title,
                poster: poster
            }
        };
    } catch (err) {
        return { meta: { id, type, name: "Vega Video" } };
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
                    title: text || "Vega Fast Stream",
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
