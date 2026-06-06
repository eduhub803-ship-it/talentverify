import { en } from "./en"
import { ar } from "./ar"
import { layoutTranslations } from "./layout"
import { candidateDashboardTranslations } from "./candidateDashboard"
import { candidateProfileTranslations } from "./candidateProfile"
import { candidateJobsTranslations } from "./candidateJobs"
import { uploadCvTranslations } from "./uploadCv"

export const translations = {
  en: {
    ...en,
    ...layoutTranslations.en,
    ...candidateDashboardTranslations.en,
    ...candidateProfileTranslations.en,
    ...candidateJobsTranslations.en,
    ...uploadCvTranslations.en,
  },
  ar: {
    ...ar,
    ...layoutTranslations.ar,
    ...candidateDashboardTranslations.ar,
    ...candidateProfileTranslations.ar,
    ...candidateJobsTranslations.ar,
    ...uploadCvTranslations.ar,
  },
}
