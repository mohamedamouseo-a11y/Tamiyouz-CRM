import CRMLayout from "@/components/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, ClipboardList, Loader2, RefreshCcw, Target } from "lucide-react";

function KpiCard({ title, value, subtitle, icon: Icon }: { title: string; value: string | number; subtitle: string; icon: any }) {
  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="rounded-xl bg-violet-50 p-2.5">
            <Icon className="h-5 w-5 text-violet-600" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Draft: "bg-slate-100 text-slate-700 border-slate-200",
    ReadyForSalesAction: "bg-emerald-100 text-emerald-700 border-emerald-200",
    WaitingForReview: "bg-amber-100 text-amber-700 border-amber-200",
    ClosedWon: "bg-green-100 text-green-700 border-green-200",
    ClosedLost: "bg-rose-100 text-rose-700 border-rose-200",
  };
  return <Badge variant="outline" className={`border ${map[status] ?? map.Draft}`}>{status}</Badge>;
}

export default function TAMDashboard() {
  const { data, isLoading } = trpc.tamWorkflow.dashboard.useQuery();

  return (
    <CRMLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">TAM Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Track Lobna's reviewed leads, sales loops, and wins after TAM intervention.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="Worked Leads" value={data?.kpis.workedLeads ?? 0} subtitle="Total leads reviewed by TAM" icon={ClipboardList} />
          <KpiCard title="Won After Review" value={data?.kpis.wonAfterReview ?? 0} subtitle="Deals marked won after TAM work" icon={CheckCircle2} />
          <KpiCard title="Ready for Sales" value={data?.kpis.readyForSales ?? 0} subtitle="Leads waiting on sales execution" icon={Target} />
          <KpiCard title="Needs Review" value={data?.kpis.waitingReview ?? 0} subtitle="Sent back from sales to TAM" icon={RefreshCcw} />
          <KpiCard title="Win Rate" value={`${data?.kpis.winRate ?? 0}%`} subtitle="Won after review / worked leads" icon={BarChart3} />
        </div>

        <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Recent TAM Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 size={16} className="animate-spin" />
                <span>Loading dashboard...</span>
              </div>
            ) : (data?.recentLeads?.length ?? 0) === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">No TAM workflow records yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/60">
                      <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lead</th>
                      <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales Owner</th>
                      <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                      <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outcome</th>
                      <th className="py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {(data?.recentLeads ?? []).map((item: any) => (
                      <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 pr-4">
                          <div className="font-medium text-foreground">{item.leadName || item.leadPhone || `Lead #${item.leadId}`}</div>
                          <div className="text-xs text-muted-foreground">{item.leadStage || "—"}</div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">{item.salesOwnerName || "—"}</td>
                        <td className="py-3 pr-4"><StatusBadge status={item.status} /></td>
                        <td className="py-3 pr-4 text-muted-foreground">{item.callOutcome || "—"}</td>
                        <td className="py-3 text-muted-foreground">{item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CRMLayout>
  );
}
