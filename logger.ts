import { MiddlewareHandler } from "@hono/hono/types";
import { getPath, getQueryParam } from "@hono/hono/utils/url";
import { log,  } from "node:console";

enum LogPrefix {
  Outgoing = '-->',
  Incoming = '<--',
  Error = 'xxx',
}

const humanize = (times: string[]) => {
  const [delimiter, separator] = [',', '.']

  const orderTimes = times.map((v) => v.replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + delimiter))

  return orderTimes.join(separator)
}

const time = (start: number) => {
  const delta = Date.now() - start
  return humanize([delta < 1000 ? delta + 'ms' : Math.round(delta / 1000) + 's'])
}

export const logger = (
  fn: (str: string, ...rest: string[]) => void = console.log,
): MiddlewareHandler => {
  return async function logger(c, next) {
    const { method } = c.req;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const path = getPath(c.req.raw);
    const targetUrl = getQueryParam(c.req.url, "u");

    log(fn, LogPrefix.Incoming, method, path, targetUrl);

    const start = Date.now();

    await next();

    log(fn, LogPrefix.Outgoing, method, path, c.res.status, time(start));
  };
};
