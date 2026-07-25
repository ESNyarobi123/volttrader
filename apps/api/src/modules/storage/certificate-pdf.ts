/**
 * Minimal single-page PDF (no external PDF library).
 * Text is escaped for PDF string literals.
 */
export function buildCertificatePdf(input: {
  learnerName: string;
  courseTitle: string;
  certificateNumber: string;
  issuedAt: string;
  brandName?: string;
}): Buffer {
  const brand = input.brandName ?? "Volt Trades";
  const lines = [
    brand,
    "Certificate of Completion",
    `Awarded to ${input.learnerName}`,
    `for completing ${input.courseTitle}`,
    `Certificate No. ${input.certificateNumber}`,
    `Issued ${input.issuedAt}`,
    "This certifies course completion — not investment performance.",
  ];

  const contentLines = lines.map((line, i) => {
    const y = 720 - i * 36;
    const size = i === 0 ? 22 : i === 1 ? 18 : 12;
    return `BT /F1 ${size} Tf 50 ${y} Td (${escapePdf(line)}) Tj ET`;
  });

  const stream = contentLines.join("\n");
  const objects: string[] = [];
  objects.push("1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n");
  objects.push("2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n");
  objects.push(
    "3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj\n",
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, "utf8")} >>stream\n${stream}\nendstream\nendobj\n`,
  );
  objects.push("5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n");

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

function escapePdf(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
