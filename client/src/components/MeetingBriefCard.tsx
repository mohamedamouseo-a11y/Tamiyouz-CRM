import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type Props = {
  leadId: number;
  leadOwnerId?: number | null;
  leadStage?: string | null;
};

const statusConfig: Record<string, { en: string; ar: string; cls: string }> = {
  Draft: { en: "Draft", ar: "مسودة", cls: "bg-slate-100 text-slate-700 border-slate-200" },
  ReadyForMeeting: { en: "Ready for Meeting", ar: "جاهز للاجتماع", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  Completed: { en: "Completed", ar: "مكتمل", cls: "bg-green-100 text-green-700 border-green-200" },
};

function toLocalInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function MeetingBriefCard({ leadId, leadOwnerId, leadStage }: Props) {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const utils = trpc.useUtils();

  const { data: brief, isLoading } = trpc.meetingBriefs.byLead.useQuery({ leadId });
  const { data: assignments } = trpc.assignments.byLead.useQuery({ leadId });

  const currentAssignmentRole = useMemo(() => {
    if (leadOwnerId === user?.id) return "owner";
    return (assignments as any[])?.find((assignment: any) => assignment.userId === user?.id)?.role ?? null;
  }, [assignments, leadOwnerId, user?.id]);

  const isPrivileged = ["Admin", "admin", "SalesManager"].includes(user?.role ?? "");
  const canManage = isPrivileged || ["technical_account_manager", "account_manager"].includes(currentAssignmentRole ?? "");
  const canView = canManage || leadOwnerId === user?.id || !!brief;

  const [meetingAt, setMeetingAt] = useState("");
  const [talkingPoints, setTalkingPoints] = useState("");
  const [objectives, setObjectives] = useState("");
  const [clientNeedsToHear, setClientNeedsToHear] = useState("");
  const [redFlags, setRedFlags] = useState("");

  useEffect(() => {
    setMeetingAt(toLocalInputValue((brief as any)?.meetingAt));
    setTalkingPoints((brief as any)?.talkingPoints ?? "");
    setObjectives((brief as any)?.objectives ?? "");
    setClientNeedsToHear((brief as any)?.clientNeedsToHear ?? "");
    setRedFlags((brief as any)?.redFlags ?? "");
  }, [brief]);

  const upsertMutation = trpc.meetingBriefs.upsert.useMutation({
    onSuccess: async () => {
      toast.success(isRTL ? "تم حفظ الـ Meeting Brief" : "Meeting brief saved");
      await utils.meetingBriefs.byLead.invalidate({ leadId });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleSave = (status: "Draft" | "ReadyForMeeting") => {
    if (!meetingAt) {
      toast.error(isRTL ? "ميعاد الاجتماع مطلوب" : "Meeting time is required.");
      return;
    }
    if (status === "ReadyForMeeting" && (!talkingPoints.trim() || !objectives.trim() || !clientNeedsToHear.trim())) {
      toast.error(isRTL ? "اكتبي Talking Points و Objectives و الرسالة الأساسية أولاً" : "Please fill talking points, objectives, and what the client needs to hear first.");
      return;
    }

    upsertMutation.mutate({
      leadId,
      meetingAt: new Date(meetingAt),
      status,
      talkingPoints: talkingPoints || undefined,
      objectives: objectives || undefined,
      clientNeedsToHear: clientNeedsToHear || undefined,
      redFlags: redFlags || undefined,
    });
  };

  const shouldShow = !!brief || leadStage === "Meeting Scheduled";
  if ((!canView && !isLoading) || !shouldShow) return null;

  const currentStatus = statusConfig[(brief as any)?.status ?? "Draft"] ?? statusConfig.Draft;

  return (
    <Card className="rounded-2xl border-border/40 shadow-sm overflow-hidden">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <CalendarClock size={13} className="text-blue-600" />
          {isRTL ? "Meeting Brief Automation" : "Meeting Brief Automation"}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {isRTL ? "تحضير السيلز قبل الاجتماع" : "Prepare sales before the meeting"}
          </div>
          <Badge variant="outline" className={`border ${currentStatus.cls}`}>
            {isRTL ? currentStatus.ar : currentStatus.en}
          </Badge>
        </div>

        {canManage ? (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "ميعاد الاجتماع" : "Meeting time"}</Label>
              <Input type="datetime-local" value={meetingAt} onChange={(event) => setMeetingAt(event.target.value)} className="mt-1 h-8 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "Talking Points" : "Talking Points"}</Label>
              <Textarea value={talkingPoints} onChange={(event) => setTalkingPoints(event.target.value)} rows={3} className="mt-1 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "Objectives" : "Objectives"}</Label>
              <Textarea value={objectives} onChange={(event) => setObjectives(event.target.value)} rows={2} className="mt-1 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "العميل محتاج يسمع إيه" : "What client needs to hear"}</Label>
              <Textarea value={clientNeedsToHear} onChange={(event) => setClientNeedsToHear(event.target.value)} rows={3} className="mt-1 text-xs" />
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{isRTL ? "Red Flags" : "Red Flags"}</Label>
              <Textarea value={redFlags} onChange={(event) => setRedFlags(event.target.value)} rows={2} className="mt-1 text-xs" />
            </div>

            <div className="rounded-lg border border-blue-200/70 bg-blue-50/70 dark:bg-blue-950/20 px-3 py-2 text-[11px] text-muted-foreground flex gap-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0 text-blue-600" />
              <span>{isRTL ? "عند إرسال الـ brief، السيلز هيوصله Notification ويتعمل له Reminder قبل الاجتماع بحوالي ساعتين." : "When you mark the brief ready, sales gets a notification and a reminder roughly 2 hours before the meeting."}</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleSave("Draft")} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                <span>{isRTL ? "حفظ كمسودة" : "Save draft"}</span>
              </Button>
              <Button type="button" size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleSave("ReadyForMeeting")} disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                <span>{isRTL ? "جاهز للاجتماع" : "Ready for meeting"}</span>
              </Button>
            </div>
          </div>
        ) : !!brief ? (
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-3 text-xs">
            {(brief as any)?.meetingAt && (
              <div>
                <p className="font-medium mb-1">{isRTL ? "ميعاد الاجتماع" : "Meeting time"}</p>
                <p className="text-muted-foreground">{new Date(String((brief as any).meetingAt).replace(" ", "T")).toLocaleString()}</p>
              </div>
            )}
            {(brief as any)?.talkingPoints && (
              <div>
                <p className="font-medium mb-1">Talking Points</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{(brief as any).talkingPoints}</p>
              </div>
            )}
            {(brief as any)?.objectives && (
              <div>
                <p className="font-medium mb-1">Objectives</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{(brief as any).objectives}</p>
              </div>
            )}
            {(brief as any)?.clientNeedsToHear && (
              <div>
                <p className="font-medium mb-1">{isRTL ? "العميل محتاج يسمع إيه" : "What client needs to hear"}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{(brief as any).clientNeedsToHear}</p>
              </div>
            )}
            {(brief as any)?.redFlags && (
              <div>
                <p className="font-medium mb-1">Red Flags</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{(brief as any).redFlags}</p>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
