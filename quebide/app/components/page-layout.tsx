import { Outlet } from "react-router";

import { Background } from "./background";
import { Footer } from "./footer";
import { Header } from "./header";

export default function PageLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#030712]">
      <Background />
      <Header />

      {/* Main content with card */}
      <main className="relative z-10 flex-1 px-6 pb-20">
        <div className="mx-auto max-w-2xl rounded-xl border border-cyan-500/20 p-8">
          <Outlet />
        </div>
      </main>

      <Footer className="relative" />
    </div>
  );
}
