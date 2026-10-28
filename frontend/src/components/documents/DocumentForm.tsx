import { useId } from "react";
import { isActive, partyFields, type DocumentSpec, type FieldSpec, type Values } from "@/lib/documents/catalog";
import { MAX_VALUE_LENGTH } from "@/lib/documents/chat";

interface DocumentFormProps {
  spec: DocumentSpec;
  values: Values;
  onChange: (values: Values) => void;
  /** Makes every input read-only, e.g. while the AI assistant is filling in the fields. */
  disabled?: boolean;
}

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 shadow-xs " +
  "focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 focus:outline-none";

/** Every field of the document, generated from its spec in documents.json. */
export function DocumentForm({ spec, values, onChange, disabled = false }: DocumentFormProps) {
  const set = (id: string, value: string) => onChange({ ...values, [id]: value });

  return (
    <form className="space-y-8" onSubmit={(event) => event.preventDefault()}>
      <Section title={spec.name} disabled={disabled}>
        {spec.fields
          .filter((field) => isActive(field, values))
          .map((field) => (
            <FieldInput key={field.id} field={field} value={values[field.id] ?? ""} onChange={set} />
          ))}
      </Section>

      {spec.parties.map((role, index) => (
        <Section key={role} title={role} disabled={disabled}>
          {partyFields(spec)
            .filter((field) => field.id.startsWith(`party${index + 1}.`))
            .map((field) => (
              <FieldInput key={field.id} field={field} value={values[field.id] ?? ""} onChange={set} />
            ))}
        </Section>
      ))}
    </form>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: string;
  onChange: (id: string, value: string) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;

  if (field.type === "choice") {
    return (
      <fieldset className="space-y-1.5" aria-describedby={hintId}>
        <legend className="text-sm font-medium">{field.label}</legend>
        <p id={hintId} className="text-xs text-brand-gray">
          {field.description}
        </p>
        <div className="space-y-2 pt-1">
          {field.options?.map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={id}
                className="mt-1 accent-brand-blue"
                checked={value === option.value}
                onChange={() => onChange(field.id, option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const common = {
    id,
    "aria-describedby": hintId,
    className: inputClass,
    maxLength: MAX_VALUE_LENGTH,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(field.id, e.target.value),
  };
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        {field.label}
        {!field.required && <span className="font-normal text-brand-gray"> (optional)</span>}
      </label>
      <p id={hintId} className="text-xs text-brand-gray">
        {field.description}
      </p>
      {field.type === "longtext" ? (
        <textarea rows={3} {...common} />
      ) : (
        <input
          type={field.type === "date" ? "date" : field.type === "years" ? "number" : "text"}
          min={field.type === "years" ? 1 : undefined}
          step={field.type === "years" ? 1 : undefined}
          {...common}
        />
      )}
    </div>
  );
}

function Section({
  title,
  disabled,
  children,
}: {
  title: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <legend className="mb-4 text-base font-semibold text-brand-navy">{title}</legend>
      {children}
    </fieldset>
  );
}
