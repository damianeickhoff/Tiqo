import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

/** The way in is one canvas, and each page brings its own words for it — so
 *  this is only the guard that keeps a signed-in account off these pages. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getCurrentUser()) redirect("/");
  return children;
}
