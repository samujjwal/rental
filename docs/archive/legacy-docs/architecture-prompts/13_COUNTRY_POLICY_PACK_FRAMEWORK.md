# Prompt 13: Country Policy Pack Framework

## Executive Summary
This document defines the structural backbone of the "Configuration-First Behavior" principle. A Country Policy Pack is an immutable, versioned, code-agnostic artifact that dictates exactly how the Global Rental Ecosystem specializes itself when executing operations within a specific geopolitical boundary. 

It handles Tax rules, Compliance checks, Identity verifications, and Address formatting overrides across Nepal, India, Bangladesh, Sri Lanka, and the US.

## 1. The Policy Pack Anatomy

A Policy Pack is fundamentally a directory of YAML files, validated against strict internal JSON Schemas (via standard tools like Ajv), published to an AWS S3/GCS bucket, and ingested by the core microservices.

### Directory Structure Example:
```text
/policy-packs/
  /NE/ (Nepal)
    general.yaml   (Currency: NPR, Locale: ne-NP, Allow_Fractional_Coins: true)
    identity.yaml  (Requires: National_ID OR Citizenship_Card)
    tax.yaml       (VAT 13% Platform level)
  /IN/ (India)...
  /BD/ (Bangladesh)...
  /US/ (United States)...
```

## 2. Defining Regional Constructs

### A. Identity Verification (KYC/AML)
*   **India (`IN/identity.yaml`):** Requires `Aadhaar_Integration_Enabled: true` for Domestic hosts. 
*   **United States (`US/identity.yaml`):** Implements `Background_Check_SSN: true` by polling third-party API proxies defined in the config. Requires `W-9` collection if payout exceeds $600.

### B. Address & Formatting Models
*   **Nepal (`NE/general.yaml`):** Overrides standard "State/Zip" structures to enforce "Province/District/Municipality/Ward" dropdowns. Disables Zip codes entirely for UI validation.
*   **Bangladesh (`BD/general.yaml`):** Defines specialized Unicode formatting constraints for right-to-left UI rendering when rendering Bengali text blocks in generated PDFs.

### C. Compliance & Restrictions
*   **Sri Lanka (`LK/compliance.yaml`):** Enforces a `maximum_foreign_currency_withdrawal` rule directly overriding the core payout frequency settings.
*   **United States (`US/compliance.yaml`/:** Sub-maps constraints down to the state (e.g., `New_York: Requires_Registration_Number_in_Listing_Title`), acting as a blocking check before a specific API call (`PublishListing`) can execute.

## 3. The Injection & Inheritance Model

1. **Global Base Defaults:** The platform maintains a `base.yaml` which defines the most restrictive, safe defaults globally.
2. **Country Merge (Deep Merge):** When a session initializes or an API receives a request, the Context extracts the locale/target country. It fetches `US.yaml` and executes a Deep Merge, overriding Base properties.
3. **Subnational Merge:** If the transaction specifically involves `NY`, it pulls `US/NY.yaml` and does a final overriding merge. 
4. **Validation/Evaluation Loop:** The completed JSON object is loaded into the active state context, driving IF/THEN statements within the generic Global Core components.

---

## Architecture Observations
- Uses a **Schema Registry** pattern. If an engineer attempts to deploy a Policy Pack with a typo (e.g., `ta_rate` instead of `tax_rate`), the CI/CD pipeline immediately fails the build using pure static analysis. The core code never crashes due to bad regional configuration.
- Separation of concerns ensures developers build generic capabilities (e.g., `CollectSecondaryID_Flow`) while Operations/Legal teams simply configure the exact Triggers via the Pack.

## Extensibility Assessment
- **Ultimate Extensibility:** This *is* the extensibility layer. Spinning up a new focus group like "Southeast Asia" requires zero code. South Asia is purely defined as an organizational folder of `IN`, `NP`, `BD`, `LK` packs rolled out sequentially.

## Critical Findings
- **Severity: Critical** - **Dependency Graphing between Packs.** Policy variables often depend on external third-party Integrations (Prompt 11 Plugins). If the `IN` pack requires the `Razorpay` plugin, but the `Razorpay` plugin is offline, the region fails. The Expansion Planner (Prompt 5) must pre-validate this matrix.
- **Severity: Medium** - **Configuration Sprawl.** As the platform scales to 190+ countries, manual management of thousands of YAML files leads to immense cognitive load. A specialized internal UI (Headless CMS) must be built to generate and validate these generic packs for non-technical Legal personnel.