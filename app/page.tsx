import { readFile } from "node:fs/promises";
import path from "node:path";
import Script from "next/script";

async function getPrototypeMarkup() {
  const prototypePath = path.join(process.cwd(), "prototype", "index.html");
  const html = await readFile(prototypePath, "utf8");
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1];

  if (!body) {
    throw new Error("The SafeGo prototype does not contain a valid body element.");
  }

  return body.replace(/<script[\s\S]*?<\/script>/gi, "");
}

export default async function Home() {
  const markup = await getPrototypeMarkup();

  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: markup }} />
      <Script src="/safego.js" strategy="afterInteractive" />
    </>
  );
}
