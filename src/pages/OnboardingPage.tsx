import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { callGeminiWithPDF } from '@/lib/openrouter'
import { PARSE_RESUME_SYSTEM_PROMPT } from '@/lib/prompts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { ResumeJSON } from '@/types/resume'

type Step = 'upload' | 'parsing' | 'saving' | 'done' | 'error'

export default function OnboardingPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const processFile = useCallback(async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file')
      return
    }

    try {
      setStep('parsing')
      const jsonStr = await callGeminiWithPDF(PARSE_RESUME_SYSTEM_PROMPT, file)
      const structured: ResumeJSON = JSON.parse(jsonStr)

      setStep('saving')
      const { error: brError } = await supabase.from('base_resumes').upsert({
        user_id: user!.id,
        structured_content: structured,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      if (brError) throw brError

      // Populate profile with personal info extracted from resume
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: structured.personalInfo?.fullName ?? '',
        phone: structured.personalInfo?.phone ?? '',
        location: structured.personalInfo?.location ?? '',
        linkedin_url: structured.personalInfo?.linkedinUrl ?? '',
        portfolio_url: structured.personalInfo?.portfolioUrl ?? '',
      }).eq('id', user!.id)

      if (profileError) throw profileError

      setStep('done')
      toast.success('Resume parsed and saved!')
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err) {
      console.error(err)
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong')
      setStep('error')
    }
  }, [user, navigate])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Resumo</h1>
          <p className="text-gray-500 mt-1">Let&apos;s get your resume set up</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload your base resume</CardTitle>
            <CardDescription>
              We&apos;ll parse it with AI to create your profile. This only needs to be done once.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 'upload' && (
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-4" />
                <p className="text-sm font-medium text-gray-700">
                  Drag & drop your PDF resume here
                </p>
                <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                <input
                  id="file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={onFileChange}
                />
              </div>
            )}

            {(step === 'parsing' || step === 'saving') && (
              <div className="text-center py-10 space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
                <div>
                  <p className="font-medium text-gray-900">
                    {step === 'parsing' ? 'Parsing your resume...' : 'Saving your profile...'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {step === 'parsing'
                      ? 'Our AI is reading and structuring your resume'
                      : 'Almost done!'}
                  </p>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className="text-center py-10 space-y-4">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
                <div>
                  <p className="font-medium text-gray-900">Resume parsed successfully!</p>
                  <p className="text-sm text-gray-500 mt-1">Redirecting to your dashboard...</p>
                </div>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center py-10 space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
                <div>
                  <p className="font-medium text-gray-900">Something went wrong</p>
                  <p className="text-sm text-red-500 mt-1">{errorMsg}</p>
                </div>
                <Button variant="outline" onClick={() => setStep('upload')}>
                  Try again
                </Button>
              </div>
            )}

            {step === 'upload' && (
              <p className="text-xs text-gray-400 text-center mt-4 flex items-center justify-center gap-1">
                <FileText className="h-3 w-3" />
                PDF files only · Processed securely on your device
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
