import { redirect } from "next/navigation";

// The setup moved to its own page in the sidebar.
export default function CommentDmPage() {
  redirect("/dashboard/comments");
}
