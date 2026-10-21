# AI Disclosure · Waypoint Lodestar

**Team:** Adagard

**Phase:** Hackathon 2026

**Last reviewed:** 4 October 2026

This document distinguishes between:

1. AI-enabled behaviour inside the Waypoint Lodestar product.
2. AI tools used by the team while designing, implementing, testing, documenting and presenting the project.

All AI-assisted work was reviewed by team members before inclusion in the submitted project. The team remains responsible for understanding, testing and approving the submitted implementation.

## 1. AI inside the product

### 1.1 Planning agent

Lodestar includes a planning-agent workflow built around a LangGraph graph, deterministic planning logic and deterministic rule checking.

The deterministic planner produces the operational plan, including:

- Vehicle assignments.
- Trip assignments.
- Stop order.
- Served and deferred orders.
- Deferral reason codes.
- Constraint and capacity results.

A language model is not the authority for these decisions. The agent uses tool results and deterministic application logic for operational facts. The dispatcher remains responsible for reviewing and approving the plan before it can be published or committed.

The repository includes a configurable agent model setting. The default and deployed configuration is `mock`, a deterministic stand-in that emits tool calls and template-based explanations from tool results. The `azure-openai` option is wired into the codebase but is not configured in the submitted deployment. Therefore, the deployed planning-agent workflow does not depend on an external language-model call for the final allocation.

Relevant area:

```text
backend/apps/agent
```

Relevant concepts include:

- Agent domain planner and rules.
- LLM integration layer.
- Graph orchestration.
- `AGENT_MODEL` configuration.

### 1.2 Human approval

The agent cannot publish a plan independently.

A dispatcher must approve, edit or reject each draft. Approval is an audited write associated with the approving user and the relevant plan or agent run.

This is an intentional safety boundary. AI-assisted reasoning and explanations cannot bypass:

- Deterministic planning.
- Rule validation.
- Dispatcher review.
- Human approval.
- Audit logging.

Relevant areas include:

```text
backend/apps/planning/src/planning.sets.ts
backend/apps/planning/src/plan-execution.ts
```

### 1.3 Read-aloud support

The driver and loader mobile experience can use the phone's native text-to-speech functionality through `expo-speech`.

No language model is shipped with the mobile application for this feature, and the spoken content is not sent to an external AI service by the read-aloud functionality.

Relevant area:

```text
mobile/src/lodestar/runtime.tsx
```

### 1.4 Computer-vision autofill

Computer-vision autofill for scanning temperature, seal or damage information is not implemented in the submitted product.

The Designathon boards include this as a concept, but the implemented workflow requires the user to enter or confirm the relevant values.

A legacy prototype route simulates a fixed value. It should not be interpreted as a production computer-vision model or an external AI integration.

Relevant area:

```text
mobile/src/app/stop/[id]/pod/index.tsx
```

### 1.5 Sinhala and Tamil voice packs

Downloadable Sinhala and Tamil voice packs are not implemented in the submitted product. They were design concepts only and are not claimed as working product functionality.

## 2. AI tools used to create the project

The team used AI-assisted tools during the Designathon and Hackathon for research, architecture, coding, documentation, testing support, debugging, content preparation and video-production assistance.

The tools were used as assistants. They did not replace human responsibility for design decisions, code review, testing, approval or submission.

### 2.1 Tools used

| Tool | Main use |
|---|---|
| Claude Code | Architecture analysis, code generation, code modification, debugging assistance, documentation, repository analysis, test-support suggestions and implementation guidance. |
| Antigravity | Coding assistance, implementation support, debugging, development workflow support and project refinement. |
| Perplexity | Challenge-booklet analysis, repository research, architecture research, technical investigation, documentation assistance and clarification of implementation decisions. |
| Gemini-based tools | Coding assistance, implementation suggestions, debugging support, documentation assistance and technical problem solving. |
| Figma | Manual design editing, visual refinement and prototype-flow wiring. |
| html.to.design Figma plugin | Conversion of HTML-based design boards into editable Figma layers. |
| Video-generation and editing tools | Preparation of the Hackathon demonstration video and supporting presentation material. |

AI-generated suggestions were not treated as automatically correct. Team members reviewed, tested, edited and approved the resulting work before it was included in the project.

### 2.2 Team responsibilities

The team responsibilities were:

| Team member | Responsibility |
|---|---|
| Nivakaran | Primary coding and implementation work, with assistance from the listed AI tools. |
| Duwaragiee | Testing, validation, review and video generation. |
| Zayan | Testing, validation, review and video generation. |

Duwaragiee and Zayan tested the implementation and reviewed the relevant workflows. Nivakaran performed the primary coding and implementation work. The team collaboratively reviewed the final behaviour and submission materials.

### 2.3 Human review and approval

All AI-assisted coding and project work was reviewed by team members.

The team:

- Reviewed AI-generated or AI-suggested code.
- Modified code where necessary.
- Tested the implemented features.
- Checked the application against the Hackathon requirements.
- Tested the main user workflows.
- Reviewed the planning and allocation behaviour.
- Verified the responsive experience.
- Reviewed the generated documentation.
- Reviewed the demo-video content.
- Approved the final submitted work as a team.

No AI-generated output was included in the submission solely because it was generated by an AI tool. AI assistance was followed by human review, testing and approval.

The team accepts responsibility for the final implementation, including AI-assisted code.

## 3. Designathon AI usage

The Designathon disclosure associated with board 11 records the following tools and uses:

| Tool | Use |
|---|---|
| Claude Code | Analysing the challenge booklet with the team, generating HTML/CSS for design boards and screen layouts from team specifications, drafting rationale copy for team editing, checking consistency across pages and summarising desk research. |
| html.to.design Figma plugin | Converting HTML boards into editable Figma layers. This was a conversion workflow, not autonomous product design. |
| Figma | Manual polishing and wiring of prototype flows. |

The Designathon materials were reviewed and edited by the team. AI-assisted content was not submitted without human review.

## 4. Hackathon AI usage

During the Hackathon, Claude Code, Antigravity, Perplexity and Gemini-based tools were used to support:

- Repository analysis.
- System architecture.
- Agentic-AI architecture research.
- Backend implementation.
- Frontend implementation.
- Mobile-flow implementation.
- API and service development.
- Debugging.
- Test planning.
- Documentation.
- README preparation.
- AI-disclosure preparation.
- Demo-video preparation.

The tools were used to accelerate implementation and assist with technical reasoning. They did not independently control the deployed system.

The team retained human control over:

- Product scope.
- Architecture selection.
- Data handling.
- Planning rules.
- User roles.
- Constraint behaviour.
- Approval workflows.
- Testing decisions.
- Final code acceptance.
- Deployment.
- Submission.

## 5. AI and planning safety boundaries

The following boundaries apply to the submitted product:

1. Deterministic code, not a language model, performs constraint-heavy allocation and rule validation.
2. The planning agent cannot commit or publish a plan without dispatcher approval.
3. AI-generated explanations must be grounded in verified tool results.
4. Vehicle assignment and trip assignment are controlled by application planning logic.
5. Capacity calculations are performed by deterministic application logic.
6. Temperature, access, depot, time and fuel restrictions are validated by application rules.
7. User-provided values remain reviewable and editable by authorised users.
8. The product does not claim computer vision, downloadable voice packs or external model inference where those features are not implemented.
9. External AI providers must not receive secrets or unnecessary operational data.
10. AI-assisted code must be reviewed and understood by the team.
11. The team must be able to explain the submitted implementation to the judges.

## 6. Data handling and AI tools

The competition datasets are not committed to this repository.

The repository ignores the competition data folder and CSV files. The seed process can use CSV files from a mounted runtime folder. A clean clone can use generated synthetic data as described in:

```text
backend/prisma/DATA.md
```

The competition rules require supplied data and derivatives to remain confidential and prohibit sharing them with third parties unless authorised by the organisers.

Accordingly:

- Competition CSV files must not be committed to Git.
- Competition datasets must not be uploaded to public repositories.
- Competition datasets must not be posted in public issues or forums.
- Production secrets must not be included in prompts, logs or source files.
- API keys must not be committed to the repository.
- Credentials must not be included in source code.
- AI tools should receive only the minimum information required for the task.

The team confirms that the project was prepared with the competition’s data-confidentiality requirements in mind.

If any competition data was supplied to an external AI tool, the team must ensure that the use was permitted under the competition rules and must disclose it accurately to the organisers if required.

## 7. Demo video and presentation tools

Duwaragiee and Zayan were responsible for testing support and video generation.

The team used video-generation or video-editing tools to prepare the Hackathon demonstration material. The final video was reviewed by the team before submission.

The team confirms that:

- The video demonstrates the submitted application workflow.
- The video was reviewed before submission.
- The team is responsible for the claims made in the video.
- Any AI-assisted script, caption or editing output was reviewed by team members.
- The video does not claim product functionality that is not implemented.

If the organisers require exact tool names for recording, editing, narration, captions or generation, the team should add those tool names here before final submission.

## 8. Known design-to-implementation departures

The following items are design concepts rather than implemented AI capabilities:

- Computer-vision autofill for temperature, seal and damage fields.
- Downloadable Sinhala and Tamil voice packs.
- Any design-board feature that is not represented by a working route, component or service in the repository.

Significant additional departures from the Designathon submission should be documented in the project README together with the reason for each change.

## 9. Limitations

The AI-assisted development process and the product have the following limitations:

- The deployed default agent model is a deterministic mock rather than a production external language model.
- Computer-vision autofill is not implemented.
- Downloadable multilingual voice packs are not implemented.
- AI-generated content may require human correction.
- The product uses deterministic application logic for operational planning rather than delegating hard constraints to an LLM.
- Some design concepts may be represented by manual inputs or simulations rather than production AI models.

These limitations are disclosed to avoid overstating the system’s AI capabilities.

## 10. Final team sign-off

Before final submission, the team reviewed and approved the following:

- [x] AI tools used during the Designathon were disclosed.
- [x] AI tools used during the Hackathon were disclosed.
- [x] Claude Code usage was disclosed.
- [x] Antigravity usage was disclosed.
- [x] Perplexity usage was disclosed.
- [x] Gemini-based tool usage was disclosed.
- [x] Nivakaran’s primary coding responsibility was disclosed.
- [x] Duwaragiee’s testing and video-generation responsibility was disclosed.
- [x] Zayan’s testing and video-generation responsibility was disclosed.
- [x] AI-assisted code was reviewed by team members.
- [x] Application behaviour was tested by team members.
- [x] Final work was approved by humans.
- [x] Deterministic planning and validation boundaries were disclosed.
- [x] Unimplemented AI features were clearly identified.
- [x] Data-confidentiality requirements were considered.
- [x] Demo-video preparation was reviewed by the team.

## 11. Accountability

This disclosure is part of the Hackathon submission.

The Adagard team is responsible for ensuring that this document accurately represents:

- The AI tools used.
- The people who used them.
- The product’s actual AI functionality.
- The data-handling process.
- The human review process.
- The submitted repository.
- The deployed application.
- The demonstration video.

AI tools assisted the team, but the team owns, reviewed, tested and approved the final submitted work.
---

## Correction (21 October 2026)

Two statements above did not match the code at the submission deadline (last pre-deadline commit `36d042e`, 4 October 2026, 23:54 Colombo). We record the correction here instead of rewriting the reviewed text.

- **Agent model (section 1, "configurable agent model setting").** From commit `5541b5f` (4 October, 21:35) the planning agent's language-model chain is Gemini first, Groq as the fallback, and the deterministic template last. `docker-compose.yml` defaults `AGENT_MODEL` to `gemini` (commit `6379696`). Without API keys the agent drafts with the template, so what the demo deployment ran depends on that server's environment, which the repository does not record. What the text says about authority still holds: the model never decides the allocation. Every draft is checked by the deterministic rules and validator, and only the dispatcher can approve and publish it.
- **Computer-vision autofill (section 1.4).** From commit `10fcd7e` (3 October) the Dock app can read the reefer's display from a photo. This runs on our own OCR service (`backend/apps/ocr`: RapidOCR, PaddleOCR PP-OCRv4 mobile models on ONNX Runtime, CPU only), not an external AI API. The value read is shown for the loader to confirm or correct, and nothing is saved until they confirm. Seal and damage scanning remain unimplemented.
