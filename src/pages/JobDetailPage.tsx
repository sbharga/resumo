import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wand2, FileEdit, BarChart2, CheckCircle2, XCircle, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { callOpenRouter } from '@/lib/openrouter'
import { TAILOR_RESUME_SYSTEM_PROMPT, ATS_SCORE_SYSTEM_PROMPT } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { JobEntry, JobStatus, ResumeJSON, ATSScore } from '@/types/resume'

const STATUS_COLORS: Record<JobStatus, 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'> = {
  'Saved': 'secondary',
  'Resume Generated': 'default',
  'Applied': 'outline',
  'Interviewing': 'warning',
  'Rejected': 'destructive',
  'Offer': 'success',
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [jobDescription, setJobDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [atsScore, setAtsScore] = useState<ATSScore | null>(null)
  const [scoringAts, setScoringAts] = useState(false)

  const { data: job, isLoading } = useQuery({
    queryKey: ['job', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_tracker')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as JobEntry
    },
  })

  useEffect(() => {
    if (job?.job_description) setJobDescription(job.job_description)
  }, [job])

  const { data: tailoredResume } = useQuery({
    queryKey: ['tailored-resume', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('tailored_resumes')
        .select('*')
        .eq('job_id', id)
        .maybeSingle()
      return data
    },
    enabled: !!id,
  })

  const updateStatus = useMutation({
    mutationFn: async (status: JobStatus) => {
      const { error } = await supabase.from('job_tracker').update({ status }).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', user?.id] })
    },
  })

  const saveJobDescription = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('job_tracker')
        .update({ job_description: jobDescription })
        .eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      toast.success('Job description saved')
    },
  })

  const generateResume = async () => {
    if (!jobDescription.trim()) {
      toast.error('Please enter a job description first')
      return
    }

    setGenerating(true)
    try {
      const { data: baseResumeData, error: brError } = await supabase
        .from('base_resumes')
        .select('structured_content')
        .eq('user_id', user!.id)
        .single()

      if (brError) throw new Error('No base resume found. Please upload your resume first.')

      const jsonStr = await callOpenRouter(
        TAILOR_RESUME_SYSTEM_PROMPT,
        `Base Resume JSON:\n${JSON.stringify(baseResumeData.structured_content, null, 2)}\n\nJob Description:\n${jobDescription}`
      )

      const tailored: ResumeJSON = JSON.parse(jsonStr)

      const { error: upsertError } = await supabase.from('tailored_resumes').upsert({
        job_id: id,
        user_id: user!.id,
        content: tailored,
      }, { onConflict: 'job_id' })

      if (upsertError) throw upsertError

      await supabase
        .from('job_tracker')
        .update({ status: 'Resume Generated', job_description: jobDescription })
        .eq('id', id!)

      queryClient.invalidateQueries({ queryKey: ['tailored-resume', id] })
      queryClient.invalidateQueries({ queryKey: ['job', id] })
      queryClient.invalidateQueries({ queryKey: ['jobs', user?.id] })
      toast.success('Tailored resume generated!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const runAtsScore = async () => {
    if (!tailoredResume || !jobDescription.trim()) return
    setScoringAts(true)
    try {
      const jsonStr = await callOpenRouter(
        ATS_SCORE_SYSTEM_PROMPT,
        `Tailored Resume JSON:\n${JSON.stringify(tailoredResume.content, null, 2)}\n\nJob Description:\n${jobDescription}`
      )
      setAtsScore(JSON.parse(jsonStr))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scoring failed')
    } finally {
      setScoringAts(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!job) return null

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-900">{job.job_title}</h2>
          <p className="text-gray-500">{job.company_name}</p>
        </div>
        <Select
          value={job.status}
          onValueChange={(val) => updateStatus.mutate(val as JobStatus)}
        >
          <SelectTrigger className="w-48">
            <SelectValue>
              <Badge variant={STATUS_COLORS[job.status]}>{job.status}</Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(['Saved', 'Resume Generated', 'Applied', 'Interviewing', 'Rejected', 'Offer'] as JobStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                <Badge variant={STATUS_COLORS[s]}>{s}</Badge>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Job Description</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            className="h-48 resize-y"
            placeholder="Paste the full job description here..."
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => saveJobDescription.mutate()}
              disabled={saveJobDescription.isPending}
            >
              Save
            </Button>
            <Button
              size="sm"
              onClick={generateResume}
              disabled={generating}
            >
              <Wand2 className="h-4 w-4" />
              {generating ? 'Generating...' : 'Generate Tailored Resume'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {tailoredResume && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-green-900">Tailored resume ready</p>
              <p className="text-sm text-green-700 mt-0.5">
                Review, edit, and download your customized PDF
              </p>
            </div>
            <Button onClick={() => navigate(`/editor/${id}`)}>
              <FileEdit className="h-4 w-4" />
              Open Editor
            </Button>
          </CardContent>
        </Card>
      )}

      {tailoredResume && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                ATS Match Score
              </CardTitle>
              <Button
                size="sm"
                variant={atsScore ? 'outline' : 'default'}
                onClick={runAtsScore}
                disabled={scoringAts || !jobDescription.trim()}
              >
                {scoringAts ? (
                  <><span className="animate-spin mr-1.5">⟳</span> Analyzing...</>
                ) : atsScore ? (
                  'Re-run'
                ) : (
                  'Check Score'
                )}
              </Button>
            </div>
            {!jobDescription.trim() && (
              <p className="text-xs text-gray-400 mt-1">Add a job description above to enable scoring.</p>
            )}
          </CardHeader>

          {atsScore && (
            <CardContent className="space-y-5">
              {/* Overall score */}
              <div className="flex items-center gap-5">
                <ScoreRing score={atsScore.overall} />
                <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2">
                  {(Object.entries(atsScore.sections) as [string, number][]).map(([key, val]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                        <span className="capitalize">{key}</span>
                        <span className="font-medium text-gray-700">{val}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${val}%`, backgroundColor: scoreColor(val) }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Keywords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Matched Keywords
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsScore.matchedKeywords.map((kw) => (
                      <span key={kw} className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">{kw}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5 text-red-400" /> Missing Keywords
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {atsScore.missingKeywords.map((kw) => (
                      <span key={kw} className="text-xs bg-red-50 text-red-600 border border-red-200 rounded-full px-2 py-0.5">{kw}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Strengths & Gaps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {atsScore.strengths.map((s, i) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-500" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">How to Improve</p>
                  <ul className="space-y-1.5">
                    {atsScore.gaps.map((g, i) => (
                      <li key={i} className="text-xs text-gray-700 flex gap-1.5">
                        <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-orange-400" />{g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}

function scoreColor(score: number) {
  if (score >= 80) return '#22c55e'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

function ScoreRing({ score }: { score: number }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = scoreColor(score)

  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: 80, height: 80 }}>
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={radius} stroke="#f3f4f6" strokeWidth="7" fill="none" />
        <circle
          cx="40" cy="40" r={radius}
          stroke={color} strokeWidth="7" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-bold text-gray-900 leading-none">{score}</span>
        <span className="text-[9px] text-gray-400 uppercase tracking-wide">/ 100</span>
      </div>
    </div>
  )
}
