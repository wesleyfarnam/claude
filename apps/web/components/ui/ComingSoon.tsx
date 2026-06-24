export function ComingSoon({
  eyebrow,
  title,
  milestone,
  body,
}: {
  eyebrow: string;
  title: string;
  milestone: string;
  body: string;
}) {
  return (
    <div className="p-8">
      <header className="mb-8">
        <p className="font-heading text-h5 uppercase tracking-[1px] text-maroon">{eyebrow}</p>
        <h1 className="mt-1 text-h3 font-black text-paua">{title}</h1>
      </header>
      <div className="rounded-lg bg-white p-8 shadow-sm">
        <span className="inline-block rounded-full bg-aqua/20 px-3 py-1 font-heading text-sm uppercase tracking-wide text-paua">
          Planned for {milestone}
        </span>
        <p className="mt-4 max-w-2xl text-body text-ink/70">{body}</p>
      </div>
    </div>
  );
}
