# Resumo

## Inspiration

The modern job hunt is a full-time job. We noticed that the biggest bottleneck isn't finding roles—it's the soul-crushing task of manually tailoring your resume for every single application to beat the ATS (Applicant Tracking System). We built **Resumo** to give job seekers that time back, turning a manual hours-long process into a few seconds of AI magic.

## What it does

Resumo is an end-to-end career copilot. 
- **Smart Parsing:** Upload your "master" resume once. Our engine uses Gemini's native PDF capabilities to parse it into a structured, searchable profile.
- **Job Tracking:** Manage your entire pipeline with a Kanban-style dashboard. Drag jobs from "Saved" to "Applied" to "Interviewing."
- **AI Tailoring:** With one click, generate a hyper-optimized resume tailored to a specific job description. It enforces a "one-page rule," selecting the most relevant experience and rewriting bullets for maximum impact.
- **ATS Score:** Get instant feedback. Our analyzer scores your tailored resume against the JD, highlighting matched keywords, missing skills, and actionable gaps.
- **Live Diff Viewer:** See exactly what the AI changed. Review edits side-by-side with your base resume before finalizing.
- **Professional PDFs:** Export download-ready, ATS-friendly PDFs directly in your browser.

## How we built it

- **Frontend:** React 19 with Vite and Tailwind CSS 4.0 for a high-performance, modern UI.
- **Backend:** Supabase handles Authentication and the PostgreSQL database.
- **AI Engine:** Google Gemini (via `@google/genai`) powers our resume parsing, tailoring, and ATS scoring.
- **State Management:** Zustand for lightweight, reactive editor state.
- **PDF Generation:** `@react-pdf/renderer` for client-side document creation.
- **Drag & Drop:** `@dnd-kit/core` for the interactive job board.

## Challenges we ran into

PDFs are where data goes to die. We initially struggled with manual text extraction from complex resume layouts. After experimenting with traditional parsers, we moved to **Gemini's native PDF processing**, which significantly improved accuracy for non-standard layouts. Fine-tuning the "one-page" constraint was another hurdle—ensuring the AI prioritizes the *right* experience while keeping the output concise required extensive prompt engineering and strict JSON schema enforcement.

## Accomplishments that we're proud of

We’re really stoked about the **Live Diff Viewer**. We didn't want the AI to be a "black box," so we built a feature that highlights exactly what the AI changed compared to your base resume. Combined with our **ATS Match Score**, it gives users total confidence that their resume is truly optimized before they hit "Download."

## What we learned

The secret to reliable AI applications is **structured output**. Moving from simple text prompts to enforcing strict JSON schemas (using Zod for validation) turned a "neat demo" into a predictable, robust tool. We also learned that providing users with "human-in-the-loop" editing capabilities is essential—AI handles the heavy lifting, but the user always has the final say.

## What's next for Resumo

- **One-click Cover Letters:** Automatically generate matching cover letters for every tailored resume.
- **Browser Extension:** Save job postings directly from LinkedIn, Indeed, and Greenhouse with one click.
- **Interview Prep:** AI-generated mock interview questions based on your tailored resume and the job description.
- **Template Library:** More professional PDF designs to choose from.
