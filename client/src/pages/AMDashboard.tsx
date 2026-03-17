import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import CRMLayout from "@/components/CRMLayout";
import { trpc } from "@/lib/trpc";
import { Users, TrendingUp, DollarSign, Activity, AlertCircle, Clock } from "lucide-react";

const COLORS = ["#10b981", "#f59e0b", "#ef4444"];

const CUSTOM_TOOLTIP_STYLE = {
  backgroundColor: "rgba(15, 23, 42, 0.9)",
  border: "1px solid rgba(99, 102, 241, 0.3)",
  borderRadius: "12px",
  color: "#f1f5f9",
  fontSize: "12px",
  padding: "10px 14px",
  backdropFilter: "blur(8px)",
};

const TOOLTIP_ITEM_STYLE = {
  color: "#f1f5f9",
  fontSize: "12px",
  fontWeight: 500,
};

const TOOLTIP_LABEL_STYLE = {
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 600,
  marginBottom: "4px",
};

function KpiCard({
  title,
  value,
  suffix = "",
  icon: Icon,
  gradient,
  iconBg,
}: {
  title: string;
  value: string | number;
  suffix?: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 shadow-sm border border-white/10 ${gradient}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">
            {value}
            {suffix && <span className="text-xl ml-0.5">{suffix}</span>}
          </p>
        </div>
        <div className={`rounded-xl p-2.5 ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
      {/* Decorative circle */}
      <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-white/5" />
      <div className="absolute -bottom-8 -right-8 h-28 w-28 rounded-full bg-white/5" />
    </div>
  );
}

const kpiConfig = [
  { key: "myActiveClients", title: "My Active Clients", suffix: "", icon: Users, gradient: "bg-gradient-to-br from-violet-600 to-indigo-700", iconBg: "bg-white/20" },
  { key: "myRenewalRate", title: "My Renewal Rate", suffix: "%", icon: TrendingUp, gradient: "bg-gradient-to-br from-emerald-500 to-teal-600", iconBg: "bg-white/20" },
  { key: "myUpsellValue", title: "My Upsell Value", suffix: "", icon: DollarSign, gradient: "bg-gradient-to-br from-amber-500 to-orange-600", iconBg: "bg-white/20" },
  { key: "avgHealthScore", title: "Avg. Health Score", suffix: "", icon: Activity, gradient: "bg-gradient-to-br from-sky-500 to-blue-600", iconBg: "bg-white/20" },
];

function SectionCard({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-slate-100">
        {Icon && (
          <div className="rounded-lg bg-violet-50 p-1.5">
            <Icon className="h-4 w-4 text-violet-600" />
          </div>
        )}
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
    completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "in progress": "bg-blue-50 text-blue-700 border-blue-200",
  };
  const cls = map[status?.toLowerCase()] ?? "bg-slate-50 text-slate-600 border-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function AMDashboard() {
  const { data, isLoading } = trpc.amDashboard.getStats.useQuery();

  return (
    <CRMLayout title="My Dashboard">
      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {kpiConfig.map((cfg) => {
            const raw = data?.kpis[cfg.key as keyof typeof data.kpis] ?? 0;
            const val = cfg.key === "myUpsellValue" ? Number(raw).toLocaleString() : raw;
            return (
              <KpiCard
                key={cfg.key}
                title={cfg.title}
                value={val}
                suffix={cfg.suffix}
                icon={cfg.icon}
                gradient={cfg.gradient}
                iconBg={cfg.iconBg}
              />
            );
          })}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard title="Clients by Health Score" icon={Activity}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.charts.clientsByHealthScore ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={70}
                    outerRadius={110}
                    paddingAngle={5}
                    strokeWidth={0}
                  >
                    {(data?.charts.clientsByHealthScore ?? []).map((entry, index) => (
                      <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ color: "#64748b", fontSize: "12px" }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Upcoming Renewals" icon={Clock}>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.charts.upcomingRenewals ?? []} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={CUSTOM_TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM_STYLE}
                    labelStyle={TOOLTIP_LABEL_STYLE}
                    cursor={{ fill: "rgba(99,102,241,0.05)" }}
                  />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} fill="url(#renewalGrad)" />
                  <defs>
                    <linearGradient id="renewalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#818cf8" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SectionCard title="My Overdue Tasks" icon={AlertCircle}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Task</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Client</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Status</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Due Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(data?.tables.myOverdueTasks ?? []).map((task: any) => (
                    <tr key={task.id} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pr-4 font-medium text-slate-800">{task.title}</td>
                      <td className="py-3 pr-4 text-slate-500">{task.clientName}</td>
                      <td className="py-3 pr-4"><StatusBadge status={task.status} /></td>
                      <td className="py-3 text-slate-500">{new Date(task.dueDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!isLoading && (data?.tables.myOverdueTasks?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={4} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <AlertCircle className="h-8 w-8 opacity-30" />
                          <span className="text-sm">No overdue tasks</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Recent Follow-ups" icon={Clock}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Client</th>
                    <th className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Note</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(data?.tables.recentFollowUps ?? []).map((followUp: any) => (
                    <tr key={followUp.id} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 pr-4 font-medium text-slate-800">{followUp.clientName}</td>
                      <td className="py-3 pr-4 text-slate-500 max-w-[180px] truncate">{followUp.notes}</td>
                      <td className="py-3 text-slate-500 whitespace-nowrap">{new Date(followUp.followUpDate ?? followUp.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {!isLoading && (data?.tables.recentFollowUps?.length ?? 0) === 0 && (
                    <tr>
                      <td colSpan={3} className="py-10 text-center">
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                          <Clock className="h-8 w-8 opacity-30" />
                          <span className="text-sm">No recent follow-ups</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </CRMLayout>
  );
}
