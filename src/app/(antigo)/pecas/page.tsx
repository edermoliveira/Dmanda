import type { Metadata } from "next";
import { Vitrine } from "./Vitrine";

export const metadata: Metadata = { title: "Peças | Dmanda" };

export default function Pecas() {
  return <Vitrine />;
}
