# BoloShop Architecture & Guidelines

## Tech Stack
- Apps: Flutter (iOS / Android) in `/apps/mobile`
- API Gateway: Node.js (TypeScript Express) in `/services/api-gateway`
- Media & Video Engine: Node.js / FFmpeg canvas pipeline in `/services/media-service`
- Order & Logistics Microservice: Go service in `/services/order-service`
- Shared Schemas & DB Helpers: PostgreSQL & Redis scripts in `/packages/db`

## Key Business & Technical Constraints
1. Target Market: Pakistan. Mobile-first, low network bandwidth optimization (HLS adaptive streaming).
2. Monorepo Structure: Keep services isolated and strongly typed.
3. Database: PostgreSQL for core relational data (users, catalog, orders), Redis for live stream stats and active cart caching.
4. Logistics: Integrated cash-on-delivery (COD) shipping pipeline with automated 1% commission calculation.
