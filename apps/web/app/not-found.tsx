import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fixed inset-0 grid place-items-center p-6 text-center">
      <div className="paper rounded-2xl p-8">
        <h1 className="font-serif text-2xl">This floor does not exist.</h1>
        <p className="mt-2 text-[var(--ink-2)]">The lift only goes to five.</p>
        <Link href="/" className="mt-4 inline-block rounded-full bg-[var(--sun)] px-5 py-2.5 font-semibold text-white">
          Back to the campus
        </Link>
      </div>
    </main>
  );
}
