import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { cache } from "hono/cache";
import sharp from "sharp";

const app = new Hono();

app.get("/", async (ctx) => {
  const url = ctx.req.query("u");
  if (!url) {
    console.error("missing query param 'u'");
    throw new HTTPException(400);
  }

  const remoteResp = await fetch(url);
  if (!remoteResp.ok) {
    console.log(
      `failed to fetch from remote (url: ${url}): ${remoteResp.status}`,
    );
    throw new HTTPException(400);
  }

  try {
    const srcBuf = await remoteResp.arrayBuffer();
    const resized = await sharp(srcBuf).resize({ width: 256, fit: "contain" })
      .webp()
      .toBuffer();
    return ctx.body(resized);
  } catch (err) {
    console.error(`failed to resize image: ${err}`);
    throw new HTTPException(500);
  }
});

app.get("*", cors({ origin: "*", allowMethods: ["GET"] }));
app.get("*", cache({ cacheName: "cache" }));

Deno.serve(app.fetch);
