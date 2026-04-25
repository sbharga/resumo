import { create } from 'zustand'
import type { ResumeJSON } from '@/types/resume'

type EditorStore = {
  editedResume: ResumeJSON | null
  setEditedResume: (resume: ResumeJSON) => void
  updatePersonalInfo: (info: Partial<ResumeJSON['personalInfo']>) => void
  updateSummary: (summary: string) => void
  updateExperienceMeta: (expIndex: number, meta: Partial<Omit<ResumeJSON['experience'][0], 'achievements'>>) => void
  updateExperienceAchievement: (expIndex: number, achIndex: number, value: string) => void
  addExperienceAchievement: (expIndex: number) => void
  removeExperienceAchievement: (expIndex: number, achIndex: number) => void
  addExperience: () => void
  removeExperience: (expIndex: number) => void
  updateEducation: (eduIndex: number, edu: Partial<ResumeJSON['education'][0]>) => void
  addEducation: () => void
  removeEducation: (eduIndex: number) => void
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

  updateExperienceMeta: (expIndex, meta) =>
    set((state) => {
      if (!state.editedResume) return state
      const experience = state.editedResume.experience.map((exp, i) =>
        i === expIndex ? { ...exp, ...meta } : exp
      )
      return { editedResume: { ...state.editedResume, experience } }
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

  addExperienceAchievement: (expIndex) =>
    set((state) => {
      if (!state.editedResume) return state
      const experience = state.editedResume.experience.map((exp, i) =>
        i === expIndex ? { ...exp, achievements: [...exp.achievements, ''] } : exp
      )
      return { editedResume: { ...state.editedResume, experience } }
    }),

  removeExperienceAchievement: (expIndex, achIndex) =>
    set((state) => {
      if (!state.editedResume) return state
      const experience = state.editedResume.experience.map((exp, i) => {
        if (i !== expIndex) return exp
        return { ...exp, achievements: exp.achievements.filter((_, j) => j !== achIndex) }
      })
      return { editedResume: { ...state.editedResume, experience } }
    }),

  addExperience: () =>
    set((state) => {
      if (!state.editedResume) return state
      const newExp = { company: '', role: '', startDate: '', endDate: 'Present', location: '', achievements: [''] }
      return { editedResume: { ...state.editedResume, experience: [...state.editedResume.experience, newExp] } }
    }),

  removeExperience: (expIndex) =>
    set((state) => {
      if (!state.editedResume) return state
      return {
        editedResume: {
          ...state.editedResume,
          experience: state.editedResume.experience.filter((_, i) => i !== expIndex),
        },
      }
    }),

  updateEducation: (eduIndex, edu) =>
    set((state) => {
      if (!state.editedResume) return state
      const education = state.editedResume.education.map((e, i) =>
        i === eduIndex ? { ...e, ...edu } : e
      )
      return { editedResume: { ...state.editedResume, education } }
    }),

  addEducation: () =>
    set((state) => {
      if (!state.editedResume) return state
      return {
        editedResume: {
          ...state.editedResume,
          education: [...(state.editedResume.education ?? []), { institution: '', degree: '', graduationDate: '' }],
        },
      }
    }),

  removeEducation: (eduIndex) =>
    set((state) => {
      if (!state.editedResume) return state
      return {
        editedResume: {
          ...state.editedResume,
          education: state.editedResume.education.filter((_, i) => i !== eduIndex),
        },
      }
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
