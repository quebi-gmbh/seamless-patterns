export function Footer({ className }: { className?: string }) {
  return (
    <footer className={`z-10 py-6 ${className ?? ""}`}>
      <nav className="flex items-center justify-center gap-6 text-sm text-gray-500">
        <a
          href="/imprint"
          className="footer-link transition-colors hover:text-emerald-400"
        >
          Imprint
        </a>
        <span className="text-gray-700">·</span>
        <a
          href="/terms"
          className="footer-link transition-colors hover:text-emerald-400"
        >
          Terms
        </a>
        <span className="text-gray-700">·</span>
        <a
          href="/privacy"
          className="footer-link transition-colors hover:text-emerald-400"
        >
          Privacy
        </a>
      </nav>
    </footer>
  );
}
