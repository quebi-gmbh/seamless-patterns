import type { Route } from "./+types/imprint";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Imprint | quebi GmbH" },
    {
      name: "description",
      content: "Legal information and imprint for quebi GmbH.",
    },
    // Open Graph
    { property: "og:title", content: "Imprint | quebi GmbH" },
    {
      property: "og:description",
      content: "Legal information and imprint for quebi GmbH.",
    },
    {
      property: "og:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
    { property: "og:image:width", content: "512" },
    { property: "og:image:height", content: "512" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://quebi.de/imprint" },
    { property: "og:site_name", content: "quebi GmbH" },
    // Twitter Card
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Imprint | quebi GmbH" },
    {
      name: "twitter:description",
      content: "Legal information and imprint for quebi GmbH.",
    },
    {
      name: "twitter:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
  ];
};

export default function Imprint() {
  return (
    <div className="text-gray-300">
      <h1 className="mb-8 text-3xl font-bold text-white">Imprint</h1>

      <section className="space-y-6">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Company Information
          </h2>
          <p>quebi GmbH</p>
          <p>Geitau 22</p>
          <p>83735 Bayrischzell</p>
          <p>Germany</p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">Contact</h2>
          <p>Email: hi@quebi.de</p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Registration
          </h2>
          <p>Commercial Register: Amtsgericht München</p>
          <p>Registration Number: HRB 306511</p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            Managing Directors
          </h2>
          <p>Max Schurig, Florian Pirchmoser</p>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">VAT ID</h2>
          <p>USt-Nr.: DE458354616</p>
        </div>
      </section>
    </div>
  );
}
