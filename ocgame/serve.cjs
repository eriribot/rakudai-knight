const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = __dirname;
const port = Number(process.env.OCGAME_PORT || 4178);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};
http
  .createServer((req, res) => {
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405, { Allow: "GET, HEAD" });
        res.end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      const file = path.resolve(
        root,
        "." + (pathname === "/" ? "/index.html" : pathname),
      );
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.stat(file, (error, stat) => {
        if (error || !stat.isFile()) {
          res.writeHead(404);
          res.end();
          return;
        }
        const headers = {
          "Content-Type":
            mime[path.extname(file)] || "application/octet-stream",
          "Cache-Control": "no-cache",
          "Content-Length": stat.size,
        };
        if (req.method === "HEAD") {
          res.writeHead(200, headers);
          res.end();
          return;
        }
        const stream = fs.createReadStream(file);
        stream.once("open", () => {
          res.writeHead(200, headers);
          stream.pipe(res);
        });
        stream.once("error", () => {
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
        res.once("close", () => stream.destroy());
      });
    } catch {
      res.writeHead(400);
      res.end();
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log("OCgame ready: http://127.0.0.1:" + port),
  );
