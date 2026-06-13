/**
 * Footer page content. Written to be accurate to what AIGLONIX actually does
 * (no invented certifications): a demonstration prototype in public beta.
 * English only (the UI is English-first for now).
 */

export const LEGAL_SLUGS = [
  "privacy",
  "terms",
  "acceptable-use",
  "cookies",
  "security",
  "responsible-disclosure",
  "compliance",
  "status",
] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export interface LegalSection {
  heading: string;
  body: string[];
}
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}

const UPDATED = "13 June 2026";

const BETA_NOTE =
  "AIGLONIX is in public beta. It is provided for demonstration and evaluation, evolves continuously with advances in technology and lessons from the modern battlefield, and is not an accredited, classified, or operational system.";

export const LEGAL: Record<LegalSlug, LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    updated: UPDATED,
    intro:
      "This policy explains what AIGLONIX collects, why, and the choices you have. We practise data minimisation: we collect only what the platform needs to function.",
    sections: [
      {
        heading: "Who we are",
        body: [
          "AIGLONIX is a collaborative situational-awareness prototype built for the European Defense Tech Hackathon (Paris, 2026). It is operated as a beta demonstration. Contact for privacy matters: privacy@aiglonix.app.",
        ],
      },
      {
        heading: "What we collect",
        body: [
          "Account data: your email address and a callsign, managed by our authentication provider (Supabase Auth). Passwords are salted and hashed by the provider; we never see them.",
          "Team data: the team you create or join, and team invite codes.",
          "Operational data you submit: jamming reports, drone detections, manual alerts, voice/text position markers and short text messages - including their coordinates and timestamps.",
          "Detection images: photos you choose to publish are re-encoded on your device before upload, which strips EXIF metadata (including embedded GPS). They are stored in a private bucket and served only through short-lived signed URLs.",
          "Technical data: minimal request metadata and rate-limiting counters. We do not use advertising or third-party tracking cookies.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "To provide the service: authenticate you, scope data to your team, and share reports/alerts in real time with your teammates. We do not sell your data and do not use it for advertising.",
        ],
      },
      {
        heading: "Processors and storage",
        body: [
          "Data is stored in a managed PostgreSQL database with row-level security (Supabase), with file storage for images and edge hosting (Vercel). Optional features may call external services you configure (speech-to-text, language models, geocoding); these receive only the minimum needed (e.g. a transcript or a place name).",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "Subject to applicable law (including the EU GDPR), you may request access, rectification, erasure, restriction, and portability of your personal data, and object to certain processing. Email privacy@aiglonix.app. Because this is a beta, retention is limited and demonstration data may be reset.",
        ],
      },
      { heading: "Beta status", body: [BETA_NOTE] },
    ],
  },
  terms: {
    title: "Terms of Use",
    updated: UPDATED,
    intro:
      "By using AIGLONIX you agree to these terms. They are deliberately short and plain.",
    sections: [
      {
        heading: "The service",
        body: [
          "AIGLONIX is a beta prototype provided \"as is\" and \"as available\", without warranties of any kind. It is not certified for safety-of-life, operational, or classified use, and must not be relied upon as a sole source for any decision with real-world consequences.",
        ],
      },
      {
        heading: "Your responsibilities",
        body: [
          "You are responsible for your account, for the lawfulness of the data you submit, and for using the platform only as permitted by the Acceptable Use Policy and by all laws that apply to you.",
        ],
      },
      {
        heading: "Availability and changes",
        body: [
          "Features may change, break, or be removed at any time. Demonstration data may be reset without notice. We may suspend access to protect the service or its users.",
        ],
      },
      {
        heading: "Liability",
        body: [
          "To the maximum extent permitted by law, AIGLONIX and its contributors are not liable for any indirect or consequential loss arising from use of this beta. Nothing here excludes liability that cannot be excluded by law.",
        ],
      },
      { heading: "Beta status", body: [BETA_NOTE] },
    ],
  },
  "acceptable-use": {
    title: "Acceptable Use Policy",
    updated: UPDATED,
    intro:
      "AIGLONIX is a defensive situational-awareness tool. Use it lawfully and responsibly.",
    sections: [
      {
        heading: "Permitted use",
        body: [
          "Authorised evaluation, training, exercises, and defensive coordination by lawful operators, in compliance with applicable law and rules of engagement.",
        ],
      },
      {
        heading: "Prohibited use",
        body: [
          "No unlawful activity, including targeting of persons or property in violation of applicable law or international humanitarian law.",
          "No uploading of content you have no right to share, no personal data of uninvolved civilians, and no classified material - this is an UNCLASSIFIED demonstration system.",
          "No attempts to break authentication, exceed rate limits, scrape other teams' data, or otherwise compromise the platform or its users.",
        ],
      },
      {
        heading: "Enforcement",
        body: [
          "We may suspend or remove access and content that violates this policy. Report abuse to abuse@aiglonix.app.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: UPDATED,
    intro:
      "AIGLONIX uses the minimum cookies required to work. No advertising or cross-site tracking.",
    sections: [
      {
        heading: "What we set",
        body: [
          "Strictly necessary cookies only: an httpOnly session cookie from our authentication provider that keeps you signed in. It is not readable by JavaScript and is not used for tracking.",
        ],
      },
      {
        heading: "What we do not set",
        body: [
          "No advertising, analytics, or third-party tracking cookies. Some browser extensions you install (e.g. wallets) may set their own storage - that is outside AIGLONIX.",
        ],
      },
      {
        heading: "Managing cookies",
        body: [
          "You can clear cookies in your browser at any time; doing so signs you out. Blocking the session cookie prevents sign-in.",
        ],
      },
    ],
  },
  security: {
    title: "Security Policy",
    updated: UPDATED,
    intro:
      "Security is built into AIGLONIX by design. This page summarises our controls and how to report issues.",
    sections: [
      {
        heading: "Controls in place",
        body: [
          "Row-level security on every table, scoping data to your team. Server-side session checks and Zod validation on all API routes.",
          "Sessions in httpOnly cookies (never in localStorage). Hardened HTTP headers: strict Content-Security-Policy, HSTS preload, X-Frame-Options DENY, nosniff, Permissions-Policy.",
          "Detection images: magic-byte type checks, on-device re-encode that strips EXIF/GPS, private storage bucket, and short-lived signed URLs only.",
          "API connector keys are stored only as SHA-256 hashes; the key is shown once. Per-user and per-key rate limiting. Service-role keys are server-only and never reach the browser.",
        ],
      },
      {
        heading: "Honest limitations",
        body: [
          "This is a beta. It has not undergone independent penetration testing or accreditation. Do not process classified or safety-critical data on it.",
        ],
      },
      {
        heading: "Reporting",
        body: [
          "See our Responsible Disclosure page and /.well-known/security.txt. Report vulnerabilities to security@aiglonix.app.",
        ],
      },
    ],
  },
  "responsible-disclosure": {
    title: "Responsible Disclosure",
    updated: UPDATED,
    intro:
      "We welcome reports from security researchers and will work with you in good faith.",
    sections: [
      {
        heading: "How to report",
        body: [
          "Email security@aiglonix.app with steps to reproduce. Our machine-readable policy is at /.well-known/security.txt. Please give us reasonable time to remediate before public disclosure.",
        ],
      },
      {
        heading: "Safe harbour",
        body: [
          "If you make a good-faith effort to comply with this policy, avoid privacy violations and service disruption, and only access data necessary to demonstrate an issue, we will not pursue action against you for your research.",
        ],
      },
      {
        heading: "Scope",
        body: [
          "In scope: the AIGLONIX web application and its APIs. Out of scope: third-party services (Supabase, Vercel, model and geocoding providers) - report those to the respective vendors.",
        ],
      },
    ],
  },
  compliance: {
    title: "Compliance & Export",
    updated: UPDATED,
    intro:
      "An honest statement of AIGLONIX's regulatory posture. We describe what we align with - we do not claim certifications we do not hold.",
    sections: [
      {
        heading: "Classification",
        body: [
          "AIGLONIX is UNCLASSIFIED and provided for demonstration only. Do not enter classified information.",
        ],
      },
      {
        heading: "NATO interoperability (by design, not accredited)",
        body: [
          "The platform is designed around interoperability principles - open, structured event data and standard web protocols - so it can integrate with existing systems via its connector API. It is not a NATO-accredited or certified system.",
        ],
      },
      {
        heading: "STANAG alignment (roadmap)",
        body: [
          "Aligning data formats and symbology with relevant STANAG concepts (e.g. standardised messaging and tactical symbology) is on the roadmap. It is not yet implemented or certified.",
        ],
      },
      {
        heading: "Data protection (GDPR)",
        body: [
          "We apply GDPR principles: lawful basis, data minimisation, purpose limitation, and data-subject rights. See the Privacy Policy.",
        ],
      },
      {
        heading: "Export control (dual-use)",
        body: [
          "Defence-related situational-awareness software may be subject to export-control regimes (e.g. the EU Dual-Use Regulation, US ITAR/EAR). You are responsible for ensuring your use, deployment, and any transfer complies with the laws that apply to you. AIGLONIX makes no representation that it is licensed for export to any particular destination or end-user.",
        ],
      },
      { heading: "Beta status", body: [BETA_NOTE] },
    ],
  },
  status: {
    title: "System Status",
    updated: UPDATED,
    intro:
      "AIGLONIX is a beta running on managed cloud infrastructure. We offer no uptime SLA.",
    sections: [
      {
        heading: "Live check",
        body: [
          "A lightweight health endpoint is available at /api/health. It reports whether the deployment is live and which backend integrations are configured (booleans only - no secrets).",
        ],
      },
      {
        heading: "Dependencies",
        body: [
          "Availability depends on third-party providers (database/auth/storage, edge hosting, and any optional model/geocoding services you configure). Incidents on those services can affect AIGLONIX.",
        ],
      },
      {
        heading: "Beta expectations",
        body: [
          "Expect occasional downtime, breaking changes, and data resets during the beta. " +
            BETA_NOTE,
        ],
      },
    ],
  },
};
