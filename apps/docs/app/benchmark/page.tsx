import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ShatterLink } from 'shatter-router/next';
import { Benchmark } from './benchmark';

export const metadata: Metadata = {
  title: 'Benchmark',
  description:
    'Measure Shatter Router on your own device: capture time, fracture time and frame rate, next to the reference machine.',
};

export default function BenchmarkPage(): ReactNode {
  return (
    <>
      <header className="page-head">
        <p className="kicker">Benchmark</p>
        <h1>Measure it here.</h1>
        <p className="lede">
          Break this page a few times on your own device and see what it costs: how long the capture
          takes, how long the glass takes to cut, and how smoothly it falls. The numbers come from
          the library&apos;s own events. How they are measured on the reference machine is in{' '}
          <ShatterLink href="/docs/performance">Performance</ShatterLink>.
        </p>
      </header>
      <Benchmark />
    </>
  );
}
