import { Logo } from "@/components/brand/Logo";
import { loginAction } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-athens px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <Logo className="text-4xl" />
          <p className="mt-2 font-heading text-h5 uppercase tracking-[1px] text-ink/60">
            Sign in to your dashboard
          </p>
        </div>
        {error ? (
          <div className="mb-4 rounded border border-maroon/40 bg-maroon/5 px-4 py-3 text-sm text-maroon">
            {error}
          </div>
        ) : null}
        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/dashboard"} />
          <label className="block">
            <span className="block text-sm font-black uppercase tracking-wide text-paua">Email</span>
            <input name="email" type="email" required autoComplete="email"
              className="mt-1 w-full rounded border border-ink/10 px-4 py-3 text-body focus:border-sapphire focus:outline-none" />
          </label>
          <label className="block">
            <span className="block text-sm font-black uppercase tracking-wide text-paua">Password</span>
            <input name="password" type="password" required autoComplete="current-password"
              className="mt-1 w-full rounded border border-ink/10 px-4 py-3 text-body focus:border-sapphire focus:outline-none" />
          </label>
          <button type="submit"
            className="w-full rounded bg-sapphire py-3 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua">
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          No account yet?{" "}
          <a href="/signup" className="font-black text-sapphire hover:underline">Request access</a>
        </p>
      </div>
    </main>
  );
}
