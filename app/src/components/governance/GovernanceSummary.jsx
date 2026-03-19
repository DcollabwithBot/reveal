import { governanceStyles as s } from './styles';

export default function GovernanceSummary({ health, approvedReadyCount }) {
  return (
    <div style={s.govGrid}>
      <Widget title="Approval Queue" value={health.queue_depth} hint="Pending" />
      <Widget title="Ready to Apply" value={approvedReadyCount} hint="Approved" />
      <Widget title="Conflict Center" value={health.blocked_writes} hint="Blocked writes" />
    </div>
  );
}

function Widget({ title, value, hint }) {
  return (
    <div style={s.widget}>
      <div style={s.widgetTitle}>{title}</div>
      <div style={s.widgetValue}>{value}</div>
      <div style={s.widgetHint}>{hint}</div>
    </div>
  );
}
