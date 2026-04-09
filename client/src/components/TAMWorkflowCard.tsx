import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, ClipboardList, Loader2, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DROP_REASON_OPTIONS = [
  { value: "service_understanding", en: "Service understanding", ar: "فهم الخدمة" },
  { value: "wrong_expectations", en: "Wrong expectations", ar: "توقعات غير صحيحة" },
  { value: "technical_gap", en: "Technical gap", ar: "شرح تيكنيكال ناقص" },
  { value: "budget", en: "Budget", ar: "الميزانية" },
  { value: "timing", en: "Timing", ar: "التوقيت" },
  { value: "trust", en: "Trust", ar: "الثقة" },
  { value: "competition", en: "Competition", ar: "المنافسة" },
  { value: "other", en: "Other", ar: "أخرى" },
] as const;

const SALES_OUTCOMES = [
  { value: "Interested", en: "Interested", ar: "مهتم" },
  { value: "NotInterested", en: "Not interested", ar: "غير مهتم" },
  { value: "NeedFollowUp", en: "Need follow-up", ar: "يحتاج متابعة" },
  { value: "NoAnswer", en: "No answer", ar: "لم يرد" },
  { value: "Won", en: "Won", ar: "تم البيع" },
  { value: "Lost", en: "Lost", ar: "مرفوض" },
  { value: "Other", en: "Other", ar: "أخرى" },
] as const;

const statusConfig: Record<string, { en: string; ar: string; cls: string }> = {
  Draft: { en: "Draft", ar: "مسودة", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  ReadyForSalesAction: { en: "Ready for Sales Action", ar: "جاهز لتنفيذ السيلز", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  WaitingForReview: { en: "Needs TAM Review", ar: "يحتاج مراجعة TAM", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  ClosedWon: { en: "Closed Won", ar: "تم البيع", cls: "bg-green-100 text-green-700 border-green-200" },
  ClosedLost: { en: "Closed Lost", ar: "لم يتم البيع", cls: "bg-rose-100 text-rose-700 border-rose-200" },
};

type Props = {
  leadId: number;
  leadOwnerId?: number | null;
};

export default function TAMWorkflowCard({ leadId, leadOwnerId }: Props) {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();

  const { data: review, isLoading } = trpc.tamWorkflow.byLead.useQuery({ leadId });
  const { data: assignments } = trpc.assignments.byLead.useQuery({ leadId });

  const currentAssignmentRole = useMemo(() => {
    if (leadOwnerId === user?.id) return "owner";
    return (assignments as any[])?.find((assignment: any) => assignment.userId === user?.id)?.role ?? null;
  }, [assignments, leadOwnerId, user?.id]);

  const isPrivileged = ["Admin", "admin", "SalesManager"].includes(user?.role ?? "");
  const canManageTam = isPrivileged || ["technical_account_manager", "account_manager"].includes(currentAssignmentRole ?? "");
  const canSubmitFeedback = isPrivileged || leadOwnerId === user?.id;

  const [dropReasonCategory, setDropReasonCategory] = useState<string>("other");
  const [dropReasonDetails, setDropReasonDetails] = useState("");
  const [leadNature, setLeadNature] = useState("");
  const [insightDoc, setInsightDoc] = useState("");
  const [nextBestAction, setNextBestAction] = useState("");
  const [salesImprovementNotes, setSalesImprovementNotes] = useState("");

  const [callOutcome, setCallOutcome] = useState<string>("Interested");
  const [objection, setObjection] = useState("");
  const [nextStep, setNextStep] = useState("");

  useEffect(() => {
    setDropReasonCategory((review as any)?.dropReasonCategory ?? "other");
    setDropReasonDetails((review as any)?.dropReasonDetails ?? "");
    setLeadNature((review as any)?.leadNature ?? "");
    setInsightDoc((review as any)?.insightDoc ?? "");
    setNextBestAction((review as any)?.nextBestAction ?? "");
    setSalesImprovementNotes((review as any)?.salesImprovementNotes ?? "");
    setCallOutcome((review as any)?.callOutcome ?? "Interested");
    setObjection((review as any)?.objection ?? "");
    setNextStep((review as any)?.nextStep ?? "");
  }, [review]);

  const upsertMutation = trpc.tamWorkflow.upsert.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حفظ مراجعة TAM" : "TAM review saved");
      await utils.tamWorkflow.byLead.invalidate({ leadId });
      await utils.tamWorkflow.dashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const feedbackMutation = trpc.tamWorkflow.submitSalesFeedback.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم إرسال متابعة السيلز" : "Sales follow-up submitted");
      await utils.tamWorkflow.byLead.invalidate({ leadId });
      await utils.tamWorkflow.dashboard.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSave = (status: "Draft" | "ReadyForSalesAction") => {
    if (status === "ReadyForSalesAction" && (!insightDoc.trim() || !nextBestAction.trim())) {
      toast.error(isRTL ? "أضيفي الـ insight والـ next best action أولاً" : "Please fill in the insight and next best action first.");
      return;
    }

    upsertMutation.mutate({
      leadId,
      status,
      dropReasonCategory: dropReasonCategory as any,
      dropReasonDetails: dropReasonDetails || undefined,
      leadNature: leadNature || undefined,
      insightDoc,
      nextBestAction,
      salesImprovementNotes: salesImprovementNotes || undefined,
    });
  };

  const handleSubmitFeedback = () => {
    if (!nextStep.trim()) {
      toast.error(isRTL ? "الـ Next Step مطلوب" : "Next step is required.");
      return;
    }
    feedbackMutation.mutate({
      leadId,
      callOutcome: callOutcome as any,
      objection: objection || undefined,
      nextStep,
    });
  };

  const currentStatus = statusConfig[(review as any)?.status ?? "Draft"] ?? statusConfig.Draft;

  if (!canManageTam && !canSubmitFeedback && !review && !isLoading) {
    return null;
  }

  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <ClipboardList size={13} className="text-violet-600" />
          {isRTL ? "Smart Notes & Sales Loop" : "Smart Notes & Sales Loop"}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {isRTL ? "حالة الـ TAM workflow" : "TAM workflow status"}
          </div>
          <Badge variant="outline" className={`border ${currentStatus.cls}`}>
            {isRTL ? currentStatus.ar : currentStatus.en}
          </Badge>
        </div>

        {canManageTam && (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "سبب وقوع الـ lead" : "Drop reason"}</Label>
              <Select value={dropReasonCategory} onValueChange={setDropReasonCategory}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DROP_REASON_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{isRTL ? option.ar : option.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "تفاصيل السبب" : "Reason details"}</Label>
              <Input value={dropReasonDetails} onChange={(event) => setDropReasonDetails(event.target.value)} className="mt-1 h-8 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "طبيعة الليد" : "Lead nature"}</Label>
              <Textarea value={leadNature} onChange={(event) => setLeadNature(event.target.value)} rows={2} className="mt-1 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Insight Doc</Label>
              <Textarea value={insightDoc} onChange={(event) => setInsightDoc(event.target.value)} rows={4} className="mt-1 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "Next Best Action" : "Next Best Action"}</Label>
              <Textarea value={nextBestAction} onChange={(event) => setNextBestAction(event.target.value)} rows={3} className="mt-1 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "تحسين منظومة السيلز" : "Sales improvement notes"}</Label>
              <Textarea value={salesImprovementNotes} onChange={(event) => setSalesImprovementNotes(event.target.value)} rows={2} className="mt-1 text-xs" />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSave("Draft")} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
                <span>{isRTL ? "حفظ كمسودة" : "Save draft"}</span>
              </Button>
              <Button type="button" size="sm" className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleSave("ReadyForSalesAction")} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                <span>{isRTL ? "إرسال للسيلز" : "Ready for sales action"}</span>
              </Button>
            </div>
          </div>
        )}

        {!!review && !canManageTam && (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs">
            <div>
              <p className="font-medium mb-1">{isRTL ? "سبب الوقوع" : "Drop reason"}</p>
              <p className="text-muted-foreground">{isRTL ? (DROP_REASON_OPTIONS.find((option) => option.value === (review as any)?.dropReasonCategory)?.ar ?? "—") : (DROP_REASON_OPTIONS.find((option) => option.value === (review as any)?.dropReasonCategory)?.en ?? "—")}</p>
            </div>
            {(review as any)?.insightDoc && (
              <div>
                <p className="font-medium mb-1">Insight Doc</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{(review as any).insightDoc}</p>
              </div>
            )}
            {(review as any)?.nextBestAction && (
              <div>
                <p className="font-medium mb-1">{isRTL ? "Next Best Action" : "Next Best Action"}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{(review as any).nextBestAction}</p>
              </div>
            )}
          </div>
        )}

        {canSubmitFeedback && !!review && ["ReadyForSalesAction", "WaitingForReview"].includes((review as any)?.status ?? "") && (
          <div className="space-y-3 rounded-xl border border-border/50 bg-blue-50/40 dark:bg-blue-950/10 p-3">
            <p className="text-xs font-semibold text-foreground">{isRTL ? "Follow-up Loop" : "Follow-up Loop"}</p>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "Call Outcome" : "Call Outcome"}</Label>
              <Select value={callOutcome} onValueChange={setCallOutcome}>
                <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SALES_OUTCOMES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>{isRTL ? option.ar : option.en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "Objection" : "Objection"}</Label>
              <Textarea value={objection} onChange={(event) => setObjection(event.target.value)} rows={2} className="mt-1 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "Next Step" : "Next Step"}</Label>
              <Textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} rows={2} className="mt-1 text-xs" />
            </div>
            <Button type="button" size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSubmitFeedback} disabled={feedbackMutation.isPending}>
              {feedbackMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCcw size={12} />}
              <span>{isRTL ? "إرجاع للمراجعة" : "Send back for review"}</span>
            </Button>
          </div>
        )}

        {!!review && ((review as any)?.callOutcome || (review as any)?.nextStep || (review as any)?.objection) && (
          <div className="space-y-2 rounded-xl border border-border/50 p-3 text-xs">
            <p className="font-semibold text-foreground">{isRTL ? "آخر متابعة من السيلز" : "Latest sales follow-up"}</p>
            {(review as any)?.callOutcome && <p className="text-muted-foreground"><span className="font-medium text-foreground">{isRTL ? "Outcome:" : "Outcome:"}</span> {(review as any).callOutcome}</p>}
            {(review as any)?.objection && <p className="text-muted-foreground whitespace-pre-wrap"><span className="font-medium text-foreground">{isRTL ? "Objection:" : "Objection:"}</span> {(review as any).objection}</p>}
            {(review as any)?.nextStep && <p className="text-muted-foreground whitespace-pre-wrap"><span className="font-medium text-foreground">{isRTL ? "Next step:" : "Next step:"}</span> {(review as any).nextStep}</p>}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            <span>{isRTL ? "جاري تحميل الـ workflow..." : "Loading workflow..."}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
