// `/` — the For You home. (Vite→Next migration, Phase 5; SEO in Phase 7.)
import { HomeRoute } from "../src/routes/HomeRoute.jsx";

// Home keeps the layout's default (longer) title; it only declares its own
// canonical so it isn't left without one.
export const metadata = { alternates: { canonical: "/" } };

export default function Page() {
  return <HomeRoute />;
}
