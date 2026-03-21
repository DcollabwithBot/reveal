/**
 * Tour demo seed data — Acme Development
 * Bruges af /demo ruten og guided tour i no-data scenarie
 */

export const DEMO_ORG = {
  name: "Acme Development",
  projects: [
    {
      id: 'demo-p1',
      name: "Kundeportal v2",
      icon: "🏰",
      sprint: "Sprint 7",
      color: "#feae34",
      items: [
        { id: 'demo-i1', title: "Login flow redesign", estimate: 5, status: "in_progress", priority: "high" },
        { id: 'demo-i2', title: "Dashboard KPI cards", estimate: 3, status: "pending" },
        { id: 'demo-i3', title: "Bruger-profil side", estimate: 8, status: "pending" },
        { id: 'demo-i4', title: "Notifikationscenter", estimate: 5, status: "pending" },
        { id: 'demo-i5', title: "Import/eksport funktionalitet", estimate: 13, status: "pending" },
        { id: 'demo-i6', title: "Mobiloptimering af checkout", estimate: 5, status: "pending" },
        { id: 'demo-i7', title: "Integrer betalingsgateway", estimate: 8, status: "done" },
        { id: 'demo-i8', title: "Tilgængeligheds-audit", estimate: 3, status: "done" },
      ],
    },
    {
      id: 'demo-p2',
      name: "API Modernisering",
      icon: "⚔️",
      sprint: "Sprint 3",
      color: "#38b764",
      items: [
        { id: 'demo-i9',  title: "Migrer til REST v3", estimate: 13, status: "in_progress", priority: "high" },
        { id: 'demo-i10', title: "OAuth 2.0 flow", estimate: 8, status: "pending" },
        { id: 'demo-i11', title: "Rate limiting", estimate: 5, status: "pending" },
        { id: 'demo-i12', title: "API dokumentation", estimate: 3, status: "pending" },
        { id: 'demo-i13', title: "Webhooks v2", estimate: 8, status: "pending" },
        { id: 'demo-i14', title: "GraphQL gateway", estimate: 21, status: "pending" },
        { id: 'demo-i15', title: "Caching-lag med Redis", estimate: 8, status: "pending" },
        { id: 'demo-i16', title: "Migrér legacy endpoints", estimate: 13, status: "pending" },
        { id: 'demo-i17', title: "Load balancer setup", estimate: 5, status: "done" },
        { id: 'demo-i18', title: "CI/CD pipeline opdatering", estimate: 3, status: "done" },
        { id: 'demo-i19', title: "Overvågning og alerting", estimate: 5, status: "done" },
        { id: 'demo-i20', title: "Backup-strategi", estimate: 3, status: "done" },
      ],
    },
  ],
  team: [
    { id: 'demo-t1', name: "Anna K.",   cls: { icon: "🧙", color: "#b55088" }, level: 7, xp: 2340 },
    { id: 'demo-t2', name: "Thomas H.", cls: { icon: "⚔️", color: "#f04f78" }, level: 5, xp: 1820 },
    { id: 'demo-t3', name: "Sara M.",   cls: { icon: "🛡️", color: "#5fcde4" }, level: 4, xp: 1250 },
    { id: 'demo-t4', name: "Emil R.",   cls: { icon: "🏹", color: "#feae34" }, level: 3, xp: 890  },
  ],
};
