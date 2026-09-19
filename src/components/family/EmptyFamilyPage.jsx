export default function EmptyFamilyPage({ icon: Icon, title, body }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-5 text-teal" aria-hidden="true" /> : null}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-slate-600">{body}</p>
    </section>
  );
}
