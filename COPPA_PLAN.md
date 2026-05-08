# SafeVision COPPA Compliance Plan

**Prepared:** February 18, 2026

This document outlines SafeVision's compliance strategy for the Children's Online Privacy Protection Act (COPPA) and related regulations for apps directed at children.

---

## 1. COPPA Applicability

SafeVision is a **child-directed application**. It is operated by a parent/guardian for the purpose of curating video content for children. COPPA applies because:

- The App is designed for and marketed toward children under 13
- Child Users are the primary audience for the video viewing experience
- The App will be listed in the Kids category on the Apple App Store

**Regulatory references:**
- 16 CFR Part 312 (COPPA Rule)
- FTC COPPA FAQ and enforcement guidance
- Apple App Store Review Guidelines §1.3 (Kids Category)
- Google Play Families Policy (if Android version is pursued)

---

## 2. Current Compliance Status

### What we already do right

| COPPA Requirement | SafeVision Status |
|-------------------|-------------------|
| No collection of personal information from children without verifiable parental consent | **Compliant.** No personal information is collected from children. Profiles use parent-chosen nicknames only. |
| No behavioral advertising to children | **Compliant.** No ads of any kind. |
| No third-party tracking SDKs | **Compliant.** No analytics, no ad networks, no social SDKs. |
| Parental control over child's experience | **Compliant.** PIN-protected admin controls all content and profiles. |
| Ability to delete child's data | **Compliant.** Profile deletion cascades to all watch progress. |
| Data minimization | **Compliant.** Only profile name, color, and watch progress are stored. |
| Reasonable data security | **Compliant.** Bcrypt hashing, HTTPS, parameterized queries, HTTP-only cookies. |

### Gaps to address before App Store submission

| Requirement | Current State | Action Needed |
|-------------|---------------|---------------|
| Published privacy policy | Created but not hosted publicly | Host at a public URL and link from App |
| Contact information for COPPA inquiries | Placeholder in privacy policy | Add real email and mailing address |
| Apple Kids Category age band declaration | Not declared | Declare age band in App Store Connect |
| Parental gate on all exits from App | YouTube embeds may show external links | Disable/intercept external navigation |
| No links to external websites accessible by children | Channel URLs could theoretically be clicked | Audit and sanitize all outbound links |
| YouTube privacy-enhanced mode | Not explicitly enforced | Enable `youtube-nocookie.com` domain for embeds |

---

## 3. Action Items

### 3.1 Privacy Policy Hosting (Required)

**Priority: HIGH — Blocks App Store submission**

- [ ] Register a domain or use a subdomain (e.g., `privacy.safevision.app`)
- [ ] Host the privacy policy at a stable, publicly accessible URL
- [ ] Link to the privacy policy from:
  - The App (footer or settings screen)
  - App Store Connect metadata
  - The App's website/landing page
- [ ] Ensure the policy is accessible without login or PIN

### 3.2 Contact Information (Required)

**Priority: HIGH — Blocks COPPA compliance**

- [ ] Set up a dedicated email for privacy inquiries (e.g., `privacy@safevision.app`)
- [ ] Add a physical mailing address to the privacy policy (can be a registered agent)
- [ ] Establish a process to respond to parental inquiries within 30 days

### 3.3 Apple Kids Category Setup (Required)

**Priority: HIGH — Blocks App Store submission**

- [ ] Select an age band in App Store Connect:
  - **Ages 5 and Under** — Most restrictive, simplest review
  - **Ages 6-8** — Moderate restrictions
  - **Ages 9-11** — Less restrictive
  - **All Ages** — Requires "Made for Kids" compliance across all bands
  - **Recommendation:** Declare **Ages 5 and Under** or **Ages 6-8** depending on content
- [ ] Confirm all content is appropriate for the selected age band
- [ ] Verify no links to external apps/websites are accessible by children

### 3.4 YouTube Embed Hardening (Required)

**Priority: HIGH — Kids category compliance**

Changes to `src/components/video/video-player.tsx`:

- [ ] Use `youtube-nocookie.com` instead of `youtube.com` for embeds (privacy-enhanced mode)
- [ ] Set player parameters to suppress external navigation:
  - `rel=0` — Don't show related videos from other channels
  - `modestbranding=1` — Minimize YouTube branding
  - `disablekb=0` — Keep keyboard controls for accessibility
  - `fs=1` — Allow fullscreen (expected by users)
- [ ] Intercept any navigation attempts away from the App (Capacitor: use `App.addListener('appUrlOpen')`)
- [ ] Disable YouTube end-screen annotations that link externally

### 3.5 External Link Audit (Required)

**Priority: MEDIUM**

- [ ] Audit all components for `<a>` tags or `<Link>` elements that could navigate outside the App
- [ ] Ensure the admin section (behind PIN gate) is the only area where external links exist
- [ ] Add a parental gate (PIN re-entry) before any action that would leave the App
- [ ] In the Capacitor build, intercept `window.open` and external URL schemes

### 3.6 Parental Gate Verification (Required)

**Priority: MEDIUM**

Apple requires a "parental gate" — a mechanism that prevents children from accessing certain features. The PIN system serves this role.

Verify PIN protection covers:
- [ ] Adding/removing channels
- [ ] Creating/deleting profiles
- [ ] Hiding/unhiding videos
- [ ] Accessing any settings
- [ ] Any future in-app purchases
- [ ] Any link that exits the App
- [ ] The admin page is inaccessible without PIN (already implemented)

### 3.7 Data Flow Documentation (Recommended)

**Priority: LOW — Best practice for FTC compliance**

- [ ] Create a data flow diagram showing all data paths
- [ ] Document what data goes to Neon (database), Vercel (hosting), YouTube (playback)
- [ ] Maintain this document for internal records and potential FTC inquiries
- [ ] Review and update quarterly

---

## 4. COPPA-Safe Architecture

### Data that touches our servers

```
Child Device → Vercel (API) → Neon (Database)
         ↓
   YouTube CDN (video stream only, no user data sent)
```

### What is stored per child profile

```
profiles table:
  - id (auto-generated integer)
  - name (parent-chosen, could be pseudonym)
  - avatarColor (hex color code)
  - createdAt (timestamp)

video_progress table:
  - profileId (links to profile)
  - youtubeVideoId (public YouTube ID)
  - progressSeconds (integer)
  - updatedAt (timestamp)
```

**None of this constitutes "personal information" under COPPA** as defined in 16 CFR §312.2, provided:
- Profile names are not full legal names (recommend nicknames in the UI)
- No persistent identifiers are used for behavioral tracking
- No photos, audio, video, or geolocation of the child is collected

### What is NOT stored

- IP addresses (not logged by our application code; Vercel may log at infrastructure level)
- Device identifiers
- Cookies that track children (admin cookie is for parent auth only)
- Any form of advertising identifier

---

## 5. Apple App Review Preparation

### App Store Connect Settings

| Field | Value |
|-------|-------|
| Primary Category | Entertainment |
| Secondary Category | Education |
| Age Rating | Select appropriate age band |
| Made for Kids | Yes |
| Privacy Policy URL | [public URL] |
| App Privacy (data types) | See Section 5.1 below |

### 5.1 App Privacy Label Answers

When completing the Apple App Privacy questionnaire:

**Do you collect data?** → Yes (minimal)

**Data types collected:**

| Category | Data Type | Collected? | Linked to Identity? | Used for Tracking? |
|----------|-----------|------------|---------------------|--------------------|
| Identifiers | User ID | No | — | — |
| Usage Data | Product Interaction | Yes (watch progress) | No | No |
| Contact Info | Name, Email, etc. | No | — | — |
| Location | Precise/Coarse | No | — | — |
| Diagnostics | Crash Data | No | — | — |
| Other | Profile nicknames | Yes | No | No |

**Purposes:**
- App Functionality (only)

### 5.2 Reviewer Notes for Apple

Include in App Store Connect reviewer notes:

> SafeVision is a parent-managed video curation app for children. All content is selected and approved by a parent/guardian who manages the app via a PIN-protected admin panel.
>
> To test admin features: Set a 4-digit PIN on first launch. This PIN protects all administrative functions including channel management, profile creation, and video visibility controls.
>
> The app does not collect personal information from children. Child profiles use parent-assigned nicknames and track only video watch progress (seconds watched) for resume functionality.
>
> No advertisements, analytics SDKs, or third-party tracking tools are used.
>
> YouTube content is displayed via the YouTube IFrame Player API in privacy-enhanced mode. Children cannot navigate outside the curated content.

---

## 6. Ongoing Compliance

### Quarterly Review Checklist

- [ ] Review privacy policy for accuracy
- [ ] Verify no new third-party SDKs have been added
- [ ] Confirm all admin functions remain behind PIN gate
- [ ] Test that children cannot access external links
- [ ] Review YouTube embed parameters for changes
- [ ] Check FTC COPPA enforcement actions for new guidance
- [ ] Verify data deletion cascade still works correctly
- [ ] Review Vercel and Neon privacy policies for changes

### If adding new features, ask:

1. Does this feature collect new data from or about children?
2. Does this feature introduce a third-party SDK?
3. Does this feature allow children to communicate with others?
4. Does this feature allow children to share personal information?
5. Does this feature use persistent identifiers for non-support purposes?

**If the answer to any of these is "yes," reassess COPPA compliance before shipping.**

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| YouTube embed shows external links to kids | Medium | High (App Store rejection) | Intercept navigation, use nocookie domain, suppress end screens |
| Profile name contains real full name | Medium | Low (not transmitted externally) | UI hint: "Enter a nickname" |
| Vercel logs contain IP addresses | High | Low (infrastructure, not app-level) | Document in privacy policy, standard hosting behavior |
| Future developer adds analytics SDK | Low | High (COPPA violation) | Enforce review checklist, document prohibition |
| FTC enforcement action | Very Low | High | Maintain compliance documentation, respond promptly to inquiries |

---

## 8. Legal Disclaimer

This plan is a technical compliance guide, not legal advice. Consult with a qualified attorney specializing in children's privacy law before App Store submission to verify compliance with COPPA, state privacy laws (CCPA, etc.), and international regulations (GDPR) as applicable to your distribution.
