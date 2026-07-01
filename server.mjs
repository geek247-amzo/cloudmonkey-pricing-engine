import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import server from "./dist/server/server.js";

const port = Number(process.env.PORT || 3000);
const appRoot = fileURLToPath(new URL(".", import.meta.url));
const clientRoot = join(appRoot, "dist", "client");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function createRequest(req) {
  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${port}`;
  const url = new URL(req.url || "/", `${protocol}://${host}`);
  const method = req.method || "GET";
  const hasBody = !["GET", "HEAD"].includes(method);

  return new Request(url, {
    method,
    headers: req.headers,
    body: hasBody ? req : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function sendResponse(res, response) {
  res.statusCode = response.status;
  res.statusMessage = response.statusText;

  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [];

  response.headers.forEach((value, key) => {
    if (key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });

  if (setCookies.length) {
    res.setHeader("set-cookie", setCookies);
  }

  if (!response.body) {
    res.end();
    return;
  }

  Readable.fromWeb(response.body).pipe(res);
}

async function tryServeStatic(req, res) {
  const url = new URL(req.url || "/", "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith("/assets/")) return false;

  const filePath = normalize(join(clientRoot, pathname));
  const relativePath = relative(clientRoot, filePath);
  if (relativePath.startsWith("..") || relativePath === "" || relativePath.includes("..")) {
    res.statusCode = 404;
    res.end("Not Found");
    return true;
  }

  let fileStat;
  try {
    fileStat = await stat(filePath);
  } catch {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  if (!fileStat.isFile()) {
    res.statusCode = 404;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Not Found");
    return true;
  }

  res.statusCode = 200;
  res.setHeader("content-type", mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream");
  res.setHeader("content-length", fileStat.size);
  res.setHeader("cache-control", "public, max-age=31536000, immutable");
  createReadStream(filePath).pipe(res);
  return true;
}

createServer(async (req, res) => {
  try {
    if (await tryServeStatic(req, res)) return;

    const request = createRequest(req);
    const response = await server.fetch(request, process.env, {});
    await sendResponse(res, response);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`CloudMonkey frontend listening on ${port}`);
});
