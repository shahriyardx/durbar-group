import { CRITERIA, CRITERIA_INTRO, CRITERIA_TITLE } from "@/lib/criteria";
import { cn } from "@/lib/utils";

/**
 * The criteria, rendered the same way everywhere they appear. Students read
 * this on their dashboard and again on the elimination page, where it is the
 * context for why they are looking at that page at all.
 */
export function CriteriaList({ className }: { className?: string }) {
  return (
    <section lang="bn" className={cn("space-y-5", className)}>
      <div>
        <h2 className="font-bangla text-2xl font-bold">{CRITERIA_TITLE}</h2>
        <p className="font-bangla text-muted-foreground mt-3 max-w-3xl text-sm leading-loose">
          {CRITERIA_INTRO}
        </p>
      </div>

      <ol className="border-border/70 bg-card/40 divide-border/60 divide-y overflow-hidden rounded-2xl border">
        {CRITERIA.map((criterion) => (
          <li key={criterion.number} className="flex gap-5 p-6">
            <span
              aria-hidden
              className="text-brand-gradient font-bangla shrink-0 text-xl font-bold"
            >
              {criterion.number}
            </span>
            <div className="min-w-0">
              <h3 className="font-bangla text-base font-semibold">
                {criterion.title}
              </h3>
              <ul className="mt-3 space-y-2">
                {criterion.points.map((point) => (
                  <li
                    key={point}
                    className="font-bangla text-muted-foreground flex gap-3 text-sm leading-loose"
                  >
                    <span aria-hidden className="shrink-0">
                      ⇒
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
