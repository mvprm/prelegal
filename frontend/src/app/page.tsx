import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight">Prelegal</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        A platform for drafting common legal agreements.
      </p>
      <Link
        href="/nda"
        className="self-start rounded-md bg-blue-600 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        Create a Mutual NDA
      </Link>
    </main>
  );
}
