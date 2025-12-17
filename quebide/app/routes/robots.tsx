import { generateRobotsTxt } from "@forge42/seo-tools/robots";
import type { Route } from "./+types/robots";

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const robotsTxt = generateRobotsTxt([
    {
      userAgent: "*",
      allow: ["/"],
      crawlDelay: 1,
      sitemap: [`${url.protocol}://${url.host}/sitemap.xml`],
    },
  ]);

  return new Response(robotsTxt, {
    headers: {
      "content-type": "text/plain",
    },
  });
}
