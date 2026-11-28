/** Letterhead of the Individual Daily Program and the List of Students forms. */
import { SCHOOL_NAME } from '@/lib/constants';
import type { PrintSettings } from '@/lib/printSettings';

export default function FormLetterhead({ settings, variant }: { settings: PrintSettings; variant: 'idp' | 'classlist' }) {
  return (
    <header className={`form-letterhead ${variant}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.jpg" alt="" />
      <div>
        <div>Republic of the Philippines</div>
        <div><b><i>{SCHOOL_NAME.toUpperCase()}</i></b></div>
        {variant === 'idp' && settings.print_unit && <div><b>{settings.print_unit}</b></div>}
        {settings.print_region && <div>{settings.print_region}</div>}
        {settings.print_main_address && <div>{settings.print_main_address}</div>}
        {variant === 'classlist' && settings.print_phone && <div>{settings.print_phone}</div>}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/unit-logo.jpg" alt="" />
    </header>
  );
}
