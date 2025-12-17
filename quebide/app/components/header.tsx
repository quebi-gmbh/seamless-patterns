import { Link } from "react-router";

interface HeaderProps {
  absolute?: boolean;
}

export function Header({ absolute = false }: HeaderProps) {
  return (
    <header
      className={`${absolute ? "absolute top-0 left-0 right-0" : "relative"} z-20 flex justify-center p-8`}
    >
      <Link to="/">
        <img
          src="/quebi-logo-transparent.png"
          alt="quebi"
          className="h-16 w-auto transition-opacity hover:opacity-80"
        />
      </Link>
    </header>
  );
}
