import {
  index,
  layout,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  layout("components/page-layout.tsx", [
    route("imprint", "routes/imprint.tsx"),
    route("terms", "routes/terms.tsx"),
    route("privacy", "routes/privacy.tsx"),
    route("sitemap.xml", "routes/sitemap.tsx"),
    route("robots.txt", "routes/robots.tsx"),
  ]),
] satisfies RouteConfig;
