import type { VaultItem } from "./types";

const R = String.raw;

/** Class XII Mathematics formulae and derivations, following the seven syllabus units. */
export const MATHS: VaultItem[] = [
  // ---------------- Formulae ----------------
  {
    id: "mat-invtrig", kind: "formula", subject: "Maths", chapter: "Relations & Functions", title: "Inverse trigonometric identities", importance: 3,
    math: R`\sin^{-1}x+\cos^{-1}x=\frac{\pi}{2},\qquad \tan^{-1}x+\tan^{-1}y=\tan^{-1}\frac{x+y}{1-xy}\ \ (xy<1)`,
    when: "Simplifying inverse trig expressions and proving identities. Check the principal value range before combining.",
    example: { q: "Evaluate tan⁻¹(1/2) + tan⁻¹(1/3).", a: R`$\dfrac{\pi}{4}$, since $\dfrac{\frac12+\frac13}{1-\frac16}=1$` },
  },
  {
    id: "mat-inverse-fn", kind: "formula", subject: "Maths", chapter: "Relations & Functions", title: "Inverse of a one-to-one function", importance: 2,
    math: R`y=f(x)\ \Rightarrow\ x=f^{-1}(y)`,
    when: "Finding the inverse of a one-to-one function: write y = f(x), swap the roles of x and y, and solve for y.",
    example: { q: "f(x) = 2x + 3.", a: R`$f^{-1}(x)=\dfrac{x-3}{2}$` },
  },
  {
    id: "mat-adjoint", kind: "formula", subject: "Maths", chapter: "Algebra: Matrices & Determinants", title: "Inverse of a matrix", importance: 3,
    math: R`A^{-1}=\frac{1}{|A|}\operatorname{adj}A,\qquad \begin{pmatrix}a&b\\c&d\end{pmatrix}^{-1}=\frac{1}{ad-bc}\begin{pmatrix}d&-b\\-c&a\end{pmatrix}`,
    when: "Inverse of a non-singular matrix, or solving AX = B as X = A⁻¹B. Needs |A| ≠ 0.",
    example: { q: "A = [[4, 7], [2, 6]].", a: R`$|A|=10$, $A^{-1}=\frac{1}{10}\begin{pmatrix}6&-7\\-2&4\end{pmatrix}$` },
    note: "Swap the diagonal and negate the off-diagonal. Dividing by the determinant comes last.",
  },
  {
    id: "mat-cramer", kind: "formula", subject: "Maths", chapter: "Algebra: Matrices & Determinants", title: "Cramer's rule", importance: 2,
    math: R`x=\frac{D_x}{D},\qquad y=\frac{D_y}{D},\qquad D\neq0`,
    when: "Solving two or three linear equations with a non-zero determinant D. Replace a column with the constants to get Dₓ.",
    example: { q: "x + y = 3, x − y = 1.", a: R`$D=-2$, $D_x=-4$, $D_y=-2$, so $x=2$, $y=1$` },
  },
  {
    id: "mat-deriv-table", kind: "formula", subject: "Maths", chapter: "Calculus", title: "Standard derivatives", importance: 3,
    math: R`\frac{d}{dx}x^n=nx^{n-1},\quad \frac{d}{dx}\sin x=\cos x,\quad \frac{d}{dx}\cos x=-\sin x,\quad \frac{d}{dx}e^x=e^x,\quad \frac{d}{dx}\ln x=\frac1x`,
    when: "Every differentiation starts from this table. Apply the chain, product or quotient rule on top of it.",
    example: { q: "d/dx of x⁵.", a: R`$5x^4$` },
  },
  {
    id: "mat-rules", kind: "formula", subject: "Maths", chapter: "Calculus", title: "Product, quotient and chain rules", importance: 3,
    math: R`(uv)'=u'v+uv',\qquad \left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v^2},\qquad \frac{dy}{dx}=\frac{dy}{dt}\cdot\frac{dt}{dx}`,
    when: "Differentiating a product, a quotient, or a composite function.",
    example: { q: "d/dx (x³ sin x).", a: R`$3x^2\sin x+x^3\cos x$` },
  },
  {
    id: "mat-std-int", kind: "formula", subject: "Maths", chapter: "Integrals", title: "Standard integrals", importance: 3,
    math: R`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C,\quad \int\frac{dx}{x^2+a^2}=\frac1a\tan^{-1}\frac xa+C,\quad \int\frac{dx}{\sqrt{a^2-x^2}}=\sin^{-1}\frac xa+C`,
    when: "Recognising the integrand, usually the first step of a substitution. Every indefinite integral needs +C.",
    example: { q: "∫₀¹ dx/(x²+1).", a: R`$\dfrac{\pi}{4}$` },
  },
  {
    id: "mat-byparts", kind: "formula", subject: "Maths", chapter: "Integrals", title: "Integration by parts", importance: 3,
    math: R`\int u\,dv=uv-\int v\,du`,
    when: "Integrand is a product of two functions, such as x·eˣ, x·ln x, or x·sin x. Choose u by ILATE: inverse, log, algebraic, trig, exponential.",
    example: { q: "∫ x eˣ dx.", a: R`$(x-1)e^x+C$` },
  },
  {
    id: "mat-area", kind: "formula", subject: "Maths", chapter: "Integrals", title: "Area under a curve", importance: 3,
    math: R`A=\int_a^b y\,dx,\qquad A=\int_c^d x\,dy`,
    when: "Area under a curve or between curves. Sketch first; take limits from the intersection points.",
    example: { q: "Area under y = x² from 0 to 3.", a: R`$9$ square units` },
    note: "Area below the x-axis is negative in the integral. Take the modulus of each part.",
  },
  {
    id: "mat-linear-de", kind: "formula", subject: "Maths", chapter: "Differential Equations", title: "First-order linear differential equation", importance: 3,
    math: R`\frac{dy}{dx}+Py=Q,\qquad IF=e^{\int P\,dx},\qquad y\cdot IF=\int Q\cdot IF\,dx`,
    when: "Equation of the form dy/dx + Py = Q. Write it in standard form first, then find P.",
    example: { q: "dy/dx + 2y = 4.", a: R`$y=2+Ce^{-2x}$` },
  },
  {
    id: "mat-separable", kind: "formula", subject: "Maths", chapter: "Differential Equations", title: "Variables separable", importance: 2,
    math: R`\frac{dy}{dx}=f(x)g(y)\ \Rightarrow\ \int\frac{dy}{g(y)}=\int f(x)\,dx`,
    when: "The variables can be separated. Include the constant of integration and apply the initial condition last.",
    example: { q: "dy/dx = xy.", a: R`$y=Ce^{x^2/2}$` },
  },
  {
    id: "mat-dot-cross", kind: "formula", subject: "Maths", chapter: "Vector Algebra", title: "Dot and cross products", importance: 3,
    math: R`\vec a\cdot\vec b=a_1b_1+a_2b_2+a_3b_3=|\vec a||\vec b|\cos\theta,\qquad |\vec a\times\vec b|=|\vec a||\vec b|\sin\theta`,
    when: "Angle between vectors, projections and perpendicularity (dot). Areas of parallelograms and normals (cross).",
    example: { q: "(1, 2, 3) · (4, 5, 6).", a: R`$32$` },
  },
  {
    id: "mat-triple", kind: "formula", subject: "Maths", chapter: "Vector Algebra", title: "Scalar triple product", importance: 2,
    math: R`[\vec a\,\vec b\,\vec c]=\vec a\cdot(\vec b\times\vec c)`,
    when: "Coplanarity (triple product zero), or the volume of a parallelepiped (|[abc]|) or tetrahedron (one sixth of it).",
    example: { q: "a = i, b = j, c = k.", a: R`$1$, so the volume is 1 unit³` },
  },
  {
    id: "mat-lines", kind: "formula", subject: "Maths", chapter: "Three-Dimensional Geometry", title: "Equation of a line and angle between lines", importance: 3,
    math: R`\frac{x-x_1}{a}=\frac{y-y_1}{b}=\frac{z-z_1}{c},\qquad \cos\theta=\frac{|a_1a_2+b_1b_2+c_1c_2|}{\sqrt{a_1^2+b_1^2+c_1^2}\sqrt{a_2^2+b_2^2+c_2^2}}`,
    when: "Line through a point with direction ratios (a, b, c). Angle between two lines from their direction ratios.",
    example: { q: "Direction ratios (1, 2, 2) and (2, −1, 2).", a: R`$\cos\theta=\dfrac{4}{9}$` },
    note: "Direction ratios are not unit vectors. Divide by the magnitude to get direction cosines.",
  },
  {
    id: "mat-plane-dist", kind: "formula", subject: "Maths", chapter: "Three-Dimensional Geometry", title: "Distance of a point from a plane", importance: 3,
    math: R`d=\frac{|ax_1+by_1+cz_1-d_0|}{\sqrt{a^2+b^2+c^2}}\quad\text{for}\quad ax+by+cz=d_0`,
    when: "Distance from a point to a plane. Put the plane in the form ax + by + cz = d₀ first.",
    example: { q: "Point (1, 2, 3), plane 2x + 3y + 6z = 12.", a: R`$d=\dfrac{|2+6+18-12|}{7}=2$` },
  },
  {
    id: "prob-addition", kind: "formula", subject: "Maths", chapter: "Probability", title: "Addition and conditional probability", importance: 3,
    math: R`P(A\cup B)=P(A)+P(B)-P(A\cap B),\qquad P(A\mid B)=\frac{P(A\cap B)}{P(B)}`,
    when: "Union of events and conditional probability. Independent events satisfy P(A∩B) = P(A)P(B).",
    example: { q: "P(A) = 0.5, P(B) = 0.4, P(A∩B) = 0.2.", a: R`$P(A\cup B)=0.7$` },
  },
  {
    id: "prob-bayes", kind: "formula", subject: "Maths", chapter: "Probability", title: "Bayes' theorem", importance: 3,
    math: R`P(A_i\mid B)=\frac{P(B\mid A_i)\,P(A_i)}{\sum_j P(B\mid A_j)\,P(A_j)}`,
    when: "Reversing a conditional: given the outcome B, what is the chance it came from A_i? List the partition first.",
    example: { q: "P(A) = 0.3, P(B|A) = 0.5, P(B) = 0.25.", a: R`$P(A\mid B)=0.6$` },
  },
  {
    id: "prob-binomial", kind: "formula", subject: "Maths", chapter: "Probability", title: "Binomial distribution", importance: 1,
    math: R`P(X=r)={}^nC_r\,p^r q^{\,n-r},\qquad \mu=np,\qquad \sigma^2=npq`,
    when: "Fixed number of independent trials, each with two outcomes and constant p. Gives mean and variance directly. Project work only: not in the theory syllabus.",
    example: { q: "n = 10, p = 0.2.", a: R`$\mu=2$, $\sigma^2=1.6$` },
  },

  // ---------------- Derivations ----------------
  {
    id: "mat-d-sin", kind: "derivation", subject: "Maths", chapter: "Calculus", title: "Derivative of sin x from first principles", importance: 2,
    math: R`\frac{d}{dx}\sin x=\cos x`,
    steps: [
      R`$f'(x)=\displaystyle\lim_{h\to0}\frac{\sin(x+h)-\sin x}{h}$`,
      R`Use $\sin(x+h)-\sin x=2\cos\!\left(x+\tfrac h2\right)\sin\tfrac h2$.`,
      R`So $f'(x)=\displaystyle\lim_{h\to0}\cos\!\left(x+\tfrac h2\right)\cdot\frac{\sin(h/2)}{h/2}$.`,
      R`As $h\to0$: $\dfrac{\sin(h/2)}{h/2}\to1$ and $\cos(x+h/2)\to\cos x$.`,
      R`Hence $\dfrac{d}{dx}\sin x=\cos x$.`,
    ],
    when: "Asked to differentiate from first principles, or to justify the derivative table.",
    example: { q: "Value of the derivative of sin x at x = 0.", a: R`$1$` },
    note: "State the standard limit $\lim \sin\theta/\theta=1$ before you use it.",
  },
  {
    id: "mat-d-byparts", kind: "derivation", subject: "Maths", chapter: "Integrals", title: "Integration by parts from the product rule", importance: 2,
    math: R`\int u\,dv=uv-\int v\,du`,
    steps: [
      R`Product rule: $\dfrac{d}{dx}(uv)=u\dfrac{dv}{dx}+v\dfrac{du}{dx}$.`,
      R`Integrate both sides with respect to x: $uv=\int u\,dv+\int v\,du$.`,
      R`Rearrange: $\int u\,dv=uv-\int v\,du$.`,
    ],
    when: "The integrand is a product of an algebraic and a transcendental function.",
    example: { q: "∫ x eˣ dx with u = x, dv = eˣ dx.", a: R`$(x-1)e^x+C$` },
  },

  // ---------------- Formulae added from the ISC 2027 syllabus ----------------
  {
    id: "mat-homogeneous", kind: "formula", subject: "Maths", chapter: "Differential Equations", title: "Homogeneous differential equation", importance: 3,
    math: R`\frac{dy}{dx}=F\left(\frac{y}{x}\right),\qquad y=vx,\quad \frac{dy}{dx}=v+x\frac{dv}{dx}`,
    when: "The right-hand side is a function of y/x. Substitute y = vx, separate the variables, and integrate.",
    example: { q: "dy/dx = (x + y)/x.", a: R`$y=x\ln x+Cx$` },
    note: "Second-order differential equations are excluded from the syllabus.",
  },
  {
    id: "mat-total-prob", kind: "formula", subject: "Maths", chapter: "Probability", title: "Theorem of total probability", importance: 3,
    math: R`P(B)=\sum_i P(B\mid A_i)\,P(A_i)`,
    when: "The probability of an event B that can occur through any of several mutually exclusive causes A_i. This is the denominator of Bayes' theorem.",
    example: { q: "P(A₁) = 0.3, P(A₂) = 0.7, P(B|A₁) = 0.5, P(B|A₂) = 0.2.", a: R`$P(B)=0.29$` },
  },
  {
    id: "mat-shortest-dist", kind: "formula", subject: "Maths", chapter: "Three-Dimensional Geometry", title: "Shortest distance between two lines", importance: 3,
    math: R`d=\frac{|(\vec a_2-\vec a_1)\cdot(\vec b_1\times\vec b_2)|}{|\vec b_1\times\vec b_2|}`,
    when: "Skew lines in vector form. The numerator is the scalar triple product of the joining vector with the cross product of the direction vectors.",
    example: { q: "Lines through (0,0,0) and (1,0,0) with directions (1,1,0) and (0,1,1).", a: R`$d=\dfrac{1}{\sqrt2}$` },
  },
  {
    id: "mat-coplanar", kind: "formula", subject: "Maths", chapter: "Three-Dimensional Geometry", title: "Condition for two lines to intersect", importance: 2,
    math: R`(\vec a_2-\vec a_1)\cdot(\vec b_1\times\vec b_2)=0`,
    when: "Two lines intersect (are coplanar) when the scalar triple product is zero. Otherwise they are skew.",
    example: { q: "Lines through (0,0,0) and (1,1,1) with directions (1,0,0) and (0,1,0).", a: "They intersect at (1, 1, 0)." },
  },
  {
    id: "mat-area-between", kind: "formula", subject: "Maths", chapter: "Application of Integrals", title: "Area between two curves", importance: 3,
    math: R`A=\int_a^b\left(y_{\mathrm{top}}-y_{\mathrm{bottom}}\right)dx`,
    when: "Area enclosed between two curves, or between a curve and the coordinate axes. Limits come from the intersection points.",
    example: { q: "Area between y = x² and y = x from 0 to 1.", a: R`$A=\dfrac16$ square units` },
    note: "Sketch first. Area below the x-axis is negative in the integral, so take the modulus of each part.",
  },
  {
    id: "mat-def-properties", kind: "formula", subject: "Maths", chapter: "Integrals", title: "Properties of definite integrals", importance: 3,
    math: R`\int_a^b f(x)\,dx=\int_a^b f(a+b-x)\,dx,\qquad \int_0^a f(x)\,dx=\int_0^a f(a-x)\,dx,\qquad \int_0^{2a} f(x)\,dx=2\int_0^a f(x)\,dx\ \text{if }f(2a-x)=f(x)`,
    when: "Evaluating definite integrals without computing them. The second property is the most used.",
    example: { q: "∫₀^π x sin x dx.", a: R`$\pi$` },
    note: "State which property you are using. It is worth the mark.",
  },
];
