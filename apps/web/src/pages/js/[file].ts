import type { APIRoute } from "astro";
import { PUBLISHED_MODULES } from "../../lib/published-modules";

export const getStaticPaths = () => Object.keys(PUBLISHED_MODULES).map((file) => ({ params: { file } }));

export const GET: APIRoute = ({ params }) =>
  new Response(PUBLISHED_MODULES[String(params.file)], {
    headers: { "Content-Type": "text/javascript; charset=utf-8" },
  });
