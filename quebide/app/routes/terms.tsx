import type { Route } from "./+types/terms";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Terms of Service | quebi GmbH" },
    { name: "description", content: "Terms of Service for quebi GmbH." },
    // Open Graph
    { property: "og:title", content: "Terms of Service | quebi GmbH" },
    { property: "og:description", content: "Terms of Service for quebi GmbH." },
    {
      property: "og:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
    { property: "og:image:width", content: "512" },
    { property: "og:image:height", content: "512" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://quebi.de/terms" },
    { property: "og:site_name", content: "quebi GmbH" },
    // Twitter Card
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Terms of Service | quebi GmbH" },
    {
      name: "twitter:description",
      content: "Terms of Service for quebi GmbH.",
    },
    {
      name: "twitter:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
  ];
};

export default function Terms() {
  return (
    <div className="text-gray-300">
      <h1 className="mb-8 text-3xl font-bold text-white">Terms of Service</h1>

      <section className="space-y-6">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">1. General</h2>
          <p>
            These Terms of Service govern your use of the services provided by
            quebi GmbH. By accessing or using our services, you agree to be
            bound by these terms.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">2. Services</h2>
          <p>
            quebi GmbH provides software development and related services. The
            specific scope of services will be defined in individual agreements
            with clients.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            3. Intellectual Property
          </h2>
          <p>
            All intellectual property rights in our services and any content
            created by quebi GmbH remain our property unless otherwise agreed in
            writing.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            4. Limitation of Liability
          </h2>
          <p>
            To the fullest extent permitted by law, quebi GmbH shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages arising out of or related to your use of our
            services.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            5. Governing Law
          </h2>
          <p>
            These terms shall be governed by and construed in accordance with
            the laws of Germany.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            6. Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these terms at any time. Changes will
            be effective immediately upon posting to our website.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">7. Contact</h2>
          <p>
            For questions about these Terms of Service, please contact us at
            hi@quebi.de.
          </p>
        </div>
      </section>
    </div>
  );
}
