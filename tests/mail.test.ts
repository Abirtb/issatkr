import assert from "node:assert/strict";
import test from "node:test";
import { createMailTransport } from "../src/lib/mail";

test("builds and sends mail with the JSON transport", async () => {
  const previousTransport = process.env.SMTP_TRANSPORT;
  const previousFrom = process.env.SMTP_FROM;
  process.env.SMTP_TRANSPORT = "json";
  process.env.SMTP_FROM = "absence@issatkr.tn";
  try {
    const { from, transporter } = createMailTransport();
    const result = await transporter.sendMail({
      from,
      to: "student@example.tn",
      subject: "Test",
      text: "Message",
    });
    assert.equal(result.envelope.from, "absence@issatkr.tn");
    assert.deepEqual(result.envelope.to, ["student@example.tn"]);
  } finally {
    process.env.SMTP_TRANSPORT = previousTransport;
    process.env.SMTP_FROM = previousFrom;
  }
});
