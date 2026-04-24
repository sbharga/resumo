export type ResumeJSON = {
  personalInfo: {
    fullName: string
    email: string
    phone: string
    location: string
    linkedinUrl?: string
    portfolioUrl?: string
  }
  summary: string
  experience: Array<{
    company: string
    role: string
    startDate: string
    endDate: string
    location: string
    achievements: string[]
  }>
  education: Array<{
    institution: string
    degree: string
    graduationDate: string
  }>
  skills: {
    technical: string[]
    soft: string[]
    tools: string[]
  }
}

export type JobStatus =
  | 'Saved'
  | 'Applied'
  | 'Interviewing'
  | 'Rejected'
  | 'Offer'

export type JobEntry = {
  id: string
  user_id: string
  company_name: string
  job_title: string
  job_description: string
  status: JobStatus
  created_at: string
}

export type TailoredResume = {
  id: string
  job_id: string
  user_id: string
  content: ResumeJSON
  created_at: string
}

export type BaseResume = {
  id: string
  user_id: string
  structured_content: ResumeJSON
  updated_at: string
}
