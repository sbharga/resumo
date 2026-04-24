# **Product Requirements & Development Plan: AI Resume Optimizer**

## **1\. Project Overview**

A web application that allows users to upload their base resume, track job opportunities, and generate hyper-optimized, ATS-friendly resumes tailored to specific job descriptions using LLMs via OpenRouter.

## **2\. Tech Stack & Dependencies**

* **Framework:** React 18 (via Vite for fast compilation)  
* **Routing:** react-router(v7)  
* **Backend & Auth:** @supabase/supabase-js (PostgreSQL, Auth, Row Level Security)  
* **Styling:** Tailwind CSS \+ clsx \+ tailwind-merge  
* **UI Components:** shadcn/ui (Radix UI primitives) \+ lucide-react (icons)  
* **Forms & Validation:** react-hook-form \+ zod  
* **State Management:** @tanstack/react-query (server state) \+ zustand (client/editor state)  
* **PDF Parsing:** pdfjs-dist (extracting text from uploaded PDFs)  
* **PDF Generation:** @react-pdf/renderer (declarative, component-based PDF generation)  
* **AI Integration:** openai SDK (configured to point to OpenRouter base URL https://openrouter.ai/api/v1)  
* **Diff Visualization:** diff (NPM package) or react-diff-viewer-continued (for highlighting changes between base and tailored resumes)

## **3\. Database Schema (Supabase PostgreSQL)**

An autonomous agent should execute these via Supabase SQL editor or migrations.

* profiles: Extensions of the auth.users table.  
  * id (uuid, PK, references auth.users)  
  * email (text)  
  * created\_at (timestamp)  
* base\_resumes: Stores the master structured data parsed from the initial onboarding.  
  * id (uuid, PK)  
  * user\_id (uuid, FK to profiles)  
  * structured\_content (jsonb) \- *See JSON schema section*  
  * updated\_at (timestamp)  
* job\_tracker: The dashboard entities.  
  * id (uuid, PK)  
  * user\_id (uuid, FK)  
  * company\_name (text)  
  * job\_title (text)  
  * job\_description (text)  
  * status (enum: 'Saved', 'Resume Generated', 'Applied', 'Interviewing', 'Rejected', 'Offer')  
  * created\_at (timestamp)  
* tailored\_resumes:  
  * id (uuid, PK)  
  * job\_id (uuid, FK to job\_tracker)  
  * user\_id (uuid, FK)  
  * content (jsonb) \- *Optimized version of structured\_content*  
  * created\_at (timestamp)

## **4\. Phased Execution Plan**

### **Phase 0: Project Initialization & Tooling**

* **Goal:** Set up the skeleton, styling engine, and database connection.  
* **Tasks:**  
  * Initialize Vite React project (npm create vite@latest . \-- \--template react-ts).  
  * Install Tailwind CSS and configure tailwind.config.js.  
  * Initialize shadcn/ui and install base components (button, input, card, dialog, textarea, label, table, tabs).  
  * Set up Supabase client (src/lib/supabase.ts) using environment variables (VITE\_SUPABASE\_URL, VITE\_SUPABASE\_ANON\_KEY).  
  * Set up React Router with a basic layout (\<AuthLayout /\> and \<DashboardLayout /\>).  
* **Definition of Done:** App compiles, Tailwind classes work, and Supabase client initializes without errors.

### **Phase 1: Authentication & Protected Routing**

* **Goal:** Secure the app.  
* **Tasks:**  
  * Implement Supabase Google OAuth (signInWithOAuth({ provider: 'google' })).  
  * Implement basic Email/Password login/register with react-hook-form \+ zod.  
  * Create an AuthContext or Zustand store to manage session state globally.  
  * Implement \<ProtectedRoute /\> wrapper for dashboard routes.  
* **Definition of Done:** User can log in with Google or Email, gets redirected to /dashboard, and cannot access /dashboard if logged out.

### **Phase 2: Onboarding & Base Resume Parsing (The "Profile" Engine)**

* **Goal:** Convert a dumb PDF into smart JSON.  
* **Tasks:**  
  * Create an onboarding route (/onboarding).  
  * Build a drag-and-drop file uploader accepting .pdf.  
  * Implement pdfjs-dist to extract raw text strings from the PDF securely on the client side.  
  * Send the raw text to a serverless function (or handle via client-side fetch securely if proxying) calling OpenRouter.  
  * **Prompt Engineering:** Instruct OpenRouter (use anthropic/claude-3.5-sonnet for best JSON output) to convert the unstructured text into a strict ResumeJSON schema (defined below).  
  * Save the resulting JSON to the base\_resumes table.  
* **Definition of Done:** User uploads a PDF, waits for a loading state, and their structured profile is saved to the database.

### **Phase 3: Dashboard & Job Tracker**

* **Goal:** A Kanban or Table view of job opportunities.  
* **Tasks:**  
  * Build CRUD operations for the job\_tracker table using React Query.  
  * Create a clean Table UI (using Shadcn UI) to list jobs (Company, Title, Status, Date).  
  * Implement a "Add New Job" Modal.  
* **Definition of Done:** User can add, view, update status, and delete job entries.

### **Phase 4: The Core Engine (AI Tailoring)**

* **Goal:** Combine Base Resume \+ Job Description \= Tailored Resume.  
* **Tasks:**  
  * On the Job Detail view, provide a text area to paste the "Job Description".  
  * Trigger "Generate Tailored Resume" action.  
  * Fetch user's base\_resumes JSON.  
  * **Prompt Engineering:** Send both base\_resumes (JSON) and job\_description (text) to OpenRouter. Prompt the AI to:  
    * Keep factual data (dates, degrees) intact.  
    * Rewrite bullet points to highlight skills mentioned in the job description.  
    * Add targeted keywords.  
    * Output exactly to the ResumeJSON schema.  
  * Save output to tailored\_resumes table.  
* **Definition of Done:** AI successfully returns a modified version of the resume tailored to the specific job description and saves it to the DB.

### **Phase 5: The Resume Editor, Diff Viewer & PDF Generation**

* **Goal:** Prevent AI hallucinations from reaching the final PDF while highlighting optimizations.  
* **Gap Filled:** Users *must* review AI output. A visual diff makes it incredibly easy to spot exactly what metrics the AI might have invented or what keywords were added compared to the original profile.  
* **Tasks:**  
  * Build a JSON-to-UI Editor layout.  
  * **Diff View Integration:** Add a "Review Changes" toggle or tab. Compute the differences between the original base\_resumes.structured\_content and the new tailored\_resumes.content. Use the diff library to show inline highlights (e.g., green text for additions, red strikethrough for deletions) specifically on the summary and achievements bullet points.  
  * **Left Column (Editor):** Forms bound to the tailored\_resumes JSON object (edit contact info, rearrange/edit experience bullet points, skills arrays). The user can accept/reject or manually edit the AI's suggestions here.  
  * **Right Column (Preview):** Implement @react-pdf/renderer inside a PDFViewer component. This updates live as the left column is edited.  
  * Add a "Download PDF" button that triggers the @react-pdf/renderer download blob.  
* **Definition of Done:** User can toggle a visual diff of the AI's changes, manually edit the finalized text, see a live visual PDF preview, and download a perfectly formatted PDF.

### **Phase 6: Polish & Security**

* **Tasks:**  
  * Add Supabase Row Level Security (RLS) policies so users can only read/write their own user\_id rows.  
  * Add skeleton loaders and toast notifications (sonner or Shadcn use-toast) for API calls.  
  * Implement error boundaries and retry logic for OpenRouter (LLM APIs fail sometimes).

## **5\. Critical AI Schemas**

### **A. The ResumeJSON Schema (Crucial for OpenRouter Structured Output)**

To ensure the LLM returns parsable data, enforce this structure in the system prompt.

type ResumeJSON \= {  
  personalInfo: {  
    fullName: string;  
    email: string;  
    phone: string;  
    location: string;  
    linkedinUrl?: string;  
    portfolioUrl?: string;  
  };  
  summary: string;  
  experience: Array\<{  
    company: string;  
    role: string;  
    startDate: string; // MM/YYYY  
    endDate: string; // MM/YYYY or "Present"  
    location: string;  
    achievements: string\[\]; // Keep to 3-5 bullet points  
  }\>;  
  education: Array\<{  
    institution: string;  
    degree: string;  
    graduationDate: string;  
  }\>;  
  skills: {  
    technical: string\[\];  
    soft: string\[\];  
    tools: string\[\];  
  };  
}

### **B. OpenRouter API Fetch Utility Example**

How the LLM agent should implement the OpenRouter call to ensure JSON formatting:

// Note for autonomous agent: Use this configuration for OpenRouter calls  
const fetchAIResume \= async (prompt, systemInstruction) \=\> {  
  const response \= await fetch("\[https://openrouter.ai/api/v1/chat/completions\](https://openrouter.ai/api/v1/chat/completions)", {  
    method: "POST",  
    headers: {  
      "Authorization": \`Bearer ${import.meta.env.VITE\_OPENROUTER\_API\_KEY}\`,  
      "Content-Type": "application/json"  
    },  
    body: JSON.stringify({  
      model: "anthropic/claude-3.5-sonnet", // Or openai/gpt-4o  
      messages: \[  
        { role: "system", content: systemInstruction },  
        { role: "user", content: prompt }  
      \],  
      response\_format: { type: "json\_object" } // Force JSON output  
    })  
  });  
  return response.json();  
}

