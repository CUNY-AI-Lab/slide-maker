# Composing System Prompts - Slide Deck Content

> CUNY AI Lab Sandbox Workshop
> Source: `index.html`

---

## Slide 1 - Title

**Composing System Prompts**
A Workshop for the CUNY AI Lab Sandbox
March 16, 2026

---

## Slide 2 - Workshop Roadmap

**Three Weeks, Three Skills**

| Date | Session | Description |
|------|---------|-------------|
| March 16 - This Week | Composing System Prompts | Define how the AI thinks, responds, and engages with your students |
| March 23 | Curating Knowledge Collections | Upload syllabi, readings, and relevant sources to ground AI models in course materials |
| March 30 | Customizing Skills & Tools | Build specialized skills, tools, and workflows tailored to your courses |

---

## Slide 3 - What Is a System Prompt?

**The Basics**

A **system prompt** is a set of instructions you write *before* a conversation begins. The user never sees it, but it shapes every response the AI gives.

> Think of it as the **setup instructions** for a specialized tool: what task it handles, how it should operate, what guardrails to follow, and what's out of scope.

**Key distinction:** The *user prompt* is what someone types in the chat. The *system prompt* is what you, the instructor, compose behind the scenes to guide the AI's behavior across the entire conversation.

---

## Slide 4 - Where It Lives (Open WebUI)

In the CUNY AI Lab Sandbox, you'll find the system prompt field in two places:

1. **Chat-Level System Prompt** - Click the settings gear at the top of any new conversation to set a prompt for that session.
2. **Model Configuration** - Go to Workspace → Models to create a custom model with a permanent system prompt baked in.

**Note:** Next time, we'll create custom models that combine your system prompt with a knowledge collection of course materials to ground the AI and situate learning in your teaching context.

---

## Slide 5 - Same Tool, Different Pedagogy

You're building a revision support tool for your composition course. A student opens it and types: **"I'm stuck on my introduction."**

**Without System Prompt** *(appears first)*
"Here's a strong introduction you could use: 'Throughout history, the question of racial identity has been central to American culture. In this essay, I will argue that...'"
*Writes the introduction for them. The student learns nothing.*

**With System Prompt** *(revealed on next advance)*
"Let's work through this. What's the main argument you want your reader to encounter first? Try telling me in one sentence what your paper is really about. Don't worry about making it perfect yet."
*Prompts the student to think. The writing stays theirs.*

---

## Slide 6 - Models in the CUNY AI Lab Sandbox

All open-weight models. No data retained on external servers. Each has different constraints and affordances.

| Model | Description |
|-------|-------------|
| DeepSeek V3.2 | Large mixture-of-experts model; strong at extended reasoning |
| Kimi K2.5 | Multimodal model; processes images and long documents |
| GLM 5 | Chain-of-thought reasoning; works through problems step by step |
| gpt-oss-120b | Large-scale open model; consistent structured outputs |
| Qwen3 235B | Large mixture-of-experts model; strong multilingual support |
| Gemma 3 27B | Compact, low-latency model; fast responses for everyday tasks |
| Llama 3.1 70B | Mid-size general-purpose model; reliable across a range of tasks |

---

## Slide 7 - Section Divider

**Part I: Drafting an Effective System Prompt**

---

## Slide 8 - Composition: The Vague Prompt

**Weak:** `Help students write better.`

**What goes wrong?**
- No role assignment to contextualize the model for specific workflows or domain-knowledge
- No boundaries or pedagogical guidance to constrain the model from doing work for students
- No success criteria for the model to optimize toward

---

## Slide 9 - Composition: Getting Warmer

**Getting There:** `You are a writing scaffold for a college composition course. Help students develop their essays by breaking revision into structured steps. Ask them to identify their thesis before giving feedback. Don't write essays for them.`

**What improved?**
- Assigns a role and disciplinary context
- Includes a basic pedagogical move
- Sets one boundary

**What's still missing?**
- No procedural instructions for *how* to give feedback
- No awareness of student population or course level
- No edge-case handling

---

## Slide 10 - Composition: A Prompt That Fosters Revision

```
You are a writing scaffold for an English 101 composition course at a public urban university. Students are drafting a position paper on rhetoric in popular media and must revise their first draft in preparation for their final submission.

The core problem: students treat revision as proofreading, fixing grammar and word choice, rather than rethinking argument, structure, and evidence. They lack a process for examining whether their ideas are clear, well-organized, and sufficiently supported. This tool scaffolds the move from surface-level fixes to substantive revision.

Procedure:
1. Request the assignment prompt and student draft before responding.
2. Identify the highest-priority concerns (thesis clarity, structure, evidence) before surface-level issues.
3. For each concern, ask the student a question rather than providing a fix.

Constraints:
- Never generate text that could substitute for the student's own writing. Focus on higher-order concerns like argument, structure, and evidence.
- If asked to "just fix it," redirect toward a specific revision step.
- Do not grade or evaluate.
- Tone: Warm and direct. Use "I notice..." and "What if you tried..."
```

---

## Slide 11 - Section Divider

**Example 2: Primary Source Analysis**

---

## Slide 12 - History: The Vague Prompt

**Weak:** `Analyze historical documents.`

**What goes wrong?**
- No methodological framework
- No period or geographic focus
- No guidance on handling hallucinated facts or invented sources

---

## Slide 13 - History: Getting Warmer

**Getting There:** `You are a history source-analysis tool. Help students analyze primary sources from American history. Ask them to consider the author, audience, and context of each document. Don't just summarize the document for them.`

**What improved?**
- Assigns a role and disciplinary scope
- References a real methodology
- Sets a boundary against summarization

**What's still missing?**
- No procedural steps for guiding analysis
- No handling of uncertainty or AI limitations
- No attention to historiographical perspective

---

## Slide 14 - History: A Prompt That Fosters Historical Thinking

```
You are a source-analysis tool for an undergraduate U.S. history survey covering the period from Reconstruction through the Civil Rights Movement. Students must analyze primary source documents from the period and use them as the basis for a historical report.

The core problem: students extract facts from sources rather than analyzing them as constructed arguments shaped by author, audience, and context.

Procedure:
1. Ask the student to identify the source (title, date, creator, document type) before proceeding.
2. Introduce the SOAPS framework and guide them through one question at a time. Never jump ahead.
3. After each answer, ask why that detail matters and prompt them to ground their response in specific passages.
4. After all five questions, ask the student to synthesize: what does the full picture reveal about this historical moment?

SOAPS Framework Questions:
- Speaker: Who created this and what do we know about them?
- Occasion: What events prompted it?
- Audience: Who was it for and how does that shape the content?
- Purpose: What was the author trying to achieve?
- Significance: What does it reveal about its moment?

Constraints:
- Never offer guidance before the student has attempted an answer.
- Encourage grounding interpretations in specific passages as analysis develops.
- If unsure about a historical fact, say so. Never invent dates, names, or events.
- Never provide a complete analysis. Ask the next question a historian would ask.
- Tone: Patient and curious.
```

---

## Slide 15 - Section Divider

**Example 3: Close Reading & Literary Analysis**

---

## Slide 16 - Literature: The Vague Prompt

**Weak:** `Help with literary analysis.`

**What goes wrong?**
- Defaults to plot summary
- No theoretical or critical framework
- No requirement for textual evidence

---

## Slide 17 - Literature: Getting Warmer

**Getting There:** `You are a close-reading scaffold. Help students analyze literary texts by focusing on themes, symbolism, and narrative techniques. Don't just summarize the plot. Ask students to point to specific passages.`

**What improved?**
- Names specific analytical categories
- Addresses the plot-summary problem
- Requires textual evidence

**What's still missing?**
- No procedural steps for scaffolding analysis
- No critical or theoretical framework
- No attention to cultural context

---

## Slide 18 - Literature: A Prompt That Fosters Close Reading

```
You are a close-reading tool designed for an introductory English course that focuses on cultural studies and literary analysis. Students recently practiced close reading and must now select a brief literary artifact to analyze using techniques associated with New Criticism.

The core problem: students default to summarizing content or importing biographical and historical context rather than attending closely to how the text works: how language, form, imagery, and internal tension generate meaning within the artifact itself.

Procedure:
1. Ask what the student notices about the language in their chosen passage.
2. Prompt them to examine specific textual features (word choice, imagery, syntax, point of view) and how they create meaning.
3. Ask how the passage connects to the work's larger themes and cultural moment.
4. Guide them toward an interpretive claim grounded in textual evidence.

Framework:
- Treat the text as a self-contained object. Bracket authorial intent and historical context; attend to what the language itself does.
- Look for tension, irony, paradox, and ambiguity as sites of meaning, not problems to resolve. Ask how formal elements (diction, imagery, syntax, tone) work together as a meaningful cultural artifact.
- Once a close reading is underway, invite students to reflect on the method itself: what does focusing on the text alone illuminate, and what does it leave out?

Constraints:
- Facilitate multiple interpretations grounded in textual evidence. Do not prescribe a correct reading.
- If a student reaches for biographical or historical context, redirect them back to the text: "What in the language itself supports that reading?"
- Tone: Encouraging and accessible. Affirm observations, then push deeper.
```

---

## Slide 19 - Section Divider

**Part II: The Building Blocks**

---

## Slide 20 - Core Components of a System Prompt

Each system prompt is built from modular components. We'll draft yours one piece at a time.

1. **Context & Problem** - What course, what students, what learning challenge?
2. **Procedure** - What steps should the tool follow?
3. **Constraints** - What should it refuse to do, and how should it redirect?
4. **Tone** - What register and affect should it use with your students?
5. **Output Format** - How should it structure its responses?

---

## Slide 21 - Component 1: Context & Problem

Name the tool, the course, the students, and the specific learning challenge. Everything else follows from this.

- What kind of tool is this?
- Who are your students?
- What learning challenge does it address?

**Template:**
```
You are a [tool type] for [course name].
Students are [relevant context].

The core problem: [specific learning challenge].
```

**Your turn:** Open the Sandbox. Write 2-3 sentences naming what the tool does, who the students are, and what learning challenge it addresses.

---

## Slide 22 - Component 2: Procedure

Tell the tool what to do, step by step. Numbered steps give the model a clear sequence rather than a loose set of suggestions.

- What should the tool request before responding?
- What should it prioritize?
- How should it respond to each student input?

**Template:**
```
Procedure:
1. Ask the student for [specific input] before responding.
2. Identify [priority concern] before addressing [secondary concerns].
3. For each issue, [specific action, e.g. ask a question rather than fix it].
```

**Your turn:** Write 2-4 numbered steps. Think about the sequence that matters for your discipline.

---

## Slide 23 - Component 3: Constraints

Define what the tool should not do and how it redirects when students push against those limits.

- What will students ask it to do *for* them?
- How should it redirect instead?
- What uncertainty should it name explicitly?

**Template:**
```
Constraints:
- Never [specific output to avoid].
- If asked to [common student request], redirect by [specific alternative].
- If uncertain about [domain content], say so explicitly.
```

**Your turn:** Write 2-3 constraints that keep the tool from doing work students should do themselves.

---

## Slide 24 - Component 4: Tone

One sentence on tone shapes how the tool communicates with every student it encounters.

- What register fits your students?
- Should it feel warm, direct, encouraging?
- Are there phrases that model the right affect?

**Template:**
```
Tone: [Adjective and adjective]. Use phrases like "[example phrase]" and "[example phrase]."
```

**Your turn:** Add one sentence describing the tone. What language makes your students feel supported rather than evaluated?

---

## Slide 25 - Component 5: Output Format

Optional, but useful when consistent structure helps students know what to expect from each response.

- Should each response end with a question?
- Should it follow a fixed structure?
- What length is appropriate?

**Template:**
```
Format each response as:
Observation: [what you notice]
Focus: [one thing to work on]
Next step: [a specific, actionable suggestion]
Question: [something for the student to consider]
```

**Your turn:** If it fits your tool, add a short format spec. Not every prompt needs one.

---

## Slide 26 - Section Divider

**Part III: Advanced Strategies & Tips**

---

## Slide 27 - Advanced Prompting Strategies

- **Conditional Behavior** - "If the student submits a draft, give feedback. If they ask a conceptual question, respond with a guiding question. If they seem frustrated, acknowledge it before continuing."
- **Procedural Instructions** - "Step 1: Request the assignment prompt and draft. Step 2: Identify one focus area. Step 3: Ask the student a question about that area before offering guidance."
- **Epistemic Guardrails** - "If you are not certain about a factual claim, explicitly state your uncertainty. Never fabricate citations or attribute quotes."
- **Multilingual Support** - "If a student writes in a language other than English, respond in that language. Offer to discuss concepts in both languages to support comprehension."

---

## Slide 28 - Common Pitfalls

- **Too Long & Too Detailed** - A 2,000-word system prompt can confuse the model. Prioritize the most important instructions.
- **Contradictory Instructions** - "Always give detailed feedback" + "Keep responses under 50 words" = confused AI.
- **Forgetting the Student's Perspective** - Test by asking the kinds of questions your students actually ask.
- **Set It and Forget It** - System prompts need iteration. Use them, notice what breaks, revise.

---

## Slide 29 - The Road Ahead

| Date | Session | Description |
|------|---------|-------------|
| March 16 - Today | System Prompts ✓ | Defining how the AI thinks and teaches |
| March 23 - Next Week | Knowledge Collections | Upload your syllabus, readings, and relevant sources to ground AI models in course materials |
| March 30 | Skills & Tools | Build custom skills, tools, and workflows tailored to your courses |

---

## Slide 30 - Closing

**Let's Build One Together**
Open the CUNY AI Lab Sandbox and compose a system prompt for your course

1. Pick one assignment from your course
2. Write a system prompt using the five building blocks
3. Test it with a real student question
4. Iterate and refine

ailab.gc.cuny.edu
