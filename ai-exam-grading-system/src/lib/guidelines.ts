import { subjectKey, type SubjectKey } from "./isc";

export interface StepRule {
  task: string;
  scheme: string;
}

export interface Guideline {
  key: SubjectKey;
  name: string;
  /** How the paper is set. Verify against the specimen in the Library; sources differ on some weightings. */
  paper: string[];
  /** How marks are awarded in this subject. */
  rules: string[];
  /** Typical step pattern for each question type. */
  steps: StepRule[];
  /** Operative words the examiner looks for. */
  keywords: string[];
  /** Where candidates lose marks, from CISCE examiner comments. */
  losses: string[];
  /** What the post-marking analysis must cover. */
  analysis: string[];
}

/**
 * Subject guidelines for the marker. Built from the official CISCE ISC 2027 syllabus documents and the
 * 2027 specimen papers with answer keys. Written to work with any vision-capable model from any provider:
 * it states the rules, not the model.
 */
export const GUIDELINES: Record<SubjectKey, Guideline> = {
  english1: {
    key: "english1",
    name: "English 1 (Language)",
    paper: [
      "Theory 80 marks, 3 hours, plus 20 marks project work (listening and speaking). All questions compulsory.",
      "Question 1 (20 marks): a composition of 400–450 words on one topic from a choice of six. The choice normally includes narrative, descriptive, reflective, argumentative or persuasive, expository topics and an original short story.",
      "Question 2 (20 marks): (a) directed writing of 250–300 words based on all the points provided — feature article, book review, blog, newspaper report or statement of purpose; (b) proposal writing based on a given situation, which must include an introduction or heading, objectives, a list of measures and a concluding statement.",
      "Question 3 (15 marks): short-answer questions on grammar, structure and usage — transformation of sentences, phrasal verbs, and verbs and tenses. The number and type of items vary from year to year.",
      "Question 4 (25 marks): a passage of about 700 words. Questions test analytical skills, vocabulary, understanding, inference and meaning. A summary of the main ideas within a word limit, in the grid form, in complete sentences.",
      "Time guidance printed on the paper: about 45 minutes on Question 1, 55 on Question 2, 30 on Question 3 and 50 on Question 4.",
    ],
    rules: [
      "Composition is marked on two criteria: the quality of the language (range and appropriateness of vocabulary and sentence structure, syntax, correctness of grammatical constructions, punctuation and spelling) and the degree to which the content is organised as a whole and in individual paragraphs.",
      "Length is marked. A composition outside 400–450 words, or directed writing outside 250–300 words, loses marks. Rambling and excessive length are penalised.",
      "Directed writing must be based on the information and all the points provided. Each missing point loses its mark. Format is marked: a speech needs a greeting and a purpose; an article needs a headline and a byline; a report needs a title and headings; a blog is informal and first-person.",
      "Proposal writing must follow the CISCE format: introduction or heading, objectives, a list of measures, and a concluding statement. Omitting the conclusion loses marks.",
      "Grammar items are units. Transformation must keep the meaning. A phrasal verb must fit the sentence. Correct only the error in error-correction items.",
      "Comprehension answers are brief and in your own words. Lifting sentences from the passage loses the mark. Each answer should match the marks: one mark is one point.",
      "Word-meaning and vocabulary answers must keep the part of speech required. Changing the form of the word or giving a proper noun loses the mark.",
      "Summary: marks are awarded for expression and for the ability to summarise clearly in complete sentences. Marks are deducted for linguistic errors. The grid form is compulsory; abbreviations and contractions are not accepted.",
      "Gross errors (tense, agreement, sentence structure, spelling) are deducted across the paper.",
    ],
    steps: [
      { task: "Composition (20 marks)", scheme: "Language quality and organisation, each marked. Format must match the chosen task type and the word limit." },
      { task: "Directed writing (15 marks)", scheme: "Format elements, then one mark per required point. Missing points lose marks even when the writing is good." },
      { task: "Proposal (5 marks)", scheme: "Introduction, objectives, measures, conclusion, plus linguistic ability." },
      { task: "Grammar item (1 mark each)", scheme: "The correct transformation, phrasal verb or tense. No partial credit." },
      { task: "Comprehension answer (1 to 2 marks)", scheme: "One mark per distinct point, in your own words. Lifted text earns nothing." },
      { task: "Summary (10 marks)", scheme: "Required number of points for content, separate marks for expression, penalty for exceeding the word limit and for linguistic errors." },
    ],
    keywords: [
      "Format: Dear Sir/Madam, Yours faithfully, Subject:, Headline, Byline, Sincerely",
      "Linking: moreover, however, consequently, on the other hand, in conclusion",
      "Register: formal for letters and reports, personal and vivid for stories and blogs",
      "Argument: thesis, supporting points, counter-argument, conclusion",
      "Comprehension: in your own words, inference, tone, the writer's attitude",
      "Proposal: introduction, objectives, measures, conclusion",
    ],
    losses: [
      "Candidates lifted sentences from the passage when asked for their own words.",
      "Excessive length and rambling were penalised. Gross errors were deducted.",
      "Directed writing answers missed required points: names, numbers, the outcome of an event.",
      "Vocabulary answers used proper nouns or changed the form of the word.",
      "Format was ignored: letters without addresses, emails without subject lines.",
      "Summaries were written in phrases or abbreviations instead of complete sentences.",
    ],
    analysis: [
      "Score each question separately: composition, directed writing, proposal, grammar, comprehension, summary.",
      "For each lost mark, say whether it was format, content, expression or accuracy.",
      "Count lifted sentences in comprehension and word-limit breaches.",
      "Track recurring grammar errors (tenses, articles, prepositions, agreement) as concept gaps.",
      "Name the point each directed-writing answer missed.",
    ],
  },

  english2: {
    key: "english2",
    name: "English 2 (Literature)",
    paper: [
      "Theory 80 marks, 3 hours, plus 20 marks project work (writing skills). All questions compulsory.",
      "Section A (20 marks): Question 1 is 10 MCQs of 1 mark each on the prescribed texts. Question 2 is 5 short answers of 2 marks each, requiring a reason for each.",
      "Section B (60 marks): three long questions of 20 marks each, one on Drama, one on Prose (short stories) and one on Poetry. Internal choice is given in the long answers.",
      "Class XII prescribed texts: Drama — Macbeth, Acts III, IV and V. Prose — Prism: Atithi/Guest (Tagore), The Cookie Lady (Philip K. Dick), There Will Come Soft Rains (Bradbury), Indigo (Satyajit Ray), The Medicine Bag (Sneve). Poetry — Rhapsody: Telephone Conversation (Soyinka), Tithonus (Tennyson), Beethoven (Koyczan), Small Towns and the River (Mamang Dai), Death be not Proud (Donne).",
      "The paper is set only on the Class XII portion of the syllabus.",
    ],
    rules: [
      "Answers must address the key words of the question: discuss, analyse, evaluate, justify and how each demand a different response. A plot summary is not an answer to any of them.",
      "Textual evidence is marked: a quotation or a specific incident earns the evidence mark. Generalised narration with no reference to the text earns little.",
      "Analysis is marked: name the device (irony, imagery, symbolism, foreshadowing) and explain its effect on meaning or mood.",
      "Characterisation needs traits supported by action, dialogue or the narrator's comment. Stock characterisation scores low.",
      "Poetry: the speaker's attitude, tone, theme and the way form (rhyme, rhythm, imagery) carries the meaning. The questions focus on the content, understanding and the personal response to the entire poem.",
      "MCQs: one option only. Two options or an overwritten answer earns zero.",
      "Short answers: the number of points asked for, each with a reason or textual support.",
      "Long answers: three or four developed points, each with evidence and analysis, in a unified argument rather than separate paragraphs of narration. The specimen asks for 100–150 words with given details to incorporate.",
      "Questions test understanding, appreciation and the ability to analyse and synthesise. Respond in your own words.",
    ],
    steps: [
      { task: "MCQ (1 mark)", scheme: "The correct option only. No partial credit." },
      { task: "Short answer (2 marks)", scheme: "Two distinct valid points, each with a reason or textual support." },
      { task: "Long answer (20 marks)", scheme: "Points (content), evidence (quotation or incident), analysis (device or theme), and expression as one argument." },
    ],
    keywords: [
      "Drama: soliloquy, dramatic irony, tragic flaw, hamartia, aside, stage direction, climax",
      "Prose: narrator, point of view, tone, twist, theme, symbolism, foreshadowing",
      "Poetry: speaker, imagery, metaphor, simile, personification, tone, structure, rhyme scheme",
      "Themes: individual versus social liberty, guilt, ambition, war, identity, justice",
      "Analysis verbs: suggests, implies, reveals, underlines, contrasts, reflects",
    ],
    losses: [
      "Answers were flat, stock characterisation, with little reference to the text.",
      "The key words of the question were ignored. The question asked for a discussion and the answer gave a summary.",
      "Candidates did not understand the intent of the poet or the purpose of a passage.",
      "Individual liberty and social liberty were confused, and no examples from the essay or story were cited.",
      "Shift in mood or tone was not discussed; the reflections of the speaker were not addressed.",
    ],
    analysis: [
      "Score each text separately: drama, prose, poetry. Name the weakest text.",
      "Separate evidence (quotations used) from analysis (explanations given).",
      "Check each answer against the verb in its question. Note where the verb was not answered.",
      "List characters, themes and devices that were not written about but should have been.",
    ],
  },

  physics: {
    key: "physics",
    name: "Physics",
    paper: [
      "Theory 70 marks, 3 hours plus 15 minutes reading time. 20 compulsory questions in four sections.",
      "Section A: 14 marks, one question with 14 sub-parts of 1 mark each (MCQ or very short answer).",
      "Section B: 14 marks, seven questions of 2 marks. Section C: 27 marks, nine questions of 3 marks. Section D: 15 marks, three questions of 5 marks.",
      "Internal choice in two questions each in Sections B, C and D. Practical 15, project 10, practical file 5.",
      "Unit weightages from the syllabus: Optics 18; Magnetic Effects and Magnetism with Electromagnetic Induction and Alternating Currents 16; Electrostatics with Current Electricity 14; Dual Nature of Radiation and Matter 7; Electronic Devices 7; Atoms and Nuclei 6; Electromagnetic Waves 2.",
      "Only SI units are to be used. Every physical quantity is to be defined with its unit and dimensions when introduced. Numerical problems are included in all topics except where only qualitative treatment is required.",
    ],
    rules: [
      "Numericals use step marking: the correct formula or relation (1), substitution in SI units (1), and the final answer with its unit and sensible significant figures (1). Correct substitution leading to the correct answer earns full credit even without a formula line. A bare final answer earns only the answer mark.",
      "Convert to SI before substituting: cm to m, μC to C, kV to V, eV to J, mm to m. Unconverted data loses the substitution mark.",
      "Error carried forward: one slip costs once. Method marks for later steps remain when the method is correct.",
      "Derivations: a labelled diagram where asked; each logical step; correct symbols (vector notation, the integral sign, limits); the final result clearly stated. Skipping to the result loses the step marks.",
      "Ray diagrams: arrows on every ray, the normal drawn, angles marked, dotted lines for virtual rays and images, the correct inversion or erection.",
      "Circuits and field diagrams: standard symbols, labelled values, polarity and direction of current or field.",
      "Definitions and laws must carry their conditions: 'at constant temperature', 'in the absence of an external torque'. Quantities defined need their unit.",
      "Graphs: labelled axes with quantity and unit, correct shape, slope or intercept marked where asked.",
      "Units on the final answer: a missing or wrong unit loses the answer mark.",
      "Exclusions from the syllabus that must not be rewarded or demanded: the bridge rectifier of four diodes; the mathematical theory of Rutherford scattering; details of the chain reaction; derivation of the energy stored in a capacitor (formulae only); derivation of the field of a bar magnet; derivation of the Q factor; mathematical treatment of collision theory.",
      "Bohr model: use nm, not Å, for wavelength.",
      "Ampère's circuital law applied to a solenoid is qualitative only. For a finitely long conductor, only the formula of B is required.",
    ],
    steps: [
      { task: "1-mark MCQ or sub-part", scheme: "The correct option or word. No partial credit." },
      { task: "2-mark short answer or numerical", scheme: "Formula with substitution plus answer with unit. For definitions, two distinct keyword points." },
      { task: "3-mark numerical or derivation", scheme: "Formula 1, substitution 1, answer with unit 1. Or diagram 1, steps 1, result 1." },
      { task: "5-mark derivation or long numerical", scheme: "Labelled diagram, each step, the boxed result. Numericals split into parts each with formula, working and unit." },
    ],
    keywords: [
      "Operative phrases in definitions: magnitude, direction, per unit, proportional to, inversely proportional to, at constant temperature, in the absence of",
      "Laws: Coulomb's law, Gauss's law, Ampere's circuital law, Biot-Savart law, Faraday's law, Lenz's law, Snell's law, Ohm's law, Kirchhoff's laws",
      "Optics: critical angle, total internal reflection, virtual image, principal focus, magnification",
      "Modern: photoelectric effect, threshold frequency, stopping potential, de Broglie wavelength, mass defect, half-life, binding energy",
      "Units: SI, N C⁻¹, V m⁻¹, T, Wb, H, F, eV",
    ],
    losses: [
      "The unit of the final answer was not written.",
      "Data not converted to SI: kV used as V, cm used as m.",
      "Wrong formula recalled, for example 1/r where the law needs 1/r².",
      "Ray diagrams without arrows, without the normal, or without the dotted line for a virtual image.",
      "Derivations: the integral sign was wrong, B·dl was not solved, and the labelled diagram was missing.",
      "Concepts confused: resonance and frequency, damped and forced vibrations, specific and heat capacity.",
      "Reasons were described rather than stated. An effect was given with no cause.",
    ],
    analysis: [
      "Classify each lost mark: concept, formula, substitution, unit or SI conversion, diagram, presentation.",
      "Check every numerical for SI conversion and the unit on the final answer.",
      "For each derivation, name the step that was skipped or wrong.",
      "Compare each formula written with the correct one in the Vault and record the difference.",
    ],
  },

  chemistry: {
    key: "chemistry",
    name: "Chemistry",
    paper: [
      "Theory 70 marks, 3 hours plus 15 minutes reading time. 21 compulsory questions in four sections.",
      "Section A: 14 marks, one question with 14 sub-parts of 1 mark (MCQ, fill in the blank, assertion and reason, passage-based).",
      "Section B: 20 marks, ten questions of 2 marks. Section C: 21 marks, seven questions of 3 marks. Section D: 15 marks, three questions of 5 marks.",
      "Internal choice in two questions each in Sections B, C and D. Practical 15, project 10, practical file 5.",
      "Unit weightages from the syllabus: Physical Chemistry (Solutions, Electrochemistry, Chemical Kinetics) 25; Inorganic Chemistry (d- and f-Block Elements, Coordination Compounds) 14; Organic Chemistry (Haloalkanes and Haloarenes, Alcohols Phenols and Ethers, Aldehydes Ketones and Carboxylic Acids, Organic Compounds containing Nitrogen, Biomolecules) 31.",
      "Numerical problems are included from all topics except where experimental details are specifically not required.",
    ],
    rules: [
      "Equations must be balanced, with the reagent or condition on the arrow: heat, catalyst, dry ether, peroxide, alcoholic KOH, 273 K. A wrong product (NO₂ written for NO) earns zero for that equation even when the reactants are right.",
      "Named reactions earn marks for reactants, product and condition. The name alone earns nothing.",
      "Numericals: formula (1), substitution with units (1), answer with unit (1). Substituting E° where E is needed, or the wrong sign in ΔG = −nFE, loses the method mark.",
      "Tests: the reagent AND the observation are both required for each compound. 'Turns milky' alone does not earn the mark.",
      "Mechanisms: curly arrows described in words, the intermediate (carbocation, carbanion, sigma complex) named, and the product justified by a rule (Markovnikov, Zaitsev, Saytzeff).",
      "IUPAC names: locants, prefixes and alphabetical order. Wrong numbering loses the name mark.",
      "Explanations need keywords: inductive effect, resonance stabilisation, steric hindrance, lanthanoid contraction, hydrogen bonding.",
      "Do not add methods that were not asked for. Examiners note unnecessary steps and extra reduction methods.",
      "Class XI topics are not in this paper: Haber, Ostwald, Contact process, chlorine preparation, bleaching powder, Hall–Héroult, chlor-alkali, Markovnikov addition to alkenes, nitration of benzene, free-radical chlorination. Do not reward them and do not demand them.",
      "Derivations included in the syllabus: depression of freezing point, elevation of boiling point, first-order rate equation, half-life from the first-order equation, and the Arrhenius equation in log form.",
      "Experimental details are not required for colligative properties, and the details of Millikan's experiment are not required for F = NAe.",
    ],
    steps: [
      { task: "1-mark MCQ or assertion and reason", scheme: "The correct option. Assertion and reason need both statements and the link." },
      { task: "2-mark reaction or numerical", scheme: "Balanced equation with its condition, or formula plus answer with unit." },
      { task: "3-mark descriptive or mechanism", scheme: "Three creditable points: reagent, observation or product, reason." },
      { task: "5-mark long or multi-step", scheme: "Reagent and product for each step. Each equation and each condition carries its own mark." },
    ],
    keywords: [
      "Equations: balanced, reagent, condition, product, state symbol, catalyst",
      "Observations: precipitate, effervescence, colour change, silver mirror, brick-red precipitate, violet colour",
      "Mechanisms: nucleophile, electrophile, carbocation, carbanion, sigma complex, curly arrow",
      "Rules: Markovnikov, anti-Markovnikov, Zaitsev, Saytzeff, Hofmann, Cannizzaro, Kolbe",
      "Physical: Nernst equation, half-life, order of reaction, molar conductivity, Raoult's law, osmotic pressure, Henderson equation",
    ],
    losses: [
      "Equations were unbalanced or lacked the reagent and the condition.",
      "Wrong product written: NO₂ for NO, or the wrong isomer.",
      "In the Nernst equation, E° was used in place of E.",
      "The final expression was not written, or SOP and POS were confused.",
      "Tests were given with the reagent but no observation, or the other way round.",
      "Symbols confused in logic questions (∼, ∧, ∨, =>), and K-maps drawn where not required.",
    ],
    analysis: [
      "For each equation: balanced, condition present, product correct.",
      "For each numerical: formula, substitution and unit each marked.",
      "For each test: reagent and observation both present.",
      "List named reactions and mechanisms the candidate could not recall.",
      "Note the questions that were likely rushed, given the time taken.",
    ],
  },

  maths: {
    key: "maths",
    name: "Mathematics",
    paper: [
      "Theory 80 marks, 3 hours plus 15 minutes reading time. 20 compulsory questions in four sections.",
      "Section A: 20 marks, Question 1 with 20 sub-parts of 1 mark each (some are MCQs).",
      "Section B: 14 marks, Questions 2 to 8 of 2 marks. Section C: 21 marks, Questions 9 to 15 of 3 marks. Section D: 25 marks, Questions 16 to 20 of 5 marks.",
      "Internal choice in three questions each in Sections B, C and D. Project work 20 marks (two projects of 10).",
      "Unit weightages from the syllabus: Calculus 35; Relations and Functions 10; Algebra 10; Probability 9; Three-Dimensional Geometry 6; Vector Algebra 5; Linear Programming 5.",
      "Mathematical tables and graph paper are provided.",
    ],
    rules: [
      "Method marks and accuracy marks: show every necessary step. A correct final answer with no working earns only the accuracy mark.",
      "Definite integrals: limits substituted at each stage. Indefinite integrals need the constant of integration; leaving it out loses the final mark.",
      "Theorems (Rolle's, Lagrange's mean value, continuity): state each condition and verify it. Proofs need each justification.",
      "Matrices: multiply by rows and columns, not element by element. Inverse by adj A divided by |A|. Show the determinant expansion.",
      "Vectors and 3D: correct vector notation, direction ratios distinguished from direction cosines, the equation in the form the question asks for.",
      "Linear programming: boundary lines drawn correctly, feasible region shaded, every corner point evaluated, the answer stated. Up to three non-trivial constraints.",
      "Probability: events defined, the theorem named (addition, multiplication, conditional, total probability, Bayes), the answer as a simplified fraction or decimal.",
      "Differential equations: the variables separated correctly, the constant included, the particular solution checked against the initial condition. Variable separable, homogeneous and linear forms only. Second order equations are excluded.",
      "Notation is marked: dx omitted, '=' used for 'implies', ambiguous symbols.",
      "Final answers in the required form: exact value, degree of approximation, the equation in the form asked for.",
      "Binomial distribution is project work, not theory. Do not demand it and do not penalise its absence.",
      "Proofs of geometrical theorems by vector algebra are excluded.",
    ],
    steps: [
      { task: "1-mark sub-part", scheme: "The correct final answer." },
      { task: "2-mark", scheme: "Method 1, accuracy 1." },
      { task: "3-mark", scheme: "Method 1, further method 1, answer 1, or as printed on the paper." },
      { task: "5-mark", scheme: "Set-up, each stage, the final answer, and the notation or checks printed on the paper. Confirm the split against the Library scheme." },
    ],
    keywords: [
      "Hence, show that, prove, verify, deduce, justify",
      "Calculus: continuous, differentiable, constant of integration, limits, increasing, decreasing, maxima, minima",
      "Matrices: adjoint, determinant, singular, non-singular, inverse, transpose, Cramer's rule",
      "Vectors and 3D: direction ratios, direction cosines, scalar triple product, distance of a point from a plane",
      "LPP: feasible region, corner points, objective function, bounded, unbounded, optimal",
      "Probability: mutually exclusive, independent, conditional, Bayes' theorem, total probability, mean, variance",
    ],
    losses: [
      "A matrix was squared element by element instead of by multiplication.",
      "The constant of integration or the correct limits were missing.",
      "A wrong formula was used, for example for P(A∪B), or a wrong regression line.",
      "Sign errors and copying errors when transposing or cross-multiplying in the equation of a plane.",
      "LPP: wrong shading, corner points not checked, the answer not stated.",
      "The method specified in the question (for example the step-deviation method) was not used.",
    ],
    analysis: [
      "Loss by unit: calculus, algebra, vectors, 3D, probability, LPP.",
      "Separate method marks lost from accuracy marks lost. Method loss is a concept gap; accuracy loss is a careless habit.",
      "Note whether the candidate checked the final answer by substitution.",
      "Keep notation errors separate from concept errors.",
    ],
  },

  cs: {
    key: "cs",
    name: "Computer Science",
    paper: [
      "Theory 70 marks, 3 hours. Practical 30 marks (three programming problems, attempt any one; 90 minutes planning and 90 minutes examination).",
      "Part I is compulsory and has two questions. Part II is divided into three sections: A, B and C. Each section has three questions, any two to be attempted from each section.",
      "Section A covers Boolean algebra and computer hardware. Section B covers implementation of algorithms and programming in Java. Section C covers inheritance, interfaces, polymorphism, data structures and computational complexity.",
      "The Java version used should be 5.0 or later. BlueJ is strongly recommended.",
      "The syllabus is aimed at algorithmic problem solving and not merely rote learning of Java syntax.",
    ],
    rules: [
      "Programs are marked by component: class declaration, data members, constructor, each method's logic, main method or object creation, and output format. Each is marked independently.",
      "Use exactly the names, types and signatures given in the question. A correct method under the wrong name or signature loses that method's mark.",
      "Logic: loop bounds, counters and accumulators initialised before the loop (sum = 0), correct condition, update inside the loop (n = n / 10), return type and return statement consistent.",
      "Output: print versus println placement, output not inside the loop where the question wants it outside, required messages printed (for example 'Not a pronic number').",
      "Java syntax: == compares references, equals() compares strings; arrays use length, strings use length(); Character methods such as isUpperCase.",
      "Boolean algebra: law names given when asked, truth tables with the correct number of variables, K-map groups marked and the reduced expression written. Karnaugh maps up to four variables.",
      "Propositional logic: well-formed formulae, truth tables, satisfiable, unsatisfiable and valid formulae, equivalence laws, converse, inverse and contrapositive, modus ponens.",
      "Definitions need the keywords and an example where asked. An example alone does not earn the definition mark.",
      "Traces and dry runs: write the trace table when asked. A bare answer earns the answer mark only.",
      "Data structures are defined as abstract data types with a well-defined interface. Infix to prefix and postfix conversion is in the syllabus.",
      "Complexity: best, average and worst case, the dominant term, and Big O notation.",
    ],
    steps: [
      { task: "2-mark definition or output", scheme: "Two key points or the exact output." },
      { task: "3-mark Boolean or short program", scheme: "Expression or table 1, simplification 1, result 1." },
      { task: "5-mark program", scheme: "Declarations 1, input 1, logic 2, output 1, split as printed on the paper." },
    ],
    keywords: [
      "OOP: class, object, constructor, this, super, static, overloading, overriding, polymorphism, encapsulation, abstraction, interface",
      "Java: wrapper, autoboxing, casting, primitive, reference, String, array, length, recursion base case",
      "Boolean: minterm, maxterm, SOP, POS, truth table, K-map, De Morgan's law, absorption",
      "Complexity: time complexity, space complexity, O(n), O(log n), Big-O",
      "Structures: stack, queue, linked list, push, pop, underflow, overflow",
    ],
    losses: [
      "The sum was not initialised to zero, or the square root of the sum was ignored.",
      "A two-dimensional array was declared or accepted incorrectly.",
      "Counters for uppercase and lowercase letters initialised inside the loop.",
      "Class and method names differed from those in the question. Variables declared in several places.",
      "println used inside both loops of a pattern program. break and flag statements omitted.",
      "length() used for an array, or length used for a string.",
      "Polymorphism not followed: separate programs written where the question asked for one class hierarchy.",
    ],
    analysis: [
      "Loss by component: declaration, logic, output, syntax.",
      "Specification compliance: were the names and signatures exactly as asked.",
      "Trace the logic for off-by-one and initialisation errors.",
      "Boolean questions: were the law names and the K-map steps shown.",
    ],
  },
};

/** Provider-agnostic: the same guide works with any vision-capable model from any provider. */
export function guidelineFor(name: string): Guideline | undefined {
  const k = subjectKey(name);
  return k ? GUIDELINES[k] : undefined;
}

/** Plain-text version of a guideline, written into the marking prompt. */
export function guidelineText(name: string): string {
  const g = guidelineFor(name);
  if (!g) return "SUBJECT GUIDELINE: none recorded. Apply the general ISC rules above.";
  return [
    `SUBJECT GUIDELINE: ${g.name}`,
    "Paper pattern:",
    ...g.paper.map((s) => `- ${s}`),
    "Mark-award rules for this subject:",
    ...g.rules.map((s) => `- ${s}`),
    "Step pattern by question type:",
    ...g.steps.map((s) => `- ${s.task}: ${s.scheme}`),
    "Keywords the examiner looks for:",
    ...g.keywords.map((s) => `- ${s}`),
    "Where candidates lose marks (CISCE examiner comments):",
    ...g.losses.map((s) => `- ${s}`),
    "What the report must analyse:",
    ...g.analysis.map((s) => `- ${s}`),
  ].join("\n");
}
