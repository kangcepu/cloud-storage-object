# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Primary users (inferred from the implemented roles and workflows): storage administrators who configure MinIO, manage users, buckets, and access policy.
- Secondary users (inferred): internal team members who browse, preview, upload, organize, and download files from the buckets assigned to them.

## Product Purpose

Cloudspace is a private object-storage workspace for operating MinIO/S3-compatible storage through a controlled web and mobile API. Success means users can find, preview, transfer, and govern files quickly without needing direct access to the underlying storage console.

## Positioning

The product combines per-bucket user permissions, web and mobile access, operational dashboards, audit logging, and on-demand preview generation for camera RAW files in one internally managed storage console.

## Operating Context

- Superadmins configure object storage, create buckets and users, assign permissions, inspect usage, and maintain branding.
- Team members work primarily in Drive: navigating folder prefixes, uploading files or folders, previewing media and documents, and copying, moving, renaming, downloading, or deleting permitted objects.
- The interface is an authenticated operations surface used repeatedly on desktop, with responsive mobile-web support.
- MySQL is the control plane; MinIO/S3 is the object data plane; local storage handles temporary uploads, avatars, branding, and RAW conversion work.

## Capabilities and Constraints

- NestJS backend and Next.js App Router frontend.
- Session and CSRF authentication for web; bearer tokens for the compatibility mobile API.
- Roles are `superadmin` and `user`, with view/upload/rename/delete/download permission per bucket.
- Proxy and direct signed-URL delivery modes are supported.
- Camera RAW previews depend on ImageMagick/LibRaw.
- Product data and behavior must remain compatible with the existing REST API and database.
- Performance work must preserve permissions and must not expose private storage objects through public caching.

## Brand Commitments

- The current product name is Cloudspace.
- The user explicitly requires an enterprise-grade interface and rejects the current visual treatment as too ordinary.
- Exact corporate palette, logo usage, and formal brand guidelines remain open decisions.

## Evidence on Hand

- Existing production-oriented application code under `src/` and `frontend/`.
- Existing operational data and a working MySQL/MinIO integration.
- No supplied corporate identity guide, customer claims, marketing proof, or approved visual references. Future work must not fabricate them.

## Product Principles

- Make large file collections feel fast through progressive loading, stable layouts, and immediate feedback.
- Keep permissions, object state, and destructive consequences explicit.
- Optimize frequent storage operations for scanability and minimal interaction cost.
- Treat security and operational truth as more important than decorative novelty.
- Use visual distinction to improve hierarchy and confidence, not to distract from the task.

## Accessibility & Inclusion

No product-specific standard was supplied. The web interface should preserve keyboard navigation, visible focus, semantic controls, readable contrast, reduced-motion support, and responsive access as a production baseline.
