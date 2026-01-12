const path = require("path");
const cheerio = require("cheerio");
const express = require("express");

const playUrlRe = /plyURL\s*=\s*["']([^"']+)["']/;

function customEncodeUri(string) {
    return btoa(unescape(encodeURIComponent(string)))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

async function genHash(string, location) {
    const o = (new TextEncoder).encode(location),
        i = await crypto.subtle.digest("SHA-256", o),
        n = crypto.getRandomValues(new Uint8Array(12)),
        a = Array.from(n).map(e => String.fromCharCode(e)).join(""),
        s = {
            name: "AES-GCM",
            iv: n
        },
        r = await crypto.subtle.importKey("raw", i, s, !1, ["encrypt"]),
        c = (new TextEncoder).encode(string),
        l = await crypto.subtle.encrypt(s, r, c),
        d = Array.from(new Uint8Array(l)),
        u = d.map(e => String.fromCharCode(e)).join("");

    return btoa(a + u)
}

const app = express();
const port = process.env.PORT || 8080;

app.use(express.static("public"));
// app.set("view engine", "ejs");

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "pages/index.html"));
});

app.get("/api/info", (req, res) => {
    const url = req.query.url;
    
    fetch(url).then(res => res.text()).then(body => {
        const episodes = [];
        const servers = [];

        const $ = cheerio.load(body);

        $("#eps-list").find("button").each((i, btn) => {
            episodes.push(parseInt($(btn).attr("id").replace("ep-", "")));
        });
        $("#srv-list").find("button").each((i, btn) => {
            servers.push(parseInt($(btn).attr("id").replace("srv-", "")));
        });

        episodes.sort((a, b) => a - b);

        res.json(JSON.stringify({
            title: $("head > title").text().replace("in 1080p on Soap2day", "").replace("Watch", "").trim(),
            episodes,
            servers
        }))
    }).catch(() => {
        res.json(JSON.stringify({
            error: "Error while loading page 1."
        }));
    });
});

app.get("/api/iframe", (req, res) => {
    const url = req.query.url;
    const server = req.query.server;
    const ep = req.query.ep;

    fetch(url).then(res => res.text()).then(async body => {
        const matches = body.match(playUrlRe);

        if (matches) {
            const $ = cheerio.load(body);

            const playUrl = atob(matches[1]);
            const mid = parseInt($("#mid").attr("data-mid"));
            const location = "IN";

            const time = Math.floor((new Date).getTime() / 1e3);
            const string = `${mid}+${ep}+${server}+${location}+${time}`;
            const hash = await genHash(string, location);

            const iframeUrl = `${playUrl}/watch/?v${server}${ep}#${customEncodeUri(hash)}`;

            res.json(JSON.stringify({
                iframeUrl
            }));
        } else {
            res.json(JSON.stringify({
                error: "Error while loading page 2."
            }));
        }
    }).catch(e => {
        console.log("Error:", e);
        res.json(JSON.stringify({
            error: "Error while loading page 1."
        }));
    });
});

app.listen(port, () => {
    console.log(`Server running at port ${port}.`);
});