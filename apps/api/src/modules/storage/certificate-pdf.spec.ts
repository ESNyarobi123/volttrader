import { buildCertificatePdf } from "./certificate-pdf";

describe("buildCertificatePdf", () => {
  it("returns a PDF buffer with header and certificate number", () => {
    const pdf = buildCertificatePdf({
      learnerName: "Ada Lovelace",
      courseTitle: "Forex Foundation",
      certificateNumber: "VT-2026-ABCD1234",
      issuedAt: "2026-07-24",
    });
    const text = pdf.toString("utf8");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("VT-2026-ABCD1234");
    expect(text).toContain("Ada Lovelace");
    expect(text).toContain("%%EOF");
  });
});
