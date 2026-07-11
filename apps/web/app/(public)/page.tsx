import Link from "next/link";

export default function PublicPage() {
  return (
    <main>
      <h1>Application workspace</h1>
      <p>Public entry point for your next product.</p>
      <Link href="/dashboard">Open dashboard</Link>
    </main>
  );
}
