import { useId } from "react";
import type { NdaFields, Party } from "@/lib/nda/fields";

interface NdaFormProps {
  fields: NdaFields;
  onChange: (fields: NdaFields) => void;
}

const baseInputClass =
  "rounded-md border border-neutral-300 bg-white text-sm text-neutral-900 " +
  "focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 focus:outline-none " +
  "dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const inputClass = `w-full px-3 py-2 shadow-xs ${baseInputClass}`;

export function NdaForm({ fields, onChange }: NdaFormProps) {
  const set = <K extends keyof NdaFields>(key: K, value: NdaFields[K]) =>
    onChange({ ...fields, [key]: value });
  const setParty = (key: "party1" | "party2", field: keyof Party, value: string) =>
    set(key, { ...fields[key], [field]: value });

  return (
    <form className="space-y-8" onSubmit={(event) => event.preventDefault()}>
      <Section title="Agreement">
        <Field label="Purpose" hint="How Confidential Information may be used">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              className={inputClass}
              value={fields.purpose}
              onChange={(e) => set("purpose", e.target.value)}
            />
          )}
        </Field>

        <Field label="Effective date">
          {(id) => (
            <input
              id={id}
              type="date"
              className={inputClass}
              value={fields.effectiveDate}
              onChange={(e) => set("effectiveDate", e.target.value)}
            />
          )}
        </Field>

        <RadioGroup
          legend="MNDA term"
          hint="The length of this MNDA"
          name="mndaTerm"
          value={fields.mndaTerm}
          onChange={(value) => set("mndaTerm", value)}
          options={[
            {
              value: "expires",
              label: (
                <YearsLabel
                  prefix="Expires"
                  suffix="from Effective Date"
                  inputLabel="Years until the MNDA expires"
                  years={fields.mndaTermYears}
                  onChange={(years) =>
                    onChange({ ...fields, mndaTerm: "expires", mndaTermYears: years })
                  }
                />
              ),
            },
            { value: "untilTerminated", label: "Continues until terminated" },
          ]}
        />

        <RadioGroup
          legend="Term of confidentiality"
          hint="How long Confidential Information is protected. Trade secrets stay protected for as long as they remain trade secrets."
          name="confidentialityTerm"
          value={fields.confidentialityTerm}
          onChange={(value) => set("confidentialityTerm", value)}
          options={[
            {
              value: "years",
              label: (
                <YearsLabel
                  suffix="from Effective Date"
                  inputLabel="Years Confidential Information is protected"
                  years={fields.confidentialityYears}
                  onChange={(years) =>
                    onChange({ ...fields, confidentialityTerm: "years", confidentialityYears: years })
                  }
                />
              ),
            },
            { value: "perpetual", label: "In perpetuity" },
          ]}
        />

        <Field label="Governing law" hint="State whose laws govern the MNDA, e.g. Delaware">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              value={fields.governingLaw}
              onChange={(e) => set("governingLaw", e.target.value)}
            />
          )}
        </Field>

        <Field label="Jurisdiction" hint="e.g. courts located in New Castle, DE">
          {(id) => (
            <input
              id={id}
              className={inputClass}
              value={fields.jurisdiction}
              onChange={(e) => set("jurisdiction", e.target.value)}
            />
          )}
        </Field>

        <Field label="MNDA modifications" hint="Optional. Changes to the Standard Terms, if any">
          {(id) => (
            <textarea
              id={id}
              rows={3}
              className={inputClass}
              value={fields.modifications}
              onChange={(e) => set("modifications", e.target.value)}
            />
          )}
        </Field>
      </Section>

      {(["party1", "party2"] as const).map((key, index) => (
        <Section key={key} title={`Party ${index + 1}`}>
          <Field label="Company">
            {(id) => (
              <input
                id={id}
                autoComplete="organization"
                className={inputClass}
                value={fields[key].company}
                onChange={(e) => setParty(key, "company", e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Signer name">
              {(id) => (
                <input
                  id={id}
                  autoComplete="name"
                  className={inputClass}
                  value={fields[key].name}
                  onChange={(e) => setParty(key, "name", e.target.value)}
                />
              )}
            </Field>
            <Field label="Title">
              {(id) => (
                <input
                  id={id}
                  autoComplete="organization-title"
                  className={inputClass}
                  value={fields[key].title}
                  onChange={(e) => setParty(key, "title", e.target.value)}
                />
              )}
            </Field>
          </div>
          <Field label="Notice address" hint="Email or postal address">
            {(id) => (
              <textarea
                id={id}
                rows={2}
                className={inputClass}
                value={fields[key].noticeAddress}
                onChange={(e) => setParty(key, "noticeAddress", e.target.value)}
              />
            )}
          </Field>
        </Section>
      ))}
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-4 text-base font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
      {children(id)}
    </div>
  );
}

function RadioGroup<T extends string>({
  legend,
  hint,
  name,
  value,
  onChange,
  options,
}: {
  legend: string;
  hint: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-sm font-medium">{legend}</legend>
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>
      <div className="space-y-2 pt-1">
        {options.map((option) => (
          <label key={option.value} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name={name}
              className="mt-1 accent-blue-600"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** A years input inside a radio option's label. Editing it also selects that option. */
function YearsLabel({
  prefix,
  suffix,
  inputLabel,
  years,
  onChange,
}: {
  prefix?: string;
  suffix: string;
  inputLabel: string;
  years: number;
  onChange: (years: number) => void;
}) {
  return (
    <>
      {prefix}
      <input
        type="number"
        min={1}
        step={1}
        aria-label={inputLabel}
        className={`w-16 px-2 py-0.5 ${baseInputClass}`}
        value={Number.isNaN(years) ? "" : years}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
      {years === 1 ? "year" : "years"} {suffix}
    </>
  );
}
