import { useState } from "react";
import { trpc } from "@/lib/trpc";

type CSATSurveyProps = {
  params: {
    clientId: string;
  };
};

export default function CSATSurvey({ params }: CSATSurveyProps) {
  const clientId = Number(params.clientId);
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.csat.submit.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = async () => {
    if (!clientId || score < 1 || score > 5) return;
    await submitMutation.mutateAsync({
      clientId,
      score,
      feedback: feedback.trim() || null,
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-lg font-bold text-white">IM</div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Customer Satisfaction</p>
            <h1 className="text-2xl font-bold text-slate-900">Iconic Marketing Agency</h1>
          </div>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <h2 className="text-2xl font-bold text-emerald-700">Thank You</h2>
            <p className="mt-2 text-slate-600">Your feedback has been submitted successfully.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">كيف تقيم تجربتك معنا؟</h2>
              <p className="mt-2 text-sm text-slate-500">اختر درجة من 1 إلى 5 ثم أضف ملاحظاتك إذا رغبت.</p>
            </div>

            <div className="flex flex-wrap gap-3">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScore(value)}
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl border text-lg font-bold transition ${
                    score === value
                      ? "border-amber-400 bg-amber-50 text-amber-600"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>

            <div className="flex gap-1 text-3xl">
              {[1, 2, 3, 4, 5].map((value) => (
                <button key={value} type="button" onClick={() => setScore(value)}>
                  <span className={value <= score ? "text-amber-400" : "text-slate-300"}>★</span>
                </button>
              ))}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">Notes (Optional)</label>
              <textarea
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                rows={5}
                placeholder="شاركنا ملاحظاتك"
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={score === 0 || submitMutation.isPending}
              className="rounded-2xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
