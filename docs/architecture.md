# ProsesaOS — Architecture & Module Diagrams

---

## 1. Module Map

How the eight feature modules relate and which data they share across companies vs. per company.

```mermaid
graph TB
    subgraph shared["Shared across both companies"]
        users["Users and Roles - admin / ventas"]
        customers["Customers - incl. Publico en general"]
        catalog["Catalog - categories and items"]
        inventory["Inventory - materials and movements"]
    end

    subgraph perco["Per company - company_id required on all transactions"]
        pos["POS - counter sales / project sales"]
        notes["Sales Notes - per-company folios + IVA"]
        orders["Work Orders - 7-stage pipeline"]
        caja["Corte de Caja - daily cash reconciliation"]
    end

    subgraph cross["Cross-cutting"]
        audit["Audit Log - append-only Postgres trigger"]
        bugs["Bug Report FAB - bug_reports table"]
    end

    users --> pos
    customers --> pos
    catalog --> pos
    pos -->|creates| notes
    pos -->|"Genera orden de trabajo toggle"| orders
    notes --> orders
    orders -->|deducts stock| inventory
    notes --> caja
    notes --> audit
    orders --> audit
    inventory --> audit
```

---

## 2. Work Order Pipeline

Seven-stage pipeline. `En instalación` is skippable. Backward (rework) transitions are allowed and always logged.

```mermaid
flowchart LR
    s1[Cotizado]
    s2[Anticipo recibido]
    s3[En diseno]
    s4[En produccion]
    s5[En instalacion]
    s6[Terminado]
    s7[Entregado]

    s1 --> s2
    s2 --> s3
    s3 --> s4
    s4 --> s5
    s4 -->|skip installation| s6
    s5 --> s6
    s6 -->|warn if saldo pendiente| s7

    s3 -.->|rework| s1
    s4 -.->|rework| s3
    s5 -.->|rework| s4
    s6 -.->|rework| s4
    s6 -.->|rework| s5
```

---

## 3. POS Data Flow

End-to-end flow from opening the POS to generating a sales note and optionally a work order.

```mermaid
flowchart TD
    A([Open POS]) --> B{Company selected?}
    B -- No --> C[Prompt: select active company]
    C --> B
    B -- Yes --> D[Add line items - catalog or freeform]
    D --> E[Apply per-line discounts - percent or fixed]
    E --> F[IVA breakdown: subtotal / IVA / total]
    F --> G{Payment method?}
    G -- single --> H[Record payment - efectivo / transferencia / tarjeta]
    G -- mixto --> I[Split across multiple methods]
    H --> J
    I --> J
    J[Create sales_note + lines + payments - folio auto-assigned]
    J --> K{Genera orden de trabajo?}
    K -- No --> L[Print thermal ticket - 80mm]
    K -- Yes --> M[Create work_order - status Cotizado]
    M --> N[Record anticipo - saldo pendiente tracked]
    N --> O[Print detailed note - letter-size PDF]
```

---

## 4. Deployment Architecture

```mermaid
graph LR
    subgraph client["End user"]
        browser["Browser"]
    end

    subgraph cf["Cloudflare - pending domain decision"]
        cloudflare["DDoS protection + SSL + Turnstile CAPTCHA"]
    end

    subgraph vercel["Vercel Pro"]
        vprod["main branch - production - prosesaos.com TBD"]
        vpreview["feature branches - preview URLs per PR"]
    end

    subgraph supabase["Supabase"]
        sbprod["prosesa-os-prod - Pro - Postgres + Auth + Storage + Realtime"]
        sbstg["prosesa-os-staging - Free - pauses after 1 week inactivity"]
    end

    karina(["Karina QA"])

    browser --> cloudflare --> vprod --> sbprod
    browser --> vpreview --> sbstg
    karina --> vpreview
```

---

## 5. Core Data Model

Key business entities and their relationships. Full column definitions in `supabase/migrations/`.

```mermaid
erDiagram
    companies {
        uuid id PK
        text nombre_comercial
        text razon_social
        text rfc
        numeric iva_rate
        bool iva_inclusive
    }

    profiles {
        uuid id PK
        text role
        text full_name
    }

    customers {
        uuid id PK
        text nombre
        text rfc
        bool requiere_factura
    }

    catalog_items {
        uuid id PK
        uuid category_id FK
        text name
        text pricing_mode
        numeric price
        bool is_active
    }

    sales_notes {
        uuid id PK
        uuid company_id FK
        uuid customer_id FK
        uuid created_by FK
        text folio
        text status
        numeric total
        timestamptz created_at
    }

    sales_note_lines {
        uuid id PK
        uuid sales_note_id FK
        text concept
        numeric quantity
        numeric unit_price
        numeric discount_value
        numeric line_total
    }

    payments {
        uuid id PK
        uuid sales_note_id FK
        uuid created_by FK
        text method
        numeric amount
        timestamptz paid_at
    }

    work_orders {
        uuid id PK
        uuid sales_note_id FK
        uuid company_id FK
        uuid customer_id FK
        text status
        text priority
        timestamptz promised_at
        timestamptz delivered_at
    }

    work_order_status_log {
        uuid id PK
        uuid work_order_id FK
        uuid changed_by FK
        text old_status
        text new_status
        text note
        timestamptz changed_at
    }

    materials {
        uuid id PK
        text name
        text unit
        numeric stock
        numeric min_threshold
        bool is_active
    }

    inventory_movements {
        uuid id PK
        uuid material_id FK
        uuid work_order_id FK
        uuid created_by FK
        text type
        numeric quantity
        text notes
        timestamptz created_at
    }

    cash_days {
        uuid id PK
        uuid company_id FK
        uuid opened_by FK
        uuid closed_by FK
        numeric opening_amount
        numeric expected_amount
        numeric closing_counted_amount
        numeric difference
    }

    companies ||--o{ sales_notes : "issues"
    companies ||--o{ work_orders : "owns"
    companies ||--o{ cash_days : "reconciles"
    customers ||--o{ sales_notes : "appears on"
    profiles ||--o{ sales_notes : "created_by"
    sales_notes ||--o{ sales_note_lines : "contains"
    sales_notes ||--o{ payments : "paid via"
    sales_notes ||--o| work_orders : "spawns"
    work_orders ||--o{ work_order_status_log : "logs transitions"
    work_orders ||--o{ inventory_movements : "triggers deduction"
    materials ||--o{ inventory_movements : "tracked in"
```

---

## Changelog

| Date       | Change                                     |
| ---------- | ------------------------------------------ |
| 2026-04-14 | Initial architecture diagrams for Phase 1. |
