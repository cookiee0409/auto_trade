declare module "lucide-react" {
  import type * as React from "react";

  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    absoluteStrokeWidth?: boolean;
  }

  export type LucideIcon = React.FC<LucideProps>;

  export const Activity: LucideIcon;
  export const AlertTriangle: LucideIcon;
  export const BarChart3: LucideIcon;
  export const BrainCircuit: LucideIcon;
  export const Crosshair: LucideIcon;
  export const Eye: LucideIcon;
  export const FileUp: LucideIcon;
  export const Gauge: LucideIcon;
  export const ListChecks: LucideIcon;
  export const Loader2: LucideIcon;
  export const LogIn: LucideIcon;
  export const LogOut: LucideIcon;
  export const Play: LucideIcon;
  export const Plus: LucideIcon;
  export const Save: LucideIcon;
  export const Search: LucideIcon;
  export const ScrollText: LucideIcon;
  export const Settings: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const Target: LucideIcon;
  export const Trash2: LucideIcon;
  export const TrendingDown: LucideIcon;
  export const TrendingUp: LucideIcon;
  export const Upload: LucideIcon;
}
