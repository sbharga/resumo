import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Wand2, FileEdit } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { callOpenRouter } from '@/lib/openrouter'
import { TAILOR_RESUME_SYSTEM_PROMPT } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { JobEntry, JobStatus, ResumeJSON } from '@/types/resume'

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
    </div>
  )
}
