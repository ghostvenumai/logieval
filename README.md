# LogiEval

LLM evaluation and observability platform for logistics AI. Test, score, and compare prompt versions against real customer service scenarios using a multi-agent Claude judge.

## What it does

LogiEval helps teams evaluate LLM-powered logistics assistants. You write prompts, upload test cases, run evaluations, and get structured scores across three logistics-specific dimensions — all through a clean web UI with live progress streaming.

**Multi-agent scoring:** Each test case is evaluated by three specialized Claude judges in parallel:

| Dimension | Weight | What it checks |
|---|---|---|
| Accuracy | 40% | Factual correctness, no hallucinations |
| Helpfulness | 35% | Does it actually solve the customer's problem? |
| Logistics Expertise | 25% | Correct use of domain terms, SLAs, Incoterms, freight processes |

## Features

- **Prompt versioning** — every edit creates a new version, old versions stay intact
- **Dataset management** — upload JSON test cases with input variables and expected outputs
- **Live evaluation progress** — SSE-powered real-time score stream as each test case completes
- **Score breakdowns** — per-dimension scores + reasoning from each judge agent
- **Prompt caching** — system prompts are cached across test cases (reduces API cost significantly on large datasets)
- **Score distribution chart** — histogram of 0-10 scores per evaluation run
- **Token tracking** — input/output/cache tokens logged per test case
- **Latency tracking** — ms-precise response time per test case

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, Django 4.2, Django REST Framework |
| Frontend | React 18, TypeScript, Vite 5 |
| LLM | Anthropic Claude (configurable model per evaluation) |
| Database | SQLite (zero-config, file-based) |
| Streaming | Server-Sent Events (SSE) |

## Setup

**Requirements:** Python 3.10+, Node.js 18+, an Anthropic API key.

```bash
git clone https://github.com/ghostvenumai/logieval.git
cd logieval

# Set your API key
export ANTHROPIC_API_KEY=sk-ant-...

# Start everything (creates venv, installs deps, runs migrations)
./start.sh
```

Open `http://localhost:5173` in your browser.

The backend API runs at `http://localhost:8000/api/`.

## Usage

### 1. Create a Prompt

Go to **Prompts** → New Prompt. Write a system prompt and a user message template. Use `{{variable_name}}` placeholders for dynamic values.

Example system prompt:
```
You are a logistics customer service assistant for FastFreight GmbH.
Answer questions about shipment status, delivery times, and logistics processes.
Be concise and accurate.
```

Example user template:
```
Customer question: {{question}}
Shipment ID: {{shipment_id}}
```

### 2. Create a Dataset

Go to **Datasets** → New Dataset. Add test cases as JSON:

```json
{
  "input_variables": {
    "question": "Where is my package?",
    "shipment_id": "FF-2024-98765"
  },
  "expected_output": "Your shipment FF-2024-98765 is currently in transit and expected to arrive within 2 business days."
}
```

### 3. Run an Evaluation

Go to **Evaluations** → New Evaluation. Select a prompt version, a dataset, and the model to evaluate. Watch the live score stream as each test case completes.

### 4. Compare Results

The Dashboard shows aggregate scores across all evaluations. Click into any evaluation for per-test-case breakdowns with individual judge reasoning.

## Project Structure

```
logieval/
├── backend/
│   ├── apps/
│   │   ├── evaluations/     # Evaluation model, runner, SSE views
│   │   ├── prompts/         # Prompt + PromptVersion models
│   │   └── datasets/        # Dataset + TestCase models
│   ├── logieval/            # Django settings, URLs, WSGI
│   ├── requirements.txt
│   └── manage.py
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, Prompts, Datasets, Evaluations
│   │   ├── components/      # Shared UI components
│   │   ├── api.ts           # Typed API client
│   │   └── App.tsx
│   └── package.json
└── start.sh                 # One-command startup
```

## API

The Django REST API is available at `http://localhost:8000/api/`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/prompts/` | GET, POST | List and create prompts |
| `/api/prompts/{id}/versions/` | GET, POST | List and create prompt versions |
| `/api/datasets/` | GET, POST | List and create datasets |
| `/api/datasets/{id}/cases/` | GET, POST | List and add test cases |
| `/api/evaluations/` | GET, POST | List and start evaluations |
| `/api/evaluations/{id}/results/` | GET | Per-test-case results with scores |
| `/api/evaluations/{id}/stream/` | GET (SSE) | Live progress stream |

## Configuration

The only required configuration is the Anthropic API key:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Or create `backend/.env`:
```
ANTHROPIC_API_KEY=sk-ant-...
```

By default, evaluations use `claude-haiku-4-5` as the production model and `claude-haiku-4-5` as the judge. Both are configurable per evaluation run in the UI.

## License

MIT
