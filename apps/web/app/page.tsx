"use client";

import { Tower } from "@/components/Tower";
import { AuthProvider } from "@/lib/auth";

export default function Home() {
  return (
    <main className="fixed inset-0">
      <AuthProvider>
        <Tower />
      </AuthProvider>
    </main>
  );
}
