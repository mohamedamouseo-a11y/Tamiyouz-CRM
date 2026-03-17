export interface Country {
  name: string;
  nameAr: string;
  code: string;       // ISO 3166-1 alpha-2
  phoneCode: string;  // e.g. "+966"
  flag: string;       // emoji flag
  minDigits: number;  // min digits after country code
  maxDigits: number;  // max digits after country code
}

export const countries: Country[] = [
  // Gulf / Middle East (most relevant first)
  { name: "Saudi Arabia", nameAr: "السعودية", code: "SA", phoneCode: "+966", flag: "🇸🇦", minDigits: 9, maxDigits: 9 },
  { name: "United Arab Emirates", nameAr: "الإمارات", code: "AE", phoneCode: "+971", flag: "🇦🇪", minDigits: 9, maxDigits: 9 },
  { name: "Kuwait", nameAr: "الكويت", code: "KW", phoneCode: "+965", flag: "🇰🇼", minDigits: 8, maxDigits: 8 },
  { name: "Bahrain", nameAr: "البحرين", code: "BH", phoneCode: "+973", flag: "🇧🇭", minDigits: 8, maxDigits: 8 },
  { name: "Qatar", nameAr: "قطر", code: "QA", phoneCode: "+974", flag: "🇶🇦", minDigits: 8, maxDigits: 8 },
  { name: "Oman", nameAr: "عُمان", code: "OM", phoneCode: "+968", flag: "🇴🇲", minDigits: 8, maxDigits: 8 },
  { name: "Yemen", nameAr: "اليمن", code: "YE", phoneCode: "+967", flag: "🇾🇪", minDigits: 9, maxDigits: 9 },
  { name: "Iraq", nameAr: "العراق", code: "IQ", phoneCode: "+964", flag: "🇮🇶", minDigits: 10, maxDigits: 10 },
  { name: "Jordan", nameAr: "الأردن", code: "JO", phoneCode: "+962", flag: "🇯🇴", minDigits: 9, maxDigits: 9 },
  { name: "Lebanon", nameAr: "لبنان", code: "LB", phoneCode: "+961", flag: "🇱🇧", minDigits: 7, maxDigits: 8 },
  { name: "Palestine", nameAr: "فلسطين", code: "PS", phoneCode: "+970", flag: "🇵🇸", minDigits: 9, maxDigits: 9 },
  { name: "Syria", nameAr: "سوريا", code: "SY", phoneCode: "+963", flag: "🇸🇾", minDigits: 9, maxDigits: 9 },

  // North Africa
  { name: "Egypt", nameAr: "مصر", code: "EG", phoneCode: "+20", flag: "🇪🇬", minDigits: 10, maxDigits: 10 },
  { name: "Libya", nameAr: "ليبيا", code: "LY", phoneCode: "+218", flag: "🇱🇾", minDigits: 9, maxDigits: 9 },
  { name: "Tunisia", nameAr: "تونس", code: "TN", phoneCode: "+216", flag: "🇹🇳", minDigits: 8, maxDigits: 8 },
  { name: "Algeria", nameAr: "الجزائر", code: "DZ", phoneCode: "+213", flag: "🇩🇿", minDigits: 9, maxDigits: 9 },
  { name: "Morocco", nameAr: "المغرب", code: "MA", phoneCode: "+212", flag: "🇲🇦", minDigits: 9, maxDigits: 9 },
  { name: "Sudan", nameAr: "السودان", code: "SD", phoneCode: "+249", flag: "🇸🇩", minDigits: 9, maxDigits: 9 },
  { name: "Mauritania", nameAr: "موريتانيا", code: "MR", phoneCode: "+222", flag: "🇲🇷", minDigits: 8, maxDigits: 8 },
  { name: "Somalia", nameAr: "الصومال", code: "SO", phoneCode: "+252", flag: "🇸🇴", minDigits: 7, maxDigits: 8 },
  { name: "Djibouti", nameAr: "جيبوتي", code: "DJ", phoneCode: "+253", flag: "🇩🇯", minDigits: 8, maxDigits: 8 },
  { name: "Comoros", nameAr: "جزر القمر", code: "KM", phoneCode: "+269", flag: "🇰🇲", minDigits: 7, maxDigits: 7 },

  // Major countries
  { name: "United States", nameAr: "الولايات المتحدة", code: "US", phoneCode: "+1", flag: "🇺🇸", minDigits: 10, maxDigits: 10 },
  { name: "United Kingdom", nameAr: "المملكة المتحدة", code: "GB", phoneCode: "+44", flag: "🇬🇧", minDigits: 10, maxDigits: 10 },
  { name: "Canada", nameAr: "كندا", code: "CA", phoneCode: "+1", flag: "🇨🇦", minDigits: 10, maxDigits: 10 },
  { name: "Germany", nameAr: "ألمانيا", code: "DE", phoneCode: "+49", flag: "🇩🇪", minDigits: 10, maxDigits: 11 },
  { name: "France", nameAr: "فرنسا", code: "FR", phoneCode: "+33", flag: "🇫🇷", minDigits: 9, maxDigits: 9 },
  { name: "Italy", nameAr: "إيطاليا", code: "IT", phoneCode: "+39", flag: "🇮🇹", minDigits: 9, maxDigits: 10 },
  { name: "Spain", nameAr: "إسبانيا", code: "ES", phoneCode: "+34", flag: "🇪🇸", minDigits: 9, maxDigits: 9 },
  { name: "Netherlands", nameAr: "هولندا", code: "NL", phoneCode: "+31", flag: "🇳🇱", minDigits: 9, maxDigits: 9 },
  { name: "Belgium", nameAr: "بلجيكا", code: "BE", phoneCode: "+32", flag: "🇧🇪", minDigits: 9, maxDigits: 9 },
  { name: "Switzerland", nameAr: "سويسرا", code: "CH", phoneCode: "+41", flag: "🇨🇭", minDigits: 9, maxDigits: 9 },
  { name: "Austria", nameAr: "النمسا", code: "AT", phoneCode: "+43", flag: "🇦🇹", minDigits: 10, maxDigits: 11 },
  { name: "Sweden", nameAr: "السويد", code: "SE", phoneCode: "+46", flag: "🇸🇪", minDigits: 9, maxDigits: 9 },
  { name: "Norway", nameAr: "النرويج", code: "NO", phoneCode: "+47", flag: "🇳🇴", minDigits: 8, maxDigits: 8 },
  { name: "Denmark", nameAr: "الدنمارك", code: "DK", phoneCode: "+45", flag: "🇩🇰", minDigits: 8, maxDigits: 8 },
  { name: "Finland", nameAr: "فنلندا", code: "FI", phoneCode: "+358", flag: "🇫🇮", minDigits: 9, maxDigits: 10 },
  { name: "Portugal", nameAr: "البرتغال", code: "PT", phoneCode: "+351", flag: "🇵🇹", minDigits: 9, maxDigits: 9 },
  { name: "Greece", nameAr: "اليونان", code: "GR", phoneCode: "+30", flag: "🇬🇷", minDigits: 10, maxDigits: 10 },
  { name: "Poland", nameAr: "بولندا", code: "PL", phoneCode: "+48", flag: "🇵🇱", minDigits: 9, maxDigits: 9 },
  { name: "Czech Republic", nameAr: "التشيك", code: "CZ", phoneCode: "+420", flag: "🇨🇿", minDigits: 9, maxDigits: 9 },
  { name: "Romania", nameAr: "رومانيا", code: "RO", phoneCode: "+40", flag: "🇷🇴", minDigits: 9, maxDigits: 9 },
  { name: "Hungary", nameAr: "المجر", code: "HU", phoneCode: "+36", flag: "🇭🇺", minDigits: 9, maxDigits: 9 },
  { name: "Ireland", nameAr: "أيرلندا", code: "IE", phoneCode: "+353", flag: "🇮🇪", minDigits: 9, maxDigits: 9 },
  { name: "Russia", nameAr: "روسيا", code: "RU", phoneCode: "+7", flag: "🇷🇺", minDigits: 10, maxDigits: 10 },
  { name: "Ukraine", nameAr: "أوكرانيا", code: "UA", phoneCode: "+380", flag: "🇺🇦", minDigits: 9, maxDigits: 9 },

  // Turkey & Central Asia
  { name: "Turkey", nameAr: "تركيا", code: "TR", phoneCode: "+90", flag: "🇹🇷", minDigits: 10, maxDigits: 10 },
  { name: "Iran", nameAr: "إيران", code: "IR", phoneCode: "+98", flag: "🇮🇷", minDigits: 10, maxDigits: 10 },
  { name: "Pakistan", nameAr: "باكستان", code: "PK", phoneCode: "+92", flag: "🇵🇰", minDigits: 10, maxDigits: 10 },
  { name: "Afghanistan", nameAr: "أفغانستان", code: "AF", phoneCode: "+93", flag: "🇦🇫", minDigits: 9, maxDigits: 9 },
  { name: "Kazakhstan", nameAr: "كازاخستان", code: "KZ", phoneCode: "+7", flag: "🇰🇿", minDigits: 10, maxDigits: 10 },
  { name: "Uzbekistan", nameAr: "أوزبكستان", code: "UZ", phoneCode: "+998", flag: "🇺🇿", minDigits: 9, maxDigits: 9 },

  // South & East Asia
  { name: "India", nameAr: "الهند", code: "IN", phoneCode: "+91", flag: "🇮🇳", minDigits: 10, maxDigits: 10 },
  { name: "China", nameAr: "الصين", code: "CN", phoneCode: "+86", flag: "🇨🇳", minDigits: 11, maxDigits: 11 },
  { name: "Japan", nameAr: "اليابان", code: "JP", phoneCode: "+81", flag: "🇯🇵", minDigits: 10, maxDigits: 10 },
  { name: "South Korea", nameAr: "كوريا الجنوبية", code: "KR", phoneCode: "+82", flag: "🇰🇷", minDigits: 9, maxDigits: 10 },
  { name: "Indonesia", nameAr: "إندونيسيا", code: "ID", phoneCode: "+62", flag: "🇮🇩", minDigits: 9, maxDigits: 12 },
  { name: "Malaysia", nameAr: "ماليزيا", code: "MY", phoneCode: "+60", flag: "🇲🇾", minDigits: 9, maxDigits: 10 },
  { name: "Philippines", nameAr: "الفلبين", code: "PH", phoneCode: "+63", flag: "🇵🇭", minDigits: 10, maxDigits: 10 },
  { name: "Thailand", nameAr: "تايلاند", code: "TH", phoneCode: "+66", flag: "🇹🇭", minDigits: 9, maxDigits: 9 },
  { name: "Vietnam", nameAr: "فيتنام", code: "VN", phoneCode: "+84", flag: "🇻🇳", minDigits: 9, maxDigits: 10 },
  { name: "Bangladesh", nameAr: "بنغلاديش", code: "BD", phoneCode: "+880", flag: "🇧🇩", minDigits: 10, maxDigits: 10 },
  { name: "Sri Lanka", nameAr: "سريلانكا", code: "LK", phoneCode: "+94", flag: "🇱🇰", minDigits: 9, maxDigits: 9 },
  { name: "Nepal", nameAr: "نيبال", code: "NP", phoneCode: "+977", flag: "🇳🇵", minDigits: 10, maxDigits: 10 },
  { name: "Singapore", nameAr: "سنغافورة", code: "SG", phoneCode: "+65", flag: "🇸🇬", minDigits: 8, maxDigits: 8 },

  // Africa
  { name: "Nigeria", nameAr: "نيجيريا", code: "NG", phoneCode: "+234", flag: "🇳🇬", minDigits: 10, maxDigits: 10 },
  { name: "South Africa", nameAr: "جنوب أفريقيا", code: "ZA", phoneCode: "+27", flag: "🇿🇦", minDigits: 9, maxDigits: 9 },
  { name: "Kenya", nameAr: "كينيا", code: "KE", phoneCode: "+254", flag: "🇰🇪", minDigits: 9, maxDigits: 9 },
  { name: "Ethiopia", nameAr: "إثيوبيا", code: "ET", phoneCode: "+251", flag: "🇪🇹", minDigits: 9, maxDigits: 9 },
  { name: "Ghana", nameAr: "غانا", code: "GH", phoneCode: "+233", flag: "🇬🇭", minDigits: 9, maxDigits: 9 },
  { name: "Tanzania", nameAr: "تنزانيا", code: "TZ", phoneCode: "+255", flag: "🇹🇿", minDigits: 9, maxDigits: 9 },
  { name: "Uganda", nameAr: "أوغندا", code: "UG", phoneCode: "+256", flag: "🇺🇬", minDigits: 9, maxDigits: 9 },
  { name: "Senegal", nameAr: "السنغال", code: "SN", phoneCode: "+221", flag: "🇸🇳", minDigits: 9, maxDigits: 9 },

  // Americas
  { name: "Mexico", nameAr: "المكسيك", code: "MX", phoneCode: "+52", flag: "🇲🇽", minDigits: 10, maxDigits: 10 },
  { name: "Brazil", nameAr: "البرازيل", code: "BR", phoneCode: "+55", flag: "🇧🇷", minDigits: 10, maxDigits: 11 },
  { name: "Argentina", nameAr: "الأرجنتين", code: "AR", phoneCode: "+54", flag: "🇦🇷", minDigits: 10, maxDigits: 10 },
  { name: "Colombia", nameAr: "كولومبيا", code: "CO", phoneCode: "+57", flag: "🇨🇴", minDigits: 10, maxDigits: 10 },
  { name: "Chile", nameAr: "تشيلي", code: "CL", phoneCode: "+56", flag: "🇨🇱", minDigits: 9, maxDigits: 9 },

  // Oceania
  { name: "Australia", nameAr: "أستراليا", code: "AU", phoneCode: "+61", flag: "🇦🇺", minDigits: 9, maxDigits: 9 },
  { name: "New Zealand", nameAr: "نيوزيلندا", code: "NZ", phoneCode: "+64", flag: "🇳🇿", minDigits: 9, maxDigits: 10 },
];

export function getCountryByCode(code: string): Country | undefined {
  return countries.find((c) => c.code === code);
}

export function getCountryByPhoneCode(phoneCode: string): Country | undefined {
  return countries.find((c) => c.phoneCode === phoneCode);
}

export function getCountryByName(name: string): Country | undefined {
  return countries.find((c) => c.name === name || c.nameAr === name);
}
