import { Logo } from "@/components/brand/Logo";
import { signupAction } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-athens px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <Logo className="text-4xl" />
          <p className="mt-2 font-heading text-h5 uppercase tracking-[1px] text-ink/60">
            Create your account
          </p>
        </div>
        {error ? (
          <div className="mb-4 rounded border border-maroon/40 bg-maroon/5 px-4 py-3 text-sm text-maroon">
            {error}
          </div>
        ) : null}
        <form action={signupAction} className="space-y-4">
          <Field name="name" label="Name" type="text" />
          <Field name="email" label="Email" type="email" autoComplete="email" />
          <Field name="password" label="Password" type="password" autoComplete="new-password" minLength={8} />
          <Field name="org_name" label="Organization name" type="text" placeholder="Acme Retail" />
          <button type="submit"
            className="w-full rounded bg-sapphire py-3 font-heading text-btn uppercase tracking-[1px] text-white transition hover:bg-paua">
            Create account
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/60">
          Already have an account?{" "}
          <a href="/login" className="font-black text-sapphire hover:underline">Sign in</a>
        </p>
      </div>
    </main>
  );
}

function Field({
  name, label, type, autoComplete, placeholder, minLength,
}: {
  name: string; label: string; type: string;
  autoComplete?: string; placeholder?: string; minLength?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-black uppercase tracking-wide text-paua">{label}</span>
      <input name={name} type={type} required autoComplete={autoComplete} placeholder={placeholder} minLength={minLength}
        className="mt-1 w-full rounded border border-ink/10 px-4 py-3 focus:border-sapphire focus:outline-none" />
    </label>
  );
}
