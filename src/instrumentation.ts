// Runs once when the Next.js server starts (not during `next build`).
// Node-only work lives in instrumentation-node.ts so it never reaches the Edge bundle.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}
