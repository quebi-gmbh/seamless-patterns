import type { Route } from "./+types/privacy";

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Privacy Policy | quebi GmbH" },
    { name: "description", content: "Privacy Policy for quebi GmbH." },
    // Open Graph
    { property: "og:title", content: "Privacy Policy | quebi GmbH" },
    { property: "og:description", content: "Privacy Policy for quebi GmbH." },
    {
      property: "og:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
    { property: "og:image:width", content: "512" },
    { property: "og:image:height", content: "512" },
    { property: "og:type", content: "website" },
    { property: "og:url", content: "https://quebi.de/privacy" },
    { property: "og:site_name", content: "quebi GmbH" },
    // Twitter Card
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Privacy Policy | quebi GmbH" },
    { name: "twitter:description", content: "Privacy Policy for quebi GmbH." },
    {
      name: "twitter:image",
      content: "https://quebi.de/favicon-transparent-512x512.png",
    },
  ];
};

export default function Privacy() {
  return (
    <div className="text-gray-300">
      <h1 className="mb-8 text-3xl font-bold text-white">Privacy Policy</h1>

      <section className="space-y-6">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            1. Data Controller
          </h2>
          <p>
            The data controller responsible for processing your personal data is
            quebi GmbH, Geitau 22, 83735 Bayrischzell, Germany.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            2. Data We Collect
          </h2>
          <p>
            We may collect and process the following data: contact information
            (name, email, phone), technical data (IP address, browser type), and
            any information you provide when contacting us.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            3. Purpose of Processing
          </h2>
          <p>
            We process your personal data to provide our services, respond to
            inquiries, improve our website, and comply with legal obligations.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            4. Legal Basis
          </h2>
          <p>
            We process your data based on: your consent (Art. 6(1)(a) GDPR),
            contract performance (Art. 6(1)(b) GDPR), legal obligations (Art.
            6(1)(c) GDPR), or legitimate interests (Art. 6(1)(f) GDPR).
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            5. Data Retention
          </h2>
          <p>
            We retain personal data only as long as necessary for the purposes
            for which it was collected or as required by law.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">
            6. Your Rights
          </h2>
          <p>
            You have the right to access, rectify, erase, restrict processing,
            data portability, and object to processing of your personal data.
            You may also withdraw consent at any time.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">7. Cookies</h2>
          <p>
            Our website may use cookies to enhance your experience. You can
            control cookie settings through your browser.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">8. Contact</h2>
          <p>
            For privacy-related inquiries, please contact us at hi@quebi.de.
          </p>
        </div>
      </section>
    </div>
  );
}
