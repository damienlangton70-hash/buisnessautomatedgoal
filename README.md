# Autonomous Commerce Engine

A separate, cloud-oriented autonomous digital-commerce experimentation system. This repository is **not Lanhorz** and must remain isolated from Lanhorz code, credentials, data, branding, and infrastructure.

## Objective

Target: £10,000 gross revenue within 90 days. This is an operating target, not a guaranteed outcome.

The engine is designed around a closed loop:

**research → validate → build → QA → publish → measure → optimise → expand**

Weak experiments are killed by measurable rules. Winners are expanded into variants and adjacent products.

## Current status

Phase 1 is underway: deterministic core decision logic and tests are in place. Cloud workers, persistent data, provider adapters, product generation, publishing integrations, and the phone dashboard are intentionally separate layers so failures cannot silently compromise the decision engine.

## Security boundaries

- Never commit API keys, payment credentials, session tokens, or personal secrets.
- No autonomous creation of financial accounts.
- No autonomous movement of money.
- No deceptive reviews, impersonation, spam, or artificial engagement.
- Any external service requiring identity, KYC, payment authorisation, or legal acceptance requires the owner's explicit action.
- Autonomous spending must be disabled by default.

## Architecture

```text
Phone PWA
    ↓
Control API
    ↓
Decision Engine
 ┌──┼───────────┐
 ↓  ↓           ↓
Research  Product Factory  Analytics
 └──┬───────────┘           │
    ↓                       ↓
 Publishing  ←──────  Feedback Loop
```

## Development principle

AI models are workers, not the source of truth. They provide research, drafts, classifications, and transformations. Deterministic code owns thresholds, experiment state, safety boundaries, and financial calculations.
