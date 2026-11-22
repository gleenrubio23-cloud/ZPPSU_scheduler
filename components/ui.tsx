/** Small shared pieces of markup used by many pages. */
import type { ReactNode } from 'react';
import ConfirmButton from './ConfirmButton';

type Items = Record<string | number, string> | [string | number, string][];

/** <option> tags from id => label pairs, with an optional empty first choice. */
export function Opts({ items, placeholder }: { items: Items; placeholder?: string }) {
  const list = Array.isArray(items) ? items : Object.entries(items);
  return (
    <>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {list.map(([value, label]) => (
        <option key={String(value)} value={String(value)}>{label}</option>
      ))}
    </>
  );
}

/** A small form that posts hidden fields to a server action, with one button. */
export function ActionButton({
  action, fields, label, className = 'small', confirm,
}: {
  action: (form: FormData) => Promise<void>;
  fields: Record<string, string | number>;
  label: ReactNode;
  className?: string;
  confirm?: string;
}) {
  return (
    <form action={action} className="inline">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
      {confirm ? (
        <ConfirmButton className={className} message={confirm}>{label}</ConfirmButton>
      ) : (
        <button className={className}>{label}</button>
      )}
    </form>
  );
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function Bar({ percent }: { percent: number }) {
  return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, Math.round(percent)))}%` }} /></div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label>{label}</label>{children}</div>;
}
