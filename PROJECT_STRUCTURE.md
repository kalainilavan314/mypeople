# Current project structure

Generated from the working tree. Dependency folders, credentials, build output and temporary QA artifacts are omitted.

## Top level

```text
app/                  live member PWA (Vite, React 18) - production, do not move
server/               live Express API (/api) and migrations 0000-0011 - production, do not move
services/api/         FastAPI modular monolith (/v1), Alembic, pytest, Dockerfile
services/ai-worker/   private AI worker: one folder per task, not built yet (README in each)
packages/             design-tokens, i18n, api-client, mobile-ui (npm workspaces)
apps/                 member-mobile and staff-mobile (Expo shells); admin-web (Next.js shell)
docs/                 requirements, architecture, api, database, ai-ml, security, policies, development
deployment/           release scripts (production), nginx/, docker-compose.dev.yml, environments/, monitoring/
design/               wireframes/, mobile/ (PWA design system and QA), admin-dashboard/
scripts/              PWA browser checks
.github/workflows/    CI
.env.example          settings for deployment/docker-compose.dev.yml
```

Every folder from the target structure exists. A folder whose feature is not built yet holds only a `README.md` that names its BRD requirement IDs and says "not built yet"; nothing in it pretends to work.

## Detail

```text
Northern Province People's Movement app/
app/src/
  App/
    App.tsx
    OfflineBanner.tsx
    OnboardingLayout.tsx
    RedirectIfAuthed.tsx
    RequireAuth.tsx
    ScreenFallback.tsx
    TabLayout.tsx
  App.tsx
  core/
    api/
      api.ts
      auth/
        models.ts
        request.ts
        session.ts
      authApi.ts
      authApiModel/
        authApi.ts
      divisions.ts
      gallery.ts
      httpContent.ts
      index.ts
      models/
        donations.ts
        events.ts
        geography.ts
        membership.ts
        participation.ts
        reports.ts
      np-divisions.json
      prototype/
        account.ts
        client.ts
        clientModel/
          applyRsvpCounts.ts
          categoryTitle.ts
          clone.ts
          currentRsvp.ts
          delay.ts
          initials.ts
          isSeedGoing.ts
          mockClient.ts
          state.ts
          votedOption.ts
          withVotes.ts
        seed.ts
        seedModel/
          announcements.ts
          badges.ts
          courses.ts
          currentMember.ts
          electorates.ts
          events.ts
          ideas.ts
          notifications.ts
          referredList.ts
          reports.ts
          skills.ts
          survey.ts
          wards.ts
      queries.ts
      queriesModel/
        keys.ts
        useAnnouncement.ts
        useAnnouncements.ts
        useBackIdea.ts
        useBadges.ts
        useCheckIn.ts
        useConfirmCardDonation.ts
        useConsents.ts
        useCourses.ts
        useDonationBoard.ts
        useEvent.ts
        useEvents.ts
        useIdeas.ts
        useMarkNotificationRead.ts
        useMember.ts
        useMyCommunityReports.ts
        useMyDonations.ts
        useNotifications.ts
        usePendingDonations.ts
        useReferral.ts
        useReport.ts
        useReports.ts
        useReviewDonation.ts
        useSetConsent.ts
        useSetLanguage.ts
        useSetRsvp.ts
        useSkills.ts
        useSubmitCommunityReport.ts
        useSubmitIdea.ts
        useSubmitReport.ts
        useSubmitSlipDonation.ts
        useSurvey.ts
        useToggleSkill.ts
        useVoteSurvey.ts
      queue.ts
      types.ts
      typesModel/
        Announcement.ts
    i18n/
      en.json
      index.ts
      si.json
      ta.json
    lib/
      image.ts
      memberDisplay.ts
      nic.ts
      qr.tsx
      utils.ts
      viewport.ts
    router/
      screens.ts
    theme/
      civic.css
      embedded/
        LoginScreen.css
        ProfileSetupScreen.css
        QuestionsScreen.css
        RegisterScreen.css
        WelcomeScreen.css
      global.css
      home.css
      index.css
      member.css
      membership-card.css
      tiers.ts
      tokens.css
      tokens.ts
  features/
    auth/
      components/
        components/
          AuthPage.tsx
          BackChip.tsx
          Checkbox.tsx
          Field.tsx
          FieldLabel.tsx
          GreenButton.tsx
          HeroPanel.tsx
          LangToggle.tsx
          LinkText.tsx
          LogoBars.tsx
          PalmSilhouette.tsx
          SegTabs.tsx
          Steps.tsx
          Wordmark.tsx
        LoginDiv.tsx
        LoginDiv2.tsx
        LoginForm.tsx
        LoginLoginCardContainer.tsx
        NameHint.tsx
        NicCard.tsx
        NicHint.tsx
        NicPhotoTile.tsx
        parts.tsx
        PasswordHint.tsx
        ProfileSetupContinue.tsx
        ProfileSetupCopy.tsx
        ProfileSetupDiv.tsx
        ProfileSetupProfileSectionCard.tsx
        ProfileSetupProfileSectionCard2.tsx
        QuestionsDiv.tsx
        QuestionsDiv2.tsx
        QuestionsQuestionCardContainer.tsx
        RegisterFields.tsx
        RegisterFields2.tsx
      ForgotScreen.tsx
      LoginScreen.tsx
      onboarding/
        components/
          Welcome.tsx
          WelcomeSections/
            WelcomeDiv.tsx
        JoinScreen.tsx
        NicScreen.tsx
        OtpScreen.tsx
        PendingScreen.tsx
        WelcomeScreen.tsx
        WelcomeScreenModel/
          markWelcomeSeen.ts
          WELCOME_SEEN.ts
      ProfileSetupScreen.tsx
      Questions.model.ts
      QuestionsScreen.tsx
      Register.model.ts
      RegisterScreen.tsx
      state/
        signupDraft.ts
    card/
      Card.model.ts
      CardScreen.tsx
      components/
        Action.tsx
        CardAvailability.tsx
        CardMpSection.tsx
        CardMpSection2.tsx
        CardMpSection3.tsx
        CardViewer.tsx
        Close.tsx
        components/
          CredentialQr.tsx
          FitText.tsx
          Guilloche.tsx
          MembershipCredential.tsx
          ScaledMembershipCredential.tsx
        Detail.tsx
        MembershipCredential.tsx
        MembershipCredentialModel/
          CREDENTIAL_HEIGHT.ts
          CREDENTIAL_WIDTH.ts
          MembershipCredentialData.ts
        PalmyraMark.tsx
        QrDialog.tsx
        ShareDialog.tsx
      MilestonesScreen.tsx
      useCardActions.ts
    community/
      AnnouncementScreen.tsx
      Community.model.ts
      CommunityScreen.tsx
      components/
      MyAreaScreen.tsx
    events/
      components/
        EventCard.tsx
        EventCardSections/
          EventCardDiv.tsx
        EventsHeader.tsx
        EventsMap.tsx
      EventDetailScreen.tsx
      Events.model.ts
      EventsScreen.tsx
    fundraising/
      components/
        BankDetails.tsx
        CardFlow.tsx
        CardFlowSections/
          CardFlowDiv.tsx
          CardFlowSheet.tsx
          CardFlowSheet2.tsx
        DonateTab.tsx
        DonorsTab.tsx
        MethodCard.tsx
        PendingCard.tsx
        ReviewTab.tsx
        Sheet.tsx
        SlipFlow.tsx
        SlipFlowSections/
          SlipFlowSheet.tsx
        StatusChip.tsx
      PartyFund.model.ts
      PartyFundScreen.tsx
    gallery/
      components/
        Photo.tsx
      GalleryScreen.tsx
    home/
      components/
        ActivityOverview.tsx
        CommunityHero.tsx
        HomeHeader.tsx
        HomeServices.tsx
        NearbyEvents.tsx
      HomeScreen.tsx
    ideas/
      components/
      IdeasScreen.tsx
    learning/
      components/
      CoursesScreen.tsx
      SkillsScreen.tsx
    profile/
      components/
        EditForm.tsx
        EditFormSections/
          EditFormDiv.tsx
          EditFormDiv2.tsx
          EditFormDiv3.tsx
          EditFormPress.tsx
          EditFormProfileSelectBtn.tsx
          EditFormProfileSelectBtn2.tsx
        HeaderChipButton.tsx
        ProfileSection.tsx
        Row.tsx
        StatusChip.tsx
        VerificationSheet.tsx
      EditProfile.model.ts
      EditProfileScreen.tsx
      LanguageScreen.tsx
      NotificationsScreen.tsx
      PrivacyScreen.tsx
      Profile.model.ts
      profileFormStyles.ts
      ProfileScreen.tsx
    referrals/
      components/
      ReferralScreen.tsx
    reports/
      components/
        MyReports.tsx
        ReportForm.tsx
        ReportFormSections/
          ReportFormDiv.tsx
          ReportFormSection.tsx
          ReportFormSection2.tsx
        ReportItem.tsx
      Reports.model.ts
      ReportsScreen.tsx
    surveys/
      components/
      SurveyScreen.tsx
  main.tsx
  shared/
    components/
      BottomNav.tsx
      Civic.tsx
      DivisionBottomSheet/
        DsSheet.tsx
        GsSheet.tsx
      DivisionBottomSheet.tsx
      FormError.tsx
      Icon.tsx
      icons/
        content.tsx
        identity.tsx
        navigation.tsx
        participation.tsx
      Logo.tsx
      MemberWorkspace.tsx
      nn/
        Bleed.tsx
        ChipRow.tsx
        ImpactStrip.tsx
        NetImage.tsx
        QuickTile.tsx
        SectionHead.tsx
        StatusBadge.tsx
      nn.tsx
      nnModel/
        BADGE.ts
        BadgeVariant.ts
      ScreenHeader.tsx
      ui/
        Button.tsx
        Card.tsx
        Chip.tsx
        CustomSelect.tsx
        CustomSelectSections/
          CustomSelectDiv.tsx
        EmptyState.tsx
        Field.tsx
        LabelPair.tsx
        loaders-skeleton/
          CommunitySkeleton.tsx
          EventsSkeleton.tsx
          HomeSkeleton.tsx
          LoaderSkeleton.tsx
          ProfileSkeleton.tsx
          ReportsSkeleton.tsx
          RouteSkeleton.tsx
          SkeletonCard.tsx
          SkeletonProfileHeader.tsx
        loaders-skeleton.tsx
        loaders-skeletonModel/
          LoaderSkeletonProps.ts
        QueryBoundary.tsx
        StatusPill.tsx
        TierBadge.tsx
        Toggle.tsx
      ui.tsx
      uiModel/
        ButtonVariant.ts
        CustomSelectOption.ts
      UpdatePrompt.tsx
    hooks/
      useAuth.ts
      useMe.ts
      useNetworkStatus.ts
      useTheme.ts
  sw.ts
  vite-env.d.ts
server/src/
  avatar.js
  db.js
  gallery-albums.json
  gallery.js
  index.js
  lib.js
  migrate.js
  seed-demo.js
  storage.js
  supabase-ca.js
  throttle.js
  tier.js
server/test/
  client-ip.test.js
services/api/
  pyproject.toml
  README.md
  .env.example
  Dockerfile
  .dockerignore
  scripts/
    export_openapi.py
  alembic.ini
  alembic/
    env.py
    script.py.mako
    versions/
      0001_baseline_express_schema.py
      0002_access_and_audit.py
      0003_identity_documents.py
      0004_identity_reviews.py
      0005_verification_appeals.py
      0006_membership_states.py
      0007_duplicate_investigations.py
      0008_registration.py
  app/
    __init__.py
    main.py
    health.py
    core/
      __init__.py
      config.py
      middleware.py
      permissions.py       staff tiers and the BRD permission matrix
      request_info.py
      schemas.py
      security.py
    db/
      __init__.py
      base.py
      express_baseline.py
      session.py
    modules/
      __init__.py
      auth/
        __init__.py
        dependencies.py
        repository.py
        router.py
        schemas.py
        service.py
        session_cookie.py
        throttle.py
      membership/
        __init__.py
        repository.py
        router.py
        rules.py
        schemas.py
        service.py
      access/
        __init__.py
        bootstrap.py
        dependencies.py
        repository.py
        router.py
        rules.py
        schemas.py
        service.py
      audit/
        __init__.py
        repository.py
        router.py
        schemas.py
        service.py
      identity/
        __init__.py
        documents/         identity images: encrypted vault, upload, signed view links
          __init__.py
          dependencies.py
          images.py
          links.py
          repository.py
          router.py
          schemas.py
          service.py
          vault.py
        reviews/           submission, queue, claim, decisions (W01, W02)
          __init__.py
          repository.py
          router.py
          rules.py
          schemas.py
          service.py
        appeals/           appeals against decisions (D05)
          __init__.py
          repository.py
          router.py
          rules.py
          schemas.py
          service.py
        duplicates/        duplicate account investigations (D04)
          __init__.py
          repository.py
          router.py
          rules.py
          schemas.py
          service.py
        registration/      sign-up, consent, registration progress (A03 to A18)
          __init__.py
          common_passwords.txt
          repository.py
          router.py
          rules.py
          schemas.py
          service.py
      geography/           district, DS and GN lists (FR-REG-029)
        __init__.py
        repository.py
        router.py
      households/          README only: not built yet
      assistance/          README only: not built yet
      community/           README only: not built yet
      events/              README only: not built yet
      engagement/          README only: not built yet
      finance/             README only: not built yet
      content/             README only: not built yet
      messaging/           README only: not built yet
      ai/                  README only: not built yet
    integrations/          README only: not built yet
    tasks/                 README only: not built yet (Celery)
  tests/
    conftest.py
    express/
      auth_helpers.mjs
      auth_vectors.json
      vectors-request.json
    test_access_api.py
    test_access_rules.py
    test_audit_log.py
    test_config.py
    test_database.py
    test_duplicate_rules.py
    test_duplicates_api.py
    test_db_session.py
    test_express_baseline.py
    test_express_compat.py
    test_health.py
    test_identity_api.py
    test_identity_vault.py
    test_members_me.py
    test_membership_api.py
    test_membership_rules.py
    test_origin_check.py
    test_registration_api.py
    test_registration_rules.py
    test_security.py
    test_sign_in.py
    test_throttle.py
    test_verification_api.py
    test_verification_appeal_rules.py
    test_verification_appeals_api.py
    test_verification_rules.py
services/ai-worker/
  README.md
  app/
    document_ocr/  face_comparison/  liveness/  issue_classification/  translation/  knowledge_assistant/
                           README only in each: not built yet (OD-28, OD-42)
  tests/                   README only
packages/
  design-tokens/
    package.json
    tsconfig.json
    src/index.ts
    test/matches-pwa.test.ts
  i18n/
    package.json
    tsconfig.json
    src/
      index.ts
      en.json
      ta.json
      si.json
    test/
      known-gaps.json
      resources.test.ts
  api-client/
    package.json
    tsconfig.json
    openapi.json
    src/
      index.ts
      schema.ts            generated from openapi.json, do not edit
    test/client.test.ts
  mobile-ui/
    package.json
    tsconfig.json
    src/
      index.ts
      fonts.ts             locked fonts and text styles for native apps
      strings.ts           shared component text (Tamil pending review)
      PlannedScreen.tsx
      ServerStatus.tsx
      tabIcon.tsx
apps/
  member-mobile/
    package.json  app.json  tsconfig.json  .env.example  README.md
    app/
      _layout.tsx
      (tabs)/
        _layout.tsx  index.tsx  events.tsx  card.tsx  gallery.tsx  profile.tsx
      (auth)/  household/  assistance/  ideas/  promises/  issues/
                           README only in each: not built yet
    src/
      lib/
        api.ts
        i18n.ts
      features/
        auth/  identity/  membership/  household/  assistance/  issues/
        development/  promises/  events/  finance/  assistant/
                           README only in each: not built yet
      components/  hooks/  providers/
                           README only in each
    assets/images/
  staff-mobile/
    package.json  app.json  tsconfig.json  .env.example  README.md
    app/
      _layout.tsx
      (tabs)/
        _layout.tsx  index.tsx  tasks.tsx  cases.tsx  check-in.tsx  profile.tsx
      (auth)/  field-visits/  identity-reviews/
                           README only in each: not built yet
    src/
      lib/
        api.ts
        i18n.ts            includes staff tab labels (Tamil pending review)
      features/  components/
                           README only in each
    assets/images/
  admin-web/
    package.json  next.config.ts  tsconfig.json  eslint.config.mjs  .env.example  README.md  AGENTS.md
    public/robots.txt      keeps the dashboard out of search engines
    src/
      app/
        layout.tsx         design tokens as CSS variables, self-hosted locked fonts
        globals.css        maps the tokens into Tailwind
        page.tsx           dashboard home: system status and planned modules
        icon.png
      components/SystemStatus.tsx
      lib/
        api.ts             server-only API client
        modules.ts         the BRD's dashboard modules
      features/
        members/  verification/  organization/  assistance/  households/  issues/
        finance/  promises/  elections/  analytics/  ai-monitoring/  audit-logs/
                           README only in each: not built yet
docs/
  requirements/README.md
  architecture/
    system-overview.md
    member-pwa.md
  api/api-reference.md
  database/database-guide.md
  ai-ml/README.md          AI rules, use-case register, release gates (BRD §15B)
  security/security-rules.md
  policies/README.md       policy approval matrix, retention, prohibitions (BRD §13.4, §16)
  development/setup.md
  assets/  home-design.md  profile-design.md
design/
  wireframes/README.md     the BRD wireframes are held by the project owner
  mobile/                  PWA design system, specifications, review.html, qa/ screenshots
  admin-dashboard/README.md
deployment/
  README.md                release record and how to deploy
  package_release.py  deploy_release.py  stage-ui-release.sh  activate-ui-release.sh  verify_public_release.py
  nginx/                   reference copy of the production site
  docker-compose.dev.yml   local PostgreSQL 17, and the API with --profile api
  environments/README.md
  monitoring/README.md
tsconfig.packages.json
.github/workflows/
  ci.yml
```

See docs/architecture/system-overview.md for boundaries and docs/development/setup.md for commands.
