-- Privacy, Consent, and Audit Framework
--
-- DRAFT — requires legal/business review before public launch
--
-- Tables:
-- 1. privacy_policies: policy registry (versioned)
-- 2. user_consents: append-only consent ledger
-- 3. privacy_audit_log: privacy-sensitive actions
-- 4. notification_preferences: opt-in/out per candidate/HR

-- ============================================================
-- 1. PRIVACY POLICIES REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS privacy_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL UNIQUE,
  -- policy_key examples: 'terms_of_service', 'privacy_policy', 'candidate_data_policy', 'employer_data_policy', 'data_retention', 'acceptable_use'
  title_en TEXT NOT NULL,
  title_ar TEXT NOT NULL,
  version TEXT NOT NULL,
  -- version examples: '1.0', '1.1', '2.0'
  effective_date DATE NOT NULL,
  last_updated_date DATE NOT NULL,
  content_en TEXT NOT NULL,
  content_ar TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  requires_acceptance BOOLEAN NOT NULL DEFAULT true,
  -- if false, policy is informational only
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_privacy_policies_policy_key ON privacy_policies(policy_key);
CREATE INDEX idx_privacy_policies_active ON privacy_policies(policy_key, is_active);

COMMENT ON TABLE privacy_policies IS 'DRAFT — Policy registry for versioned legal/privacy documents';
COMMENT ON COLUMN privacy_policies.policy_key IS 'Unique identifier for policy type (terms_of_service, privacy_policy, etc.)';
COMMENT ON COLUMN privacy_policies.requires_acceptance IS 'Whether this policy requires explicit user acceptance at signup/milestone';

-- ============================================================
-- 2. USER CONSENTS (APPEND-ONLY LEDGER)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  policy_key TEXT NOT NULL,
  -- Foreign key constraint: must reference privacy_policies(policy_key)
  -- But using TEXT to allow historical policies to be deleted from registry
  policy_version TEXT NOT NULL,
  -- The version they accepted (e.g., '1.0', '2.0')
  accepted BOOLEAN NOT NULL,
  -- true = accepted, false = rejected
  accepted_at TIMESTAMPTZ NOT NULL,
  -- Timestamp of acceptance
  context TEXT,
  -- e.g., 'signup', 'update_check', 'admin_forced'
  locale TEXT,
  -- e.g., 'en', 'ar'
  revoked_at TIMESTAMPTZ,
  -- If consent can be withdrawn (e.g., marketing), revocation timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX idx_user_consents_policy_key ON user_consents(policy_key);
CREATE INDEX idx_user_consents_accepted_at ON user_consents(accepted_at);
CREATE INDEX idx_user_consents_user_policy ON user_consents(user_id, policy_key);

COMMENT ON TABLE user_consents IS 'DRAFT — Append-only ledger of user consent/rejection to policies. No update/delete.';
COMMENT ON COLUMN user_consents.revoked_at IS 'If consent can be withdrawn, this marks when. Revoked records stay immutable.';

-- ============================================================
-- 3. PRIVACY AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS privacy_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Who performed the action (null for system)
  actor_role user_role NOT NULL,
  -- admin, super_admin, hr, candidate
  action TEXT NOT NULL,
  -- Examples: 'profile_view', 'cv_access', 'verification_decision', 'employer_visibility_change',
  --          'consent_acceptance', 'deletion_request', 'data_export', 'account_deleted'
  subject_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Who the action was about (if applicable; null for system actions)
  organization_id UUID REFERENCES hr_organizations(id) ON DELETE SET NULL,
  -- HR organization if applicable
  metadata JSONB,
  -- Limited/minimized context (e.g., {"old_visibility": false, "new_visibility": true})
  -- Never includes passwords, tokens, CV contents, or unnecessary PII
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_privacy_audit_log_actor ON privacy_audit_log(actor_user_id);
CREATE INDEX idx_privacy_audit_log_subject ON privacy_audit_log(subject_user_id);
CREATE INDEX idx_privacy_audit_log_action ON privacy_audit_log(action);
CREATE INDEX idx_privacy_audit_log_created_at ON privacy_audit_log(created_at DESC);
CREATE INDEX idx_privacy_audit_log_actor_action ON privacy_audit_log(actor_user_id, action);

COMMENT ON TABLE privacy_audit_log IS 'DRAFT — Immutable privacy-sensitive event log. No user update/delete.';
COMMENT ON COLUMN privacy_audit_log.actor_role IS 'Role of actor at time of action (not looked up from current profiles state)';
COMMENT ON COLUMN privacy_audit_log.metadata IS 'Minimized context only; no passwords, tokens, sensitive content';

-- ============================================================
-- 4. NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  user_role user_role NOT NULL,
  -- Candidate preferences
  job_alerts BOOLEAN NOT NULL DEFAULT true,
  application_updates BOOLEAN NOT NULL DEFAULT true,
  employer_contact BOOLEAN NOT NULL DEFAULT true,
  career_services BOOLEAN NOT NULL DEFAULT true,
  account_updates BOOLEAN NOT NULL DEFAULT true,
  marketing_communications BOOLEAN NOT NULL DEFAULT false,
  -- HR preferences
  applications BOOLEAN NOT NULL DEFAULT true,
  talent_requests BOOLEAN NOT NULL DEFAULT true,
  recruitment_services BOOLEAN NOT NULL DEFAULT true,
  organization_updates BOOLEAN NOT NULL DEFAULT true,
  hr_marketing BOOLEAN NOT NULL DEFAULT false,
  -- Common
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_preferences_user_id ON notification_preferences(user_id);

COMMENT ON TABLE notification_preferences IS 'DRAFT — User notification opt-in/out. System/security notifications cannot be disabled.';
COMMENT ON COLUMN notification_preferences.marketing_communications IS 'Optional: user must explicitly opt-in (default false)';

-- ============================================================
-- 5. DELETION REQUESTS (ACCOUNT DELETION WORKFLOW)
-- ============================================================
CREATE TABLE IF NOT EXISTS deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'requested',
  -- 'requested', 'under_review', 'approved', 'completed', 'rejected'
  CHECK (status IN ('requested', 'under_review', 'approved', 'completed', 'rejected')),
  rejection_reason TEXT,
  reviewed_by_admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  -- e.g., {"reason": "user_provided_reason", "retention_notes": "..."}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deletion_requests_user_id ON deletion_requests(user_id);
CREATE INDEX idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX idx_deletion_requests_created_at ON deletion_requests(created_at DESC);

COMMENT ON TABLE deletion_requests IS 'DRAFT — Account deletion workflow: request → review → approval/rejection → completion';

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================
ALTER TABLE privacy_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_requests ENABLE ROW LEVEL SECURITY;

-- privacy_policies: read by all authenticated, write by super_admin only
CREATE POLICY privacy_policies_select ON privacy_policies FOR SELECT
  USING (true);

CREATE POLICY privacy_policies_write ON privacy_policies FOR INSERT
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

CREATE POLICY privacy_policies_update ON privacy_policies FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role = 'super_admin'));

-- user_consents: users read own, super_admin audits all
CREATE POLICY user_consents_own_select ON user_consents FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  );

CREATE POLICY user_consents_own_insert ON user_consents FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No update/delete on user_consents (append-only ledger)

-- privacy_audit_log: admin/super_admin read all, users see limited info
CREATE POLICY privacy_audit_log_admin_select ON privacy_audit_log FOR SELECT
  USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  );

-- privacy_audit_log: no user insert/update/delete (system-only writes)

-- notification_preferences: users manage own, super_admin can read all
CREATE POLICY notification_preferences_own_select ON notification_preferences FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  );

CREATE POLICY notification_preferences_own_insert ON notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_preferences_own_update ON notification_preferences FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- deletion_requests: users can view/create own, admin/super_admin manage workflow
CREATE POLICY deletion_requests_own_select ON deletion_requests FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin'))
  );

CREATE POLICY deletion_requests_own_insert ON deletion_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY deletion_requests_admin_update ON deletion_requests FOR UPDATE
  USING (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')))
  WITH CHECK (auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin', 'super_admin')));

-- ============================================================
-- 7. INITIAL POLICIES (DRAFT CONTENT)
-- ============================================================
INSERT INTO privacy_policies (policy_key, title_en, title_ar, version, effective_date, last_updated_date, content_en, content_ar, requires_acceptance)
VALUES
  (
    'terms_of_service',
    'Terms & Conditions',
    'الشروط والأحكام',
    '1.0',
    CURRENT_DATE,
    CURRENT_DATE,
    E'DRAFT — This Terms & Conditions requires legal review before public launch.\n\n1. SERVICE DESCRIPTION\nTalent Verify is a professional talent and career development platform.\n\n2. USER ROLES\nCandidates: Individuals seeking career opportunities or professional development.\nEmployers/HR: Organizations recruiting talent.\nAdmins: Platform operators.\n\n3. VERIFICATION\nTalent Verify verification is a platform certification only and does not guarantee employment or hiring.\nEmployers make independent hiring decisions.\n\n4. DATA & PRIVACY\nUser data is processed per the Privacy Policy.\nCandidates control their professional profile visibility.\nEmployers access only authorized, verified candidate data.\n\n5. ACCEPTABLE USE\nUsers must not: Share others'' credentials, upload malicious content, scrape data, abuse automation, or violate laws.\nViolations may result in account suspension or termination.\n\n6. LIABILITY\nService provided as-is. We are not liable for employment outcomes, lost opportunities, or indirect damages.\n\n7. TERMINATION\nWe may terminate accounts for policy violations, with or without notice.\n\n8. CHANGES\nWe may update these terms. Continued use implies acceptance.\n\n9. CONTACT\nFor questions, contact: [PRIVACY_CONTACT_REQUIRED]',
    E'DRAFT — يتطلب هذا الشروط والأحكام مراجعة قانونية قبل الإطلاق العام.\n\n1. وصف الخدمة\nTalent Verify هي منصة احترافية للمواهب والتطور الوظيفي.\n\n2. أدوار المستخدمين\nالمرشحون: الأفراد الذين يسعون إلى فرص عمل أو تطور مهني.\nأصحاب العمل / الموارد البشرية: المنظمات التي تجند المواهب.\nالمسؤولون: مشغلو المنصة.\n\n3. التحقق\nالتحقق من Talent Verify هو شهادة منصة فقط ولا يضمن العمل أو التوظيف.\nيتخذ أصحاب العمل قرارات التوظيف بشكل مستقل.\n\n4. البيانات والخصوصية\nتتم معالجة بيانات المستخدم وفقاً لسياسة الخصوصية.\nيتحكم المرشحون برؤية ملفهم المهني.\nيصل أصحاب العمل فقط إلى بيانات المرشحين المصرح بها والمتحققة.\n\n5. الاستخدام المقبول\nيجب على المستخدمين عدم: مشاركة بيانات اعتماد الآخرين، أو تحميل محتوى ضار، أو كشط البيانات، أو إساءة استخدام الأتمتة، أو انتهاك القوانين.\nقد تؤدي الانتهاكات إلى إيقاف الحساب أو إغلاقه.\n\n6. المسؤولية\nالخدمة كما هي. لا نتحمل مسؤولية النتائج الوظيفية أو الفرص المفقودة أو الأضرار غير المباشرة.\n\n7. الإنهاء\nقد نقوم بإنهاء الحسابات بسبب انتهاك السياسة، مع أو بدون إشعار.\n\n8. التغييرات\nقد نقوم بتحديث هذه الشروط. الاستخدام المستمر يعني الموافقة.\n\n9. الاتصال\nللأسئلة، يرجى التواصل: [PRIVACY_CONTACT_REQUIRED]',
    true
  ),
  (
    'privacy_policy',
    'Privacy Policy',
    'سياسة الخصوصية',
    '1.0',
    CURRENT_DATE,
    CURRENT_DATE,
    E'DRAFT — This Privacy Policy requires legal review before public launch.\n\n1. INTRODUCTION\nTalent Verify ("we", "us", "our") operates the professional talent platform.\nThis policy explains how we collect, use, and protect your personal data.\n\n2. DATA WE COLLECT\n- Account: Email, full name, password hash\n- Profile: Headline, location, bio, skills, education, experience, projects, languages, credentials\n- Documents: CVs, certificates\n- Verification: Status, verification timestamp\n- Activity: Applications, career service requests\n- Preferences: Job alert settings, employer visibility\n\n3. HOW WE USE DATA\n- Operate the platform and user accounts\n- Match candidates with opportunities\n- Verify professional qualifications\n- Communicate with users\n- Improve services (with aggregated, anonymized data only)\n- Comply with legal obligations\n\n4. WHO CAN ACCESS YOUR DATA\n- You: Full access to your own data\n- HR/Employers: Only verified, professional profile data where employer_visible=true\n- Admins: Full access where operationally necessary\n- Service providers: Limited, contracted third parties (if any)\n\n5. EMPLOYER VISIBILITY\nCandidates control visibility via employer_visible setting (default: OFF).\nWhen ON: Professional profile (skills, experience, education, projects) may be accessed by approved employers.\nWhen OFF: Profile is private and not discoverable.\n\n6. YOUR RIGHTS\n- Access: Request a copy of your data\n- Deletion: Request account deletion (see Data Retention & Deletion Policy)\n- Correction: Update your profile\n- Portability: Export your data\n- Opt-out: Disable employer visibility, unsubscribe from communications\n\n7. DATA RETENTION\nSee separate Data Retention & Deletion Policy.\n\n8. SECURITY\nWe use industry-standard encryption and access controls.\nNo system is 100% secure. We are not liable for unauthorized access despite our efforts.\n\n9. CONTACT & REQUESTS\nFor privacy requests or concerns: [PRIVACY_CONTACT_REQUIRED]',
    E'DRAFT — تتطلب سياسة الخصوصية هذه مراجعة قانونية قبل الإطلاق العام.\n\n1. المقدمة\nTalent Verify ("نحن"، "لنا"، "منا") تشغل منصة المواهب المحترفة.\nتشرح هذه السياسة كيف نجمع بيانات شخصية وكيف نستخدمها وحمايتها.\n\n2. البيانات التي نجمعها\n- الحساب: البريد الإلكتروني، الاسم الكامل، تجزئة كلمة المرور\n- الملف الشخصي: العنوان الوظيفي، الموقع، السيرة الذاتية، المهارات، التعليم، الخبرة، المشاريع، اللغات، البيانات الاعتمادية\n- المستندات: السير الذاتية، الشهادات\n- التحقق: الحالة، طابع زمني للتحقق\n- النشاط: الطلبات، طلبات خدمات التطور الوظيفي\n- التفضيلات: إعدادات التنبيهات الوظيفية، رؤية صاحب العمل\n\n3. كيف نستخدم البيانات\n- تشغيل المنصة وحسابات المستخدم\n- مطابقة المرشحين مع الفرص\n- التحقق من المؤهلات المهنية\n- التواصل مع المستخدمين\n- تحسين الخدمات (باستخدام البيانات المجمعة والمجهولة فقط)\n- الامتثال للالتزامات القانونية\n\n4. من يمكنه الوصول إلى بيانات الحساب\n- أنت: الوصول الكامل إلى بيانات الحساب الخاصة بك\n- الموارد البشرية / أصحاب العمل: فقط بيانات الملف المهني المتحقق منها حيث employer_visible=true\n- المسؤولون: الوصول الكامل حيث يكون ذلك ضروريًا من الناحية التشغيلية\n- مزودو الخدمات: أطراف ثالثة محدودة ومتعاقدة (إن وجدت)\n\n5. رؤية صاحب العمل\nيتحكم المرشحون برؤية الملف عبر إعداد employer_visible (الافتراضي: OFF).\nعندما يكون ON: قد يتمكن أصحاب العمل المصرح لهم من الوصول إلى الملف المهني (المهارات، الخبرة، التعليم، المشاريع).\nعندما يكون OFF: الملف خاص وغير قابل للاكتشاف.\n\n6. حقوقك\n- الوصول: اطلب نسخة من بيانات الحساب\n- الحذف: اطلب حذف الحساب (انظر سياسة الاحتفاظ بالبيانات والحذف)\n- التصحيح: تحديث ملفك الشخصي\n- النقل: تصدير بيانات الحساب\n- عدم الاشتراك: تعطيل رؤية صاحب العمل، إلغاء الاشتراك في المراسلات\n\n7. الاحتفاظ بالبيانات\nانظر سياسة منفصلة للاحتفاظ بالبيانات والحذف.\n\n8. الأمان\nنستخدم التشفير وعناصر التحكم في الوصول بمعايير الصناعة.\nلا توجد نظام آمن 100٪. لا نتحمل مسؤولية الوصول غير المصرح به رغم جهودنا.\n\n9. الاتصال والطلبات\nللطلبات المتعلقة بالخصوصية أو المخاوف: [PRIVACY_CONTACT_REQUIRED]',
    true
  ),
  (
    'candidate_data_policy',
    'Candidate Data & Employer Visibility Policy',
    'سياسة بيانات المرشح ورؤية صاحب العمل',
    '1.0',
    CURRENT_DATE,
    CURRENT_DATE,
    E'DRAFT — This policy requires legal review before public launch.\n\n1. WHAT DATA DO EMPLOYERS SEE?\n\nWhen Employer Visibility is ON and you are VERIFIED:\nEmployers can see:\n- Your professional headline, location, skills, education, experience, projects, languages\n- Your talent ID and verification status\n- Your CV (only in authorized hiring workflows)\n\nEmployers CANNOT see:\n- Your email address (initial contact only through the platform)\n- Your password or auth credentials\n- Internal verification notes\n- Career service history\n- Private messages\n- Rejection reasons\n\n2. WHAT DATA DO EMPLOYERS NOT SEE?\n- Personal contact information\n- Admin internal notes\n- Account deletion requests\n- Decline reasons\n- Your other employers'' names (from Career Services)\n\n3. VERIFICATION & VISIBILITY\n- Verification = platform confirmed your qualifications\n- Visibility = you allowed employers to discover your profile\n- Both must be true for employers to find you\n\n4. YOU ARE IN CONTROL\n- Default: Visibility is OFF\n- You can turn visibility ON or OFF anytime\n- You can update your profile anytime\n- You can delete your CV anytime\n- You can request account deletion anytime\n\n5. WHAT DOES "VERIFIED" MEAN?\n- Platform reviewed your qualifications\n- We found no disqualifying issues\n- This is NOT a hiring guarantee\n- Employers make their own decisions\n\n6. APPLICATION & CONTACT\n- If an employer contacts you, they used the platform workflow\n- Your email is NOT directly exposed\n- You can accept, decline, or ignore employer messages\n- You control all communication\n\n7. QUESTIONS?\nContact: [PRIVACY_CONTACT_REQUIRED]',
    E'DRAFT — تتطلب هذه السياسة مراجعة قانونية قبل الإطلاق العام.\n\n1. ما البيانات التي يراها أصحاب العمل؟\n\nعندما تكون رؤية صاحب العمل ON وأنت VERIFIED:\nيمكن لأصحاب العمل أن يروا:\n- عنوانك المهني والموقع والمهارات والتعليم والخبرة والمشاريع واللغات\n- معرّف الموهبة الخاص بك وحالة التحقق\n- السيرة الذاتية الخاصة بك (فقط في سير العمل المصرح به)\n\nلا يمكن لأصحاب العمل أن يروا:\n- عنوان بريدك الإلكتروني (الاتصال الأولي فقط من خلال المنصة)\n- كلمة مرورك أو بيانات اعتماد المصادقة\n- ملاحظات التحقق الداخلية\n- سجل خدمات التطور الوظيفي\n- الرسائل الخاصة\n- أسباب الرفض\n\n2. ما البيانات التي لا يراها أصحاب العمل؟\n- معلومات الاتصال الشخصية\n- ملاحظات الأدمن الداخلية\n- طلبات حذف الحساب\n- أسباب الرفض\n- أسماء أصحاب العمل الآخرين (من خدمات التطور الوظيفي)\n\n3. التحقق والرؤية\n- التحقق = المنصة أكدت مؤهلاتك\n- الرؤية = السماح لأصحاب العمل باكتشاف ملفك\n- يجب أن يكون كلاهما صحيحًا لأصحاب العمل للعثور عليك\n\n4. أنت المسيطر\n- الافتراضي: الرؤية OFF\n- يمكنك تشغيل أو إيقاف الرؤية في أي وقت\n- يمكنك تحديث ملفك في أي وقت\n- يمكنك حذف السيرة الذاتية الخاصة بك في أي وقت\n- يمكنك طلب حذف الحساب في أي وقت\n\n5. ماذا يعني "Verified"؟\n- استعرضت المنصة مؤهلاتك\n- لم نجد أي مشاكل مؤهلة\n- هذا ليس ضمان توظيف\n- يتخذ أصحاب العمل قرارات خاصة بهم\n\n6. التطبيق والاتصال\n- إذا اتصل بك صاحب عمل، فقد استخدموا سير عمل المنصة\n- بريدك الإلكتروني ليس مكشوفًا مباشرة\n- يمكنك قبول أو رفض أو تجاهل رسائل صاحب العمل\n- أنت تتحكم في جميع الاتصالات\n\n7. أسئلة؟\nالاتصال: [PRIVACY_CONTACT_REQUIRED]',
    true
  ),
  (
    'employer_data_policy',
    'Employer & HR Data Use Policy',
    'سياسة استخدام بيانات صاحب العمل والموارد البشرية',
    '1.0',
    CURRENT_DATE,
    CURRENT_DATE,
    E'DRAFT — This policy requires legal review before public launch.\n\n1. DATA ACCESS\n\nHR Users can access:\n- Verified candidates who enabled Employer Visibility\n- Applications to your job postings\n- Talent Request inquiries\n- Candidate interactions with your postings\n\nHR Users CANNOT access:\n- Candidates who did not enable visibility\n- Draft/unpublished candidates\n- Other employers'' candidate data\n- Admin internal notes\n- Auth/system data\n\n2. CANDIDATE CONTACT\n- You can reach candidates only through the platform workflow\n- You cannot scrape, export, or bulk download candidate emails\n- Candidates can decline or ignore your contact\n- Respect candidate communication preferences\n\n3. DATA USE RESTRICTIONS\nYou agree to:\n- Use candidate data ONLY for hiring/recruiting\n- Do NOT resell, share, or republish candidate profiles\n- Do NOT use data for marketing without explicit consent\n- Do NOT discriminate based on protected characteristics\n- Comply with employment laws and data protection regulations\n\n4. THIRD-PARTY SHARING\n- Do NOT share candidate data with contractors without consent\n- Do NOT integrate with external recruiting/tracking systems without disclosure\n- Talent Verify is not responsible for third-party misuse\n\n5. DATA RETENTION\n- Keep candidate contact data only as long as needed for hiring\n- Delete or anonymize data after hiring decision\n- Do NOT maintain unauthorized databases of candidates\n\n6. VERIFICATION\n- Talent Verify verification is platform certification only\n- You must conduct your own due diligence\n- Verification does not guarantee candidate performance\n\n7. LIABILITY\n- Talent Verify is not responsible for hiring outcomes\n- You are responsible for employment decisions\n- Candidates are responsible for their own data accuracy\n\n8. MONITORING\n- Talent Verify monitors for abuse\n- Violations may result in account suspension or termination\n- We may audit your data usage\n\n9. CONTACT\nFor questions: [PRIVACY_CONTACT_REQUIRED]',
    E'DRAFT — تتطلب هذه السياسة مراجعة قانونية قبل الإطلاق العام.\n\n1. الوصول إلى البيانات\n\nيمكن لمستخدمي الموارد البشرية الوصول إلى:\n- المرشحين المتحققين الذين فعلوا رؤية صاحب العمل\n- الطلبات على عروض الوظائف الخاصة بك\n- استفسارات طلب الموهبة\n- تفاعلات المرشحين مع عروضك\n\nلا يمكن لمستخدمي الموارد البشرية الوصول إلى:\n- المرشحين الذين لم يفعلوا رؤية صاحب العمل\n- المرشحين في المسودة / غير المنشورة\n- بيانات المرشح لأصحاب العمل الآخرين\n- ملاحظات الأدمن الداخلية\n- بيانات المصادقة / النظام\n\n2. اتصال المرشح\n- يمكنك الوصول إلى المرشحين فقط من خلال سير عمل المنصة\n- لا يمكنك كشط أو تصدير أو تحميل رسائل بريد المرشحين بشكل مجمع\n- يمكن للمرشحين رفض أو تجاهل اتصالك\n- احترم تفضيلات الاتصال بالمرشح\n\n3. قيود استخدام البيانات\nأنت توافق على:\n- استخدام بيانات المرشح فقط للتوظيف / التجنيد\n- عدم إعادة بيع أو مشاركة أو إعادة نشر ملفات تعريف المرشحين\n- عدم استخدام البيانات للتسويق بدون موافقة صريحة\n- عدم التمييز بناءً على الخصائص المحمية\n- الامتثال لقوانين التوظيف ولوائح حماية البيانات\n\n4. مشاركة الطرف الثالث\n- لا تشارك بيانات المرشح مع المقاولين بدون موافقة\n- لا تتكامل مع أنظمة التجنيد / التتبع الخارجية بدون الإفصاح\n- Talent Verify ليست مسؤولة عن إساءة استخدام الطرف الثالث\n\n5. الاحتفاظ بالبيانات\n- احتفظ ببيانات اتصال المرشح فقط طالما لزم الأمر للتوظيف\n- احذف أو أخفِ البيانات بعد قرار التوظيف\n- لا تحتفظ بقواعد بيانات غير مصرح بها للمرشحين\n\n6. التحقق\n- التحقق من Talent Verify هو شهادة منصة فقط\n- يجب عليك إجراء تحقق خاص بك\n- التحقق لا يضمن أداء المرشح\n\n7. المسؤولية\n- Talent Verify ليست مسؤولة عن نتائج التوظيف\n- أنت مسؤول عن قرارات التوظيف\n- المرشحون مسؤولون عن دقة بيانات الحساب الخاصة بهم\n\n8. المراقبة\n- تراقب Talent Verify الإساءة\n- قد تؤدي الانتهاكات إلى إيقاف الحساب أو إغلاقه\n- قد نقوم بتدقيق استخدام البيانات الخاصة بك\n\n9. الاتصال\nللأسئلة: [PRIVACY_CONTACT_REQUIRED]',
    true
  ),
  (
    'data_retention_deletion',
    'Data Retention & Account Deletion Policy',
    'سياسة الاحتفاظ بالبيانات وحذف الحساب',
    '1.0',
    CURRENT_DATE,
    CURRENT_DATE,
    E'DRAFT — This policy requires legal review and business review for actual retention durations before public launch.\n\n1. OVERVIEW\n\nThis policy outlines how long we keep your data and how to request account deletion.\nRetention periods are currently under BUSINESS/LEGAL REVIEW and not yet finalized for production.\n\n2. CANDIDATE DATA RETENTION (PENDING BUSINESS DECISION)\n\nOnce finalized, the following categories will apply:\n\n- Active Account: Full data retention while account is active\n- Verification Records: [TBD — How long to keep after verification?]\n- CVs/Documents: [TBD — How long accessible after account deletion?]\n- Applications: [TBD — How long do completed applications stay?]\n- Career Service History: [TBD — How long to retain?]\n- Consent Records: [TBD — Permanent? 2+ years?]\n- Audit Logs: [TBD — 1 year? 3 years? Permanent?]\n\n3. HR ORGANIZATION DATA RETENTION (PENDING BUSINESS DECISION)\n\n- Active Organization: Full data retention while organization is active\n- Job Postings: [TBD — How long after closed?]\n- Applications: [TBD — Duration?]\n- Organization Audit: [TBD — Duration?]\n\n4. ACCOUNT DELETION REQUEST PROCESS\n\nStep 1: Candidate initiates deletion request from Settings → Delete Account\nStep 2: System logs the request and notifies admins\nStep 3: Admin reviews for compliance hold (legal, audit, retention)\nStep 4: Approval/rejection decision\nStep 5: If approved, scheduled for deletion\nStep 6: Cascade deletion of dependent data\nStep 7: Auth user deletion\n\n5. WHAT HAPPENS WHEN YOU REQUEST DELETION\n\nImmediately:\n- Account marked as "deletion_requested"\n- Profile made private (visible to admins/self only)\n- Email no longer indexed for recruitment\n- Account cannot be used (no login)\n\nAfter Admin Approval:\n- Associated documents deleted from storage\n- Applications marked as deleted (metadata retained for audit)\n- Consent records kept (legal requirement)\n- Audit log kept (permanent)\n- Auth user deleted from Supabase Auth\n\n6. WHAT CANNOT BE DELETED\n- Audit logs (legal/compliance requirement)\n- Consent history (legal requirement)\n- Completed job applications (may be required by labor law)\n- Anonymized/aggregated analytics\n\n7. WHAT CAN BE DELETED\n- Your personal profile data\n- Your CV and documents\n- Your message history (except compliance logs)\n- Active notifications\n\n8. DATA EXPORT\nBefore or after deletion request, you can export:\n- Your full profile data (JSON)\n- Your document metadata\n- Your application history\n- Your consent history\n\n9. ANONYMIZATION OPTION (IF APPLICABLE)\nInstead of full deletion, some retention requirements may allow anonymization:\n- Identifying fields removed/hashed\n- Audit trail retained\n- Original verification records archived\n\n10. CONTACT\nFor deletion requests or questions: [PRIVACY_CONTACT_REQUIRED]\n\nNOTE: Actual retention periods are currently [TBD] pending business and legal review.',
    E'DRAFT — تتطلب هذه السياسة مراجعة قانونية ومراجعة تجارية للمدد الفعلية للاحتفاظ قبل الإطلاق العام.\n\n1. نظرة عامة\n\nتوضح هذه السياسة المدة التي نحتفظ فيها ببيانات الحساب وكيفية طلب حذف الحساب.\nفترات الاحتفاظ حاليًا تحت مراجعة تجارية / قانونية وليست نهائية للإنتاج.\n\n2. الاحتفاظ ببيانات المرشح (قيد البحث التجاري)\n\nبمجرد الانتهاء، ستنطبق الفئات التالية:\n\n- الحساب النشط: الاحتفاظ الكامل بالبيانات أثناء نشاط الحساب\n- سجلات التحقق: [TBD — كم من الوقت بعد التحقق؟]\n- السير الذاتية / المستندات: [TBD — كم من الوقت بعد حذف الحساب؟]\n- التطبيقات: [TBD — كم من الوقت تبقى التطبيقات المكتملة؟]\n- سجل خدمات التطور الوظيفي: [TBD — كم من الوقت للاحتفاظ؟]\n- سجلات الموافقة: [TBD — دائم؟ سنتان على الأقل؟]\n- سجلات التدقيق: [TBD — سنة واحدة؟ 3 سنوات؟ دائم؟]\n\n3. الاحتفاظ ببيانات منظمة الموارد البشرية (قيد البحث التجاري)\n\n- المنظمة النشطة: الاحتفاظ الكامل بالبيانات أثناء نشاط المنظمة\n- عروض الوظائف: [TBD — كم من الوقت بعد الإغلاق؟]\n- الطلبات: [TBD — المدة؟]\n- تدقيق المنظمة: [TBD — المدة؟]\n\n4. عملية طلب حذف الحساب\n\nالخطوة 1: يبدأ المرشح طلب الحذف من الإعدادات → حذف الحساب\nالخطوة 2: يسجل النظام الطلب وينبه الأدمن\nالخطوة 3: يراجع الأدمن للامتثال (قانوني، تدقيق، احتفاظ)\nالخطوة 4: قرار الموافقة / الرفض\nالخطوة 5: إذا تمت الموافقة، حدد للحذف\nالخطوة 6: حذف متسلسل للبيانات التابعة\nالخطوة 7: حذف المستخدم الأساسي\n\n5. ماذا يحدث عندما تطلب الحذف\n\nفورًا:\n- تم وضع الحساب علامة "deletion_requested"\n- الملف الشخصي خاص (مرئي للأدمن / النفس فقط)\n- لم يعد البريد الإلكتروني مفهرسًا للتجنيد\n- لا يمكن استخدام الحساب (لا يمكن تسجيل الدخول)\n\nبعد موافقة الأدمن:\n- تم حذف المستندات المرتبطة من التخزين\n- تطبيقات تم وضع علامة عليها كمحذوفة (البيانات الوصفية المحفوظة للتدقيق)\n- سجلات الموافقة المحفوظة (متطلب قانوني)\n- سجل التدقيق المحفوظ (دائم)\n- المستخدم الأساسي محذوف من Supabase Auth\n\n6. ما الذي لا يمكن حذفه\n- سجلات التدقيق (متطلب الامتثال القانوني)\n- سجل الموافقة (متطلب قانوني)\n- تطبيقات الوظائف المكتملة (قد تكون مطلوبة بموجب قانون العمل)\n- التحليلات المجهولة / المجمعة\n\n7. ما يمكن حذفه\n- بيانات الملف الشخصي الخاصة بك\n- السيرة الذاتية والمستندات الخاصة بك\n- سجل الرسائل الخاص بك (باستثناء سجلات الامتثال)\n- الإخطارات النشطة\n\n8. تصدير البيانات\nقبل أو بعد طلب الحذف، يمكنك تصدير:\n- بيانات الملف الشخصي الكاملة (JSON)\n- البيانات الوصفية للمستند الخاص بك\n- سجل الطلب الخاص بك\n- سجل الموافقة الخاص بك\n\n9. خيار المجهول (إن أمكن)\nبدلاً من الحذف الكامل، قد تسمح بعض متطلبات الاحتفاظ بالمجهول:\n- تم حذف / تجزئة الحقول المحددة\n- سجل التدقيق المحفوظ\n- سجلات التحقق الأصلية المؤرشفة\n\n10. الاتصال\nللطلبات المتعلقة بالحذف أو الأسئلة: [PRIVACY_CONTACT_REQUIRED]\n\nملاحظة: فترات الاحتفاظ الفعلية حاليًا [TBD] في انتظار المراجعة التجارية والقانونية.',
    true
  ),
  (
    'acceptable_use',
    'Acceptable Use Policy',
    'سياسة الاستخدام المقبول',
    '1.0',
    CURRENT_DATE,
    CURRENT_DATE,
    E'DRAFT — This policy requires legal review before public launch.\n\n1. PROHIBITED BEHAVIOR\n\nYou agree NOT to:\n\n- Share your account login with others\n- Attempt to access others'' accounts or data\n- Upload malicious, harassing, or illegal content\n- Scrape, export, or bulk download data from the platform\n- Misrepresent your qualifications or identity\n- Post discriminatory, hateful, or abusive content\n- Spam or send unsolicited messages\n- Circumvent platform features or security measures\n- Reverse-engineer or attempt to hack the platform\n- Use automation or bots without authorization\n- Impersonate another user or organization\n- Violate employment or labor laws\n- Engage in illegal activities\n\n2. CONSEQUENCES\n\nViolations may result in:\n- Warning\n- Account suspension\n- Account termination\n- Legal action\n- Report to authorities\n\n3. CANDIDATE-SPECIFIC RULES\n\n- Do NOT apply to the same job multiple times (spam)\n- Do NOT share others'' CVs or credentials\n- Do NOT post false qualifications\n- Do NOT engage in sham applications\n\n4. EMPLOYER-SPECIFIC RULES\n\n- Do NOT discriminate in hiring\n- Do NOT scrape candidate data\n- Do NOT use data for non-recruitment purposes\n- Do NOT share candidate data with unauthorized parties\n- Do NOT harass candidates\n\n5. ADMIN-SPECIFIC RULES\n\n- Do NOT access user data without cause\n- Do NOT modify user data without authorization\n- Do NOT share admin access with non-admins\n- Do NOT use admin access for personal gain\n\n6. REPORTING ABUSE\n\nIf you witness a violation, contact: [PRIVACY_CONTACT_REQUIRED]\n\n7. PLATFORM RIGHTS\n\nTalent Verify reserves the right to:\n- Investigate violations\n- Suspend or terminate accounts\n- Remove content\n- Report to authorities\n- Refuse service\n\n8. NO GUARANTEE OF SERVICE\n\nWe provide this service as-is.\nWe reserve the right to modify, suspend, or discontinue features.\n\n9. CONTACT\nQuestions: [PRIVACY_CONTACT_REQUIRED]',
    E'DRAFT — تتطلب هذه السياسة مراجعة قانونية قبل الإطلاق العام.\n\n1. السلوك المحظور\n\nأنت توافق على عدم:\n\n- مشاركة بيانات دخول حسابك مع الآخرين\n- محاولة الوصول إلى حسابات أو بيانات الآخرين\n- تحميل محتوى ضار أو مسيء أو غير قانوني\n- كشط أو تصدير أو تحميل البيانات بكثرة من المنصة\n- تحريف مؤهلاتك أو هويتك\n- نشر محتوى تمييزي أو كراهية أو مسيء\n- الرسائل غير المرغوب فيها أو إرسال الرسائل غير المرغوب فيها\n- التحايل على ميزات المنصة أو تدابير الأمان\n- محاولة الهندسة العكسية أو اختراق المنصة\n- استخدام الأتمتة أو الروبوتات بدون تفويض\n- محاكاة مستخدم آخر أو منظمة\n- انتهاك قوانين التوظيف أو العمل\n- الانخراط في أنشطة غير قانونية\n\n2. العواقب\n\nقد تؤدي الانتهاكات إلى:\n- تنبيه\n- إيقاف الحساب\n- إنهاء الحساب\n- إجراء قانوني\n- تقرير إلى السلطات\n\n3. قواعد خاصة بالمرشح\n\n- لا تتقدم لنفس الوظيفة عدة مرات (رسائل غير مرغوب فيها)\n- لا تشارك السير الذاتية أو بيانات اعتماد الآخرين\n- لا تنشر مؤهلات كاذبة\n- لا تشارك في تطبيقات وهمية\n\n4. قواعد صاحب العمل\n\n- لا تميز في التوظيف\n- لا تكشط بيانات المرشح\n- لا تستخدم البيانات لأغراض غير التجنيد\n- لا تشارك بيانات المرشح مع أطراف غير مصرح بها\n- لا تضايق المرشحين\n\n5. قواعد الأدمن\n\n- لا تصل إلى بيانات المستخدم بدون سبب\n- لا تعدل بيانات المستخدم بدون تفويض\n- لا تشارك وصول الأدمن مع غير الأدمن\n- لا تستخدم وصول الأدمن للكسب الشخصي\n\n6. إبلاغ الإساءة\n\nإذا شهدت انتهاكًا، فاتصل بـ: [PRIVACY_CONTACT_REQUIRED]\n\n7. حقوق المنصة\n\nتحتفظ Talent Verify بالحق في:\n- التحقيق في الانتهاكات\n- إيقاف أو إنهاء الحسابات\n- إزالة المحتوى\n- تقرير إلى السلطات\n- رفض الخدمة\n\n8. لا ضمان للخدمة\n\nنحن نقدم هذه الخدمة كما هي.\nنحتفظ بالحق في تعديل أو إيقاف أو إيقاف الميزات.\n\n9. الاتصال\nأسئلة: [PRIVACY_CONTACT_REQUIRED]',
    true
  );
