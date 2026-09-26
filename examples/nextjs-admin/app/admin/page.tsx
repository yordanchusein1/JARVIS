import { AutomationToggle, Briefing, LeadList } from '@arclighthq/react';

export default function Today() {
  return (
    <>
      <h1>Today</h1>
      <Briefing title="Good morning" />
      <h2>Leads</h2>
      <LeadList limit={20} />
      <AutomationToggle />
    </>
  );
}
