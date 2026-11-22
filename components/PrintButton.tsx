'use client';

export default function PrintButton() {
  return <button className="ghost no-print" onClick={() => window.print()}>Print</button>;
}
