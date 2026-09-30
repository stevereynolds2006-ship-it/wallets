import { createFileRoute } from "@tanstack/react-router";
import { WalletsApp } from "@/components/wallets-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <WalletsApp />;
}
