import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { attempts, files, questionBank } from "@/db/schema";
import { pdfToText } from "./pdf";
import { subjectKey } from "./isc";

/** Heuristics for finding questions and their chapters in an extracted paper. */
const CHAPTER_HINTS: { subject: string; re: RegExp; chapter: string }[] = [
  { subject: "physics", re: /electrostat|capacitan|coulomb|gauss|dipole|electric field|electric flux|equipotential/i, chapter: "Electrostatics" },
  { subject: "physics", re: /current|ohm|kirchhoff|wheatstone|potentiometer|resist/i, chapter: "Current Electricity" },
  { subject: "physics", re: /magnetic|solenoid|galvanometer|ampere|biot|ferro/i, chapter: "Magnetic Effects of Current and Magnetism" },
  { subject: "physics", re: /induct|alternating|induction|transformer|lc[lr]|inductor|impedance|self.?induct|eddy current|reactance|ac generator|choke/i, chapter: "Electromagnetic Induction and Alternating Currents" },
  { subject: "physics", re: /bohr|nucleus|isotope|isobar|isotone|binding energy|fission|fusion|radioactive|half.?life|hydrogen spectrum|rydberg|spectral line|mass defect|nuclear/i, chapter: "Atoms and Nuclei" },
  { subject: "physics", re: /electromagnetic wave|displacement current|electromagnetic spectrum|gamma rays|radio waves|x.?rays.*uses|infrared.*microwav/i, chapter: "Electromagnetic Waves" },
  { subject: "physics", re: /optics|lens|mirror|refract|prism|interference|diffraction|huygen|microscope|telescope|fringe|wavefront|total internal|critical angle|dispersion/i, chapter: "Optics" },
  { subject: "physics", re: /photoelectric|photon|de ?broglie|work function/i, chapter: "Dual Nature of Radiation and Matter" },
  { subject: "physics", re: /bohr|nucleus|isotope|isobar|isotone|binding energy|fission|fusion|radioactive|half.?life|hydrogen spectrum|rydberg|spectral line|mass defect|nuclear/i, chapter: "Atoms and Nuclei" },
  { subject: "physics", re: /semiconductor|diode|zener|rectifier|junction|transistor|led|solar cell|energy band|photodiode|intrinsic|extrinsic|doping|forward bias|reverse bias/i, chapter: "Electronic Devices" },
  { subject: "chemistry", re: /solution|raoult|colligative|osmotic|osmot|molal|molar elevation|freezing point|van'?t hoff/i, chapter: "Solutions" },
  { subject: "chemistry", re: /electrochem|nernst|electrode|faraday|conduct|galvanic|electroly|cell notation|corrosion/i, chapter: "Electrochemistry" },
  { subject: "chemistry", re: /kinetic|rate constant|order of reaction|arrhenius|half.?life|activation energy|molecularity/i, chapter: "Chemical Kinetics" },
  { subject: "chemistry", re: /transition|lanthanoid|actinoid|permanganate|dichromate|3d series|d.?block|f.?block/i, chapter: "d- and f-Block Elements" },
  { subject: "chemistry", re: /coordination|ligand|complex|hybridisation.*complex|crystal field|iupac.*complex|isomer.*complex/i, chapter: "Coordination Compounds" },
  { subject: "chemistry", re: /haloalkane|haloarene|sn1|sn2|nucleophilic substitution|grignard|wurtz|alkyl halide/i, chapter: "Haloalkanes and Haloarenes" },
  { subject: "chemistry", re: /alcohol|phenol|ether|lucas|williamson|kolbe|reimer/i, chapter: "Alcohols, Phenols and Ethers" },
  { subject: "chemistry", re: /aldehyde|ketone|carboxylic|aldol|cannizzaro|tollens|fehling|iodoform|hvz|ester/i, chapter: "Aldehydes, Ketones and Carboxylic Acids" },
  { subject: "chemistry", re: /amine|diazon|aniline|carbylamine|hinsberg|hofmann|nitro compound/i, chapter: "Organic Compounds containing Nitrogen" },
  { subject: "chemistry", re: /biomolecule|carbohydrate|glucose|protein|amino acid|vitamin|nucleic|dna|rna|enzyme/i, chapter: "Biomolecules" },
  { subject: "maths", re: /relation|function|inverse trigonometric|one.?to.?one|onto|equivalence/i, chapter: "Relations and Functions" },
  { subject: "maths", re: /matrix|matrices|determinant|adjoint|singular/i, chapter: "Algebra: Matrices and Determinants" },
  { subject: "maths", re: /continuity|differentiab|derivative|maxima|minima|tangent|normal|increasing|decreasing/i, chapter: "Calculus: Continuity, Differentiability and Differentiation" },
  { subject: "maths", re: /integrat|integral|area under|area bounded/i, chapter: "Calculus: Integrals" },
  { subject: "maths", re: /differential equation|dy\/dx|integrating factor/i, chapter: "Calculus: Differential Equations" },
  { subject: "maths", re: /vector|dot product|cross product|scalar triple/i, chapter: "Vector Algebra" },
  { subject: "maths", re: /three.?dimensional|direction cosin|plane.*line|skew|shortest distance/i, chapter: "Three-Dimensional Geometry" },
  { subject: "maths", re: /linear programming|feasible|objective function|constraint/i, chapter: "Linear Programming" },
  { subject: "maths", re: /probability|bayes|conditional|random variable|binomial/i, chapter: "Probability" },
  { subject: "cs", re: /boolean|karnaugh|k.?map|sop|pos|minterm|maxterm|truth table|proposition|wff|tautolog/i, chapter: "Boolean Algebra" },
  { subject: "cs", re: /logic gate|nand|nor|multiplexer|decoder|encoder|adder/i, chapter: "Computer Hardware" },
  { subject: "cs", re: /java|class|method|constructor|scanner|inheritance|interface|polymorph|abstract/i, chapter: "Programming in Java" },
  { subject: "cs", re: /stack|queue|linked list|infix|postfix|prefix|dequeue|binary tree|traversal/i, chapter: "Data Structures" },
  { subject: "cs", re: /complexity|big.?o|time complexity|space complexity/i, chapter: "Complexity and Big O Notation" },
  { subject: "english1", re: /composition|essay|write a.*words/i, chapter: "Composition" },
  { subject: "english1", re: /directed writing|proposal|speech|article|report|blog|review/i, chapter: "Directed Writing and Proposal" },
  { subject: "english1", re: /rewrite|transform|phrasal verb|fill in the blank|join the following/i, chapter: "Grammar, Structure and Usage" },
  { subject: "english1", re: /passage|comprehension|summary/i, chapter: "Comprehension" },
  { subject: "english2", re: /macbeth|duncan|banquo|lady macbeth|macduff|malcolm|witch/i, chapter: "Drama: Macbeth" },
  { subject: "english2", re: /cookie lady|soft rains|medicine bag|atithi|indigo|tagore|bradbury|prism/i, chapter: "Prose: Prism" },
  { subject: "english2", re: /telephone conversation|tithonus|beethoven|small towns|death be not proud|soyinka|tennyson|donne|rhapsody|poem|poet/i, chapter: "Poetry: Rhapsody" },
];

function chapterFor(subject: string, text: string): string {
  const key = subjectKey(subject) ?? "";
  const hit = CHAPTER_HINTS.find((h) => h.subject === key && h.re.test(text));
  return hit?.chapter ?? "Unclassified";
}

const clean = (s: string) =>
  s
    .replace(/[─\-]{10,}/g, " ")
    .replace(/-- \d+ of \d+ --/g, " ")
    .replace(/ISC SPECIMEN QUESTION PAPER \d+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export interface ExtractResult {
  added: number;
  fromPdf: boolean;
}

/**
 * Reads an uploaded question paper and stores each numbered question it can find in the practice
 * bank. Runs on upload, and can be run again for a paper already in the bin, because the paper
 * itself stays useful after the attempt is recycled.
 */
export async function extractQuestions(attemptId: number): Promise<ExtractResult> {
  const [a] = await db.select().from(attempts).where(eq(attempts.id, attemptId));
  if (!a) return { added: 0, fromPdf: false };

  const paper = await db
    .select()
    .from(files)
    .where(eq(files.attemptId, attemptId))
    .orderBy(asc(files.position), asc(files.id));
  const pdf = paper.find((f) => f.kind === "paper" && f.mime === "application/pdf");
  if (!pdf) return { added: 0, fromPdf: false };

  let text: string;
  try {
    text = await pdfToText(pdf.data, { maxChars: 90_000 });
  } catch {
    return { added: 0, fromPdf: false };
  }
  if (!text.trim()) return { added: 0, fromPdf: false };

  // Keep only the question paper: cut at the answer key if the PDF carries one. Specimen papers
  // repeat every question in the key, so failing to cut doubles the whole bank.
  const marker = text.search(/ANSWER\s*KEY|MARKING\s*SCHEME|SOLUTIONS?\s*TO\s*QUESTION|Answers?\s+to\s+Question/i);
  const body = marker > 500 ? text.slice(0, marker) : text;

  // Re-running extraction replaces what we had, so a paper can be re-read after more pages are
  // uploaded without leaving stale or duplicated rows behind.
  const existing = await db.select({ number: questionBank.number }).from(questionBank).where(eq(questionBank.attemptId, attemptId));
  const hadExisting = existing.length > 0;
  const seen = new Set<string>();

  const parts = body.split(/(?=Question\s+\d+\b)/);
  const rows: (typeof questionBank.$inferInsert)[] = [];
  let currentSection = "";
  let sectionBuffer = "";

  for (const part of parts) {
    const secMatch = part.match(/SECTION\s*[-–]?\s*([A-D])/i);
    if (secMatch) currentSection = secMatch[1].toUpperCase();

    const qm = part.match(/Question\s+(\d+)\b/);
    if (!qm) continue;
    const number = qm[1];

    // The visible text of this question, minus the markers.
    const body = clean(part.replace(/SECTION\s*[-–]?\s*[A-D]\s*[–-]?\s*\d*\s*MARKS?/i, " ").replace(/Question\s+\d+\b/, ""));
    if (body.length < 40) continue;

    // Marks: the bracketed totals on the line.
    const marks = [...part.matchAll(/\[(\d{1,2})\]/g)].map((m) => parseInt(m[1], 10));
    const total = marks.length ? marks.reduce((x, y) => x + y, 0) : null;

    // Chapter: from the section banner if there is one, otherwise from the question's own words.
    const look = `${sectionBuffer} ${part}`.slice(0, 1200);
    const chapter = chapterFor(a.subject, look);

    if (seen.has(number)) continue; // the same number twice inside one paper is the answer key
    seen.add(number);

    rows.push({
      attemptId,
      subject: a.subject,
      chapter,
      number,
      section: currentSection,
      marks: total && total > 0 && total <= 100 ? total : null,
      text: body.slice(0, 1400),
      sourceName: pdf.name,
    });
    sectionBuffer = "";
  }

  if (rows.length === 0) return { added: 0, fromPdf: true };

  if (hadExisting) {
    await db.delete(questionBank).where(eq(questionBank.attemptId, attemptId));
  }
  await db.insert(questionBank).values(rows);
  return { added: rows.length, fromPdf: true };
}
