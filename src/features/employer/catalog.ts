/**
 * Employer-purchased services (35 and 36).
 *
 * Same shape and the same canonical status model as the Career Services
 * catalog, but scoped to an organization rather than a candidate. The workflow
 * rules are imported from Career Services rather than duplicated.
 */
import type { EmployerService } from '@/types/domain'

export const EMPLOYER_SERVICES: EmployerService[] = [
  {
    id: 'talent-request',
    code: '34',
    name: 'Talent Request',
    nameAr: 'طلب مواهب',
    pricingType: 'paid',
    description:
      'Tell SEH exactly who you need. Our team searches the verified talent pool and submits a reviewed shortlist of candidates.',
    descriptionAr:
      'أخبر SEH بالضبط من تحتاج. يبحث فريقنا في قاعدة المواهب الموثقة ويقدّم لك قائمة مختصرة مراجَعة من المرشحين.',
    active: true,
    requiresScheduling: false,
    resultType: 'recommendations',
    allowsRepeatRequests: true,
    inputFields: [
      {
        key: 'targetRole',
        label: 'Role you need',
        labelAr: 'الوظيفة المطلوبة',
        type: 'text',
        required: true,
        placeholder: 'e.g. Project Coordinator',
      },
      {
        key: 'candidateCount',
        label: 'How many candidates do you need?',
        labelAr: 'كم عدد المرشحين المطلوب؟',
        type: 'text',
        required: true,
        placeholder: 'e.g. 5',
      },
      {
        key: 'requiredSkills',
        label: 'Required skills',
        labelAr: 'المهارات المطلوبة',
        type: 'textarea',
        required: true,
        helpText: 'Comma-separated. These are treated as must-haves.',
        helpTextAr: 'مفصولة بفواصل. تُعامل كمتطلبات أساسية.',
      },
      {
        key: 'preferredSkills',
        label: 'Preferred skills',
        labelAr: 'المهارات المفضلة',
        type: 'textarea',
        required: false,
        helpText: 'Comma-separated. Nice to have, not essential.',
        helpTextAr: 'مفصولة بفواصل. مفضلة وليست أساسية.',
      },
      {
        key: 'minimumExperience',
        label: 'Minimum experience',
        labelAr: 'الحد الأدنى للخبرة',
        type: 'select',
        required: false,
        options: [
          { value: 'entry', label: 'Entry level', labelAr: 'مبتدئ' },
          { value: '1-3', label: '1-3 years', labelAr: '1-3 سنوات' },
          { value: '3-5', label: '3-5 years', labelAr: '3-5 سنوات' },
          { value: '5+', label: '5+ years', labelAr: 'أكثر من 5 سنوات' },
        ],
      },
      {
        key: 'languages',
        label: 'Languages required',
        labelAr: 'اللغات المطلوبة',
        type: 'text',
        required: false,
        placeholder: 'e.g. Arabic, English',
      },
      {
        key: 'sehTraining',
        label: 'SEH training required',
        labelAr: 'تدريب SEH المطلوب',
        type: 'text',
        required: false,
        helpText: 'Leave blank if any background is acceptable.',
        helpTextAr: 'اتركه فارغاً إذا كانت أي خلفية مقبولة.',
      },
      {
        key: 'sector',
        label: 'Sector',
        labelAr: 'القطاع',
        type: 'select',
        required: false,
        options: [
          { value: 'private', label: 'Private sector', labelAr: 'القطاع الخاص' },
          { value: 'ngo', label: 'NGO / INGO', labelAr: 'المنظمات غير الحكومية' },
          { value: 'public', label: 'Public sector', labelAr: 'القطاع العام' },
        ],
      },
      {
        key: 'employmentType',
        label: 'Employment type',
        labelAr: 'نوع التوظيف',
        type: 'select',
        required: false,
        options: [
          { value: 'Full-time', label: 'Full-time', labelAr: 'دوام كامل' },
          { value: 'Part-time', label: 'Part-time', labelAr: 'دوام جزئي' },
          { value: 'Contract', label: 'Contract', labelAr: 'عقد' },
          { value: 'Internship', label: 'Internship', labelAr: 'تدريب' },
        ],
      },
      {
        key: 'location',
        label: 'Location',
        labelAr: 'الموقع',
        type: 'text',
        required: false,
      },
      {
        key: 'availability',
        label: 'When do you need them to start?',
        labelAr: 'متى تحتاجهم للبدء؟',
        type: 'select',
        required: false,
        options: [
          { value: 'immediate', label: 'Immediately', labelAr: 'فوراً' },
          { value: 'two_weeks', label: 'Within two weeks', labelAr: 'خلال أسبوعين' },
          { value: 'one_month', label: 'Within a month', labelAr: 'خلال شهر' },
          { value: 'flexible', label: 'Flexible', labelAr: 'مرن' },
        ],
      },
      {
        key: 'additionalRequirements',
        label: 'Anything else we should screen for?',
        labelAr: 'هل هناك متطلبات إضافية؟',
        type: 'textarea',
        required: false,
      },
    ],
  },
  {
    id: 'recruitment-and-candidate-assessment',
    code: '35',
    name: 'Recruitment & Candidate Assessment',
    nameAr: 'خدمة التوظيف وتقييم المرشحين',
    pricingType: 'paid',
    description:
      'SEH runs the search and structured assessment for a role you are hiring, and returns a shortlist with written evaluations.',
    descriptionAr:
      'يتولى فريق SEH البحث والتقييم المنظّم للوظيفة التي توظّف لها، ويسلّمك قائمة مختصرة مع تقييمات مكتوبة.',
    active: true,
    requiresScheduling: false,
    resultType: 'recommendations',
    allowsRepeatRequests: true,
    inputFields: [
      {
        key: 'roleTitle',
        label: 'Role you are hiring for',
        labelAr: 'الوظيفة المطلوب شغلها',
        type: 'text',
        required: true,
      },
      {
        key: 'headcount',
        label: 'How many hires?',
        labelAr: 'كم عدد الوظائف الشاغرة؟',
        type: 'text',
        required: false,
        placeholder: 'e.g. 2',
      },
      {
        key: 'jobDescription',
        label: 'Job description',
        labelAr: 'الوصف الوظيفي',
        type: 'textarea',
        required: true,
        helpText: 'Paste the full description, including the must-have requirements.',
        helpTextAr: 'الصق الوصف الكامل، بما في ذلك المتطلبات الأساسية.',
      },
      {
        key: 'assessmentFocus',
        label: 'What should the assessment focus on?',
        labelAr: 'على ماذا يجب أن يركز التقييم؟',
        type: 'textarea',
        required: false,
        helpText: 'For example: technical depth, English level, competency interviews.',
        helpTextAr: 'مثال: العمق التقني، مستوى الإنجليزية، مقابلات الكفاءات.',
      },
      {
        key: 'timeline',
        label: 'When do you need to hire by?',
        labelAr: 'ما الموعد المستهدف للتوظيف؟',
        type: 'text',
        required: false,
        placeholder: 'YYYY-MM-DD',
      },
    ],
  },
  {
    id: 'corporate-talent-partnership',
    code: '36',
    name: 'Corporate Talent Partnership',
    nameAr: 'شراكة المواهب المؤسسية',
    pricingType: 'premium',
    description:
      'An ongoing partnership with SEH. Managed by the SEH team as an account entitlement, not requested through this page.',
    descriptionAr:
      'شراكة مستمرة مع SEH يديرها فريق SEH كصلاحية على حساب المؤسسة، ولا تُطلب من هذه الصفحة.',
    // Service 36 became an entitlement tier (plan = 'partner'). The entry is
    // retained so historic requests still resolve, but no new ones are accepted.
    active: false,
    requiresScheduling: true,
    resultType: 'session',
    allowsRepeatRequests: false,
    inputFields: [
      {
        key: 'hiringVolume',
        label: 'Expected hiring volume per year',
        labelAr: 'حجم التوظيف السنوي المتوقع',
        type: 'select',
        required: true,
        options: [
          { value: '1-5', label: '1-5 hires', labelAr: '1-5 وظائف' },
          { value: '6-20', label: '6-20 hires', labelAr: '6-20 وظيفة' },
          { value: '21-50', label: '21-50 hires', labelAr: '21-50 وظيفة' },
          { value: '50+', label: 'More than 50', labelAr: 'أكثر من 50' },
        ],
      },
      {
        key: 'focusAreas',
        label: 'Roles and functions you hire for',
        labelAr: 'الوظائف والمجالات التي توظّف لها',
        type: 'textarea',
        required: true,
      },
      {
        key: 'availability',
        label: 'When are you available for the partnership review?',
        labelAr: 'ما الأوقات المناسبة لجلسة مراجعة الشراكة؟',
        type: 'textarea',
        required: true,
        helpText: 'Give a few options. SEH confirms one of them.',
        helpTextAr: 'اذكر عدة خيارات، وسيؤكد فريق SEH أحدها.',
      },
      {
        key: 'goals',
        label: 'What do you want the partnership to achieve?',
        labelAr: 'ما الذي تريد تحقيقه من الشراكة؟',
        type: 'textarea',
        required: false,
      },
    ],
  },
]

export const ACTIVE_EMPLOYER_SERVICES = EMPLOYER_SERVICES.filter((service) => service.active)

export function getEmployerService(code: string): EmployerService | undefined {
  return EMPLOYER_SERVICES.find((service) => service.code === code)
}

export function requireEmployerService(code: string): EmployerService {
  const service = getEmployerService(code)
  if (!service) throw new Error(`Unknown employer service: ${code}`)
  return service
}
