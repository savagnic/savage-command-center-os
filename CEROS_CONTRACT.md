# CEROS Data Contracts

This document establishes the official data contracts between the Sovereign Agent Shell frontend and the CEROS backend services (running on GCP / Cloud Run).

## 1. Endpoint: `/api/organism-status`
- **Method:** `GET`
- **Headers:** `Accept: application/json`
- **Description:** Fetches the overall status and health metrics of the self-assembling autonomous organism.

### Expected JSON Response Schema
```json
{
  "status": "string",
  "health": "string",
  "active_agents": "integer | string",
  "entropy_index": "number | string",
  "revenue_signal": "number | string"
}
```

### Detailed Field Definitions
| Field | Type | Description | Empty-State Fallback |
| :--- | :--- | :--- | :--- |
| `status` | `string` | The operational status of the organism (e.g., `"LIVE"`, `"DEGRADED"`, `"OFFLINE"`). | `"LIVE"` |
| `health` | `string` | System health metric percentage/expression (e.g., `"99.2%"`, `"95.5%"`). | `"—"` |
| `active_agents` | `integer` or `string` | The number of active running agents in the multi-agent system. | `"—"` |
| `entropy_index` | `number` or `string` | The stabilized entropy index (e.g., `0.034` or `"0.034"`). | `"—"` |
| `revenue_signal` | `number` or `string` | The real-time revenue performance signal (e.g., `3.14` or `"3.14"`). | `"—"` |

### UI Behavior and Downtime Strategy
- **Success State:** Values are displayed in their respective cockpit and pressure cards. The background of the organism status badge updates dynamically (e.g., `green` for `"LIVE"`, `amber` for other states). A `Last updated:` timestamp is shown on both screens.
- **Offline / Failure State:** If the endpoint is offline or returns a non-200 status, the UI:
  1. Shows the status as `OFFLINE` in red.
  2. Renders `"—"` for other metric fields.
  3. Displays a human-readable timestamp showing exactly when the update failed.
  4. Appends a detailed error message in the Raw Feed output block.

---

## 2. Endpoint: `/api/decisions`
- **Method:** `GET`
- **Headers:** `Accept: application/json`
- **Description:** Retrieves the historical audit trail of deterministic decisions resolved by the autonomous system.

### Expected JSON Response Schema
```json
[
  {
    "id": "string",
    "title": "string",
    "timestamp": "string",
    "accepted": "boolean",
    "context": "string",
    "outcome": "string",
    "proof_hash": "string",
    "replay_verdict": "string"
  }
]
```

### Detailed Field Definitions
| Field | Type | Description | Empty-State Fallback |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Unique identifier for the decision. | `"—"` |
| `title` | `string` | User-friendly title representing the decision type. | `"Decision [index]"` |
| `timestamp` | `string` | ISO/human-readable timestamp when the decision was compiled. | `"—"` |
| `accepted` | `boolean` | Flag indicating whether the decision was accepted (`true`) or rejected (`false`). | `true` |
| `context` | `string` | The descriptive baseline context for the decision. | `"—"` |
| `outcome` | `string` | The mathematical or behavioral result outcome. | `"—"` |
| `proof_hash` | `string` | Crucial cryptographic attestation verifying convergence. | `"—"` |
| `replay_verdict` | `string` | A verified indicator verifying identical execution. | `"Deterministic replay: identical to original"` |

### UI Behavior and Downtime Strategy
- **Success State:** Renders a list of decision cards in the Replay Theater, displaying the exact count loaded. Clicking a decision card opens a detail view populated with the fields.
- **Empty State:** If the response is valid but empty (`[]`), the UI displays: "No decisions recorded yet — run an organism cycle and return."
- **Offline / Failure State:** If the API fails or times out, the UI displays a clear error status stating "Error: [Details] — showing local history" and shows the fallback/empty state cleanly rather than failing silently.
