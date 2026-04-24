import { create } from 'zustand'
import type { ResumeJSON } from '@/types/resume'

type EditorStore = {
  editedResume: ResumeJSON | null
  setEditedResume: (resume: ResumeJSON) => void
  updatePersonalInfo: (info: Partial<ResumeJSON['personalInfo']>) => void
  updateSummary: (summary: string) => void
  updateExperienceAchievement: (expIndex: number, achIndex: number, value: string) => void
  updateSkills: (skills: Partial<ResumeJSON['skills']>) => void
}

export const useEditorStore = create<EditorStore>((set) => ({
  editedResume: null,

  setEditedResume: (resume) => set({ editedResume: resume }),

  updatePersonalInfo: (info) =>
    set((state) => {
      if (!state.editedResume) return state
      return {
        editedResume: {
          ...state.editedResume,
          personalInfo: { ...state.editedResume.personalInfo, ...info },
        },
      }
    }),

  updateSummary: (summary) =>
    set((state) => {
      if (!state.editedResume) return state
      return { editedResume: { ...state.editedResume, summary } }
    }),

  updateExperienceAchievement: (expIndex, achIndex, value) =>
    set((state) => {
      if (!state.editedResume) return state
      const experience = state.editedResume.experience.map((exp, i) => {
        if (i !== expIndex) return exp
        const achievements = exp.achievements.map((a, j) => (j === achIndex ? value : a))
        return { ...exp, achievements }
      })
      return { editedResume: { ...state.editedResume, experience } }
    }),

  updateSkills: (skills) =>
    set((state) => {
      if (!state.editedResume) return state
      return {
        editedResume: {
          ...state.editedResume,
          skills: { ...state.editedResume.skills, ...skills },
        },
      }
    }),
}))
