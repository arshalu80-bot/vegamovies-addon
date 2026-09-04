const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE_URL = "https://vegamovies.yt";

const manifest = {
    id: "org.vegamovies.directcatalog",
    version: "1.0.0",
    name: "VegaMovies Direct",
    description: "VegaMovies Custom Catalog & Stream Addon",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
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
    let targetUrl = `${BASE_URL}/category/${type === "series" ? "web-series" : "movies"}/`;
    if (extra && extra.search) {
        targetUrl = `${BASE_URL}/?s=${encodeURIComponent(extra.search)}`;
    }

    try {
        const { data } = await axios.get(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }
        });
        const $ = cheerio.load(data);
        const metas = [];

        $("article, .post-item, .blog-item").each((_, el) => {
            const title = $(el).find("h2, .entry-title").text().trim();
            const link = $(el).find("a").attr("href");
            const poster = $(el).find("img").attr("src") || $(el).find("img").attr("data-src");

            if (title && link) {
                const encodedId = "vega:" + Buffer.from(link).toString("base64");
                metas.push({
                    id: encodedId,
                    type: type,
                    name: title,
                    poster: poster || ""
                });
            }
        });
        return { metas };
    } catch (err) {
        return { metas: [] };
    }
});

builder.defineMetaHandler(async ({ type, id }) => {
    try {
        const targetUrl = Buffer.from(id.replace("vega:", ""), "base64").toString("ascii");
        const { data } = await axios.get(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }
        });
        const $ = cheerio.load(data);
        const title = $("h1.entry-title, h1").first().text().trim();
        const poster = $(".entry-content img").first().attr("src");

        return {
            meta: {
                id: id,
                type: type,
                name: title || "Vega Video",
                poster: poster || ""
            }
        };
    } catch (err) {
        return { meta: { id, type, name: "Vega Video" } };
    }
});

builder.defineStreamHandler(async ({ id }) => {
    try {
        const targetUrl = Buffer.from(id.replace("vega:", ""), "base64").toString("ascii");
        const { data } = await axios.get(targetUrl, {
            headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" }
        });
        const $ = cheerio.load(data);
        const streams = [];

        $("a").each((_, el) => {
            const href = $(el).attr("href");
            const text = $(el).text().trim();
            if (href && (href.includes("fastdl") || href.includes("hubcloud") || href.includes("drive") || href.includes("download"))) {
                streams.push({
                    title: text || "Vega Direct Stream",
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
