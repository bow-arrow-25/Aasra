export default function EmptyFamilyPage({ icon: Icon, title, body }) {
  return (
    <section className="flux-card p-5">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-5 text-teal" aria-hidden="true" /> : null}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-slate-600">{body}</p>
    </section>
  );
}
