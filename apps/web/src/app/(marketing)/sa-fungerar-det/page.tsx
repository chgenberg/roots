import { pageMetadata } from "@/lib/seo";
import { SaFungerarDetClient } from "./sa-fungerar-det-client";

export const metadata = pageMetadata({
  title: "Så fungerar det",
  description:
    "Se hur Roots fungerar för föreningar i tre enkla steg — och räkna ut vad försäljningen kan ge er förening. Inga pärmar, inga kontanter.",
  path: "/sa-fungerar-det",
});

export default function SaFungerarDetPage() {
  return <SaFungerarDetClient />;
}
