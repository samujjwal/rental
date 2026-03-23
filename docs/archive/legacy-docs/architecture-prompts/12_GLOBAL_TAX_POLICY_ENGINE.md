# Prompt 12: Global Tax Policy Engine

## Executive Summary
This document outlines the Global Tax Policy Engine. Taxation in the local rental space (especially short-term rentals) is notoriously fragmented, often involving cascading percentages at the National, State/Provincial, and Municipal levels. This engine abstracts that complexity, dynamically calculating required remittances purely from externalized configuration files.

## 1. Top-Down Policy Architecture

The Tax Engine is completely detached from product logic. At Checkout (Prompt 11), the backend sends a "Tax Inquiry" payload containing:
*   `Origin`: Host Address (Coordinates & Region strings)
*   `Destination`: Renter billing address
*   `Asset Type`: (e.g., Short Term Lease, Car Rental, Yacht)
*   `Monetary Value`: Base Price + Fees

The engine processes this payload against the currently active **Country Policy Pack** (Prompt 13).

## 2. Tax Policy Schema & Overrides

The system is configured via strictly typed JSON/YAML matrices that define the cascading tax rules. It follows an overriding hierarchy: `Country -> Subnational -> Municipal -> Hyperlocal Zone`.

### Example Tax Policy Definition:
```yaml
jurisdiction: "US-CA-LA-LOS_ANGELES"
tax_line_items:
  - type: "STATE_SALES_TAX"
    rate: 0.0725
    applied_to: ["BASE_PRICE", "CLEANING_FEE"]
    remitted_by: "PLATFORM" # The platform collects and pays the state
  - type: "MUNICIPAL_TRANSIENT_OCCUPANCY_TAX" # (TOT)
    rate: 0.14
    applied_to: ["BASE_PRICE"]
    remitted_by: "HOST" # The platform quotes it, but pays the host to remit
```

### Supported Complexities:
*   **Variable Tax Bases:** Defining exactly which fees are taxable (e.g., in some states Cleaning Fees are taxed, in others they are not).
*   **Duration-Based Exemptions:** Automatically dropping the "Tourism Levy" if the stay duration exceeds 30 days (transitioning from Short-Term to Long-Term residency logic).
*   **Reverse Charge Mechanisms:** B2B bookings where the Host is VAT Registered and the Renter assumes the UI tax liability (common in the EU).

## 3. Rule Evaluation Pipeline (The Fast Path)

1. **Resolution:** Extract precise geopolitical boundaries from the Asset's `Location` coordinates.
2. **Fetch Active Matrix:** Retrieve the version of the tax policy strictly active for the `Transaction Timestamp` (handling overlapping periods where a municipal tax increases from 10% to 12% precisely at midnight on Q1).
3. **Calculation:** Sequentially apply rule calculations.
4. **Append Line Items:** Return a structured array of new `LedgerEntry` intents (e.g., Platform VAT, Host TOT) to the Checkout Orchestrator.

---

## Architecture Observations
- Uses a **Versioned Historical Ledger**. Tax laws change. If a Renter modifies a booking from 2025 in the year 2026, the recalculation MUST use the 2025 tax code. The engine applies an immutable `PolicyVersionID` hash to every finalized Booking.
- Extensively uses caching for rapid geo-to-jurisdiction mapping, but the actual rate fetches come directly from an in-memory representation of the parsed YAML models.

## Extensibility Assessment
- **High:** To update the municipal tax code of Las Vegas, an operations manager simply updates `US.yaml` -> `California` -> `LA` -> `Las_Vegas.TOT_rate` from 0.14 to 0.15 and pushes a configuration commit. Zero code deployment is required.

## Critical Findings
- **Severity: Blocker** - **Rounding Incompatibilities.** Tax calculation across multiple line items often generates fractional pennies. The engine must rigorously apply "Banker's Rounding" (Round Half to Even) and resolve remaining pennies systematically over the line items to prevent Checkout Ledgers failing to balance exactly to zero.
- **Severity: High** - **Liability Definition.** The architecture must strictly denote `remitted_by: "PLATFORM"` vs `remitted_by: "HOST"`. If the platform mistakenly collects and holds tax data that was defined to be passed-through to the Host, massive regulatory audits and penalties will occur.