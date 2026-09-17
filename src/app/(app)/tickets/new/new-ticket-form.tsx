"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ListChecks, X } from "lucide-react";
import { createTicket } from "@/lib/actions/tickets";
import { searchCiItems, type CiCandidate } from "@/lib/actions/cmdb";
import { CiGlyph } from "@/components/cmdb/ci-glyph";
import {
  AttachButton,
  AttachChips,
  AttachmentsProvider,
  DropZone,
} from "@/components/tickets/file-picker";
import { TogglePicker } from "@/components/toggle-picker";
import {
  PRIORITY_META,
  PRIORITY_ORDER,
  TYPE_ORDER,
  hasResponseTarget,
  projectedDeadline,
} from "@/lib/tickets";
import { useClock, useDateFormat, useMessages } from "@/components/shell/instance-context";
import {
  Button,
  buttonClass,
  Card,
  Field,
  FieldError,
  FormError,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type Tag = { id: string; name: string; color: string };

function Submit() {
  const { pending } = useFormStatus();
  const t = useMessages();
  return (
    <Button type="submit" size="lg" disabled={pending}>
      {pending ? t.newTicket.creating : t.newTicket.create}
    </Button>
  );
}

export function NewTicketForm({
  projects,
  milestones,
  agents,
  requesters,
  tags,
  viewerId,
  canTriage,
  canPickAssets,
  onAsset,
  parent,
  defaults,
  plans,
}: {
  projects: { id: string; key: string; name: string }[];
  milestones: { id: string; projectId: string; title: string }[];
  agents: { id: string; name: string }[];
  requesters: { id: string; name: string; role: string }[];
  tags: Tag[];
  viewerId: string;
  /// Whether this person may name the assets a ticket is about. The register
  /// is not something every requester has, and a picker they cannot search is
  /// worse than no picker.
  canPickAssets: boolean;
  /// The asset this ticket is being raised against, when Raise on an item page
  /// sent somebody here. Null on every other visit — and dropped entirely for
  /// anyone who may not name assets, because a hidden field they cannot see is
  /// not something they agreed to.
  onAsset: CiCandidate | null;
  canTriage: boolean;
  /// The ticket this one is being raised under, when the Links card sent
  /// somebody here. Null on every other visit to this page.
  parent: {
    id: string;
    number: number;
    reference: string;
    title: string;
    reporterId: string;
  } | null;
  defaults: { type: string; priority: string; projectId: string | null };
  plans: { id: string; name: string; description: string | null; steps: number }[];
}) {
  const clock = useClock();
  const targets = clock.targets;
  const t = useMessages();
  const dueFormat = useDateFormat({ dateStyle: "full", timeStyle: "short" });
  const [state, formAction] = useActionState(createTicket, undefined);
  const [priority, setPriority] = useState(defaults.priority);
  const [type, setType] = useState(defaults.type);
  const [planId, setPlanId] = useState("");
  const [picking, setPicking] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [assets, setAssets] = useState<CiCandidate[]>(onAsset ? [onAsset] : []);
  const [projectId, setProjectId] = useState(defaults.projectId ?? "");
  const [milestoneId, setMilestoneId] = useState("");

  // Only the chosen project's, and nothing at all when it has none: a picker
  // with one empty option is a question nobody can answer.
  const forProject = milestones.filter((row) => row.projectId === projectId);
  const errors = state?.errors ?? {};

  function toggleTag(id: string) {
    setTagIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  return (
    // One card, three columns: what happened, how it should be handled, and who
    // it involves. The old two-column split left the right half mostly empty.
    <form action={formAction} className="mx-auto max-w-6xl">
      <AttachmentsProvider>
        <DropZone>
          <Card className="animate-rise overflow-hidden">
            <div className="grid gap-x-8 gap-y-6 p-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
              <div className="space-y-5">
                <FormError>{errors.form}</FormError>

                {/* Said, not merely done: a form that quietly files the ticket
                    under something else is one nobody trusts the second time.
                    The link itself is written on save, from the id below. */}
                {parent ? (
                  <div className="callout-brand px-4 py-3 text-base">
                    <input type="hidden" name="parentId" value={parent.id} />
                    {t.newTicket.under}{" "}
                    <a href={`/tickets/${parent.number}`} className="font-mono text-sm font-medium">
                      {parent.reference}
                    </a>{" "}
                    <span className="text-text-2">{parent.title}</span>
                  </div>
                ) : null}

                <Field label={t.newTicket.subject} htmlFor="title" hint={t.newTicket.titleHint}>
                  <Input
                    id="title"
                    name="title"
                    autoFocus
                    aria-invalid={Boolean(errors.title)}
                    placeholder={t.newTicket.titlePlaceholder}
                    className="text-md h-11"
                  />
                  <FieldError>{errors.title}</FieldError>
                </Field>

                <Field
                  label={t.newTicket.description}
                  htmlFor="description"
                  hint={t.newTicket.descriptionHint}
                >
                  {/* Pasting a screenshot mid-sentence attaches it rather than
                  dropping a blob of nothing into the text. */}
                  <Textarea id="description" name="description" rows={14} />
                </Field>

                <Field label={t.ticket.attachments} hint={t.ticket.attachHint}>
                  <div className="flex flex-wrap items-center gap-2">
                    <AttachButton className={buttonClass("outline", "sm")} showLabel />
                    <AttachChips />
                  </div>
                  <FieldError>{errors.files}</FieldError>
                </Field>
              </div>

              <div className="space-y-6">
                {/* Priority as a segmented control: seeing all four at once is what
                makes the choice, and it fills the column properly. */}
                <div className="space-y-2">
                  <p className="label">{t.ticket.priority}</p>
                  <input type="hidden" name="priority" value={priority} />
                  <div className="grid grid-cols-2 gap-2">
                    {PRIORITY_ORDER.map((value) => {
                      const meta = PRIORITY_META[value];
                      const on = priority === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setPriority(value)}
                          className={cn(
                            "rounded-control flex flex-col items-start gap-0.5 border px-3 py-2.5 text-left transition-all duration-150 active:scale-[0.97]",
                            on ? "border-transparent" : "border-border hover:border-text-3",
                          )}
                          style={
                            on
                              ? {
                                  background: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
                                  borderColor: meta.color,
                                }
                              : undefined
                          }
                        >
                          <span className="text-md flex items-center gap-1.5 font-semibold">
                            <span
                              aria-hidden
                              className="size-2 rounded-full"
                              style={{ background: meta.color }}
                            />
                            <span style={on ? { color: meta.color } : undefined}>
                              {t.vocab.priority[value]}
                            </span>
                          </span>
                          <span className="text-text-3 text-xs">
                            {t.ticket.hoursTarget(targets[value])}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label={t.ticket.type} htmlFor="type">
                    <Select
                      id="type"
                      name="type"
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                    >
                      {TYPE_ORDER.map((value) => (
                        <option key={value} value={value}>
                          {t.vocab.type[value]}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  {/* An incident's deadline is the promise its priority already
                  made, so it is shown rather than asked for — the ticket page
                  derives the same date and would ignore a typed one. */}
                  {hasResponseTarget(type as "QUESTION" | "INCIDENT" | "CHANGE") ? (
                    <Field label={t.newTicket.derivedDue} hint={t.newTicket.derivedDueHint}>
                      <p className="border-border-soft bg-surface-2 text-text-2 rounded-control text-md flex h-11 items-center border px-3">
                        {dueFormat.format(
                          projectedDeadline(
                            priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
                            clock,
                          ),
                        )}
                      </p>
                    </Field>
                  ) : (
                    <Field label={t.newTicket.dueDate} htmlFor="dueDate">
                      <Input id="dueDate" name="dueDate" type="date" />
                    </Field>
                  )}
                </div>

                {type === "CHANGE" && plans.length > 0 ? (
                  <Field label={t.plan.title} htmlFor="plan" hint={t.newTicket.planHint}>
                    <input type="hidden" name="planId" value={planId} />
                    <button
                      id="plan"
                      type="button"
                      onClick={() => setPicking(true)}
                      className="border-border bg-surface hover:border-brand focus:border-brand rounded-control text-md flex h-11 w-full items-center gap-2 border px-3 text-left transition-colors focus:ring-4 focus:ring-[var(--brand-tint)] focus:outline-none"
                    >
                      <ListChecks size={15} className="text-text-3 shrink-0" />
                      {planId ? (
                        <span className="truncate">
                          {plans.find((plan) => plan.id === planId)?.name}
                        </span>
                      ) : (
                        <span className="text-text-3">{t.newTicket.pickPlan}</span>
                      )}
                    </button>
                    <FieldError>{errors.planId}</FieldError>
                  </Field>
                ) : null}

                {picking ? (
                  <TogglePicker
                    title={t.newTicket.pickPlan}
                    description={t.newTicket.planHint}
                    items={plans.map((plan) => ({
                      id: plan.id,
                      label: plan.name,
                      hint: plan.description ?? t.plan.stepCount(plan.steps),
                      icon: <ListChecks size={15} className="text-text-3" />,
                    }))}
                    selected={new Set(planId ? [planId] : [])}
                    emptyText={t.plan.noTemplates}
                    searchPlaceholder={t.newTicket.searchPlans}
                    onToggle={(id, next) => {
                      // One plan, not several: picking another replaces it.
                      setPlanId(next ? id : "");
                      if (next) setPicking(false);
                    }}
                    onClose={() => setPicking(false)}
                  />
                ) : null}

                {/* Optional: a ticket belongs to a project only if it belongs to one. */}
                <Field label={t.ticket.project} htmlFor="projectId" hint={t.newTicket.projectHint}>
                  <Select
                    id="projectId"
                    name="projectId"
                    value={projectId}
                    onChange={(event) => {
                      setProjectId(event.target.value);
                      // A milestone belongs to one project, so changing the project
                      // cannot leave the old one selected.
                      setMilestoneId("");
                    }}
                  >
                    <option value="">{t.ticket.noProject}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.key} · {project.name}
                      </option>
                    ))}
                  </Select>
                </Field>

                {forProject.length > 0 ? (
                  <Field label={t.projects.inMilestone} htmlFor="milestoneId">
                    <Select
                      id="milestoneId"
                      name="milestoneId"
                      value={milestoneId}
                      onChange={(event) => setMilestoneId(event.target.value)}
                    >
                      <option value="">{t.projects.noMilestone}</option>
                      {forProject.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.title}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}

                {canTriage ? (
                  <div className="grid grid-cols-2 gap-4">
                    <Field
                      label={t.newTicket.requester}
                      htmlFor="reporterId"
                      hint={t.newTicket.forWhom}
                    >
                      <Select
                        id="reporterId"
                        name="reporterId"
                        defaultValue={parent?.reporterId ?? viewerId}
                      >
                        {requesters.map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                            {person.id === viewerId ? t.newTicket.isYou : ""}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field
                      label={t.ticket.assignee}
                      htmlFor="assigneeId"
                      hint={t.newTicket.whoWillWork}
                    >
                      <Select id="assigneeId" name="assigneeId" defaultValue="">
                        <option value="">{t.tickets.unassigned}</option>
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                ) : null}

                {/* Named while the ticket is being raised rather than after
                    it exists. "Which server is this about" is something the
                    person reporting it knows and the person picking it up has
                    to guess — and a register that is only filled in later is
                    one whose counts are always a week behind. */}
                {canPickAssets ? (
                  <div className="space-y-2">
                    <p className="label">{t.cmdb.assetsOnTicketTitle}</p>
                    <AssetField chosen={assets} onChange={setAssets} />
                    {assets.map((asset) => (
                      <input key={asset.id} type="hidden" name="ciIds" value={asset.id} />
                    ))}
                  </div>
                ) : null}

                {tags.length ? (
                  <div className="space-y-2">
                    <p className="label">{t.ticket.tags}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tags.map((tag) => {
                        const on = tagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            aria-pressed={on}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-base transition-all duration-150 active:scale-95",
                              on
                                ? "border-brand text-brand-deep bg-[var(--brand-tint)] font-semibold"
                                : "border-border text-text-2 hover:border-text-3 hover:text-text",
                            )}
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                    {tagIds.map((id) => (
                      <input key={id} type="hidden" name="labelIds" value={id} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-border-soft bg-surface-2 flex items-center justify-end gap-3 border-t px-6 py-4">
              <p className="text-text-3 mr-auto text-base">{t.newTicket.changeLater}</p>
              <Submit />
            </div>
          </Card>
        </DropZone>
      </AttachmentsProvider>
    </form>
  );
}

/**
 * The assets this ticket is about, picked by name.
 *
 * A search rather than a list, because the register is the one thing on this
 * form that may hold thousands of rows. Nothing is written here — the chosen
 * ids ride along as hidden fields and land with the ticket, so a form somebody
 * abandons leaves no trace on the register.
 */
function AssetField({
  chosen,
  onChange,
}: {
  chosen: CiCandidate[];
  onChange: (next: CiCandidate[]) => void;
}) {
  const t = useMessages();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CiCandidate[]>([]);
  const [open, setOpen] = useState(false);

  // Debounced for the same reason every other picker here is: the search runs
  // against the whole register, and a query per character is a query per
  // character.
  useEffect(() => {
    if (!open) return;
    let live = true;
    const timer = setTimeout(() => {
      searchCiItems(query).then((rows) => {
        if (live) setResults(rows);
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [open, query]);

  return (
    <div className="space-y-2">
      {chosen.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {chosen.map((asset) => (
            <li key={asset.id}>
              <span className="border-border text-text-2 inline-flex items-center gap-1.5 rounded-full border py-1 pr-1 pl-2.5 text-base">
                <CiGlyph icon={asset.type.icon} color={asset.type.color} size={12} />
                <span className="max-w-[10rem] truncate">{asset.name}</span>
                <button
                  type="button"
                  onClick={() => onChange(chosen.filter((one) => one.id !== asset.id))}
                  aria-label={t.cmdb.removeAsset}
                  title={t.cmdb.removeAsset}
                  className="text-text-3 hover:bg-surface-3 hover:text-text flex size-5 items-center justify-center rounded-full transition-colors"
                >
                  <X size={11} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {open ? (
        <>
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.cmdb.searchItems}
            aria-label={t.cmdb.searchItems}
          />
          <div className="border-border rounded-card max-h-48 space-y-1 overflow-y-auto border p-1">
            {results.filter((row) => !chosen.some((one) => one.id === row.id)).length === 0 ? (
              <p className="text-text-3 py-4 text-center text-base">{t.common.noMatches}</p>
            ) : (
              results
                .filter((row) => !chosen.some((one) => one.id === row.id))
                .map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => {
                      onChange([...chosen, candidate]);
                      setQuery("");
                    }}
                    className="hover:bg-surface-2 rounded-control flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left transition-colors"
                  >
                    <CiGlyph icon={candidate.type.icon} color={candidate.type.color} size={13} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{candidate.name}</span>
                      <span className="text-text-3 block truncate text-sm">
                        {candidate.type.name}
                      </span>
                    </span>
                  </button>
                ))
            )}
          </div>
        </>
      ) : null}

      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(!open)}>
        {open ? t.common.done : t.cmdb.addAsset}
      </Button>
    </div>
  );
}
