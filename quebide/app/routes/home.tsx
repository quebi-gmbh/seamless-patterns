import { Background } from "~/components/background";
import { Footer } from "~/components/footer";
import { Header } from "~/components/header";

import type { Route } from "./+types/home";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "quebi GmbH" },
    {
      name: "description",
      content: "We build and ship software. Stay tuned for our next projects.",
    },
    // Open Graph
    { property: "og:title", content: "quebi GmbH" },
    {
      property: "og:description",
      content: "We build and ship software. Stay tuned for our next projects.",
    },
    {
      property: "og:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
    { property: "og:image:width", content: "512" },
    { property: "og:image:height", content: "512" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://quebi.de" },
    { property: "og:site_name", content: "quebi GmbH" },
    { property: "og:locale", content: "en_US" },
    // Twitter Card
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "quebi GmbH" },
    {
      name: "twitter:description",
      content: "We build and ship software. Stay tuned for our next projects.",
    },
    {
      name: "twitter:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
  ];
};

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#030712]">
      <Background />
      <Header absolute />

      {/* Main content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 text-center">
        {/* Pulsing rings behind text */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 sm:h-[500px] sm:w-[500px] md:h-[600px] md:w-[600px]">
          <div className="pulse-ring" />
          <div className="pulse-ring" />
          <div className="pulse-ring" />
          <div className="pulse-ring" />
        </div>

        <div>
          {/* Hero text with glow */}
          <div className="reveal-animation relative inline-block overflow-visible p-8">
            <div className="hero-glow" />
            <h1 className="hero-text text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl">
              We build software
            </h1>
          </div>

          {/* Animated underline */}
          <div
            className="separator-line mx-auto mt-10 h-px w-32 sm:w-48 md:w-64"
            style={{
              maskImage:
                "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
              WebkitMaskImage:
                "linear-gradient(90deg, transparent, black 20%, black 80%, transparent)",
            }}
          />

          {/* Subtle tagline */}
          <p
            className="mt-6 text-sm tracking-[0.3em] text-gray-500 uppercase"
            style={{
              animation: "reveal-text 2s ease-out 0.5s forwards",
              opacity: 0,
            }}
          >
            Shipping ideas into reality
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
