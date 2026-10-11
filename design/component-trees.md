# Updated component trees · React PWA, React Native and Flutter
11 October 2026 · My People

These are equivalent implementations of one system. The React PWA tree below describes the updated source. The native trees are a migration handoff, not a claim that a Flutter or React Native app was built or tested.

## Shared contract

Data belongs above presentation. Controllers/hooks provide Member, Events, Album and AsyncState models. Screens do not contain verification rules or assume activation from a name/tier. Membership activation and identity verification are distinct. The same data drives accessible labels and visible content.

```ts
type IdentityState = 'unverified' | 'nic_format' | 'review_pending' | 'identity_confirmed';
type MembershipState = 'pending' | 'active' | 'suspended' | 'inactive' | 'unknown';
type Tone = 'neutral' | 'verified' | 'pending';
type AsyncState<T> =
  | { kind:'loading' }
  | { kind:'ready'; data:T; refreshedAt:string; cached:boolean }
  | { kind:'empty' }
  | { kind:'error'; message:string; retry:()=>void };

interface MemberPresentation {
  legalName:string; memberId:string; portraitUrl?:string;
  district:string; dsDivision:string; gnDivision:string;
  recognitionTier:'volunteer'|'diamond'|'gold'|'platinum';
  governanceAssignment?:{tier:1|2|3|4|5;title:string;scope:string};
  identity:IdentityState; membership:MembershipState;
}
interface Photo {
  id:string; src:string; altEn:string; altTa:string;
  credit:string; sourceUrl:string; license:string; licenseUrl:string;
}
interface Album {
  id:string; titleEn:string; titleTa:string;
  category:'events'|'community'; sample:boolean; publishedAt:string;
  publisher:string; place:string; photos:Photo[]; count:number;
}
```

Standard props: SurfaceCard(content, accent?), Action(label, onPress, busy?, enabled?), IconButton(icon, accessibleLabel, onPress), DateBadge(timestamp), StatusTag(label,tone), MenuRow(icon,label,destination), AlbumCard(album,onOpen).

## Current React PWA

```text
QueryClientProvider
└─ BrowserRouter
   └─ App
      └─ RequireAuth
         └─ TabLayout (.app-shell)
            ├─ OfflineBanner [conditional]
            ├─ ScrollViewport (.screen)
            │  └─ Suspense → route screen
            └─ BottomNav [Home / Events / raised Card QR / Gallery / Profile; measured clearance]

Home (.civic-page)
├─ GreetingHeader
│  ├─ h1(time greeting + first name)
│  ├─ LocationRow
│  └─ NotificationLink [44 target / 40 visual]
├─ NextStepCard | VerificationNotice
│  └─ QueryBoundary → TaskTitle / Venue / PrimaryAction
├─ QuickActionGrid → QuickAction × 4
├─ NearbySection → QueryBoundary → EventPreview
│  └─ DateBadge / EventText / StatusTag
├─ ServiceGrid + Search [surveys / events / ideas / courses / referrals / fund / gallery / card]
├─ ActivitySummary [existing event / report / referral counts]
└─ MissionFooter

Events (.civic-page)
├─ ScreenHeader / SearchControl
├─ SegmentedButtons [List / Map]
├─ FilterChips [horizontal scroll]
└─ QueryBoundary
   ├─ EventCard × N
   │  ├─ DateBadge
   │  ├─ TitleButton / BookmarkButton
   │  ├─ VenueLine / TimeLine
   │  ├─ ResponseCount / RsvpAction
   │  └─ ErrorMessage / ConfirmationLiveRegion
   └─ EventsMap [alternate]

Card (.membership-page)
└─ QueryBoundary(useMeQuery)
   ├─ Header / ProfileOptionsButton
   ├─ ScaledMembershipCredential (1573:1000 reference ID)
   │  └─ MembershipCredential(canonical1000)
   │     ├─ SVG waves / line art / map / palms
   │     ├─ Portrait / SignatureArea / BilingualBrand
   │     ├─ MemberName / FieldColumns / OfficialLogo
   │     └─ QR panel / SupportingCaptions
   ├─ CardActionRow → ViewQR / DownloadPDF / Wallet / Share
   ├─ MembershipDetails / RecognitionProgress / Milestones
   ├─ CardViewer [zoom / pinch / pan / Fit / Close]
   ├─ QrDialog [opaque backend token]
   ├─ WalletAvailabilityNotice
   └─ PublicShareDialog

Gallery (.civic-page)
├─ ScreenTitle
├─ FilterChips
├─ QueryBoundary(useGallery)
│  ├─ SampleNotice [conditional]
│  └─ AlbumGrid → AlbumCard × N
│     ├─ Photo(4:3) / PhotoCounter
│     └─ Caption(title / publication date)
└─ AlbumDialog [conditional]
   ├─ Title / Close / SampleTag
   ├─ Photo / Caption / CreditLinks
   ├─ Prev / Counter / Next
   └─ CoordinatorContactRoute

Profile (.civic-page)
└─ QueryBoundary
   ├─ h1
   ├─ IdentitySummaryCard
   │  └─ Portrait / MemberName / MemberId / StatusChips
   ├─ PrimaryMenu → Row × 5
   ├─ SettingsMenu → Row / AppearanceSwitch
   ├─ SignOutAction
   └─ VerificationSheet [conditional]
```

The small shared native-style pieces live in app/src/components/Civic.tsx. Route controllers remain in the existing screens and data hooks. CSS roles live in civic.css; token values live in tokens.css.

## React Native tree

Use a safe area provider and a tab navigator with equal destinations; a native stack belongs to each destination. Keep touch targets in layout rather than overlapping hitSlop.

```text
SafeAreaProvider
└─ CivicThemeProvider + QueryClientProvider + LocaleProvider
   └─ NavigationContainer
      └─ MemberTabs(custom solid-surface bar; centre Card/QR action)
         ├─ HomeStack
         ├─ EventsStack
         ├─ CardStack
         ├─ GalleryStack
         └─ ProfileStack

HomeScreen
└─ SafeAreaView(edges: top)
   └─ ScrollView(contentContainerStyle: gutter16)
      ├─ GreetingHeader(Text + LocationText + IconPressable44)
      ├─ SurfaceCard(accentWidth4)
      │  └─ Text(eyebrow) / Text(hero14) / VenueRow / CivicButton(visual40,target44)
      ├─ ActionGrid(View, flexWrap) → QuickAction(Pressable) × 4
      ├─ SectionHeader / EventPreview(Pressable)
      │  └─ CalendarBadge / EventSummary / StatusTag
      ├─ ServiceGrid / SearchField / ActivitySummary
      └─ MissionText

EventsScreen
└─ SafeAreaView
   └─ FlatList<Event>
      ├─ ListHeaderComponent(ScreenTitle / SearchField / SegmentedControl / HorizontalChipList)
      ├─ renderItem → EventCard
      │  └─ CalendarBadge / EventTitlePressable / BookmarkPressable44
      │     / VenueText(numberOfLines1) / TimeText / RsvpButton44 / StateMessage
      └─ ListEmptyComponent / ErrorRetry
Map variant → MapView + accessible selected-event preview

MemberCardScreen
└─ ScrollView
   ├─ ScreenTitle
   ├─ DigitalPass(View, aspectRatio1.586; minHeight and flexible content)
   │  └─ BilingualText / TierTag / Portrait48 / Name16 / Id11 / Geography11 / SecurityPill / QrPressable44
   ├─ ActionGrid(4 columns, 2 when narrow) → CardAction44 × 4
   ├─ PrintableIdAction / SeparatePrivatePdfExporter
   ├─ MembershipDetails
   └─ QrModal | WalletAvailabilitySheet | PublicSharePreviewModal
QrModal → native QR view + server expiry controller + unavailable/retry

GalleryScreen
└─ FlatList<Album>(numColumns2)
   ├─ ListHeaderComponent(ScreenTitle / HorizontalChipList / SampleNotice)
   ├─ AlbumPressable
   │  └─ Image(aspectRatio4/3) / CounterScrim / CaptionView
   └─ EmptyState / ErrorRetry
AlbumScreen → context header / FlatList<Photo> / Attribution
PhotoViewerModal → Image(contain) / Caption / Prev44 / Next44 / Close44 / ContactRoute

ProfileScreen
└─ ScrollView
   ├─ ScreenTitle / IdentitySummaryCard
   ├─ MenuGroup → MenuRow(Pressable,minHeight48) × 5
   ├─ SettingsGroup → MenuRow / SwitchPressable44
   ├─ SignOutButton
   └─ VerificationModal
```

Implementation rules: allowFontScaling stays true; no arbitrary maxFontSizeMultiplier; Tamil text uses Noto Sans Tamil and generous lineHeight. Use accessibilityRole, accessibilityLabel and accessibilityState(selected/disabled/busy) on pressables. Set accessibilityLanguage where supported. Image alt goes into accessibilityLabel. Use reduce-motion settings. Native sharing and Wallet adapters return real success/cancel/error. The native theme starter is in react-native/civic-theme.ts.

## Flutter tree

```text
ProviderScope / application state provider
└─ MaterialApp.router(theme: buildCivicTheme(), locale + delegates)
   └─ MemberShell
      └─ Scaffold
         ├─ body: StatefulNavigationShell / IndexedStack
         └─ CivicMedTechNavigation(destinations5,raised Card/QR,minHeight72 + safe inset)

HomeScreen
└─ SafeArea
   └─ CustomScrollView
      ├─ SliverPadding(gutter16)
      │  └─ Column
      │     ├─ GreetingHeader(Text + IconButton44)
      │     ├─ SurfaceCard(Border.left4)
      │     │  └─ TaskText / VenueRow / CivicAction(44 target,40 painted)
      │     ├─ LayoutBuilder → Wrap(2 columns,gap12) → QuickAction × 4
      │     ├─ SectionHeader / EventPreview(InkWell)
      │     ├─ ServiceGrid / SearchField / ActivitySummary
      │     └─ MissionText
      └─ loading/error/empty slivers as required

EventsScreen
└─ SafeArea → CustomScrollView
   ├─ SliverToBoxAdapter(ScreenTitle / TextField / SegmentedButtons / ChipScroll)
   └─ SliverList → EventCard
      └─ Row(CalendarBadge44x50, Expanded(Column))
         └─ TitleButton / Bookmark44 / Venue / Time / RSVP44 / StateMessage
Map variant → map widget / selected event card / list recovery action

MemberCardScreen
└─ SafeArea → SingleChildScrollView
   └─ Column
      ├─ ScreenTitle
      ├─ LayoutBuilder → DigitalPass(AspectRatio1.586 at default scale; intrinsic/minimum height at larger text)
      │  └─ BrandRow / IdentityRow(CircleAvatar48,Expanded(Name/ID/Hierarchy))
      │     / SecurityRow(SecurityPill,QR entry44)
      ├─ Wrap → CardAction44 × 4
      ├─ PrintableIdAction / SeparatePrivatePdfExporter
   ├─ MembershipDetails
      └─ showModalBottomSheet → QR / Wallet availability / Share preview

GalleryScreen
└─ SafeArea → CustomScrollView
   ├─ SliverToBoxAdapter(ScreenTitle / FilterScroll / SampleNotice)
   └─ SliverGrid(delegate2 columns,gap12) → AlbumCard
      └─ Column(AspectRatio4/3(Image.network or asset + scrim),Caption)
At increased text scale: use content-sized rows/Wrap or one column, not a fixed childAspectRatio
AlbumScreen / PhotoViewer → Dialog or dedicated route with focus and Back recovery

ProfileScreen
└─ SafeArea → SingleChildScrollView
   └─ Column
      ├─ ScreenTitle / IdentitySummaryCard
      ├─ SurfaceCard → MenuRow × 5
      ├─ SettingsGroup → MenuRow / Switch with44 target
      └─ SignOut / VerificationSheet
```

Implementation rules: use MediaQuery.textScaler, retain system text settings, use ThemeExtensions for semantic backgrounds/foregrounds and pass colors, and use Semantics for names, state and live messages. Use MaterialTapTargetSize.padded and minimumSize44. Keep provider-managed requests outside widgets. Flexible names and Tamil labels must wrap. The starter theme is in flutter/civic_theme.dart.

## Data/API migration

Reuse existing cookie-authenticated HTTP contracts for the PWA. A native client needs an explicitly supported secure session contract; do not assume web cookies can be copied into native storage. Backend APIs own authorization and scope.

The implemented gallery API is read-only and serves published public assets. The member activation field is optional in the current PWA adapter and maps absent values to unknown in a native adapter. Wallet services and photo removal receipts remain separate integration work. Native QR tooling must render server tokens faithfully and keep its quiet zone.

## Native layout contracts

| Component | Flutter | React Native | Shared acceptance |
| --- | --- | --- | --- |
| Card | DecoratedBox + Padding | View with border/shadow | 12 radius, 12 padding, white, 1px border |
| Next step | Border(left:4) + Column | View with borderLeftWidth:4 | 14px title; 44 target around 40 visual button |
| Quick action | InkWell + Column | Pressable + View | 36 well; 13 label; 10 caption; entire card target |
| Pass | LayoutBuilder + constrained minimum height | View with minimum height from measured width | Width / 1.586 at default type; allow growth |
| Photo album | AspectRatio(4/3) + caption | Image with aspectRatio:4/3 + caption | Keep caption outside image and full height at large type |
| Menu | constrained minHeight48 + Row/Expanded | Pressable minHeight48 + flexShrink | 20px icons; 13px label; no text clipping |
| Centre QR | Custom navigation item + Semantics | Custom tabBar Pressable | One Card destination, explicit QR affordance, no extra sixth tab |

Tier mapping is recognition only: Volunteer→0, Diamond→1, Gold→2, Platinum→3. The governance diagram's Tier 1–5 remains separate; the current API has no assigned role field. Neither adapter may authorize a staff action from recognition, referrals or a rendered badge. Native themes should be validated in their actual SDKs before use; no native application compilation is claimed here.

## Current Card override · 11 October user correction

The user restored the detailed ID design after reviewing the wallet pass. The native DigitalPass tree above is now an inactive alternative. For the current Card destination, use these primary trees instead:

```text
React Native MemberCardScreen
└─ ScrollView
   ├─ ScreenTitle
   ├─ ScaledCredential(View with measured width and 1573:1000 bounds)
   │  └─ CredentialComposition(canonical1000; SVG art + native text/images + QR)
   ├─ CardActionGrid44
   ├─ ReadableMembershipDetails / RecognitionProgress / Milestones
   └─ CredentialViewerModal | QrModal | WalletNotice | SharePreview

Flutter MemberCardScreen
└─ SafeArea → SingleChildScrollView → Column
   ├─ ScreenTitle
   ├─ LayoutBuilder → AspectRatio(1573/1000)
   │  └─ FittedBox → SizedBox(canonical1000×635.728) → Stack
   │     └─ SVG art / portrait / typography / fields / logo / QR
   ├─ CardActionWrap44
   ├─ ReadableMembershipDetails / RecognitionProgress / Milestones
   └─ InteractiveViewerDialog | QrDialog | WalletNotice | SharePreview
```

Keep the full member details readable outside the scaled credential. Use an independent canonical exporter rather than distorting a large-type layout into a PDF. These are implementation mappings; the running production source is React/TypeScript.
