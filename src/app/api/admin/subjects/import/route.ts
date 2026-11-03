import { importReferences } from "@/lib/reference-import";

export function POST(req: Request) {
  return importReferences(req, "subjects");
}
