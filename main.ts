import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { cors } from "@hono/hono/cors";
import { cache } from "@hono/hono/cache";
import {
  ImageMagick,
  IMagickImage,
  initialize,
  MagickFormat,
} from "imagemagick";
import { logger } from "./logger.ts";

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

app.use(logger());
app.use(cors({ origin: "*", allowMethods: ["GET"] }));
app.use(
  cache({ cacheName: "cache", wait: true, cacheControl: "public, max-age=60" }),
);

app.get("/", async (ctx) => {
  const url = ctx.req.query("u");
  if (!url) {
    console.error("missing query param 'u'");
    throw new HTTPException(400);
  }
  console.log("fetching image from remote:", url);
  const remoteResp = await fetch(url);
  if (!remoteResp.ok) {
    console.error(
      `failed to fetch from remote (url: ${url}): ${remoteResp.status}`,
    );
    throw new HTTPException(400);
  }
  const remoteMime = remoteResp.headers.get("Content-Type");
  if (remoteMime !== null && !remoteMime.startsWith("image")) {
    console.error(`not an image (${remoteMime}):`, url);
    throw new HTTPException(400);
  }

  try {
    console.log("resizing & reformatting image:", url);
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
    ctx.header("Content-Type", "image/webp");
    return ctx.body(resized);
  } catch (err) {
    console.error(`failed to resize image: ${err}`);
    throw new HTTPException(500);
  }
});

Deno.serve(app.fetch);
