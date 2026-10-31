// Public client config. The publishable key is safe to ship: every trip table is protected by RLS
// and only the emails in trip_people can read or write.
export const SUPABASE_URL = "https://ebzxlyqofhtlnahxpyow.supabase.co";
export const SUPABASE_KEY = "sb_publishable_yYpvz-IprBd-NVzBsiV-3Q_vJLBs0Vx";

// Fallback list of who can log in; the live list comes from the trip_logins() database function.
export const LOGINS = [
  { id: "alexandre", name: "Alexandre", email: "alexandre@meribel.invalid" },
  { id: "jose", name: "José Inácio", email: "jose@meribel.invalid" },
  { id: "ricardo", name: "Ricardo", email: "ricardo@meribel.invalid" },
  { id: "miguel", name: "Miguel", email: "miguel@meribel.invalid" },
  { id: "milton", name: "Milton", email: "milton@meribel.invalid" },
  { id: "daniel", name: "Daniel", email: "daniel@meribel.invalid" },
  { id: "marina", name: "Marina", email: "marina@meribel.invalid" },
];
