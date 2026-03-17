import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

const qualityConfig = {
  Hot: { class: "lead-quality-hot", icon: "🔥" },
  Warm: { class: "lead-quality-warm", icon: "☀️" },
  Cold: { class: "lead-quality-cold", icon: "❄️" },
  Bad: { class: "lead-quality-bad", icon: "👎" },
  Unknown: { class: "lead-quality-unknown", icon: "❓" },
};

interface Props {
  quality: string;
  size?: "sm" | "md";
}

export default function LeadQualityBadge({ quality, size = "md" }: Props) {
  const { t } = useLanguage();
  const config = qualityConfig[quality as keyof typeof qualityConfig] ?? qualityConfig.Unknown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        config.class,
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1"
      )}
    >
      <span>{config.icon}</span>
      <span>{t(quality as any)}</span>
    </span>
  );
}
