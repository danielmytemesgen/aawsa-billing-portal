import * as React from "react";
import {
  BarChart2, MapPin, ClipboardList, Activity, RefreshCcw, Building,
  UserCog, UserCheck, ShieldCheck, Bell, LibraryBig, Map,
  BookText, FileText, AlertOctagon, LifeBuoy, Gauge, Users,
  FileDown, BarChart3, CheckCircle2, Send, FileClock, Settings,
  Megaphone, Shield, Trash2, Database, Scale, Wallet,
} from "lucide-react";

export type LanguageMode = "en" | "am" | "both";

export type Callout = {
  type: "info" | "warning" | "tip" | "danger";
  text: string;
  amharicText: string;
};

export type TableData = {
  headers: string[];
  rows: string[][];
};

export type ContentBlock = {
  heading: string;
  amharicHeading: string;
  body?: string;
  amharicBody?: string;
  steps?: string[];
  amharicSteps?: string[];
  table?: TableData;
  amharicTable?: TableData;
  diagram?: "billing-workflow" | "meter-hierarchy" | "user-roles" | "payment-flow";
  callouts?: Callout[];
};

export type Section = {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  amharicTitle: string;
  badge: string;
  amharicBadge: string;
  group: string;
  color: string;
  gradient: string;
  accentLight: string;
  content: ContentBlock[];
};

export type GlossaryTerm = {
  english: string;
  amharic: string;
  phonetic: string;
  category: "Metering" | "Billing" | "Workflow" | "Tariff & Finance" | "System";
  definitionEn: string;
  definitionAm: string;
};

// ─── Bilingual Glossary Data (AAWSA Specific) ───────────────────────────────────

export const BILINGUAL_GLOSSARY: GlossaryTerm[] = [
  // Metering
  {
    english: "Bulk Meter",
    amharic: "የጅምላ ውሃ ቆጣሪ",
    phonetic: "Ye-jimla Wuha Qotari",
    category: "Metering",
    definitionEn: "Master water meter measuring aggregate consumption for condominiums, commercial zones, or residential clusters.",
    definitionAm: "ለጋራ ህንፃዎች፣ ለኮንዶሚኒየም ወይም ለንግድ ማዕከላት የተተከለ ዋና የውሃ መለኪያ ቆጣሪ።",
  },
  {
    english: "Individual Customer / Sub-Meter",
    amharic: "የግል ተጠቃሚ / ንዑስ ቆጣሪ",
    phonetic: "Ye-gil Teteqaami / Ni'us Qotari",
    category: "Metering",
    definitionEn: "Sub-meter measuring individual tenant or household consumption under a parent bulk meter.",
    definitionAm: "በዋናው የጅምላ ቆጣሪ ስር የተመዘገበ የግል ቤት ወይም የነዋሪ መለኪያ ቆጣሪ።",
  },
  {
    english: "Meter Reading",
    amharic: "የቆጣሪ ንባብ",
    phonetic: "Ye-qotari Nibab",
    category: "Metering",
    definitionEn: "Current numeric index recorded from the physical meter dial by a field reader.",
    definitionAm: "በመስክ ቆጣሪ አንባቢዎች ከቆጣሪው ላይ ተመልክተው የሚመዘገብ የፍጆታ አሀዝ።",
  },
  {
    english: "Water Consumption",
    amharic: "የውሃ ፍጆታ",
    phonetic: "Ye-wuha Fijota",
    category: "Metering",
    definitionEn: "Volume of water utilized during a cycle in cubic meters (m³), computed as Current Reading minus Previous Reading.",
    definitionAm: "በአንድ የቢል ዑደት ውስጥ ጥቅም ላይ የዋለ የውሃ መጠን በኪዩቢክ ሜትር (m³)።",
  },
  {
    english: "Meter Change / Replacement",
    amharic: "የቆጣሪ ቅያሬ",
    phonetic: "Ye-qotari Qiyare",
    category: "Metering",
    definitionEn: "Field process of replacing a damaged, aged, or malfunctioning meter with a new unit while preserving reading continuity.",
    definitionAm: "የተበላሸ ወይም ያረጀ ቆጣሪን በአዲስ የመተካት እና የንባብ ቀጣይነትን የማስጠበቅ ሂደት።",
  },
  {
    english: "Reading Route",
    amharic: "የንባብ መስመር",
    phonetic: "Ye-nibab Mesmer",
    category: "Metering",
    definitionEn: "Geographic path or cluster of meters assigned to a specific meter reader for regular cycle inspection.",
    definitionAm: "ለአንድ ቆጣሪ አንባቢ በዞን ወይም በመንደር ተከፋፍሎ የተሰጠ የቆጣሪዎች ስብስብ።",
  },

  // Billing
  {
    english: "Billing Cycle",
    amharic: "የቢል ማውጫ ዑደት",
    phonetic: "Ye-bill Mawcha Udet",
    category: "Billing",
    definitionEn: "Regular calendar period (usually monthly) in which readings are converted into computed charges and statements.",
    definitionAm: "በየወሩ የቆጣሪ ንባብ ተሰብስቦ የፍጆታ ሂሳብ ተሰልቶ ደረሰኝ የሚዘጋጅበት ጊዜ።",
  },
  {
    english: "Draft Bill",
    amharic: "ረቂቅ ቢል",
    phonetic: "Reqiq Bill",
    category: "Billing",
    definitionEn: "Initial generated bill undergoing verification, editable by staff before formal submission.",
    definitionAm: "የተሰላ ነገር ግን ገና ያልጸደቀ እና ሊስተካከል የሚችል የመጀመሪያ ደረጃ ደረሰኝ።",
  },
  {
    english: "Posted Bill",
    amharic: "የተለጠፈ / የተረጋገጠ ቢል",
    phonetic: "Yeteletefe Bill",
    category: "Billing",
    definitionEn: "Approved, finalized, and locked bill that has been issued to the customer and is active for payment collection.",
    definitionAm: "ተረጋግጦና ጸድቆ ለደንበኛው የተላከ፣ ክፍያ የሚፈጸምበት የመጨረሻ ህጋዊ ደረሰኝ።",
  },
  {
    english: "Correction Bill (CORR)",
    amharic: "የማስተካከያ ቢል",
    phonetic: "Yemastekakeya Bill",
    category: "Billing",
    definitionEn: "Adjustment bill generated to replace a reversed posted bill when reading or calculation errors are identified.",
    definitionAm: "በተሳሳተ ንባብ ወይም ስሌት ምክንያት የተሰረዘን ቢል ለማረም የሚዘጋጅ አዲስ ደረሰኝ።",
  },
  {
    english: "Carrying Balance",
    amharic: "የተሸጋገረ ቀሪ ሂሳብ",
    phonetic: "Yeteshegagere Qeri Hisab",
    category: "Billing",
    definitionEn: "Unpaid balance or surplus credit from previous periods rolled forward into the current bill statement.",
    definitionAm: "ካለፈው የቢል ዑደት ያልተከፈለ ዕዳ ወይም ትርፍ ክፍያ ወደ አዲሱ ቢል የሚሸጋገርበት አሰራር።",
  },

  // Workflow
  {
    english: "Pending Approval",
    amharic: "ይሁንታ በመጠባበቅ ላይ",
    phonetic: "Yihunta Bemetababeq Lay",
    category: "Workflow",
    definitionEn: "Workflow state where a draft bill is submitted to supervisors for verification before posting.",
    definitionAm: "ረቂቅ ቢሉ በቅርንጫፍ ተቆጣጣሪዎች ወይም በኃላፊዎች እስኪመረመር የሚቆይበት ሁኔታ።",
  },
  {
    english: "Rework / Send Back",
    amharic: "ለማስተካከያ የተመለሰ",
    phonetic: "Lemastekakeya Yetemelese",
    category: "Workflow",
    definitionEn: "Supervisor action returning a pending bill back to draft status with corrective instructions.",
    definitionAm: "ጉድለት ወይም ስህተት የተገኘበት ቢል በኃላፊው ወደ ረቂቅ ተመልሶ እንዲስተካከል የሚደረግበት።",
  },
  {
    english: "Batch Billing",
    amharic: "የጅምላ ቢል ማውጣት",
    phonetic: "Ye-jimla Bill Mawtaat",
    category: "Workflow",
    definitionEn: "Automated batch background job that computes bills for all meters within an entire branch at once.",
    definitionAm: "በአንድ ቅርንጫፍ ስር ያሉትን ሁሉንም ቆጣሪዎች በአንድ ጊዜ በኮምፒዩተር ስርዓት ቢል የማውጣት ስራ።",
  },

  // Tariff & Finance
  {
    english: "Tariff Structure",
    amharic: "የታሪፍ ተመን መዋቅር",
    phonetic: "Ye-tariff Temen Mewaqir",
    category: "Tariff & Finance",
    definitionEn: "Official AAWSA price matrix establishing consumption tiers and applicable rates by customer category.",
    definitionAm: "በደንበኞች አይነት (የቤት፣ የንግድ፣ የቦቴ) የተከፋፈለ የውሃ መሸጫ ህጋዊ ዋጋ ዝርዝር።",
  },
  {
    english: "Base Water Rate",
    amharic: "የመነሻ ውሃ ዋጋ",
    phonetic: "Yemenesha Wuha Waaga",
    category: "Tariff & Finance",
    definitionEn: "Tiered rate per cubic meter (m³) of water consumed within established volume brackets.",
    definitionAm: "በፍጆታ እርከን መሰረት ለአንድ ኪዩቢክ ሜትር ውሃ የሚታሰብ ክፍያ።",
  },
  {
    english: "Sanitation & Sewerage Fee",
    amharic: "የፍሳሽ ማስወገጃና ሳኒቴሽን ክፍያ",
    phonetic: "Ye-fissash Maswogeja Kifya",
    category: "Tariff & Finance",
    definitionEn: "Service fee calculated as a percentage of water charge for wastewater disposal and sewer connectivity.",
    definitionAm: "ለቆሻሻ ፍሳሽ ማስወገጃ መስመር እና ለአካባቢ ጽዳት አገልግሎት የሚከፈል ተመን።",
  },
  {
    english: "Maintenance Fee",
    amharic: "የመስመር ጥገና ክፍያ",
    phonetic: "Ye-mesmer Tigena Kifya",
    category: "Tariff & Finance",
    definitionEn: "Fixed service charge allocated for municipal pipeline maintenance, valve upkeep, and meter network integrity.",
    definitionAm: "የውሃ ቱቦዎች፣ የመስመርና የመሰረተ-ልማት ጥገናን ለመሸፈን በየወሩ የሚታሰብ ክፍያ።",
  },
  {
    english: "Meter Rent",
    amharic: "የቆጣሪ ኪራይ",
    phonetic: "Ye-qotari Kiray",
    category: "Tariff & Finance",
    definitionEn: "Monthly fee charged for the equipment lease and calibration of the authority's meter installation.",
    definitionAm: "ለተተከለው የመንግስት ቆጣሪ አገልግሎት በየወሩ የሚከፈል መጠነኛ የኪራይ ክፍያ።",
  },
  {
    english: "Overdue Penalty",
    amharic: "የዘገየ ክፍያ ቅጣት",
    phonetic: "Ye-zegeye Kifya Qitaat",
    category: "Tariff & Finance",
    definitionEn: "Statutory surcharge compounded on accounts exceeding the grace payment threshold past the due date.",
    definitionAm: "የመክፈያ ጊዜው ካለፈ በኋላ ክፍያ ላልፈጸሙ ደንበኞች የሚጣል ህጋዊ የወለድ ቅጣት።",
  },
  {
    english: "Payment Settlement",
    amharic: "የክፍያ ማወራረድ",
    phonetic: "Ye-kifya Maweraared",
    category: "Tariff & Finance",
    definitionEn: "Financial recording of collected funds against a posted bill, marking invoice status as PAID.",
    definitionAm: "ከደንበኛ የተሰበሰበው ገንዘብ በሲስተም ውስጥ ተመዝግቦ የቢል ደረሰኙ 'የተከፈለ' ተብሎ የሚዘጋበት።",
  },

  // System
  {
    english: "Branch Office",
    amharic: "ቅርንጫፍ ጽህፈት ቤት",
    phonetic: "Qirnchaf Tsihefet Biet",
    category: "System",
    definitionEn: "Sub-city administrative hub managing assigned routes, billing reviews, and customer servicing.",
    definitionAm: "በአዲስ አበባ የተለያዩ ክፍለ ከተሞች የሚገኝ የውሃና ፍሳሽ ባለስልጣን የአገልግሎት ማዕከል።",
  },
  {
    english: "Security & Audit Logs",
    amharic: "የደህንነትና የኦዲት ምዝግብ",
    phonetic: "Ye-dehninetina Audit Mizgib",
    category: "System",
    definitionEn: "Immutable audit trail capturing all user logins, billing modifications, approvals, and deletions.",
    definitionAm: "በሲስተሙ ውስጥ ማን፣ መቼ፣ ምን አይነት ለውጥ ወይም ስራ እንዳከናወነ የሚያሳይ የቁጥጥር መዝገብ።",
  },
  {
    english: "Recycle Bin",
    amharic: "የቆሻሻ ማከማቻ (የተሰረዙ መረጃዎች)",
    phonetic: "Ye-qoshasha Makemacha",
    category: "System",
    definitionEn: "Safety holding area for soft-deleted bills and meters, allowing restoration or permanent purge.",
    definitionAm: "በስህተት የተሰረዙ ደረሰኞችን ወይም ቆጣሪዎችን መልሶ ለማግኘት የሚያስችል ጊዜያዊ ማከማቻ።",
  },
  {
    english: "Database Backup",
    amharic: "የመረጃ ቋት ምትኬ",
    phonetic: "Ye-mereja Qwat Mitke",
    category: "System",
    definitionEn: "Compressed archival snapshot of all system tables, meters, and billing ledgers for disaster recovery.",
    definitionAm: "የአደጋ ጊዜ መረጃ እንዳይጠፋ መላውን የሲስተሙን መረጃ በኮምፒዩተር ምትኬ አስቀምጦ መያዝ።",
  },
];

// ─── Group Config ─────────────────────────────────────────────────────────────

export const GROUP_CONFIG: Record<string, {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  gradient: string;
  description: string;
  amharicDescription: string;
  amharicTitle: string;
}> = {
  "Dashboard": {
    icon: BarChart2,
    color: "text-indigo-600",
    gradient: "from-indigo-50 to-purple-50",
    description: "Analytics & KPI overview for all roles",
    amharicDescription: "የሁሉንም የስራ ሚናዎች የአፈፃፀም እና ቁልፍ መረጃዎች ማጠቃለያ",
    amharicTitle: "ዳሽቦርድ (አጠቃላይ እይታ)",
  },
  "Field Operations": {
    icon: MapPin,
    color: "text-teal-600",
    gradient: "from-teal-50 to-cyan-50",
    description: "On-ground meter reading & field tasks",
    amharicDescription: "የመስክ ላይ የቆጣሪ ንባብ እና ተዛማጅ ስራዎች",
    amharicTitle: "የመስክ ስራዎች",
  },
  "Management": {
    icon: UserCog,
    color: "text-violet-600",
    gradient: "from-violet-50 to-purple-50",
    description: "Staff, billing, approvals & configuration",
    amharicDescription: "ሰራተኞች፣ የቢል አስተዳደር፣ ማጽደቂያዎች እና አወቃቀሮች",
    amharicTitle: "አስተዳደር እና ቁጥጥር",
  },
  "Customer & Metering": {
    icon: Gauge,
    color: "text-amber-600",
    gradient: "from-amber-50 to-orange-50",
    description: "Bulk meters, sub-meters & customer data",
    amharicDescription: "የጅምላ ቆጣሪዎች፣ ንዑስ ቆጣሪዎች እና የደንበኞች መረጃ",
    amharicTitle: "ደንበኞች እና ቆጣሪዎች",
  },
  "Data & Reports": {
    icon: BarChart3,
    color: "text-cyan-600",
    gradient: "from-cyan-50 to-blue-50",
    description: "Reports, exports & data entry tools",
    amharicDescription: "ሪፖርቶች፣ ወደ ኤክሴል መላኪያ እና የመረጃ ማስገቢያ መሳሪያዎች",
    amharicTitle: "መረጃ እና ሪፖርቶች",
  },
  "System": {
    icon: Settings,
    color: "text-slate-600",
    gradient: "from-slate-50 to-gray-50",
    description: "Security, backups, settings & maintenance",
    amharicDescription: "ደህንነት፣ ምትኬ፣ ቅንብሮች እና የሲስተም ጥገና",
    amharicTitle: "የስርዓት ቅንብሮች",
  },
};

export const GROUPS = Object.keys(GROUP_CONFIG);

export const CATEGORY_NAMES: Record<string, { en: string; am: string }> = {
  "All": { en: "All", am: "ሁሉም" },
  "Metering": { en: "Metering", am: "የቆጣሪ ስራ" },
  "Billing": { en: "Billing", am: "የቢል ስራ" },
  "Workflow": { en: "Workflow", am: "የስራ ሂደት" },
  "Tariff & Finance": { en: "Tariff & Finance", am: "ታሪፍና ፋይናንስ" },
  "System": { en: "System", am: "የስርዓት" },
};

// ─── 30 Modules (All Sections with Full Amharic Translations) ─────────────────

export const SECTIONS: Section[] = [
  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  {
    id: "dashboard", icon: BarChart2, title: "Dashboard", amharicTitle: "ዳሽቦርድ (አጠቃላይ እይታ)",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Dashboard", color: "bg-indigo-600", gradient: "from-indigo-50 to-purple-50", accentLight: "border-indigo-200 bg-indigo-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The Dashboard is the central command center. It provides a real-time snapshot of billing operations, collection efficiency, and branch-level performance — tailored by your user role.",
        amharicBody: "ዳሽቦርዱ የቢል ስራዎችን፣ የክፍያ አሰባሰብ ቅልጥፍናን እና የቅርንጫፎችን የስራ አፈፃፀም በቀጥታ የሚያሳይ ማዕከል ነው። እንደተጠቃሚው የስራ ሚና የተመቻቸ መረጃን ያቀርባል።",
      },
      {
        heading: "Admin Dashboard — System-Wide View",
        amharicHeading: "የአድሚን ዳሽቦርድ — የመላው ሲስተም እይታ",
        steps: [
          "Log in as Admin and click Dashboard in the left sidebar.",
          "Review summary cards: Total Bills, Paid / Unpaid / Overdue, Total Revenue, Collection Efficiency.",
          "Use the Branch Filter (top right) to narrow data to a specific branch.",
          "Click any summary card to drill into the filtered bill list.",
        ],
        amharicSteps: [
          "እንደ አድሚን ይግቡ እና በግራ በኩል ዳሽቦርድን ይጫኑ።",
          "የማጠቃለያ ካርዶችን ይገምግሙ፡ አጠቃላይ ቢሎች፣ የተከፈሉ / ያልተከፈሉ / ጊዜያቸው ያለፈባቸው፣ አጠቃላይ ገቢ እና የመሰብሰብ ቅልጥፍና።",
          "መረጃውን ወደ አንድ የተወሰነ ቅርንጫፍ ለማጥበብ የቅርንጫፍ ማጣሪያን (ከላይ በቀኝ) ይጠቀሙ።",
          "የተጣራውን የቢል ዝርዝር በዝርዝር ለማየት ማንኛውንም የማጠቃለያ ካርድ ይጫኑ።",
        ],
        callouts: [
          {
            type: "tip",
            text: "Use the Branch Filter with date range filters for precise period analysis.",
            amharicText: "ለተወሰነ የጊዜ ገደብ ትክክለኛ ትንተና የቅርንጫፍ ማጣሪያውን ከቀን ገደብ ማጣሪያዎች ጋር አጣምረው ይጠቀሙ።",
          },
        ],
      },
      {
        heading: "Head Office Dashboard",
        amharicHeading: "የዋና መ/ቤት ዳሽቦርድ",
        steps: [
          "Click Dashboard in the sidebar (head-office role).",
          "View a comparative table of all branches side by side.",
          "Compare collection efficiency and outstanding balances per branch.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ ዳሽቦርድን ይጫኑ (የዋና መ/ቤት ሚና)።",
          "ሁሉንም ቅርንጫፎች ጎን ለጎን የሚያወዳድር ሰንጠረዥ ይመልከቱ።",
          "የክፍያ አሰባሰብ ቅልጥፍናን እና በእያንዳንዱ ቅርንጫፍ ያለውን ቀሪ ሂሳብ ያወዳድሩ።",
        ],
      },
      {
        heading: "Staff Dashboard — Branch View",
        amharicHeading: "የቅርንጫፍ ሰራተኛ ዳሽቦርድ",
        steps: [
          "Log in as Staff and click Dashboard in the sidebar.",
          "View bills pending your action: Draft, Pending Approval.",
          "Review your branch collection summary and overdue meters.",
        ],
        amharicSteps: [
          "እንደ ሰራተኛ ይግቡ እና በጎን አሞሌው ላይ ዳሽቦርድን ይጫኑ።",
          "የእርስዎን እርምጃ የሚጠብቁ ቢሎችን ይመልከቱ፡ ረቂቅ እና ይሁንታ የሚጠብቁ።",
          "የቅርንጫፍዎን የገንዘብ አሰባሰብ ማጠቃለያ እና ክፍያቸው የዘገዩ ቆጣሪዎችን ይገምግሙ።",
        ],
      },
    ],
  },

  // ── FIELD OPERATIONS ──────────────────────────────────────────────────────────
  {
    id: "my-routes", icon: MapPin, title: "My Routes", amharicTitle: "የእኔ የንባብ መስመሮች",
    badge: "Meter Reader", amharicBadge: "ቆጣሪ አንባቢ",
    group: "Field Operations", color: "bg-teal-600", gradient: "from-teal-50 to-cyan-50", accentLight: "border-teal-200 bg-teal-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "My Routes is the dedicated workspace for meter readers. It shows all routes assigned to you, the meters on each route, and allows you to submit readings directly from a mobile or desktop browser.",
        amharicBody: "የእኔ መስመሮች ለቆጣሪ አንባቢዎች የተዘጋጀ የስራ ገጽ ነው። ለእርስዎ የተመደቡትን ሁሉንም መስመሮች፣ በእያንዳንዱ መስመር ላይ ያሉትን ቆጣሪዎች ያሳያል፤ እንዲሁም በቀጥታ ከስልክ ወይም ከኮምፒዩተር ንባብ ለማስገባት ያስችላል።",
      },
      {
        heading: "View Your Assigned Routes",
        amharicHeading: "የተመደቡልዎትን መስመሮች ማየት",
        steps: [
          "Click My Routes in the sidebar (visible to meter readers only).",
          "Your assigned routes are listed with total meters and completion status.",
          "Click a route to see all meters on that route.",
          "Click a meter row to enter a reading directly.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የእኔ መስመሮች' የሚለውን ይጫኑ (ለቆጣሪ አንባቢዎች ብቻ ይታያል)።",
          "የተመደቡልዎት መስመሮች ከአጠቃላይ ቆጣሪዎች እና የማጠናቀቂያ ሁኔታ ጋር ተዘርዝረዋል።",
          "በመስመሩ ላይ ያሉትን ሁሉንም ቆጣሪዎች ለማየት መስመሩን ይጫኑ።",
          "ንባብ በቀጥታ ለማስገባት የቆጣሪውን ረድፍ ይጫኑ።",
        ],
      },
      {
        heading: "Enter a Reading from My Routes",
        amharicHeading: "ከእኔ መስመሮች ገጽ ንባብ ማስገባት",
        steps: [
          "Open a route and click the meter you want to read.",
          "Enter the Current Reading value.",
          "The system computes consumption = Current minus Previous automatically.",
          "Click Submit Reading.",
        ],
        amharicSteps: [
          "መስመሩን ከፍተው ማንበብ የሚፈልጉትን ቆጣሪ ይጫኑ።",
          "የወቅቱን የንባብ ዋጋ (Current Reading) ያስገቡ።",
          "ሲስተሙ ፍጆታውን (የአሁኑ ንባብ ሲቀነስ ያለፈው ንባብ) በራሱ ያሰላል።",
          "'ንባብ አስገባ' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "warning",
            text: "If the current reading is lower than the previous reading, it is flagged for supervisor review.",
            amharicText: "የአሁኑ ንባብ ካለፈው ንባብ ያነሰ ከሆነ ለተቆጣጣሪ ምርመራ ምልክት ይደረግበታል።",
          },
        ],
      },
    ],
  },
  {
    id: "meter-readings", icon: ClipboardList, title: "Meter Readings", amharicTitle: "የቆጣሪ ንባቦች ምዝገባ",
    badge: "Admin / Staff / Reader", amharicBadge: "አድሚን / ሰራተኛ / አንባቢ",
    group: "Field Operations", color: "bg-teal-700", gradient: "from-teal-50 to-green-50", accentLight: "border-teal-200 bg-teal-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Meter Readings is the central hub for entering, reviewing, and managing all reading data — both bulk and individual customer meters. Supports manual entry, CSV batch upload, and correction workflows.",
        amharicBody: "የቆጣሪ ንባቦች ምዝገባ የጅምላ እና የግል ደንበኞችን ንባብ ለማስገባት፣ ለመገምገም እና ለማስተዳደር ዋና ማዕከል ነው። በእጅ ማስገባትን፣ በCSV ፋይል በጅምላ መጫንን እና የእርማት ስራዎችን ይደግፋል።",
      },
      {
        heading: "CSV Upload Format",
        amharicHeading: "የCSV ፋይል መጫኛ ቅርጸት",
        table: {
          headers: ["Column", "Format", "Required", "Notes"],
          rows: [
            ["CUSTOMER_KEY", "Text (e.g. BM-0012)", "✅ Yes", "Must match existing meter"],
            ["READING_DATE", "YYYY-MM-DD", "✅ Yes", "Cannot be a future date"],
            ["METER_READING", "Number (integer)", "✅ Yes", "Must be ≥ previous reading"],
          ],
        },
        amharicTable: {
          headers: ["አምድ (Column)", "ቅርጸት", "አስፈላጊነት", "ማስታወሻ"],
          rows: [
            ["CUSTOMER_KEY", "ፅሁፍ (ምሳሌ፡ BM-0012)", "✅ አዎ", "ከነባር ቆጣሪ ጋር መመሳሰል አለበት"],
            ["READING_DATE", "ዓዓዓዓ-ወወ-ቀቀ (YYYY-MM-DD)", "✅ አዎ", "የወደፊት ቀን መሆን አይችልም"],
            ["METER_READING", "ቁጥር (ሙሉ ቁጥር)", "✅ አዎ", "ከቀዳሚው ንባብ እኩል ወይም የሚበልጥ መሆን አለበት"],
          ],
        },
      },
      {
        heading: "Upload Readings via CSV",
        amharicHeading: "ንባቦችን በCSV ፋይል መጫን",
        steps: [
          "Go to Meter Readings > Upload CSV.",
          "Click Download Template to get the correct CSV format.",
          "Fill the template: columns CUSTOMER_KEY, READING_DATE, METER_READING.",
          "Click Choose File and select your filled CSV.",
          "Click Upload & Preview to see validation results.",
          "Fix any errors highlighted in red, then re-upload.",
          "Click Confirm Upload to save all valid readings.",
        ],
        amharicSteps: [
          "ወደ 'የቆጣሪ ንባቦች' > 'CSV ጫን' ይሂዱ።",
          "ትክክለኛውን የCSV ቅርጸት ለማግኘት 'ቅጽ (Template) አውርድ' የሚለውን ይጫኑ።",
          "ቅጹን ይሙሉ፡ አምዶች CUSTOMER_KEY፣ READING_DATE፣ METER_READING።",
          "'ፋይል ምረጥ' የሚለውን ተጭነው የሞሉትን የCSV ፋይል ይምረጡ።",
          "የማረጋገጫ ውጤቱን ለማየት 'ጫን እና አስቀድመህ እይ' የሚለውን ይጫኑ።",
          "በቀይ የተመለከቱ ስህተቶች ካሉ አርመው እንደገና ይጫኑ።",
          "ሁሉንም ትክክለኛ ንባቦች ለማስቀመጥ 'መጫኑን አረጋግጥ' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "info",
            text: "The system validates each row before importing. Only rows with no errors are saved.",
            amharicText: "ሲስተሙ ከመጫኑ በፊት እያንዳንዱን ረድፍ ያረጋግጣል። ምንም ስህተት የሌለባቸው ረድፎች ብቻ ይቀመጣሉ።",
          },
          {
            type: "warning",
            text: "Readings lower than the previous reading are flagged but can be manually confirmed by an admin.",
            amharicText: "ከቀዳሚው ንባብ ያነሱ ንባቦች ምልክት ይደረግባቸዋል፤ ነገር ግን በአድሚን በእጅ ሊረጋገጡ ይችላሉ።",
          },
        ],
      },
      {
        heading: "Edit / Recalculate a Reading",
        amharicHeading: "ንባብን ማረም / እንደገና ማስላት",
        body: "Requires the meter_readings_edit_recalculate permission (Supervisors and Admins only).",
        amharicBody: "የንባብ ማረምና እንደገና ማስላት ፈቃድ (meter_readings_edit_recalculate) ያስፈልጋል (ለተቆጣጣሪዎች እና አድሚኖች ብቻ)።",
        steps: [
          "Find the reading in the list.",
          "Click the Edit (pencil) icon on the row.",
          "Update the reading value.",
          "Click Save & Recalculate — consumption and bill charges are updated automatically.",
        ],
        amharicSteps: [
          "በዝርዝሩ ውስጥ ንባቡን ያግኙ።",
          "በረድፉ ላይ ያለውን የእርሳስ ምልክት (Edit) ይጫኑ።",
          "የንባብ ዋጋውን ያሻሽሉ።",
          "'አስቀምጥ እና እንደገና አስላ' የሚለውን ይጫኑ — ፍጆታ እና የቢል ክፍያዎች በራስ-ሰር ይስተካከላሉ።",
        ],
        callouts: [
          {
            type: "danger",
            text: "Editing a reading on an already-posted bill will mark that bill for review. Contact your supervisor before editing historical readings.",
            amharicText: "ቀድሞ በተለጠፈ (Posted) ቢል ላይ ንባብ ማረም ቢሉ ለግምገማ እንዲቀርብ ያደርገዋል። ያለፉ ንባቦችን ከማረምዎ በፊት ተቆጣጣሪዎን ያማክሩ።",
          },
        ],
      },
    ],
  },
  {
    id: "reader-monitoring", icon: Activity, title: "Reader Monitoring", amharicTitle: "የአንባቢዎች የስራ ክትትል",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Field Operations", color: "bg-cyan-600", gradient: "from-cyan-50 to-sky-50", accentLight: "border-cyan-200 bg-cyan-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Reader Monitoring gives supervisors a live view of meter reader performance — tracking completion rates, last activity, and identifying readers who are behind schedule.",
        amharicBody: "የአንባቢዎች ክትትል ተቆጣጣሪዎች የቆጣሪ አንባቢዎችን የስራ አፈፃፀም በቀጥታ እንዲከታተሉ ያስችላል — የማጠናቀቂያ መጠንን፣ የመጨረሻ የስራ እንቅስቃሴን እና ወደኋላ የቀሩ አንባቢዎችን ለመለየት ይረዳል።",
      },
      {
        heading: "Monitor Reader Progress",
        amharicHeading: "የአንባቢዎችን የስራ ሂደት መከታተል",
        steps: [
          "Click Reader Monitoring in the sidebar.",
          "View a table of assigned routes per reader: total meters, meters read, % completion, last reading date.",
          "Filter by Branch or Date Range.",
          "Use this to identify readers who are behind schedule.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የአንባቢዎች ክትትል' የሚለውን ይጫኑ።",
          "ለእያንዳንዱ አንባቢ የተመደቡ መስመሮችን ሰንጠረዥ ይመልከቱ፡ አጠቃላይ ቆጣሪዎች፣ የተነበቡ ቆጣሪዎች፣ የተጠናቀቀ % እና የመጨረሻ የንባብ ቀን።",
          "በቅርንጫፍ ወይም በቀን ገደብ ያጣሩ።",
          "ይህን በመጠቀም ከፕሮግራም ወደኋላ የቀሩ አንባቢዎችን ይለዩ።",
        ],
        table: {
          headers: ["Column", "Description"],
          rows: [
            ["Reader Name", "Staff member assigned to the route"],
            ["Route", "The route they are responsible for"],
            ["Total Meters", "Total number of meters on the route"],
            ["Meters Read", "Readings submitted so far this cycle"],
            ["% Completion", "Progress toward 100% for this period"],
            ["Last Reading", "Date of most recent submission"],
          ],
        },
        amharicTable: {
          headers: ["አምድ", "መግለጫ"],
          rows: [
            ["የአንባቢው ስም", "ለመስመሩ የተመደበው ሰራተኛ"],
            ["መስመር", "ኃላፊነት የተሰጠበት የንባብ መስመር"],
            ["አጠቃላይ ቆጣሪዎች", "በመስመሩ ላይ ያሉ አጠቃላይ ቆጣሪዎች ብዛት"],
            ["የተነበቡ ቆጣሪዎች", "በዚህ ዑደት እስካሁን የገቡ ንባቦች"],
            ["የማጠናቀቂያ %", "ለዚህ ጊዜ 100% ለማድረስ የተከናወነ ሂደት"],
            ["የመጨረሻ ንባብ", "በጣም የቅርብ ጊዜ ንባብ የገባበት ቀን"],
          ],
        },
      },
    ],
  },
  {
    id: "meter-change", icon: RefreshCcw, title: "Meter Change", amharicTitle: "የቆጣሪ ቅያሬ",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Field Operations", color: "bg-amber-600", gradient: "from-amber-50 to-yellow-50", accentLight: "border-amber-200 bg-amber-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The Meter Change module tracks physical meter replacements in the field. When a faulty or aged meter is replaced, this module records both the final reading of the old meter and the opening reading of the new one — ensuring billing continuity.",
        amharicBody: "የቆጣሪ ቅያሬ ሞጁል በመስክ ላይ የሚደረጉ የቆጣሪ ለውጦችን ይከታተላል። የተበላሸ ወይም ያረጀ ቆጣሪ በአዲስ ሲተካ፣ ይህ ክፍል የድሮውን ቆጣሪ የመጨረሻ ንባብ እና የአዲሱን መነሻ ንባብ ይመዘግባል — ይህም የቢል ስሌት ቀጣይነትን ያረጋግጣል።",
      },
      {
        heading: "Log a Meter Change (Field Replacement)",
        amharicHeading: "የቆጣሪ ቅያሬ መመዝገብ (የመስክ ቅያሬ)",
        steps: [
          "Click Meter Change in the sidebar.",
          "Click New Meter Change.",
          "Select the Bulk Meter being changed.",
          "Fill in: Old Meter Key, New Meter Key, Old Meter Final Reading, New Meter Opening Reading (usually 0), Change Date, Reason.",
          "Click Save Meter Change.",
          "The meter's readings are updated automatically; the old meter is archived.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የቆጣሪ ቅያሬ' የሚለውን ይጫኑ።",
          "'አዲስ የቆጣሪ ቅያሬ' የሚለውን ይጫኑ።",
          "የሚቀየረውን የጅምላ ቆጣሪ ይምረጡ።",
          "የሚከተሉትን ይሙሉ፡ የድሮ ቆጣሪ ቁጥር፣ አዲስ ቆጣሪ ቁጥር፣ የድሮ ቆጣሪ የመጨረሻ ንባብ፣ የአዲስ ቆጣሪ መነሻ ንባብ (ብዙውን ጊዜ 0)፣ የተቀየረበት ቀን፣ ምክንያቱ።",
          "'የቆጣሪ ቅያሬ አስቀምጥ' የሚለውን ይጫኑ።",
          "የቆጣሪው ንባብ በራስ-ሰር ይዘመናል፤ አሮጌው ቆጣሪ በማህደር ይቀመጣል።",
        ],
        callouts: [
          {
            type: "info",
            text: "The Old Meter Final Reading must be ≥ the last recorded reading. The system will block the save if not.",
            amharicText: "የድሮው ቆጣሪ የመጨረሻ ንባብ ከመጨረሻው ከተመዘገበው ንባብ እኩል ወይም የሚበልጥ መሆን አለበት። ካልሆነ ሲስተሙ ምዝገባውን ይከለክላል።",
          },
          {
            type: "tip",
            text: "The New Meter Opening Reading is almost always 0 (zero) for a brand-new meter.",
            amharicText: "ለአዲስ ቆጣሪ መነሻ ንባብ ሁልጊዜ ማለት ይቻላል 0 (ዜሮ) ነው።",
          },
        ],
      },
      {
        heading: "View Meter Change History",
        amharicHeading: "የቆጣሪ ቅያሬ ታሪክን ማየት",
        steps: [
          "Click Meter Change in the sidebar.",
          "Filter by meter, date, or branch.",
          "Each entry shows old and new meter details, readings, and who logged the change.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የቆጣሪ ቅያሬ' የሚለውን ይጫኑ።",
          "በቆጣሪ፣ በቀን ወይም በቅርንጫፍ ያጣሩ።",
          "እያንዳንዱ ምዝገባ የድሮ እና አዲስ ቆጣሪ ዝርዝሮችን፣ ንባቦችን እና ቅያሬውን የመዘገበውን ሰው ያሳያል።",
        ],
      },
    ],
  },

  // ── MANAGEMENT ────────────────────────────────────────────────────────────────
  {
    id: "branches", icon: Building, title: "Branch Management", amharicTitle: "የቅርንጫፎች አስተዳደር",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "Management", color: "bg-slate-600", gradient: "from-slate-50 to-gray-50", accentLight: "border-slate-200 bg-slate-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Branches represent the physical service offices of AAWSA (e.g., Megenagna, Bole, Kirkos). All meters, staff, and bills belong to a branch. The Admin can create, edit, and archive branches here.",
        amharicBody: "ቅርንጫፎች የባለስልጣኑን የአገልግሎት ጽህፈት ቤቶች ይወክላሉ (ለምሳሌ፡ መገናኛ፣ ቦሌ፣ ቂርቆስ)። ሁሉም ቆጣሪዎች፣ ሰራተኞች እና ቢሎች የአንድ ቅርንጫፍ አካል ናቸው። አድሚን ቅርንጫፎችን እዚህ መፍጠር፣ ማረም እና መሰረዝ ይችላል።",
      },
      {
        heading: "Create a New Branch",
        amharicHeading: "አዲስ ቅርንጫፍ መፍጠር",
        steps: [
          "Click + New Branch.",
          "Enter the full Name (e.g. Megenagna Branch) and 2-letter Code (e.g. MG).",
          "Click Save.",
        ],
        amharicSteps: [
          "'+ አዲስ ቅርንጫፍ' የሚለውን ይጫኑ።",
          "ሙሉ ስሙን (ምሳሌ፡ መገናኛ ቅርንጫፍ) እና ባለ 2-ፊደል ኮድ (ምሳሌ፡ MG) ያስገቡ።",
          "'አስቀምጥ' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "info",
            text: "The 2-letter branch code is used as a prefix for customer keys and billing references (e.g. MG-00123).",
            amharicText: "ባለ 2-ፊደል የቅርንጫፍ ኮድ ለደንበኞች መለያ ቁጥር እና ለቢል መለያ እንደ ቅድመ-ቅጥያ ያገለግላል (ምሳሌ፡ MG-00123)።",
          },
        ],
      },
      {
        heading: "Edit / Archive a Branch",
        amharicHeading: "ቅርንጫፍን ማረም / መሰረዝ",
        steps: [
          "Click a branch row to open it.",
          "Click Edit, update the fields, click Save.",
          "To delete: click Delete then confirm. Only possible if no active meters or staff are assigned.",
        ],
        amharicSteps: [
          "ለመክፈት የቅርንጫፉን ረድፍ ይጫኑ።",
          "'አርም' (Edit) የሚለውን ተጭነው መረጃዎችን ያሻሽሉ፣ ከዚያ 'አስቀምጥ'ን ይጫኑ።",
          "ለመሰረዝ፡ 'ሰርዝ'ን ተጭነው ያረጋግጡ። ይህ የሚቻለው ምንም አይነት ንቁ ቆጣሪ ወይም ሰራተኛ ያልተመደበበት ከሆነ ብቻ ነው።",
        ],
        callouts: [
          {
            type: "warning",
            text: "Deleting a branch with active meters or staff is blocked. Reassign them first.",
            amharicText: "ንቁ ቆጣሪዎች ወይም ሰራተኞች ያሉት ቅርንጫፍ መሰረዝ አይቻልም። መጀመሪያ ወደ ሌላ ቅርንጫፍ ያዛውሯቸው።",
          },
        ],
      },
    ],
  },
  {
    id: "staff-management", icon: UserCog, title: "Staff Management", amharicTitle: "የሰራተኞች ምዝገባና አስተዳደር",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "Management", color: "bg-violet-600", gradient: "from-violet-50 to-purple-50", accentLight: "border-violet-200 bg-violet-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Staff Management is where Admins create, configure, and deactivate staff accounts. Each staff member is assigned a Branch, Role, and login credentials.",
        amharicBody: "የሰራተኞች አስተዳደር አድሚኖች የሰራተኞችን አካውንት የሚፈጥሩበት፣ የሚያዋቅሩበት እና የሚያግዱበት ክፍል ነው። ለእያንዳንዱ ሰራተኛ ቅርንጫፍ፣ የስራ ሚና እና የመግቢያ ምስክር ወረቀት ይመደብለታል።",
        diagram: "user-roles",
      },
      {
        heading: "Create a New Staff Member",
        amharicHeading: "አዲስ ሰራተኛ መመዝገብ",
        steps: [
          "Click + Add Staff.",
          "Fill in: Name, Email (login username), Temporary Password, Branch, Role.",
          "Click Create Staff.",
          "Inform the staff member to change their password on first login.",
        ],
        amharicSteps: [
          "'+ ሰራተኛ ጨምር' የሚለውን ይጫኑ።",
          "የሚከተሉትን ይሙሉ፡ ስም፣ ኢሜይል (የመግቢያ ስም)፣ ጊዜያዊ የይለፍ ቃል፣ ቅርንጫፍ፣ የስራ ሚና።",
          "'ሰራተኛ ፍጠር' የሚለውን ይጫኑ።",
          "ሰራተኛው በመጀመሪያው መግቢያ ላይ የይለፍ ቃሉን እንዲቀይር ያሳውቁ።",
        ],
        callouts: [
          {
            type: "tip",
            text: "Use a strong temporary password: minimum 8 characters, 1 uppercase, 1 number.",
            amharicText: "ጠንካራ ጊዜያዊ የይለፍ ቃል ይጠቀሙ፡ ቢያንስ 8 ፊደላት፣ 1 የካፒታል ፊደል እና 1 ቁጥር።",
          },
        ],
      },
      {
        heading: "Deactivate / Delete Staff",
        amharicHeading: "ሰራተኛን ማገድ / መሰረዝ",
        steps: [
          "To deactivate: Edit the staff record, change Status to Inactive, click Save.",
          "To permanently remove: click Delete then confirm. This is irreversible.",
        ],
        amharicSteps: [
          "ለማገድ፡ የሰራተኛውን መረጃ አርመው ሁኔታውን ወደ 'ቦዝኗል' (Inactive) ይቀይሩ፣ ከዚያ 'አስቀምጥ'ን ይጫኑ።",
          "ሙሉ በሙሉ ለማስወገድ፡ 'ሰርዝ'ን ተጭነው ያረጋግጡ። ይህ እርምጃ የማይመለስ ነው።",
        ],
        callouts: [
          {
            type: "danger",
            text: "Permanently deleted staff records cannot be recovered. Use Deactivate unless you are certain.",
            amharicText: "በቋሚነት የተሰረዙ ሰራተኞችን መልሶ ማግኘት አይቻልም። እርግጠኛ ካልሆኑ 'አግድ' (Deactivate) የሚለውን ይጠቀሙ።",
          },
        ],
      },
    ],
  },
  {
    id: "approvals", icon: UserCheck, title: "Approvals", amharicTitle: "የቢል ማጽደቂያዎች",
    badge: "Admin / Supervisor", amharicBadge: "አድሚን / ተቆጣጣሪ",
    group: "Management", color: "bg-blue-600", gradient: "from-blue-50 to-indigo-50", accentLight: "border-blue-200 bg-blue-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The Approvals module is the gatekeeper for the billing workflow. Before a bill can be posted to customers, it must be submitted by staff and approved by a supervisor or admin.",
        amharicBody: "የማጽደቂያ ሞጁል ለቢል ስራ ሂደት ዋና ተቆጣጣሪ ነው። አንድ ቢል ለደንበኞች ከመለጠፉ በፊት በሰራተኛ ቀርቦ በተቆጣጣሪ ወይም በአድሚን መጽደቅ አለበት።",
      },
      {
        heading: "Billing Approval Workflow",
        amharicHeading: "የቢል ማጽደቅ የስራ ሂደት",
        diagram: "billing-workflow",
      },
      {
        heading: "Approve a Bill",
        amharicHeading: "ቢል ማጽደቅ",
        steps: [
          "Open the pending bill.",
          "Review all charges and readings.",
          "Click Approve. The bill moves to Approved status.",
        ],
        amharicSteps: [
          "ይሁንታ የሚጠብቀውን ቢል ይክፈቱ።",
          "ሁሉንም ክፍያዎች እና ንባቦች ይገምግሙ።",
          "'አጽድቅ' የሚለውን ይጫኑ። ቢሉ ወደ 'የጸደቀ' ሁኔታ ይሸጋገራል።",
        ],
      },
      {
        heading: "Send Back for Rework",
        amharicHeading: "ለማስተካከያ መመለስ",
        steps: [
          "Open the pending bill.",
          "Click Send Back for Rework.",
          "Enter the reason (required).",
          "The bill returns to Draft with a rework note visible to the submitter.",
        ],
        amharicSteps: [
          "ይሁንታ የሚጠብቀውን ቢል ይክፈቱ።",
          "'ለማስተካከያ መልስ' የሚለውን ይጫኑ።",
          "ምክንያቱን ያስገቡ (ግዴታ ነው)።",
          "ቢሉ ላቀረበው ሰራተኛ በሚታይ የማስተካከያ ማስታወሻ ወደ 'ረቂቅ' ይመለሳል።",
        ],
        callouts: [
          {
            type: "info",
            text: "The rework reason is stored in the audit log and shown to the submitting staff member on their dashboard.",
            amharicText: "የማስተካከያው ምክንያት በኦዲት መዝገብ ውስጥ ይቀመጣል እንዲሁም ላቀረበው ሰራተኛ በዳሽቦርዱ ላይ ይታያል።",
          },
        ],
      },
      {
        heading: "Bulk Approve",
        amharicHeading: "በጅምላ ማጽደቅ",
        steps: [
          "On the Approvals page, use checkboxes to select multiple items.",
          "Click Approve Selected.",
          "All selected items move to Approved status.",
        ],
        amharicSteps: [
          "በማጽደቂያ ገጹ ላይ አመልካች ሳጥኖችን በመጠቀም ብዙ ቢሎችን ይምረጡ።",
          "'የተመረጡትን አጽድቅ' የሚለውን ይጫኑ።",
          "ሁሉም የተመረጡ ቢሎች ወደ 'የጸደቀ' ሁኔታ ይሸጋገራሉ።",
        ],
        callouts: [
          {
            type: "warning",
            text: "Bulk Approve bypasses individual review. Only use when you have already verified the bills outside the system.",
            amharicText: "በጅምላ ማጽደቅ የግል ምርመራን ያልፋል። ቢሎችን ከሲስተሙ ውጭ አስቀድመው ካረጋገጡ ብቻ ይጠቀሙበት።",
          },
        ],
      },
    ],
  },
  {
    id: "roles", icon: ShieldCheck, title: "Roles & Permissions", amharicTitle: "የስራ ሚናዎችና ፈቃዶች",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "Management", color: "bg-purple-700", gradient: "from-purple-50 to-indigo-50", accentLight: "border-purple-200 bg-purple-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The role and permission system controls exactly what each staff member can see and do in the portal. Permissions are grouped by feature area and assigned to roles — roles are then assigned to individual staff members.",
        amharicBody: "የስራ ሚና እና የፈቃድ ስርዓት እያንዳንዱ ሰራተኛ በፖርታሉ ውስጥ ምን ማየት እና ምን መስራት እንደሚችል ይቆጣጠራል። ፈቃዶች በስራ ዘርፍ ተከፋፍለው ለሚናዎች ይሰጣሉ፤ ሚናዎች ደግሞ ለግል ሰራተኞች ይመደባሉ።",
      },
      {
        heading: "Permission Groups",
        amharicHeading: "የፈቃድ ምድቦች",
        table: {
          headers: ["Permission Group", "Controls", "Typical Role"],
          rows: [
            ["BILLING_VIEW", "See bills and billing data", "All staff"],
            ["BILLING_MANAGE", "Create, submit, and edit bills", "Supervisor, Staff"],
            ["BILLING_APPROVE", "Approve and post bills", "Supervisor, Admin"],
            ["READINGS_VIEW", "See meter readings", "All staff"],
            ["READINGS_MANAGE", "Enter and edit readings", "Meter Reader, Staff"],
            ["SETTINGS_MANAGE", "Change system settings, roles", "Admin only"],
            ["DASHBOARD_VIEW_ALL", "View all branches dashboard", "Head Office, Admin"],
            ["REPORTS_EXPORT", "Export reports to XLSX/CSV", "Admin, Supervisor"],
          ],
        },
        amharicTable: {
          headers: ["የፈቃድ ምድብ", "የሚቆጣጠረው ስራ", "የተለመደ ሚና"],
          rows: [
            ["BILLING_VIEW", "ቢሎችንና የቢል መረጃዎችን ማየት", "ሁሉም ሰራተኞች"],
            ["BILLING_MANAGE", "ቢል መፍጠር፣ ማቅረብ እና ማረም", "ተቆጣጣሪ፣ ሰራተኛ"],
            ["BILLING_APPROVE", "ቢሎችን ማጽደቅ እና መለጠፍ", "ተቆጣጣሪ፣ አድሚን"],
            ["READINGS_VIEW", "የቆጣሪ ንባቦችን ማየት", "ሁሉም ሰራተኞች"],
            ["READINGS_MANAGE", "ንባቦችን ማስገባት እና ማረም", "ቆጣሪ አንባቢ፣ ሰራተኛ"],
            ["SETTINGS_MANAGE", "የሲስተም ቅንብሮችንና ሚናዎችን መቀየር", "አድሚን ብቻ"],
            ["DASHBOARD_VIEW_ALL", "የሁሉንም ቅርንጫፎች ዳሽቦርድ ማየት", "ዋና መ/ቤት፣ አድሚን"],
            ["REPORTS_EXPORT", "ሪፖርቶችን ወደ XLSX/CSV መላክ", "አድሚን፣ ተቆጣጣሪ"],
          ],
        },
      },
      {
        heading: "Create a New Role",
        amharicHeading: "አዲስ ሚና መፍጠር",
        steps: [
          "Click + New Role.",
          "Enter a Role Name.",
          "Check the permissions to grant this role.",
          "Click Save Role.",
        ],
        amharicSteps: [
          "'+ አዲስ ሚና' የሚለውን ይጫኑ።",
          "የሚናውን ስም ያስገቡ።",
          "ለዚህ ሚና የሚሰጡትን ፈቃዶች ምልክት ያድርጉባቸው።",
          "'ሚና አስቀምጥ' የሚለውን ይጫኑ።",
        ],
      },
    ],
  },
  {
    id: "notifications", icon: Bell, title: "Notifications", amharicTitle: "ማሳወቂያዎች",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Management", color: "bg-yellow-500", gradient: "from-yellow-50 to-amber-50", accentLight: "border-yellow-200 bg-yellow-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The notification system keeps all staff informed of important events: bills submitted for approval, billing job completions, overdue bills, and system alerts.",
        amharicBody: "የማሳወቂያ ስርዓቱ ሰራተኞችን ስለ አስፈላጊ ክስተቶች ያሳውቃል፡ ለይሁንታ የቀረቡ ቢሎች፣ የጅምላ ቢል ስራ መጠናቀቅ፣ ጊዜያቸው ያለፈባቸው ቢሎች እና አጠቃላይ የሲስተም ማንቂያዎች።",
      },
      {
        heading: "Notification Types",
        amharicHeading: "የማሳወቂያ አይነቶች",
        table: {
          headers: ["Type", "Triggered By", "Recipients"],
          rows: [
            ["Bill Submitted", "Staff submits bill for approval", "Supervisors, Admins"],
            ["Bill Approved", "Supervisor approves bill", "Submitting staff"],
            ["Bill Rework", "Supervisor sends back bill", "Submitting staff"],
            ["Billing Job Done", "Batch billing completes", "Admin who triggered it"],
            ["Overdue Alert", "System daily job", "Branch supervisors"],
            ["System Alert", "Admin broadcast", "All staff / selected role"],
          ],
        },
        amharicTable: {
          headers: ["አይነት", "መነሻ ምክንያት", "ተቀባዮች"],
          rows: [
            ["ቢል ቀርቧል", "ሰራተኛ ለይሁንታ ቢል ሲያቀርብ", "ተቆጣጣሪዎች፣ አድሚኖች"],
            ["ቢል ጸድቋል", "ተቆጣጣሪ ቢሉን ሲያጸድቅ", "ያቀረበው ሰራተኛ"],
            ["ለማስተካከያ ተመልሷል", "ተቆጣጣሪ ቢሉን ሲመልስ", "ያቀረበው ሰራተኛ"],
            ["የቢል ስራ ተጠናቋል", "የጅምላ ቢል ማውጣት ሲጠናቀቅ", "ስራውን ያስጀመረው አድሚን"],
            ["የዘገየ ቢል ማንቂያ", "የሲስተሙ ዕለታዊ ቼክ", "የቅርንጫፍ ተቆጣጣሪዎች"],
            ["የሲስተም መልዕክት", "የአድሚን አጠቃላይ መልዕክት", "ሁሉም ሰራተኞች / የተመረጠ ሚና"],
          ],
        },
      },
      {
        heading: "Create a Notification (Admin)",
        amharicHeading: "ማሳወቂያ መላክ (አድሚን)",
        steps: [
          "Go to Notifications > New Notification.",
          "Select recipients: All Staff, specific Branch, or specific Role.",
          "Enter the message title and body.",
          "Click Send.",
        ],
        amharicSteps: [
          "ወደ 'ማሳወቂያዎች' > 'አዲስ ማሳወቂያ' ይሂዱ።",
          "ተቀባዮችን ይምረጡ፡ ሁሉም ሰራተኞች፣ የተወሰነ ቅርንጫፍ ወይም የተወሰነ ሚና።",
          "የመልዕክቱን ርዕስ እና ዝርዝር ያስገቡ።",
          "'ላክ' የሚለውን ይጫኑ።",
        ],
      },
    ],
  },
  {
    id: "tariffs", icon: LibraryBig, title: "Tariff Management", amharicTitle: "የታሪፍ ተመን አስተዳደር",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "Management", color: "bg-orange-600", gradient: "from-orange-50 to-red-50", accentLight: "border-orange-200 bg-orange-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Tariffs define the pricing structure for water billing. Each charge group (Domestic, Non-domestic, Borehole, Public Fountain) has its own tariff with base rate tiers, maintenance, sanitation, meter rent, and VAT.",
        amharicBody: "ታሪፎች ለውሃ ቢል የዋጋ መዋቅርን ይወስናሉ። እያንዳንዱ የደንበኛ ምድብ (የቤት፣ የንግድ፣ የቦቴ፣ የጋራ ቧንቧ) የራሱ የሆነ የመነሻ ዋጋ እርከኖች፣ የጥገና፣ የፍሳሽ፣ የቆጣሪ ኪራይ እና የተጨማሪ እሴት ታክስ (VAT) አለው።",
      },
      {
        heading: "Charge Components",
        amharicHeading: "የክፍያ ክፍሎች",
        table: {
          headers: ["Component", "Description", "Applied To"],
          rows: [
            ["Base Rate (Tiered)", "Rate per m³ — increases with consumption tier", "All charge groups"],
            ["Maintenance Fee", "Fixed monthly fee for pipe maintenance", "All charge groups"],
            ["Sanitation Fee", "Fee for sewerage & sanitation services", "Meters with sewerage connection"],
            ["Meter Rent", "Monthly fee for meter equipment", "All meters"],
            ["VAT", "15% Value Added Tax", "Non-domestic, Borehole"],
            ["Penalty", "Tiered penalty for overdue accounts", "Overdue accounts only"],
          ],
        },
        amharicTable: {
          headers: ["ክፍል", "መግለጫ", "የሚመለከተው"],
          rows: [
            ["የመነሻ ዋጋ (በእርከን)", "ለአንድ ሜ³ የሚታሰብ ዋጋ — በፍጆታው እርከን ይጨምራል", "ሁሉም የክፍያ ምድቦች"],
            ["የጥገና ክፍያ", "ለቧንቧ ጥገና የሚከፈል ቋሚ ወርሃዊ ክፍያ", "ሁሉም የክፍያ ምድቦች"],
            ["የሳኒቴሽን/ፍሳሽ ክፍያ", "ለፍሳሽ ማስወገጃ እና ጽዳት አገልግሎት የሚከፈል", "የፍሳሽ መስመር ያላቸው ቆጣሪዎች"],
            ["የቆጣሪ ኪራይ", "ለቆጣሪ እቃ የሚከፈል ወርሃዊ ክፍያ", "ሁሉም ቆጣሪዎች"],
            ["ተ.እ.ታ (VAT)", "15% የተጨማሪ እሴት ታክስ", "የንግድ፣ የቦቴ ቆጣሪዎች"],
            ["ቅጣት", "ክፍያ ላዘገዩ ደንበኞች የሚጣል እርከን ያለው ቅጣት", "ክፍያቸው የዘገዩ ደንበኞች ብቻ"],
          ],
        },
      },
      {
        heading: "Penalty Settings",
        amharicHeading: "የቅጣት ቅንብሮች",
        body: "Configure in the tariff record:\n• Penalty Month Threshold — months of non-payment before penalty starts\n• Bank Lending Rate — base rate used for penalty calculation\n• Penalty Tiered Rates — additional rate per aging tier (30 / 60 / 90+ days)",
        amharicBody: "በታሪፍ መዝገብ ውስጥ የሚከተሉትን ያዋቅሩ፡\n• የቅጣት መነሻ ወራት — ቅጣት ከመጀመሩ በፊት የሚሰጥ የእፎይታ ጊዜ\n• የባንክ ብድር ወለድ ምጣኔ — ለቅጣት ስሌት መሰረት የሚሆን ወለድ\n• የዕድሜ እርከን ተመን — በእርከን የሚጨመር ምጣኔ (30 / 60 / 90+ ቀናት)",
        callouts: [
          {
            type: "danger",
            text: "Changing a tariff affects ALL future billing cycles for that customer type. Existing posted bills are NOT retroactively changed.",
            amharicText: "ታሪፍ መቀየር የወደፊት የቢል ዑደቶችን ብቻ ይነካል። ቀደም ሲል የተለጠፉ ቢሎች ወደኋላ ተመልሰው አይቀየሩም።",
          },
        ],
      },
    ],
  },
  {
    id: "route-management", icon: Map, title: "Route Management", amharicTitle: "የንባብ መስመሮች አስተዳደር",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Management", color: "bg-green-700", gradient: "from-green-50 to-emerald-50", accentLight: "border-green-200 bg-green-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Routes group bulk meters geographically and are assigned to meter readers. This allows field operations to be organized efficiently by area.",
        amharicBody: "መስመሮች የጅምላ ቆጣሪዎችን በጂኦግራፊያዊ አቀማመጥ ያሰባስባሉ እንዲሁም ለቆጣሪ አንባቢዎች ይመደባሉ። ይህ የመስክ ስራዎችን በየአካባቢው በብቃት ለማደራጀት ያስችላል።",
      },
      {
        heading: "Create a Route",
        amharicHeading: "አዲስ መስመር መፍጠር",
        steps: [
          "Click Route Management in the sidebar.",
          "Click + New Route.",
          "Enter Route Name, Branch, and a description.",
          "Assign bulk meters to the route from the meter picker.",
          "Click Save.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የመስመሮች አስተዳደር' የሚለውን ይጫኑ።",
          "'+ አዲስ መስመር' የሚለውን ይጫኑ።",
          "የመስመሩን ስም፣ ቅርንጫፍ እና መግለጫ ያስገቡ።",
          "ከቆጣሪ መምረጫው ላይ የጅምላ ቆጣሪዎችን ለመስመሩ ይመድቡ።",
          "'አስቀምጥ' የሚለውን ይጫኑ።",
        ],
      },
      {
        heading: "Assign a Meter Reader to a Route",
        amharicHeading: "ቆጣሪ አንባቢን ለመስመር መመደብ",
        steps: [
          "Open a route.",
          "In the Assigned Readers section, click Add Staff.",
          "Search and select the staff member.",
          "Click Assign.",
          "The reader can now see this route under My Routes.",
        ],
        amharicSteps: [
          "መስመሩን ይክፈቱ።",
          "በተመደቡ አንባቢዎች ክፍል ውስጥ 'ሰራተኛ ጨምር' የሚለውን ይጫኑ።",
          "ሰራተኛውን ፈልገው ይምረጡ።",
          "'መድብ' የሚለውን ይጫኑ።",
          "አንባቢው አሁን ይህንን መስመር በ'የእኔ መስመሮች' ስር ማየት ይችላል።",
        ],
        callouts: [
          {
            type: "info",
            text: "A meter reader can be assigned to multiple routes. Each route can also have multiple readers.",
            amharicText: "አንድ ቆጣሪ አንባቢ ለብዙ መስመሮች ሊመደብ ይችላል። እንዲሁም አንድ መስመር ብዙ አንባቢዎች ሊኖሩት ይችላሉ።",
          },
        ],
      },
    ],
  },
  {
    id: "knowledge-base", icon: BookText, title: "Knowledge Base", amharicTitle: "የእውቀት ማዕከል / ሰነዶች",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Management", color: "bg-sky-600", gradient: "from-sky-50 to-blue-50", accentLight: "border-sky-200 bg-sky-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The Knowledge Base is an internal wiki where administrators publish articles, SOPs, and how-to guides for staff. It is searchable and organized by category.",
        amharicBody: "የእውቀት ማዕከል አድሚኖች ጽሁፎችን፣ የአሰራር መመሪያዎችን (SOPs) እና መመሪያዎችን ለሰራተኞች የሚያሳትሙበት ውስጣዊ ማዕከል ነው። በፍለጋ የሚገኝ እና በምድብ የተደራጀ ነው።",
      },
      {
        heading: "Browse & Search Articles",
        amharicHeading: "ጽሁፎችን ማሰስና መፈለግ",
        steps: [
          "Click Knowledge Base in the sidebar.",
          "Browse articles by category or search by keyword.",
          "Click an article to read it in full.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የእውቀት ማዕከል' የሚለውን ይጫኑ።",
          "ጽሁፎችን በምድብ ያስሱ ወይም በቁልፍ ቃላት ይፈልጉ።",
          "ሙሉውን ለማንበብ ጽሁፉን ይጫኑ።",
        ],
      },
      {
        heading: "Manage Articles (Admin)",
        amharicHeading: "ጽሁፎችን ማስተዳደር (አድሚን)",
        steps: [
          "Click + New Article.",
          "Enter title, content (rich text editor), and category.",
          "Click Publish to make it visible to all staff.",
          "Click Edit on an existing article to update it.",
        ],
        amharicSteps: [
          "'+ አዲስ ጽሁፍ' የሚለውን ይጫኑ።",
          "ርዕስ፣ ይዘት እና ምድብ ያስገቡ።",
          "ለሁሉም ሰራተኞች እንዲታይ 'አትም' የሚለውን ይጫኑ።",
          "ነባር ጽሁፍን ለማሻሻል 'አርም' የሚለውን ይጫኑ።",
        ],
      },
    ],
  },
  {
    id: "bill-management", icon: FileText, title: "Bill Management", amharicTitle: "የቢል አስተዳደር",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Management", color: "bg-rose-600", gradient: "from-rose-50 to-pink-50", accentLight: "border-rose-200 bg-rose-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Bill Management is the core billing module. It supports single-meter and batch billing, the full approval workflow, payment recording, PDF export, and bill corrections.",
        amharicBody: "የቢል አስተዳደር የፖርታሉ ዋነኛ የቢል ሞጁል ነው። የነጠላ ቆጣሪ እና የጅምላ ቢል ስሌትን፣ ሙሉውን የማጽደቅ ሂደት፣ የክፍያ ምዝገባን፣ የPDF ህትመትን እና የቢል ማስተካከያዎችን ያከናውናል።",
        diagram: "billing-workflow",
      },
      {
        heading: "Bill Status Reference",
        amharicHeading: "የቢል ሁኔታዎች ማጣቀሻ",
        table: {
          headers: ["Status", "Meaning", "Who Can Edit"],
          rows: [
            ["Draft", "Created, not yet submitted", "Staff who created it"],
            ["Pending Approval", "Awaiting supervisor review", "Supervisors / Admins only"],
            ["Approved", "Approved, not yet posted", "Supervisors / Admins"],
            ["Posted", "Locked — sent to customer", "Payment fields only"],
            ["Reversed", "Correction applied — replaced by CORR- bill", "No edits"],
          ],
        },
        amharicTable: {
          headers: ["ሁኔታ", "ትርጉም", "ማን ማረም ይችላል"],
          rows: [
            ["ረቂቅ (Draft)", "የተፈጠረ፣ ገና ያልቀረበ", "የፈጠረው ሰራተኛ"],
            ["ይሁንታ በመጠባበቅ ላይ (Pending)", "የተቆጣጣሪን ምርመራ የሚጠብቅ", "ተቆጣጣሪዎች / አድሚኖች ብቻ"],
            ["የጸደቀ (Approved)", "የጸደቀ፣ ገና ያልተለጠፈ", "ተቆጣጣሪዎች / አድሚኖች"],
            ["የተለጠፈ (Posted)", "የተዘጋ — ለደንበኛ የተላከ", "የክፍያ መረጃዎች ብቻ"],
            ["የተሰረዘ (Reversed)", "እርማት የተደረገበት — በCORR- ቢል የተተካ", "ምንም ማረም አይቻልም"],
          ],
        },
      },
      {
        heading: "Run Billing Cycle — Single Meter",
        amharicHeading: "ቢል ማስላት — ለነጠላ ቆጣሪ",
        steps: [
          "Open the Bulk Meter Details page for the specific meter.",
          "Click Run Billing Cycle.",
          "Select Billing Period (Month/Year) and Carry Balance option.",
          "Review the computed charges in the preview.",
          "Click Confirm and Generate Bill.",
        ],
        amharicSteps: [
          "ለተፈለገው ቆጣሪ የጅምላ ቆጣሪ ዝርዝር ገጽን ይክፈቱ።",
          "'የቢል ዑደት አስላ' የሚለውን ይጫኑ።",
          "የቢል ጊዜ (ወር/ዓመት) እና የቀሪ ሂሳብ ማሸጋገር ምርጫን ይምረጡ።",
          "በቅድመ-ዕይታው የተሰሉትን ክፍያዎች ይገምግሙ።",
          "'አረጋግጥ እና ቢል አውጣ' የሚለውን ይጫኑ።",
        ],
      },
      {
        heading: "Batch Billing — All Meters in a Branch",
        amharicHeading: "የጅምላ ቢል ማውጣት — በአንድ ቅርንጫፍ ላሉ ቆጣሪዎች በሙሉ",
        steps: [
          "In Bill Management, click the Bulk Billing tab.",
          "Select Branch, Billing Period, and Carry Balance option.",
          "Click Start Batch Billing.",
          "A background job is queued — progress is shown in the job status panel.",
          "When complete, all meters in the branch have a new Draft bill.",
        ],
        amharicSteps: [
          "በቢል አስተዳደር ውስጥ 'የጅምላ ቢል' ትርን ይጫኑ።",
          "ቅርንጫፍ፣ የቢል ጊዜ እና የቀሪ ሂሳብ ማሸጋገርን ይምረጡ።",
          "'የጅምላ ቢል ጀምር' የሚለውን ይጫኑ።",
          "የጀርባ ስራ ይሰለፋል — ሂደቱ በስራ ሁኔታ ፓነል ላይ ይታያል።",
          "ሲጠናቀቅ በቅርንጫፉ ላሉ ቆጣሪዎች በሙሉ አዲስ ረቂቅ ቢል ይዘጋጃል።",
        ],
        callouts: [
          {
            type: "warning",
            text: "Batch billing will skip meters that already have a bill for the selected period. Use Bulk Delete first if you need to re-run.",
            amharicText: "የጅምላ ቢል ማውጣት ለተመረጠው ጊዜ ቀደም ሲል ቢል የወጣላቸውን ቆጣሪዎች ይዘላል። እንደገና ማስላት ከፈለጉ መጀመሪያ 'በጅምላ ሰርዝ'ን ይጠቀሙ።",
          },
        ],
      },
      {
        heading: "Record a Payment",
        amharicHeading: "ክፍያ መመዝገብ",
        diagram: "payment-flow",
        steps: [
          "Open the bill in Bill Details.",
          "Click Record Payment.",
          "Fill in: Amount Paid, Payment Method, Transaction Reference, Payment Date.",
          "Click Save Payment.",
          "If full amount is covered, the bill is automatically marked Paid.",
        ],
        amharicSteps: [
          "በቢል ዝርዝር ውስጥ ቢሉን ይክፈቱ።",
          "'ክፍያ መዝግብ' የሚለውን ይጫኑ።",
          "የሚከተሉትን ይሙሉ፡ የተከፈለ መጠን፣ የክፍያ ዘዴ፣ የግብይት ማጣቀሻ ቁጥር፣ የተከፈለበት ቀን።",
          "'ክፍያ አስቀምጥ' የሚለውን ይጫኑ።",
          "ሙሉው መጠን ከተከፈለ ቢሉ በራስ-ሰር 'ተከፍሏል' ተብሎ ይመዘገባል።",
        ],
      },
      {
        heading: "Create a Bill Correction",
        amharicHeading: "የቢል ማስተካከያ (CORR) መፍጠር",
        steps: [
          "Open the Posted bill to correct.",
          "Click Create Correction.",
          "The original bill is marked Reversed.",
          "A new CORR- prefixed bill is created in Draft.",
          "Edit and re-submit through the normal approval workflow.",
        ],
        amharicSteps: [
          "የሚታረመውን የተለጠፈ (Posted) ቢል ይክፈቱ።",
          "'እርማት ፍጠር' የሚለውን ይጫኑ።",
          "የመጀመሪያው ቢል 'የተሰረዘ' (Reversed) ተብሎ ምልክት ይደረግበታል።",
          "አዲስ የ'CORR-' ቅድመ-ቅጥያ ያለው ቢል በረቂቅ ደረጃ ይፈጠራል።",
          "አርመው በመደበኛው የማጽደቅ ሂደት እንደገና ያቅርቡት።",
        ],
        callouts: [
          {
            type: "danger",
            text: "Corrections on Paid bills require manual reconciliation of the payment. Contact finance before correcting a paid bill.",
            amharicText: "በተከፈሉ ቢሎች ላይ የሚደረግ እርማት የክፍያውን ማወራረድ በእጅ ማረጋገጥ ይጠይቃል። የተከፈለ ቢል ከማረምዎ በፊት የፋይናንስ ክፍልን ያማክሩ።",
          },
        ],
      },
      {
        heading: "Bulk Delete / Reset Bills for a Period",
        amharicHeading: "የአንድ ጊዜ ቢሎችን በጅምላ መሰረዝ / ዳግም ማስጀመር",
        steps: [
          "Click Bulk Delete / Reset Bills button (top right in Bill Management).",
          "Select Billing Period and Branch in the dialog.",
          "Click Preview Impact to see total scope.",
          "Check Preserve paid & settled bills (recommended — on by default).",
          "Type DELETE in the confirmation box.",
          "Click Delete Bills to archive to Recycle Bin.",
        ],
        amharicSteps: [
          "ከላይ በቀኝ በኩል 'ቢሎችን በጅምላ ሰርዝ / ዳግም አስጀምር' የሚለውን ቁልፍ ይጫኑ።",
          "በመገናኛ ሳጥኑ ውስጥ የቢል ጊዜ እና ቅርንጫፍ ይምረጡ።",
          "አጠቃላይ መጠኑን ለማየት 'ተፅዕኖውን አስቀድመህ እይ' የሚለውን ይጫኑ።",
          "'የተከፈሉና የተወራረዱ ቢሎችን ጠብቅ' የሚለውን ምልክት ያድርጉ (የሚመከር — በነባሪነት የበራ ነው)።",
          "በማረጋገጫ ሳጥኑ ውስጥ 'DELETE' ብለው ይተይቡ።",
          "ወደ ቆሻሻ ማከማቻ ለማዛወር 'ቢሎችን ሰርዝ' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "danger",
            text: "This action cannot be undone from the portal. Items go to the Recycle Bin. Paid bills are always protected by default.",
            amharicText: "ይህ እርምጃ ከፖርታሉ ሊቀለበስ አይችልም። ፋይሎች ወደ ቆሻሻ ማከማቻ ይሄዳሉ። የተከፈሉ ቢሎች በነባሪነት ሁልጊዜ የተጠበቁ ናቸው።",
          },
        ],
      },
    ],
  },
  {
    id: "fault-codes", icon: AlertOctagon, title: "Fault Codes", amharicTitle: "የብልሽት ኮዶች",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Management", color: "bg-red-600", gradient: "from-red-50 to-orange-50", accentLight: "border-red-200 bg-red-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Fault codes are predefined labels for billing or meter reading exceptions. They help classify anomalies (e.g., Tampered Meter, Estimated Reading, Damaged Seal) for tracking and audit purposes.",
        amharicBody: "የብልሽት ኮዶች ለቢል ወይም ለቆጣሪ ንባብ ልዩ ሁኔታዎች የተዘጋጁ መለያዎች ናቸው። ያልተለመዱ ሁኔታዎችን (ለምሳሌ፡ የተነካካ ቆጣሪ፣ በግምት የተወሰደ ንባብ፣ የተበላሸ ማህተም) ለክትትልና ለኦዲት ለመመደብ ይረዳሉ።",
      },
      {
        heading: "Common Fault Code Categories",
        amharicHeading: "የተለመዱ የብልሽት ኮድ ምድቦች",
        table: {
          headers: ["Category", "Description"],
          rows: [
            ["Meter Fault", "Physical meter malfunction or damage"],
            ["Reading Exception", "Estimated or skipped reading"],
            ["Billing Exception", "Unusual consumption or charge override"],
            ["Compliance", "Seal tampering, unauthorized connections"],
          ],
        },
        amharicTable: {
          headers: ["ምድብ", "መግለጫ"],
          rows: [
            ["የቆጣሪ ብልሽት", "አካላዊ የቆጣሪ ብልሽት ወይም ጉዳት"],
            ["የንባብ ልዩ ሁኔታ", "በግምት የተወሰደ ወይም የተዘለለ ንባብ"],
            ["የቢል ልዩ ሁኔታ", "ያልተለመደ የፍጆታ መጠን ወይም በእጅ የተቀየረ ክፍያ"],
            ["ደንብ መተላለፍ", "ማህተም መሰበር፣ ያልተፈቀደ ህገወጥ መስመር"],
          ],
        },
      },
      {
        heading: "Create / Edit Fault Codes",
        amharicHeading: "የብልሽት ኮዶችን መፍጠር / ማረም",
        steps: [
          "Click + New Fault Code.",
          "Enter Code, Description, and Category.",
          "Click Save.",
          "To edit: click the fault code row, update fields, click Save.",
        ],
        amharicSteps: [
          "'+ አዲስ የብልሽት ኮድ' የሚለውን ይጫኑ።",
          "ኮድ፣ መግለጫ እና ምድብ ያስገቡ።",
          "'አስቀምጥ' የሚለውን ይጫኑ።",
          "ለማረም፡ የኮዱን ረድፍ ይጫኑ፣ መረጃዎችን ያሻሽሉ፣ ከዚያ 'አስቀምጥ'ን ይጫኑ።",
        ],
      },
    ],
  },
  {
    id: "support", icon: LifeBuoy, title: "Customer Support", amharicTitle: "የደንበኞች አገልግሎትና ቅሬታ",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Management", color: "bg-pink-600", gradient: "from-pink-50 to-rose-50", accentLight: "border-pink-200 bg-pink-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The Customer Support module manages internal support tickets raised for customer complaints, billing disputes, and technical issues. Tickets are assigned to staff and tracked through resolution.",
        amharicBody: "የደንበኞች አገልግሎት ሞጁል ለደንበኞች ቅሬታዎች፣ ለቢል አለመግባባቶች እና ለቴክኒክ ችግሮች የሚከፈቱ የድጋፍ ትኬቶችን ያስተዳድራል። ትኬቶች ለሰራተኞች ተመድበው እስኪፈቱ ድረስ ክትትል ይደረግባቸዋል።",
      },
      {
        heading: "Ticket Lifecycle",
        amharicHeading: "የትኬት የህይወት ዑደት",
        table: {
          headers: ["Status", "Meaning"],
          rows: [
            ["Open", "Ticket submitted, pending assignment"],
            ["In Progress", "Assigned and being worked on"],
            ["Awaiting Customer", "Response needed from customer"],
            ["Resolved", "Issue fixed, ticket closed"],
            ["Escalated", "Passed to senior staff or admin"],
          ],
        },
        amharicTable: {
          headers: ["ሁኔታ", "ትርጉም"],
          rows: [
            ["ክፍት (Open)", "ትኬቱ ቀርቧል፣ ምደባ በመጠባበቅ ላይ ነው"],
            ["በሂደት ላይ (In Progress)", "ተመድቧል እና ስራ እየተሰራበት ነው"],
            ["ደንበኛን በመጠባበቅ ላይ", "ከደንበኛው ምላሽ ይፈለጋል"],
            ["የተፈታ (Resolved)", "ችግሩ ተፈትቷል፣ ትኬቱ ተዘግቷል"],
            ["የተላለፈ (Escalated)", "ወደ ከፍተኛ ኃላፊ ወይም አድሚን ተላልፏል"],
          ],
        },
      },
      {
        heading: "Create & Manage a Ticket",
        amharicHeading: "ትኬት መፍጠር እና ማስተዳደር",
        steps: [
          "Click Customer Support in the sidebar > + New Ticket.",
          "Fill in: Subject, Description, Priority (Low / Medium / High).",
          "Click Submit.",
          "To respond: open the ticket, add a Reply, click Submit Reply.",
          "Click Resolve when the issue is fixed.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የደንበኞች አገልግሎት' > '+ አዲስ ትኬት' የሚለውን ይጫኑ።",
          "የሚከተሉትን ይሙሉ፡ ርዕስ፣ መግለጫ፣ ቅድሚያ (ዝቅተኛ / መካከለኛ / ከፍተኛ)።",
          "'አስገባ' የሚለውን ይጫኑ።",
          "ምላሽ ለመስጠት፡ ትኬቱን ይክፈቱ፣ ምላሽ ይፃፉ፣ 'ምላሽ ላክ'ን ይጫኑ።",
          "ችግሩ ሲፈታ 'እንደተፈታ ምልክት አድርግ' (Resolve) የሚለውን ይጫኑ።",
        ],
      },
    ],
  },

  // ── CUSTOMER & METERING ────────────────────────────────────────────────────────
  {
    id: "bulk-meters", icon: Gauge, title: "Bulk Meters", amharicTitle: "የጅምላ ውሃ ቆጣሪዎች",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Customer & Metering", color: "bg-amber-600", gradient: "from-amber-50 to-yellow-50", accentLight: "border-amber-200 bg-amber-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Bulk Meters are the primary metered connections managed by AAWSA. Each bulk meter can have multiple individual sub-customers attached to it. They form the core billing unit.",
        amharicBody: "የጅምላ ቆጣሪዎች በባለስልጣኑ የሚተዳደሩ ዋና የቆጣሪ መስመሮች ናቸው። እያንዳንዱ የጅምላ ቆጣሪ ስር በርካታ የግል ንዑስ ደንበኞች ሊኖሩት ይችላሉ። ዋናው የቢል ማዕከል ናቸው።",
        diagram: "meter-hierarchy",
      },
      {
        heading: "Bulk Meter Key Fields",
        amharicHeading: "የጅምላ ቆጣሪ ዋና መረጃዎች",
        table: {
          headers: ["Field", "Description", "Required"],
          rows: [
            ["Name", "Descriptive name of the meter location", "✅"],
            ["Contract Number", "Official AAWSA contract reference", "✅"],
            ["Customer Key", "Unique identifier used in billing", "✅"],
            ["Branch", "Which branch manages this meter", "✅"],
            ["Charge Group", "Domestic / Non-domestic / Borehole / Public Fountain", "✅"],
            ["Sewerage Connection", "Whether meter has sewerage service", "✅"],
            ["Meter Size", "Physical pipe size (e.g. 15mm, 20mm)", "Optional"],
            ["GPS Coordinates", "For mapping and field navigation", "Optional"],
          ],
        },
        amharicTable: {
          headers: ["መስክ", "መግለጫ", "አስፈላጊነት"],
          rows: [
            ["ስም", "የቆጣሪው መገኛ ቦታ ገላጭ ስም", "✅"],
            ["የውል ቁጥር", "ይፋዊ የባለስልጣኑ የውል ማጣቀሻ", "✅"],
            ["የደንበኛ መለያ (Customer Key)", "ለቢል ስራ የሚያገለግል ልዩ መለያ", "✅"],
            ["ቅርንጫፍ", "ይህንን ቆጣሪ የሚያስተዳድረው ቅርንጫፍ", "✅"],
            ["የክፍያ ምድብ", "የቤት / የንግድ / የቦቴ / የጋራ ቧንቧ", "✅"],
            ["የፍሳሽ መስመር", "ቆጣሪው የፍሳሽ አገልግሎት ያለው መሆኑ", "✅"],
            ["የቆጣሪ መጠን", "የቧንቧው አካላዊ መጠን (ምሳሌ፡ 15ሚሜ፣ 20ሚሜ)", "አማራጭ"],
            ["የGPS መገኛ", "ለካርታ እና ለመስክ አሰሳ", "አማራጭ"],
          ],
        },
      },
      {
        heading: "Create a New Bulk Meter",
        amharicHeading: "አዲስ የጅምላ ቆጣሪ መፍጠር",
        steps: [
          "Click Bulk Meters > New Bulk Meter (or the + Add button).",
          "Fill in required fields: Name, Contract Number, Meter Key, Branch, Charge Group, Sewerage Connection, Meter Size, Initial Readings.",
          "Optionally fill: Route, Sub-City, Woreda, GPS coordinates.",
          "Click Save. The meter is created with status Active.",
        ],
        amharicSteps: [
          "'የጅምላ ቆጣሪዎች' > 'አዲስ የጅምላ ቆጣሪ' (ወይም '+ ጨምር' ቁልፍን) ይጫኑ።",
          "አስፈላጊ መስኮችን ይሙሉ፡ ስም፣ የውል ቁጥር፣ የቆጣሪ ቁጥር፣ ቅርንጫፍ፣ የክፍያ ምድብ፣ የፍሳሽ መስመር፣ የቆጣሪ መጠን፣ የመጀመሪያ ንባብ።",
          "አማራጭ መስኮችን ይሙሉ፡ መስመር፣ ክፍለ ከተማ፣ ወረዳ፣ የGPS መገኛ።",
          "'አስቀምጥ' የሚለውን ይጫኑ። ቆጣሪው በ'ንቁ' ሁኔታ ይፈጠራል።",
        ],
      },
      {
        heading: "Credit / Deposit Balance",
        amharicHeading: "የትርፍ ክፍያ / የተቀማጭ ሂሳብ",
        steps: [
          "Open the Bulk Meter Details page.",
          "Scroll to the Credit / Deposit section.",
          "Click Add Credit to record an overpayment or deposit.",
          "Credits are automatically applied to the next bill generated for this meter.",
        ],
        amharicSteps: [
          "የጅምላ ቆጣሪ ዝርዝር ገጽን ይክፈቱ።",
          "ወደ 'ክሬዲት / ተቀማጭ' ክፍል ይሂዱ።",
          "ትርፍ ክፍያ ወይም ተቀማጭ ለመመዝገብ 'ክሬዲት ጨምር' የሚለውን ይጫኑ።",
          "ክሬዲቱ ለዚህ ቆጣሪ በሚቀጥለው በሚወጣው ቢል ላይ በራስ-ሰር ይቀነሳል።",
        ],
        callouts: [
          {
            type: "tip",
            text: "Credits reduce the net amount due on the next bill. Use the Void button to reverse an unused credit entry.",
            amharicText: "ክሬዲቶች በሚቀጥለው ቢል ላይ የሚከፈለውን የተጣራ ሂሳብ ይቀንሳሉ። ጥቅም ላይ ያልዋለ የክሬዲት ምዝገባን ለመሰረዝ 'ሰርዝ' (Void) የሚለውን ቁልፍ ይጠቀሙ።",
          },
        ],
      },
    ],
  },
  {
    id: "individual-customers", icon: Users, title: "Individual Customers", amharicTitle: "የግል ደንበኞች (ንዑስ ቆጣሪዎች)",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Customer & Metering", color: "bg-blue-700", gradient: "from-blue-50 to-indigo-50", accentLight: "border-blue-200 bg-blue-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Individual Customers (sub-meters) are attached to a parent Bulk Meter and represent end-consumers within a shared connection (e.g., tenants in an apartment block served by one bulk meter).",
        amharicBody: "የግል ደንበኞች (ንዑስ ቆጣሪዎች) ከአንድ ዋና የጅምላ ቆጣሪ ጋር የተገናኙ ሆነው በጋራ መስመር ውስጥ ያሉ የግል ተጠቃሚዎችን ይወክላሉ (ለምሳሌ፡ በአንድ ህንፃ ውስጥ በአንድ የጅምላ ቆጣሪ የሚገለገሉ ነዋሪዎች)።",
      },
      {
        heading: "Create an Individual Customer (Sub-meter)",
        amharicHeading: "የግል ደንበኛ (ንዑስ ቆጣሪ) መፍጠር",
        steps: [
          "Click Individual Customers > New Customer.",
          "Fill in: Name, Contract Number, Customer Key, Assigned Bulk Meter (parent), Branch, Route, Initial Readings.",
          "Click Save.",
        ],
        amharicSteps: [
          "'የግል ደንበኞች' > 'አዲስ ደንበኛ' የሚለውን ይጫኑ።",
          "የሚከተሉትን ይሙሉ፡ ስም፣ የውል ቁጥር፣ የደንበኛ መለያ፣ የተመደበለት የጅምላ ቆጣሪ፣ ቅርንጫፍ፣ መስመር፣ የመጀመሪያ ንባብ።",
          "'አስቀምጥ' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "info",
            text: "The Assigned Bulk Meter (parent) determines which branch and tariff structure the customer falls under.",
            amharicText: "የተመደበው የጅምላ ቆጣሪ ደንበኛው በየትኛው ቅርንጫፍ እና የታሪፍ መዋቅር ስር እንደሚወድቅ ይወስናል።",
          },
        ],
      },
      {
        heading: "Assign Customer to a Bulk Meter",
        amharicHeading: "ደንበኛን ለጅምላ ቆጣሪ መመደብ",
        steps: [
          "Open the Bulk Meter Details page.",
          "Scroll to Assigned Individual Customers.",
          "Click Add Customer.",
          "Search and select the customer.",
          "Click Assign.",
        ],
        amharicSteps: [
          "የጅምላ ቆጣሪ ዝርዝር ገጽን ይክፈቱ።",
          "ወደ 'የተመደቡ የግል ደንበኞች' ክፍል ይሂዱ።",
          "'ደንበኛ ጨምር' የሚለውን ይጫኑ።",
          "ደንበኛውን ፈልገው ይምረጡ።",
          "'መድብ' የሚለውን ይጫኑ።",
        ],
      },
    ],
  },

  // ── DATA & REPORTS ─────────────────────────────────────────────────────────────
  {
    id: "data-entry", icon: FileDown, title: "Data Entry", amharicTitle: "የመረጃ ማስገቢያ (CSV)",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Data & Reports", color: "bg-teal-700", gradient: "from-teal-50 to-green-50", accentLight: "border-teal-200 bg-teal-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Data Entry provides bulk import tools for loading large datasets of bulk meters and individual customers via CSV. Used during initial setup or when migrating data from legacy systems.",
        amharicBody: "የመረጃ ማስገቢያ በርካታ የጅምላ ቆጣሪዎችን እና የግል ደንበኞችን መረጃ በCSV ፋይል አማካኝነት በጅምላ ለመጫን የሚያስችል መሳሪያ ነው። በመጀመሪያ ምዝገባ ወቅት ወይም ከቀድሞ ሲስተም መረጃዎችን ለማዘዋወር ያገለግላል።",
      },
      {
        heading: "Bulk Meter CSV Import",
        amharicHeading: "የጅምላ ቆጣሪዎችን በCSV መጫን",
        steps: [
          "Click Data Entry in the sidebar.",
          "Select the Bulk Meters tab.",
          "Click Download Template to get the CSV format.",
          "Fill the template with meter data.",
          "Click Upload File and select your CSV.",
          "Review the validation summary — errors are highlighted.",
          "Click Import to save all valid rows.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የመረጃ ማስገቢያ' የሚለውን ይጫኑ።",
          "የ'ጅምላ ቆጣሪዎች' ትርን ይምረጡ።",
          "የCSV ቅርጸቱን ለማግኘት 'ቅጽ (Template) አውርድ' የሚለውን ይጫኑ።",
          "ቅጹን በቆጣሪዎች መረጃ ይሙሉበት።",
          "'ፋይል ጫን' የሚለውን ተጭነው የCSV ፋይልዎን ይምረጡ።",
          "የማረጋገጫ ማጠቃለያውን ይገምግሙ — ስህተቶች በቀይ ጎልተው ይታያሉ።",
          "ሁሉንም ትክክለኛ ረድፎች ለማስቀመጥ 'አስገባ' (Import) የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "warning",
            text: "Duplicate Customer Keys will be rejected. Ensure all keys are unique before uploading.",
            amharicText: "የተደገሙ የደንበኛ መለያዎች ውድቅ ይደረጋሉ። ከመጫንዎ በፊት ሁሉም መለያዎች ልዩ መሆናቸውን ያረጋግጡ።",
          },
        ],
      },
      {
        heading: "Individual Customer CSV Import",
        amharicHeading: "የግል ደንበኞችን በCSV መጫን",
        steps: [
          "Same process as Bulk Meter import, but select the Individual Customers tab.",
          "The template requires an ASSIGNED_BULK_METER_KEY column.",
          "Customers with an invalid bulk meter key will be flagged as errors.",
        ],
        amharicSteps: [
          "እንደ ጅምላ ቆጣሪ መጫኛ ተመሳሳይ ሂደት ነው፤ ነገር ግን የ'የግል ደንበኞች' ትርን ይምረጡ።",
          "ቅጹ ASSIGNED_BULK_METER_KEY የሚል አምድ ይጠይቃል።",
          "ትክክለኛ ያልሆነ የጅምላ ቆጣሪ መለያ ያላቸው ደንበኞች እንደ ስህተት ምልክት ይደረግባቸዋል።",
        ],
      },
    ],
  },
  {
    id: "reports", icon: BarChart3, title: "Reports", amharicTitle: "አጠቃላይ ሪፖርቶች",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Data & Reports", color: "bg-cyan-600", gradient: "from-cyan-50 to-sky-50", accentLight: "border-cyan-200 bg-cyan-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The Reports module provides pre-built operational and financial reports that can be previewed on screen and exported to Excel (XLSX). Reports cover billing summaries, payments, water usage, GL finance, and customer data.",
        amharicBody: "የሪፖርቶች ሞጁል በስክሪኑ ላይ ሊታዩ እና ወደ ኤክሴል (XLSX) ሊወርዱ የሚችሉ የተዘጋጁ የአሰራርና የፋይናንስ ሪፖርቶችን ያቀርባል። ሪፖርቶቹ የቢል ማጠቃለያዎችን፣ ክፍያዎችን፣ የውሃ ፍጆታን፣ የGL ፋይናንስን እና የደንበኞችን መረጃ ያካትታሉ።",
      },
      {
        heading: "Available Reports",
        amharicHeading: "ዝግጁ ሪፖርቶች",
        table: {
          headers: ["Report Name", "Description", "Who"],
          rows: [
            ["Billing Summary", "All bills for a period with totals", "Admin, Staff"],
            ["List of Paid Bills", "Only paid bills with payment details", "Admin, Staff"],
            ["List of Sent Bills", "Bills that have been posted/sent", "Admin, Staff"],
            ["List of Unsettled Bills", "Unpaid and overdue bills", "Admin, Staff"],
            ["GL Monthly Summary by GL Code", "Finance GL report by Branch, Charge Group", "Admin Finance"],
            ["GL Finance Monthly", "Monthly GL finance export", "Admin Finance"],
            ["Water Usage", "Consumption by meter and period", "Admin, Staff"],
            ["Meter Reading Accuracy", "Flagged irregular readings", "Admin, Staff"],
            ["Customer Data Export", "Full customer list with all fields", "Admin"],
            ["Bulk Meter Data Export", "Full bulk meter list with all fields", "Admin"],
            ["Monthly Bill Export", "All bills for a month in bulk", "Admin, Staff"],
          ],
        },
        amharicTable: {
          headers: ["የሪፖርት ስም", "መግለጫ", "ተጠቃሚዎች"],
          rows: [
            ["የቢል ማጠቃለያ", "የአንድ ጊዜ ሁሉም ቢሎች ከጠቅላላ ድምር ጋር", "አድሚን፣ ሰራተኛ"],
            ["የተከፈሉ ቢሎች ዝርዝር", "የተከፈሉ ቢሎች ብቻ ከክፍያ ዝርዝር ጋር", "አድሚን፣ ሰራተኛ"],
            ["የተላኩ ቢሎች ዝርዝር", "የተለጠፉ/የተላኩ ቢሎች በሙሉ", "አድሚን፣ ሰራተኛ"],
            ["ያልተከፈሉ ቢሎች ዝርዝር", "ያልተከፈሉ እና ጊዜያቸው ያለፈባቸው ቢሎች", "አድሚን፣ ሰራተኛ"],
            ["የGL ወርሃዊ ማጠቃለያ", "የፋይናንስ GL ሪፖርት በቅርንጫፍና በክፍያ ምድብ", "አድሚን የፋይናንስ"],
            ["የGL ወርሃዊ ፋይናንስ ኤክስፖርት", "ወርሃዊ የGL ፋይናንስ ወደ ኤክሴል", "አድሚን የፋይናንስ"],
            ["የውሃ ፍጆታ", "የፍጆታ መጠን በቆጣሪ እና በጊዜ", "አድሚን፣ ሰራተኛ"],
            ["የቆጣሪ ንባብ ትክክለኛነት", "ያልተለመዱ ወይም አጠራጣሪ ንባቦች", "አድሚን፣ ሰራተኛ"],
            ["የደንበኞች መረጃ ኤክስፖርት", "የደንበኞች ሙሉ ዝርዝር ከሁሉም መስኮች ጋር", "አድሚን"],
            ["የጅምላ ቆጣሪዎች ኤክስፖርት", "የጅምላ ቆጣሪዎች ሙሉ ዝርዝር", "አድሚን"],
            ["ወርሃዊ ቢሎች ኤክስፖርት", "የአንድ ወር ቢሎች በሙሉ በጅምላ", "አድሚን፣ ሰራተኛ"],
          ],
        },
      },
      {
        heading: "GL Code Reference",
        amharicHeading: "የGL ኮዶች ማጣቀሻ",
        table: {
          headers: ["GL Code", "Meaning"],
          rows: [
            ["WDGL", "Water — Domestic"],
            ["WNDGL", "Water — Non-domestic"],
            ["WBORGL", "Water — Borehole"],
            ["WPFNTGL", "Water — Public Fountain"],
            ["SEWERGL", "Sewerage Charge"],
            ["SNTGL", "Sanitation Fee"],
            ["MTRRNTGL", "Meter Rent"],
            ["MNTGL", "Maintenance Fee"],
            ["FIREGL", "Additional Fees / Penalty"],
          ],
        },
        amharicTable: {
          headers: ["የGL ኮድ", "ትርጉም"],
          rows: [
            ["WDGL", "የውሃ ገቢ — የቤት"],
            ["WNDGL", "የውሃ ገቢ — የንግድ"],
            ["WBORGL", "የውሃ ገቢ — የቦቴ"],
            ["WPFNTGL", "የውሃ ገቢ — የጋራ ቧንቧ"],
            ["SEWERGL", "የፍሳሽ ማስወገጃ ክፍያ"],
            ["SNTGL", "የሳኒቴሽን ክፍያ"],
            ["MTRRNTGL", "የቆጣሪ ኪራይ"],
            ["MNTGL", "የጥገና ክፍያ"],
            ["FIREGL", "ተጨማሪ ክፍያዎች / ቅጣት"],
          ],
        },
      },
    ],
  },
  {
    id: "paid-bills", icon: CheckCircle2, title: "List of Paid Bills", amharicTitle: "የተከፈሉ ቢሎች ዝርዝር",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Data & Reports", color: "bg-green-600", gradient: "from-green-50 to-emerald-50", accentLight: "border-green-200 bg-green-50",
    content: [
      {
        heading: "View and Export Paid Bills",
        amharicHeading: "የተከፈሉ ቢሎችን ማየትና ወደ ኤክሴል መላክ",
        steps: [
          "Click List Of Paid Bills in the sidebar.",
          "Filter by Branch, Date Range, or Charge Group.",
          "Click Preview to see the data.",
          "Click Export XLSX to download the list.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የተከፈሉ ቢሎች ዝርዝር' የሚለውን ይጫኑ።",
          "በቅርንጫፍ፣ በቀን ገደብ ወይም በክፍያ ምድብ ያጣሩ።",
          "መረጃውን ለማየት 'አስቀድመህ እይ' የሚለውን ይጫኑ።",
          "ዝርዝሩን ለማውረድ 'Export XLSX' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "tip",
            text: "Use this report for daily cash reconciliation and end-of-month financial summaries.",
            amharicText: "ይህን ሪፖርት ለዕለታዊ የጥሬ ገንዘብ ማወራረድ እና ለወር መጨረሻ የፋይናንስ ማጠቃለያ ይጠቀሙበት።",
          },
        ],
      },
    ],
  },
  {
    id: "sent-bills", icon: Send, title: "List of Sent Bills", amharicTitle: "የተላኩ / የተለጠፉ ቢሎች",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Data & Reports", color: "bg-blue-500", gradient: "from-blue-50 to-sky-50", accentLight: "border-blue-200 bg-blue-50",
    content: [
      {
        heading: "View and Export Sent Bills",
        amharicHeading: "የተላኩ ቢሎችን ማየትና ወደ ኤክሴል መላክ",
        steps: [
          "Click List Of Sent Bills in the sidebar.",
          "Shows all bills that have been Posted (sent to customers).",
          "Filter by Branch or Date Range.",
          "Click Export XLSX to download.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የተላኩ ቢሎች ዝርዝር' የሚለውን ይጫኑ።",
          "የተለጠፉ (ለደንበኞች የተላኩ) ሁሉንም ቢሎች ያሳያል።",
          "በቅርንጫፍ ወይም በቀን ገደብ ያጣሩ።",
          "ለማውረድ 'Export XLSX' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "info",
            text: "A 'Sent' bill = Posted status. It is visible to customers and awaiting payment.",
            amharicText: "'የተላከ' ቢል ማለት 'የተለጠፈ' (Posted) ደረጃ ነው። ለደንበኞች የሚታይ እና ክፍያ የሚጠበቅበት ነው።",
          },
        ],
      },
    ],
  },
  {
    id: "unsettled-bills", icon: FileClock, title: "List of Unsettled Bills", amharicTitle: "ያልተከፈሉ / የቀሩ ቢሎች ዝርዝር",
    badge: "Admin / Staff", amharicBadge: "አድሚን / ሰራተኛ",
    group: "Data & Reports", color: "bg-orange-600", gradient: "from-orange-50 to-red-50", accentLight: "border-orange-200 bg-orange-50",
    content: [
      {
        heading: "View Unsettled (Unpaid / Overdue) Bills",
        amharicHeading: "ያልተከፈሉ እና ጊዜያቸው ያለፈባቸውን ቢሎች ማየት",
        steps: [
          "Click List of Unsettled Bills in the sidebar.",
          "This shows all bills with payment_status = Unpaid that are past their due date.",
          "Filter by Branch or Date Range.",
          "Use this list for follow-up and collection actions.",
          "Click Export XLSX to download for offline use.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'ያልተከፈሉ ቢሎች ዝርዝር' የሚለውን ይጫኑ።",
          "ይህ ክፍያ ያልተፈጸመባቸውንና የመክፈያ ቀናቸው ያለፈባቸውን ቢሎች በሙሉ ያሳያል።",
          "በቅርንጫፍ ወይም በቀን ገደብ ያጣሩ።",
          "ይህን ዝርዝር ለክፍያ ክትትልና ማሳሰቢያ ስራዎች ይጠቀሙበት።",
          "ከሲስተም ውጭ ለመጠቀም 'Export XLSX' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "tip",
            text: "Sort by 'Days Overdue' to prioritize the most at-risk accounts for collection follow-up.",
            amharicText: "ከፍተኛ ስጋት ያለባቸውን ሂሳቦች ቅድሚያ ሰጥቶ ለመከታተል በ'ያለፉ ቀናት ብዛት' (Days Overdue) ያደራጁ።",
          },
        ],
      },
    ],
  },
  {
    id: "gl-audit", icon: Scale, title: "GL Reports & Audit", amharicTitle: "የጠቅላላ ሂሳብ (GL) ሪፖርቶችና ኦዲት",
    badge: "Admin / Finance", amharicBadge: "አድሚን / ፋይናንስ",
    group: "Data & Reports", color: "bg-indigo-600", gradient: "from-indigo-50 to-blue-50", accentLight: "border-indigo-200 bg-indigo-50",
    content: [
      {
        heading: "General Ledger Financial Summary & Audit Workspace",
        amharicHeading: "የጠቅላላ ሂሳብ የፋይናንስ ማጠቃለያ እና የኦዲት መስሪያ ገጽ",
        body: "The GL Reports & Audit module provides real-time financial tracking across all 9 AAWSA GL codes (WDGL, WNDGL, WBORGL, WPFNTGL, SEWERGL, SNTGL, MTRRNTGL, MNTGL, FIREGL), automatic arithmetic sum validation, and instant bill-level audit drill-down.",
        amharicBody: "ይህ ሞጁል በሁሉም 9 የደብተር ኮዶች ላይ የፋይናንስ ክትትል፣ አውቶማቲክ የሒሳብ ትክክለኛነት ማረጋገጫ እና የእያንዳንዱን ቢል ዝርዝር ኦዲት ያቀርባል።",
        steps: [
          "Navigate to 'GL Reports & Audit' under Data & Reports in the sidebar.",
          "Review the top KPI cards: Gross Billed GL Total, Net Revenue Excl. VAT, VAT (15%) Collected, Audited Bills Count, and Audit Health Status.",
          "Use the filters (Branch, Period, Charge Group, GL Code) to narrow down records.",
          "Click any GL Summary row to open the Audit Drill-Down Drawer and inspect all individual bills contributing to that balance.",
          "Switch to 'Component Breakdown Matrix' for customer-level component breakdown, or 'Audit & Anomaly Inspector' for automated discrepancy detection.",
          "Click 'Export XLSX' or 'CSV' for financial accounting integration, or 'Print PDF' for executive audit printing."
        ],
        amharicSteps: [
          "በጎን አሞሌው ስር 'የጠቅላላ ሂሳብ (GL) ሪፖርቶችና ኦዲት' የሚለውን ይምረጡ።",
          "ዋና ዋና የፋይናንስ አመልካቾችን (ጠቅላላ የተጠየቀ ገቢ፣ የተጣራ ገቢ፣ የተሰበሰበ 15% ቫት፣ እና የኦዲት ጤና ሁኔታ) ይመልከቱ።",
          "በቅርንጫፍ፣ በጊዜ ገደብ፣ በክፍያ ምድብ፣ ወይም በኮድ ያጣሩ።",
          "የማንኛውንም ረድፍ ቢሎች በዝርዝር ለመመርመር ረድፉን ይጫኑ።",
          "ለዝርዝር አካላት ወይም ለአውቶማቲክ የልዩነት ፍተሻ ተዛማጅ ትሮችን ይጠቀሙ።",
          "ሪፖርቱን በኤክሴል ወይም ፒዲኤፍ አውርደው ይጠቀሙበት።"
        ]
      }
    ]
  },
  {
    id: "credit-notes-report", icon: Wallet, title: "Credit Note Report", amharicTitle: "የክሬዲት ኖትና ተቀማጭ ሂሳብ ሪፖርት",
    badge: "Billing / Audit", amharicBadge: "ቢሊንግ / ኦዲት",
    group: "Data & Reports", color: "bg-emerald-600", gradient: "from-emerald-50 to-green-50", accentLight: "border-emerald-200 bg-emerald-50",
    content: [
      {
        heading: "Credit Note & Deposit Financial Tracking",
        amharicHeading: "የክሬዲት ኖትና ተቀማጭ የፋይናንስ ክትትል",
        body: "Track all bulk meter overpayments, customer deposit notes, billing cycle offsets, and void reversals across all AAWSA branches.",
        amharicBody: "በሁሉም የአዲስ አበባ ውሃና ፍሳሽ ባለስልጣን ቅርንጫፎች ላይ የተመዘገቡ የደንበኞች ተቀማጭ ገንዘቦች፣ ከመጠን በላይ ክፍያዎች፣ ለቢል የተካካሱ እና የተሰረዙ ክሬዲቶችን ይከታተሉ።",
        steps: [
          "Navigate to 'Credit Note Report' under Data & Reports in the sidebar.",
          "Inspect the top KPI cards: Active Deposit Balance, Total Credit Created, Applied to Bills, Voided/Reversed, and Total Transactions.",
          "Switch between the 'Credit Ledger Journal' for individual event audit trails, and 'Active Deposit Meters' for meters currently holding positive balances.",
          "Filter by Branch, Event Type (Created, Applied, Voided), Reason, Date range, or keyword search.",
          "Click the inspect eye icon on any entry to see full technical ledger metadata (Entry ID, Source Bill, Created By, Notes).",
          "Click 'Export Report' to download full reports in Excel (.xlsx) or CSV format, or 'Print' for physical audit records."
        ],
        amharicSteps: [
          "በጎን አሞሌው ስር 'የክሬዲት ኖትና ተቀማጭ ሂሳብ ሪፖርት' የሚለውን ይምረጡ።",
          "ዋና ዋና አመልካቾችን (የተቀማጭ ቀሪ ሂሳብ፣ የተመዘገበ ክሬዲት፣ ለቢል የተካካሰ እና የተሰረዘ ሂሳብ) ይመልከቱ።",
          "በ'የክሬዲት ሌጀር ጆርናል' (ዝርዝር ክስተቶች) እና 'ተቀማጭ ያላቸው ቆጣሪዎች' ትሮች መካከል ይቀያይሩ።",
          "በቅርንጫፍ፣ በክስተት ዓይነት፣ በምክንያት ወይም በጊዜ ገደብ ያጣሩ።",
          "የማንኛውንም ግብይት ዝርዝር መረጃ ለማየት የአይን ምልክቱን ይጫኑ።",
          "ሪፖርቱን በኤክሴል ወይም ሲኤስቪ ለማውረድ 'Export Report' የሚለውን ይጫኑ።"
        ]
      }
    ]
  },

  // ── SYSTEM ──────────────────────────────────────────────────────────────────
  {
    id: "settings", icon: Settings, title: "Settings", amharicTitle: "የስርዓት ቅንብሮች",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "System", color: "bg-slate-700", gradient: "from-slate-50 to-gray-50", accentLight: "border-slate-200 bg-slate-50",
    content: [
      {
        heading: "System Settings",
        amharicHeading: "የሲስተም ቅንብሮች",
        steps: [
          "Click Settings in the sidebar.",
          "Configure: System Name, Logo, Currency, Due Date Rule (days after billing before due), Email notifications on/off.",
          "Click Save Settings.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'ቅንብሮች' የሚለውን ይጫኑ።",
          "የሚከተሉትን ያዋቅሩ፡ የሲስተም ስም፣ አርማ (Logo)፣ የገንዘብ ምንዛሬ፣ የመክፈያ ቀን ደንብ (ከቢል በኋላ ስንት ቀናት)፣ የኢሜይል ማሳወቂያዎች ማብሪያ/ማጥፊያ።",
          "'ቅንብሮችን አስቀምጥ' የሚለውን ይጫኑ።",
        ],
      },
      {
        heading: "Billing Settings",
        amharicHeading: "የቢል ቅንብሮች",
        steps: [
          "In Settings, navigate to the Billing tab.",
          "Configure: default carry balance behavior, penalty thresholds, billing cycle defaults.",
          "Click Save.",
        ],
        amharicSteps: [
          "በቅንብሮች ውስጥ ወደ 'የቢል ቅንብሮች' ትር ይሂዱ።",
          "ያዋቅሩ፡ ነባሪ የቀሪ ሂሳብ ማሸጋገር ባህሪ፣ የቅጣት መነሻ ወራት፣ ነባሪ የቢል ዑደት።",
          "'አስቀምጥ' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "warning",
            text: "Changes to billing settings take effect on the NEXT billing cycle only. Bills already in progress are not affected.",
            amharicText: "የቢል ቅንብሮች ለውጥ በሚቀጥለው የቢል ዑደት ላይ ብቻ ተፈፃሚ ይሆናል። በሂደት ላይ ያሉ ቢሎች አይነኩም።",
          },
        ],
      },
    ],
  },
  {
    id: "promotions", icon: Megaphone, title: "Promotions", amharicTitle: "ቅናሾችና ማበረታቻዎች",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "System", color: "bg-pink-500", gradient: "from-pink-50 to-rose-50", accentLight: "border-pink-200 bg-pink-50",
    content: [
      {
        heading: "Manage Promotions",
        amharicHeading: "ቅናሾችን ማስተዳደር",
        steps: [
          "Click Promotions in the sidebar.",
          "View active and past promotions.",
          "Click + New Promotion to create one.",
          "Enter: Title, Description, Discount Type, Value, Eligible Charge Groups, Date Range.",
          "Click Save to activate the promotion.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'ቅናሾች' የሚለውን ይጫኑ።",
          "ንቁና ያለፉ ቅናሾችን ይመልከቱ።",
          "አዲስ ለመፍጠር '+ አዲስ ቅናሽ' የሚለውን ይጫኑ።",
          "ያስገቡ፡ ርዕስ፣ መግለጫ፣ የቅናሽ አይነት፣ ዋጋ፣ የሚመለከታቸው የክፍያ ምድቦች፣ የቀን ገደብ።",
          "ቅናሹን ተግባራዊ ለማድረግ 'አስቀምጥ'ን ይጫኑ።",
        ],
        callouts: [
          {
            type: "info",
            text: "Promotions automatically apply discounts to new bills generated within the promotion's date range.",
            amharicText: "ቅናሾች በቅናሹ የቀን ገደብ ውስጥ ለሚወጡ አዳዲስ ቢሎች በራስ-ሰር ተፈፃሚ ይሆናሉ።",
          },
        ],
      },
    ],
  },
  {
    id: "security-logs", icon: Shield, title: "Security Logs", amharicTitle: "የደህንነት ምዝግብ ማስታወሻ",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "System", color: "bg-red-700", gradient: "from-red-50 to-orange-50", accentLight: "border-red-200 bg-red-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Security Logs provide a full audit trail of all sensitive actions: logins, data changes, deletions, bulk operations, and permission changes — essential for compliance and incident investigation.",
        amharicBody: "የደህንነት ምዝግብ ማስታወሻዎች የሁሉንም ጥንቃቄ የሚሹ እርምጃዎች ሙሉ የኦዲት መዝገብ ይይዛሉ፡ መግቢያዎች፣ የመረጃ ለውጦች፣ ስረዛዎች፣ የጅምላ ስራዎች እና የፈቃድ ለውጦች — ለህጋዊ ቁጥጥር እና ለስህተት ምርመራ ወሳኝ ናቸው።",
      },
      {
        heading: "Security Log Entry Fields",
        amharicHeading: "የደህንነት መዝገብ መስኮች",
        table: {
          headers: ["Field", "Description"],
          rows: [
            ["Event Type", "Category: Login, Data Change, Delete, Bulk Op, Settings"],
            ["User", "Which staff member performed the action"],
            ["Timestamp", "Exact date and time (with timezone)"],
            ["IP Address", "Network address of the user's device"],
            ["Details", "What specifically was changed (before/after)"],
            ["Branch", "Which branch context the action was performed in"],
          ],
        },
        amharicTable: {
          headers: ["መስክ", "መግለጫ"],
          rows: [
            ["የክስተት አይነት", "ምድብ፡ መግቢያ፣ የመረጃ ለውጥ፣ ስረዛ፣ የጅምላ ስራ፣ ቅንብሮች"],
            ["ተጠቃሚ", "እርምጃውን የፈጸመው ሰራተኛ"],
            ["የጊዜ ማህተም", "ትክክለኛ ቀን እና ሰዓት"],
            ["የአይፒ አድራሻ (IP)", "የሰራተኛው መሳሪያ ኔትወርክ አድራሻ"],
            ["ዝርዝር", "በተለይ ምን እንደተቀየረ (የቀድሞ / የአሁን ዋጋ)"],
            ["ቅርንጫፍ", "እርምጃው የተከናወነበት የቅርንጫፍ አውድ"],
          ],
        },
      },
      {
        heading: "User Sessions Tab",
        amharicHeading: "የተጠቃሚዎች ክፍለ-ጊዜ (Sessions) ትር",
        steps: [
          "Click Security Logs > User Sessions tab.",
          "View all active and recent staff and customer sessions.",
          "Filter by type (Staff/Customer), status, or branch.",
          "Click Kick Out to immediately terminate an active session.",
          "Click View to see the full session details and page visit history.",
          "Click Export CSV to download the session log.",
        ],
        amharicSteps: [
          "ወደ 'የደህንነት ምዝግብ' > 'የተጠቃሚ ክፍለ-ጊዜ' ትር ይሂዱ።",
          "ሁሉንም ንቁና የቅርብ ጊዜ የሰራተኛ እና የደንበኛ ክፍለ-ጊዜዎችን ይመልከቱ።",
          "በአይነት (ሰራተኛ/ደንበኛ)፣ በሁኔታ ወይም በቅርንጫፍ ያጣሩ።",
          "አንድን ክፍለ-ጊዜ ወዲያውኑ ለማቋረጥ 'አስወጣ' (Kick Out) የሚለውን ይጫኑ።",
          "ሙሉ የክፍለ-ጊዜ ዝርዝሮችን እና የጎበኟቸውን ገጾች ለማየት 'እይ' የሚለውን ይጫኑ።",
          "የክፍለ-ጊዜ መዝገቡን ለማውረድ 'Export CSV' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "warning",
            text: "Kicking out a session immediately invalidates their login token. The user will be redirected to the login page on their next action.",
            amharicText: "አንድን ተጠቃሚ ማስወጣት ወዲያውኑ የመግቢያ ምልክቱን ያሰርዘዋል። ተጠቃሚው በሚቀጥለው እርምጃው ወደ መግቢያ ገጽ ይዛወራል።",
          },
        ],
      },
    ],
  },
  {
    id: "recycle-bin", icon: Trash2, title: "Recycle Bin", amharicTitle: "የተሰረዙ መረጃዎች ማከማቻ",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "System", color: "bg-orange-600", gradient: "from-orange-50 to-amber-50", accentLight: "border-orange-200 bg-orange-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "The Recycle Bin stores soft-deleted records — bills, bulk meters, and individual customers. Items can be restored or permanently deleted. Paid bills are always protected from permanent deletion.",
        amharicBody: "የቆሻሻ ማከማቻ በጊዜያዊነት የተሰረዙ መረጃዎችን ይይዛል — ቢሎች፣ የጅምላ ቆጣሪዎች እና የግል ደንበኞች። መረጃዎችን መልሶ ማግኘት ወይም በቋሚነት ማጥፋት ይቻላል። የተከፈሉ ቢሎች በቋሚነት ከመሰረዝ ሁልጊዜ የተጠበቁ ናቸው።",
      },
      {
        heading: "Restore vs. Permanently Delete",
        amharicHeading: "መልሶ ማግኘት እና በቋሚነት መሰረዝ ማነፃፀሪያ",
        table: {
          headers: ["Action", "Result", "Reversible?"],
          rows: [
            ["Restore", "Item returns to its original state and location", "✅ Yes — can be deleted again"],
            ["Delete Permanently", "Record is removed from the database forever", "❌ No — irreversible"],
          ],
        },
        amharicTable: {
          headers: ["እርምጃ", "ውጤት", "ሊመለስ ይችላል?"],
          rows: [
            ["መልሶ ማግኘት (Restore)", "መረጃው ወደ ቀድሞ ሁኔታው እና ቦታው ይመለሳል", "✅ አዎ — እንደገና ሊሰረዝ ይችላል"],
            ["በቋሚነት መሰረዝ (Purge)", "መረጃው ከመረጃ ቋቱ ለዘላለም ይወገዳል", "❌ አይ — ፈጽሞ አይመለስም"],
          ],
        },
      },
      {
        heading: "Restore a Single Item",
        amharicHeading: "አንድን መረጃ መልሶ ማግኘት",
        steps: [
          "Find the item in the Recycle Bin list.",
          "Click the Restore button on that row.",
          "The item is restored to its original state.",
          "For bills, customer outstanding balances are recalculated automatically.",
        ],
        amharicSteps: [
          "በቆሻሻ ማከማቻ ዝርዝር ውስጥ መረጃውን ያግኙ።",
          "በረድፉ ላይ ያለውን 'መልስ' (Restore) የሚለውን ቁልፍ ይጫኑ።",
          "መረጃው ወደ ቀድሞ ሁኔታው ይመለሳል።",
          "ለቢሎች ከሆነ፣ የደንበኛው ቀሪ ሂሳብ በራስ-ሰር እንደገና ይሰላል።",
        ],
      },
      {
        heading: "Permanently Delete",
        amharicHeading: "በቋሚነት መሰረዝ",
        steps: [
          "Select one or more items using checkboxes.",
          "Click Delete Permanently.",
          "Type DELETE in the confirmation box.",
          "Click Confirm.",
        ],
        amharicSteps: [
          "አመልካች ሳጥኖችን በመጠቀም አንድ ወይም ከዚያ በላይ መረጃዎችን ይምረጡ።",
          "'በቋሚነት ሰርዝ' የሚለውን ይጫኑ።",
          "በማረጋገጫ ሳጥኑ ውስጥ 'DELETE' ብለው ይተይቡ።",
          "'አረጋግጥ' የሚለውን ይጫኑ።",
        ],
        callouts: [
          {
            type: "danger",
            text: "Permanently deleted records CANNOT be recovered under any circumstances. The database row is removed entirely.",
            amharicText: "በቋሚነት የተሰረዙ መረጃዎችን በማንኛውም ሁኔታ መልሶ ማግኘት አይቻልም። የመረጃ ቋት ረድፉ ሙሉ በሙሉ ይወገዳል።",
          },
        ],
      },
    ],
  },
  {
    id: "backup", icon: Database, title: "Database Backup", amharicTitle: "የመረጃ ቋት ምትኬ",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "System", color: "bg-indigo-700", gradient: "from-indigo-50 to-blue-50", accentLight: "border-indigo-200 bg-indigo-50",
    content: [
      {
        heading: "Overview",
        amharicHeading: "አጠቃላይ መግለጫ",
        body: "Database Backup allows admins to create and download snapshots of the entire system database. Regular backups protect against data loss from hardware failure, accidental deletion, or system corruption.",
        amharicBody: "የመረጃ ቋት ምትኬ አድሚኖች የመላውን ሲስተም የመረጃ ቋት ቅጂ እንዲፈጥሩ እና እንዲያወርዱ ያስችላቸዋል። መደበኛ ምትኬዎች በሃርድዌር ብልሽት፣ በስህተት መሰረዝ ወይም በሲስተም ጉዳት ምክንያት የሚደርስ የመረጃ መጥፋትን ይከላከላሉ።",
      },
      {
        heading: "Create a Backup",
        amharicHeading: "ምትኬ መፍጠር",
        steps: [
          "Click Database Backup in the sidebar.",
          "Click Create Backup to generate a system backup.",
          "Download the backup file for safe offline storage.",
          "View backup history with timestamps and file sizes.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የመረጃ ቋት ምትኬ' የሚለውን ይጫኑ።",
          "አዲስ የሲስተም ምትኬ ለማዘጋጀት 'ምትኬ ፍጠር' የሚለውን ይጫኑ።",
          "ለደህንነቱ የተጠበቀ ማከማቻ የምትኬ ፋይሉን ያውርዱ።",
          "የምትኬ ታሪክን ከቀን ሰዓት እና ከፋይል መጠን ጋር ይመልከቱ።",
        ],
        callouts: [
          {
            type: "tip",
            text: "Schedule backups weekly minimum. Store copies in two different physical locations or cloud services.",
            amharicText: "ቢያንስ በየሳምንቱ ምትኬ ያስይዙ። ቅጂዎችን በሁለት የተለያዩ አካላዊ ቦታዎች ወይም የክላውድ አገልግሎቶች ያስቀምጡ።",
          },
          {
            type: "warning",
            text: "Backup files contain sensitive customer and financial data. Store them securely with encryption.",
            amharicText: "የምትኬ ፋይሎች ሚስጥራዊ የደንበኛ እና የፋይናንስ መረጃዎችን ይይዛሉ። በምስጠራ (Encryption) በጥንቃቄ ያስቀምጧቸው።",
          },
        ],
      },
    ],
  },
  {
    id: "maintenance", icon: Activity, title: "System Maintenance", amharicTitle: "የሲስተም ጥገና",
    badge: "Admin", amharicBadge: "አድሚን",
    group: "System", color: "bg-yellow-700", gradient: "from-yellow-50 to-amber-50", accentLight: "border-yellow-200 bg-yellow-50",
    content: [
      {
        heading: "System Maintenance Tasks",
        amharicHeading: "የሲስተም ጥገና ስራዎች",
        steps: [
          "Click System Maintenance in the sidebar.",
          "View system health statistics: database size, active jobs, error counts.",
          "Use maintenance tools: clear stale jobs, rebuild indexes, re-sync aging.",
          "Schedule or run maintenance tasks as needed.",
        ],
        amharicSteps: [
          "በጎን አሞሌው ላይ 'የሲስተም ጥገና' የሚለውን ይጫኑ።",
          "የሲስተም ጤና አሀዞችን ይመልከቱ፡ የመረጃ ቋት መጠን፣ ንቁ ስራዎች፣ የስህተት ብዛት።",
          "የጥገና መሳሪያዎችን ይጠቀሙ፡ የተጣበቁ ስራዎችን ማጽዳት፣ ኢንዴክሶችን ማደስ፣ የክፍያ እርጅናን እንደገና ማመሳሰል።",
          "እንደ አስፈላጊነቱ የጥገና ስራዎችን ያከናውኑ።",
        ],
        table: {
          headers: ["Tool", "What it does", "When to use"],
          rows: [
            ["Clear Stale Jobs", "Removes billing jobs stuck in running state", "If batch billing seems frozen"],
            ["Rebuild Indexes", "Optimizes database query performance", "Monthly, or after bulk imports"],
            ["Re-sync Aging", "Recalculates overdue days for all bills", "After tariff or date changes"],
          ],
        },
        amharicTable: {
          headers: ["መሳሪያ", "ምን ይሰራል", "መቼ ጥቅም ላይ ይውላል"],
          rows: [
            ["የተጣበቁ ስራዎችን ማጽዳት", "በመሮጥ ላይ ተጣብቀው የቀሩ የቢል ስራዎችን ያስወግዳል", "የጅምላ ቢል ስራ የቆመ ከመሰለ"],
            ["ኢንዴክሶችን ማደስ", "የመረጃ ቋት ፍለጋ ፍጥነትን ያሻሽላል", "በየወሩ፣ ወይም ከትላልቅ ፋይሎች ጭነት በኋላ"],
            ["የእርጅና ቀናትን ማመሳሰል", "ለሁሉም ቢሎች ያለፉ ቀናትን እንደገና ያሰላል", "ከታሪፍ ወይም ከቀን ለውጦች በኋላ"],
          ],
        },
      },
    ],
  },
  {
    id: "errors", icon: AlertOctagon, title: "Common Errors & Fixes", amharicTitle: "የተለመዱ ስህተቶችና መፍትሄዎች",
    badge: "All Users", amharicBadge: "ሁሉም ተጠቃሚዎች",
    group: "System", color: "bg-red-600", gradient: "from-red-50 to-rose-50", accentLight: "border-red-200 bg-red-50",
    content: [
      {
        heading: "Error Reference Table",
        amharicHeading: "የስህተቶች ማመሳከሪያ ሰንጠረዥ",
        table: {
          headers: ["Error Message", "Cause", "Solution"],
          rows: [
            ["A billing job is currently in progress", "Billing job is running", "Wait for completion or clear stale job from System Maintenance"],
            ["Bill not found", "Bill deleted or invalid ID", "Check the Recycle Bin"],
            ["Cannot edit core billing data", "Bill is Posted or Approved", "Only payment fields are editable on Posted bills"],
            ["Deletion Failed", "SQL or system error", "Contact administrator and check Security Logs"],
            ["Forbidden: Missing permission", "Role lacks this permission", "Contact your administrator to update role permissions"],
            ["Billing period overlaps", "Bill exists for that period", "Use Bulk Delete to reset the period first"],
            ["Reading below previous", "New reading < prior reading", "Verify field reading; admin can override if confirmed"],
            ["HTTP error: 500", "Server error (missing DB table / config)", "Contact system administrator to check server logs"],
          ],
        },
        amharicTable: {
          headers: ["የስህተት መልዕክት", "ምክንያት", "መፍትሄ"],
          rows: [
            ["የቢል ስራ በሂደት ላይ ነው", "ሌላ የቢል ስራ እየሮጠ ነው", "እስኪጠናቀቅ ይጠብቁ ወይም ከተጣበቀ ከጥገና ገጽ ያጽዱ"],
            ["ቢሉ አልተገኘም", "ቢሉ ተሰርዟል ወይም መለያው ልክ አይደለም", "የቆሻሻ ማከማቻውን ይመልከቱ"],
            ["ዋና የቢል መረጃን ማረም አይቻልም", "ቢሉ የተለጠፈ ወይም የጸደቀ ነው", "በተለጠፉ ቢሎች ላይ የክፍያ መስኮች ብቻ ይታረማሉ"],
            ["ስረዛው አልተሳካም", "የSQL ወይም የሲስተም ስህተት", "አድሚኑን ያነጋግሩና የደህንነት መዝገቡን ይመልከቱ"],
            ["ያልተፈቀደ፡ ፈቃድ ይጎድሎታል", "የስራ ሚናዎ ይህ ፈቃድ የለውም", "የሚና ፈቃድ እንዲሰጥዎ አድሚኑን ያነጋግሩ"],
            ["የቢል ጊዜ ይደራረባል", "ለዚያ ጊዜ ቢል ቀድሞ ወጥቷል", "ጊዜውን እንደገና ለማስላት መጀመሪያ 'በጅምላ ሰርዝ'ን ይጠቀሙ"],
            ["ንባቡ ከቀዳሚው ያነሰ ነው", "አዲሱ ንባብ < የቀድሞው ንባብ", "የመስክ ንባቡን ያረጋግጡ፤ ከተረጋገጠ አድሚን ሊያልፈው ይችላል"],
            ["HTTP error: 500", "የሰርቨር ስህተት", "የሰርቨር መዝገቦችን እንዲመረምር የሲስተም አድሚኑን ያነጋግሩ"],
          ],
        },
        callouts: [
          {
            type: "info",
            text: "All 500 errors are logged server-side. Provide the exact timestamp and action to your administrator for faster diagnosis.",
            amharicText: "ሁሉም የ500 ስህተቶች በሰርቨር በኩል ይመዘገባሉ። ለፈጣን ምርመራ ትክክለኛውን ሰዓትና የሰሩትን እርምጃ ለአድሚኑ ያቅርቡ።",
          },
        ],
      },
    ],
  },
];
