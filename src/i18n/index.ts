import { en } from "./en"
import { ar } from "./ar"
import { layoutTranslations } from "./layout"
import { candidateDashboardTranslations } from "./candidateDashboard"
import { candidateProfileTranslations } from "./candidateProfile"
import { candidateJobsTranslations } from "./candidateJobs"
import { uploadCvTranslations } from "./uploadCv"
import { adminImportTranslations } from "./adminImport"
import { careerServicesTranslations } from "./careerServices"
import { employerTranslations } from "./employer"

export const translations = {
  en: {
    ...en,
    ...layoutTranslations.en,
    ...candidateDashboardTranslations.en,
    ...candidateProfileTranslations.en,
    ...candidateJobsTranslations.en,
    ...uploadCvTranslations.en,
    ...adminImportTranslations.en,
    ...careerServicesTranslations.en,
    ...employerTranslations.en,
  },
  ar: {
    ...ar,
    ...layoutTranslations.ar,
    ...candidateDashboardTranslations.ar,
    ...candidateProfileTranslations.ar,
    ...candidateJobsTranslations.ar,
    ...uploadCvTranslations.ar,
    ...adminImportTranslations.ar,
    ...careerServicesTranslations.ar,
    ...employerTranslations.ar,
  },
}
