# ProsesaOS — Architecture & Module Diagrams

---

## 1. Module Map

How the eight feature modules relate and which data they share across companies vs. per company.

```mermaid
graph TB
    subgraph shared["Shared across both companies"]
        users["Users & Roles\nadmin / ventas"]
        customers["Customers\nincl. Público en general"]
        catalog["Catalog\ncategories + items"]
        inventory["Inventory\nmaterials + movements"]
    end

    subgraph perco["Per company — company_id required on all transactions"]
        pos["POS\ncounter sales / project sales"]
        notes["Sales Notes\nper-company folios + IVA breakdown"]
        orders["Work Orders\n7-stage pipeline"]
        caja["Corte de Caja\ndaily cash reconciliation"]
    end

    subgraph cross["Cross-cutting"]
        audit["Audit Log\nappend-only Postgres trigger"]
        bugs["Bug Report FAB\nbug_reports table + Storage"]
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
stateDiagram-v2
    direction LR

    state "Cotizado" as s1
    state "Anticipo recibido" as s2
    state "En diseño" as s3
    state "En producción" as s4
    state "En instalación" as s5
    state "Terminado" as s6
    state "Entregado" as s7

    [*] --> s1 : sale created
    s1 --> s2 : payment recorded
    s2 --> s3 : start design
    s3 --> s4 : design approved
    s4 --> s5 : production done
    s4 --> s6 : skip installation
    s5 --> s6 : installation done
    s6 --> s7 : delivered to client ⚠ warn if saldo > 0
    s7 --> [*]

    s3 --> s1 : rework ↩
    s4 --> s3 : rework ↩
    s5 --> s4 : rework ↩
    s6 --> s4 : rework ↩
    s6 --> s5 : rework ↩
```

---

## 3. POS Data Flow

End-to-end flow from opening the POS to generating a sales note and optionally a work order.

```mermaid
flowchart TD
    A([Open POS]) --> B{Company selected?}
    B -- No --> C[Prompt to select\nactive company]
    C --> B
    B -- Yes --> D[Add line items\ncatalog or freeform]
    D --> E[Apply per-line discounts\npercent or fixed amount]
    E --> F[IVA breakdown always visible\nsubtotal / IVA / total]
    F --> G{Payment method?}
    G -- single --> H[Record single payment\nefectivo / transferencia / tarjeta]
    G -- mixto --> I[Split across\nmultiple methods]
    H --> J
    I --> J
    J[Create sales_note + lines + payments\ntransactional — folio auto-assigned per company]
    J --> K{Genera orden\nde trabajo?}
    K -- No --> L[Print thermal ticket\n80mm, window.print]
    K -- Yes --> M[Create work_order\nstatus = Cotizado]
    M --> N[Record anticipo\nsaldo pendiente tracked]
    N --> O[Print detailed note\nletter-size PDF]
```

---

## 4. Deployment Architecture

```mermaid
graph LR
    subgraph client["End user"]
        browser["Browser"]
    end

    subgraph cf["Cloudflare — pending domain decision"]
        cloudflare["DDoS protection\nSSL termination\nTurnstile CAPTCHA"]
    end

    subgraph vercel["Vercel Pro"]
        vprod["main branch → production\nprosesaos.com TBD"]
        vpreview["feature branches → preview URLs\nper-PR staging environment"]
    end

    subgraph supabase["Supabase"]
        sbprod["prosesa-os-prod\nPro plan\nPostgres · Auth · Storage · Realtime"]
        sbstg["prosesa-os-staging\nFree plan\npauses after 1 week inactivity"]
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

| Date | Change |
|---|---|
| 2026-04-14 | Initial architecture diagrams for Phase 1. |
