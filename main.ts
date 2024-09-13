import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cors } from "hono/cors";
import { cache } from "hono/cache";
import { logger } from "hono/logger";
import {
  ImageMagick,
  IMagickImage,
  initialize,
  MagickFormat,
} from "https://deno.land/x/imagemagick_deno@0.0.27/mod.ts";

const PICTURE_MAX_SIZE = 256;
function shouldResize(w: number, h: number): boolean {
  return w > PICTURE_MAX_SIZE || h > PICTURE_MAX_SIZE;
}

function fitPicture(w: number, h: number): { w: number; h: number } {
  if (w > h) {
    const newW = PICTURE_MAX_SIZE;
    const newH = Math.floor(h * (newW / w));
    return { w: newW, h: newH };
  } else {
    const newH = PICTURE_MAX_SIZE;
    const newW = Math.floor(w * (newH / h));
    return { w: newW, h: newH };
  }
}

// initialize ImageMagick
await initialize();

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
    const src = new Uint8Array(await remoteResp.arrayBuffer());
    const resized = await new Promise<Uint8Array>((resolve) => {
      ImageMagick.read(src, (img: IMagickImage) => {
        if (shouldResize(img.width, img.height)) {
          const { w, h } = fitPicture(img.width, img.height);
          img.resize(w, h);
        }
        img.write(MagickFormat.Webp, (data: Uint8Array) => resolve(data));
      });
    });
    return ctx.body(resized);
  } catch (err) {
    console.error(`failed to resize image: ${err}`);
    throw new HTTPException(500);
  }
});

app.use(logger());
app.get("*", cors({ origin: "*", allowMethods: ["GET"] }));
app.get("*", cache({ cacheName: "cache" }));

Deno.serve(app.fetch);
