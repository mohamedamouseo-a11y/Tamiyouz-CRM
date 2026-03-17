import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/lib/trpc";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { ar } from "date-fns/locale";
import { Bell, Calendar, Check, ChevronLeft, ChevronRight, Clock, ListTodo } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

const PRIORITY_COLORS: Record<string, string> = {
  Low: "bg-blue-500",
  Medium: "bg-yellow-500",
  High: "bg-red-500",
};

const PRIORITY_BADGE: Record<string, string> = {
  Low: "bg-blue-100 text-blue-700 border-blue-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  High: "bg-red-100 text-red-700 border-red-200",
};

const DAY_NAMES_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
const MONTH_NAMES_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

export default function ReminderCalendar() {
  const { t, language } = useLanguage();
  const isRTL = language === "ar";
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const utils = trpc.useUtils();
  const { data: todayReminders } = trpc.leadReminders.getToday.useQuery();
  const { data: calendarReminders } = trpc.leadReminders.getCalendar.useQuery({ month, year });
  const markDoneMutation = trpc.leadReminders.markDone.useMutation({
    onSuccess: () => {
      utils.leadReminders.getToday.invalidate();
      utils.leadReminders.getCalendar.invalidate();
      toast.success(isRTL ? "تم إكمال التذكير" : "Reminder completed");
    },
  });

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const remindersByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    calendarReminders?.forEach((r: any) => {
      const dateKey = format(new Date(r.reminderDate), "yyyy-MM-dd");
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(r);
    });
    return map;
  }, [calendarReminders]);

  const selectedDateReminders = useMemo(() => {
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return remindersByDate[dateKey] ?? [];
  }, [selectedDate, remindersByDate]);

  const pendingToday = todayReminders?.filter((r: any) => r.status === "Pending") ?? [];
  const doneToday = todayReminders?.filter((r: any) => r.status === "Done") ?? [];

  const monthLabel = isRTL
    ? `${MONTH_NAMES_AR[currentDate.getMonth()]} ${year}`
    : format(currentDate, "MMMM yyyy");

  return (
    <div className="space-y-4">
      {/* Today's To Do List */}
      <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-purple-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ListTodo size={16} className="text-indigo-600" />
            {t("todayTasks" as any)}
            {pendingToday.length > 0 && (
              <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-xs px-1.5 py-0" variant="outline">
                {pendingToday.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pendingToday.length === 0 && doneToday.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-xs">
              {isRTL ? "لا توجد مهام لليوم" : "No tasks for today"}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {pendingToday.map((reminder: any) => (
                <div key={reminder.id} className="px-4 py-2.5 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => markDoneMutation.mutate({ id: reminder.id })}
                      className="mt-0.5 w-5 h-5 rounded-full border-2 border-indigo-300 hover:border-green-500 hover:bg-green-50 flex items-center justify-center transition-colors shrink-0"
                    >
                      <Check size={10} className="text-transparent" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{reminder.title}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_BADGE[reminder.priority]}`}>
                          {t((`priority${reminder.priority}`) as any)}
                        </Badge>
                      </div>
                      {reminder.leadName && (
                        <Link href={`/leads/${reminder.leadId}`}>
                          <span className="text-xs text-indigo-600 hover:underline cursor-pointer">
                            {reminder.leadName || reminder.leadPhone}
                          </span>
                        </Link>
                      )}
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        <Clock size={10} />
                        <span>{reminder.reminderTime}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {doneToday.map((reminder: any) => (
                <div key={reminder.id} className="px-4 py-2 opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Check size={10} className="text-green-600" />
                    </div>
                    <span className="text-sm line-through text-muted-foreground flex-1 truncate">{reminder.title}</span>
                    <span className="text-xs text-muted-foreground">{reminder.reminderTime}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar View */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Calendar size={16} />
              {t("reminders" as any)}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft size={14} />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">{monthLabel}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {(isRTL ? DAY_NAMES_AR : DAY_NAMES_EN).map((day) => (
              <div key={day} className="text-center text-[10px] font-medium text-muted-foreground py-1">
                {day}
              </div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {daysInMonth.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayReminders = remindersByDate[dateKey] ?? [];
              const pendingCount = dayReminders.filter((r: any) => r.status === "Pending").length;
              const hasReminders = dayReminders.length > 0;
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={dateKey}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square rounded-md flex flex-col items-center justify-center relative transition-all text-xs
                    ${isSelected ? "bg-indigo-600 text-white shadow-sm" : "hover:bg-muted/80"}
                    ${isTodayDate && !isSelected ? "bg-indigo-50 font-bold text-indigo-600 ring-1 ring-indigo-200" : ""}
                  `}
                >
                  <span className="text-[11px]">{format(day, "d")}</span>
                  {hasReminders && (
                    <div className="flex gap-0.5 mt-0.5">
                      {pendingCount > 0 && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-indigo-500"}`} />
                      )}
                      {dayReminders.some((r: any) => r.status === "Done") && (
                        <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/60" : "bg-green-400"}`} />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected date reminders */}
          {selectedDateReminders.length > 0 && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {format(selectedDate, "dd MMMM yyyy", { locale: isRTL ? ar : undefined })}
              </p>
              {selectedDateReminders.map((reminder: any) => (
                <div
                  key={reminder.id}
                  className={`flex items-center gap-2.5 p-2 rounded-lg border text-sm ${
                    reminder.status === "Done" ? "opacity-50 bg-green-50/30" : "bg-background"
                  }`}
                >
                  {reminder.status === "Pending" ? (
                    <button
                      onClick={() => markDoneMutation.mutate({ id: reminder.id })}
                      className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 hover:border-green-500 shrink-0"
                    />
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <Check size={8} className="text-green-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-medium ${reminder.status === "Done" ? "line-through" : ""}`}>
                      {reminder.title}
                    </span>
                    {reminder.leadName && (
                      <Link href={`/leads/${reminder.leadId}`}>
                        <p className="text-[10px] text-indigo-600 hover:underline">{reminder.leadName}</p>
                      </Link>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{reminder.reminderTime}</span>
                    <div className={`w-2 h-2 rounded-full ${PRIORITY_COLORS[reminder.priority]}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
