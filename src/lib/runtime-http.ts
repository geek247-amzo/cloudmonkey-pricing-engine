import dns from "node:dns";
import http from "node:http";
import https from "node:https";

type FetchLikeInit = {
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
  signal?: AbortSignal | null;
  timeoutMs?: number;
};

function forceIpv4Lookup(
  hostname: string,
  options: dns.LookupOneOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string, family: number) => void,
) {
  return dns.lookup(hostname, { ...options, family: 4 }, callback);
}

function headersToObject(headers: HeadersInit | undefined): Record<string, string> {
  const normalized = new Headers(headers);
  const result: Record<string, string> = {};
  for (const [key, value] of normalized.entries()) {
    result[key] = value;
  }
  return result;
}

function responseHeaders(rawHeaders: http.IncomingHttpHeaders) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(rawHeaders)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

async function bodyToBuffer(body: BodyInit | null | undefined) {
  if (body == null) return null;
  if (typeof body === "string") return Buffer.from(body);
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  if (body instanceof FormData) {
    throw new Error("FormData is not supported by fetchIpv4");
  }
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  throw new Error(`Unsupported request body type: ${typeof body}`);
}

export async function fetchIpv4(input: string | URL, init: FetchLikeInit = {}) {
  const url = input instanceof URL ? input : new URL(input);
  const protocol = url.protocol === "https:" ? https : http;
  const body = await bodyToBuffer(init.body);
  const headers = headersToObject(init.headers);
  if (body && headers["content-length"] == null) {
    headers["content-length"] = String(body.length);
  }

  const timeoutMs = init.timeoutMs ?? 15_000;

  return await new Promise<Response>((resolve, reject) => {
    const request = protocol.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname}${url.search}`,
        method: init.method ?? "GET",
        headers,
        lookup: forceIpv4Lookup,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) =>
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)),
        );
        response.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 500,
              headers: responseHeaders(response.headers),
            }),
          );
        });
        response.on("error", reject);
      },
    );

    const timer = setTimeout(() => {
      request.destroy(new Error(`IPv4 fetch timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    if (init.signal) {
      if (init.signal.aborted) {
        request.destroy(new Error("IPv4 fetch aborted"));
      } else {
        init.signal.addEventListener(
          "abort",
          () => request.destroy(new Error("IPv4 fetch aborted")),
          { once: true },
        );
      }
    }

    request.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    request.on("close", () => clearTimeout(timer));

    if (body) request.write(body);
    request.end();
  });
}
