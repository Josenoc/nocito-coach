"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "public");
const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

http.createServer(function (req, res) {
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch (e) {
    res.writeHead(400);
    res.end("Bad request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!(filePath + path.sep).startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      if (urlPath.endsWith("/") && fs.existsSync(path.join(filePath, "index.html"))) {
        return fs.createReadStream(path.join(filePath, "index.html")).pipe(res);
      }
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 - no encontrado: " + urlPath);
      return;
    }
    res.writeHead(200, {
      "Content-Type": TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(filePath).pipe(res);
  });
}).listen(PORT, function () {
  console.log("Servidor local en http://localhost:" + PORT);
});