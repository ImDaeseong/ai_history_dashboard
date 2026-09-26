# AI History Dashboard Design

Updated: 2026-09-27

## Purpose

Turn local AI-session, Git, and QA evidence into a static work-history dashboard without publishing private raw records.

## Stakeholders, concerns, and scenarios

- User: understand work patterns and verification history without exposing raw prompts.
- Maintainer: regenerate the dashboard deterministically as source formats evolve.
- Reviewer: interpret metrics as observations rather than productivity scores.
- Representative scenario: read configured local sources, sanitize and aggregate them, generate private/public views, then perform a privacy review before publication.

## Boundaries

- Reads explicitly configured local session, repository, and QA state sources.
- Writes generated HTML and local private dashboard data.
- Private dashboards, raw prompts, paths, and tokens must not enter the public site.
- Metrics describe observable activity and verification evidence; they are not productivity scores.

## Main components

- `scripts/analyze-private.bat`: local private analysis entry point.
- `dashboard.config.example.json`: explicit source and retention configuration.
- `private-data/`: ignored local inputs and generated private output.
- `index.html`: public static dashboard.

## Key decisions and tradeoffs

- Require explicit source configuration instead of scanning arbitrary locations. This reduces accidental disclosure but adds setup work.
- Publish aggregates rather than raw records. This protects privacy but limits forensic detail in the public view.

## Verification and human review

Run the repository validation and regeneration scripts documented in README. Before publishing, a human must review excerpts, paths, identifiers, and source scope for privacy and interpretation risk.

## Evidence basis and limits

The stakeholder/view structure follows [IEEE 1016-2009](https://standards.ieee.org/ieee/1016/4502/) and [Kruchten's 4+1 paper](https://www.cs.ubc.ca/~gregor/teaching/papers/4%2B1view-architecture.pdf); module boundaries follow [Parnas (1972)](https://doi.org/10.1145/361598.361623); quality and security gates are informed by [ISO/IEC 25010:2023](https://www.iso.org/standard/78176.html) and [NIST SSDF 1.1](https://doi.org/10.6028/NIST.SP.800-218). No formal conformance claim is made.
