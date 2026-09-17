import { redirect } from "next/navigation";

/** The area has no overview of its own — the first section is the landing. */
export default function SettingsIndex() {
  redirect("/settings/general");
}
