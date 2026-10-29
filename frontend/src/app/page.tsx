import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-brand-navy">Prelegal</h1>
      <p className="text-lg text-brand-gray">
        A platform for drafting common legal agreements.
      </p>
      <Link
        href="/draft"
        className="self-start rounded-md bg-brand-blue px-4 py-2 font-semibold text-white shadow-sm hover:bg-brand-blue/90"
      >
        Draft an agreement
      </Link>
      <p className="text-sm text-brand-gray">
        <Link href="/signin" className="font-medium text-brand-blue hover:underline">
          Sign in
        </Link>{" "}
        or{" "}
        <Link href="/signup" className="font-medium text-brand-blue hover:underline">
          create an account
        </Link>
      </p>
    </main>
  );
}
