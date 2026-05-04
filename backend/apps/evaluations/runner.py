import re
import time
import json
import threading
from django.utils import timezone
from django.conf import settings
import anthropic


_sse_queues: dict[int, list] = {}
_sse_lock = threading.Lock()


def get_queue(eval_id: int) -> list:
    with _sse_lock:
        if eval_id not in _sse_queues:
            _sse_queues[eval_id] = []
        return _sse_queues[eval_id]


def push_event(eval_id: int, event: dict):
    with _sse_lock:
        if eval_id not in _sse_queues:
            _sse_queues[eval_id] = []
        _sse_queues[eval_id].append(event)


def pop_events(eval_id: int) -> list:
    with _sse_lock:
        events = _sse_queues.get(eval_id, [])[:]
        if eval_id in _sse_queues:
            _sse_queues[eval_id] = []
        return events


def _render_template(template: str, variables: dict) -> str:
    for key, value in variables.items():
        template = template.replace(f'{{{{{key}}}}}', str(value))
    return template


# ─── Multi-Dimensional Judge (3 specialized agents) ───────────────────────────

JUDGE_DIMENSIONS = {
    'accuracy': {
        'weight': 0.40,
        'system': (
            "You are an expert fact-checker for logistics customer service AI.\n"
            "Evaluate ONLY factual accuracy: Is the information correct and not hallucinated?\n"
            "Score 0-10. Penalize heavily for wrong facts, made-up data, or contradictions.\n"
            "Respond with JSON only: {\"score\": <0-10>, \"reasoning\": \"<one sentence>\"}"
        ),
    },
    'helpfulness': {
        'weight': 0.35,
        'system': (
            "You are a customer experience expert for logistics companies.\n"
            "Evaluate ONLY customer helpfulness: Does this response actually solve the customer's problem?\n"
            "Score 0-10. Consider: clarity, actionability, completeness.\n"
            "Respond with JSON only: {\"score\": <0-10>, \"reasoning\": \"<one sentence>\"}"
        ),
    },
    'logistics_expertise': {
        'weight': 0.25,
        'system': (
            "You are a logistics domain expert (supply chain, last-mile delivery, freight, SLAs, Incoterms).\n"
            "Evaluate ONLY logistics domain correctness: Is the terminology accurate? "
            "Does the response reflect real logistics processes and industry standards?\n"
            "Score 0-10. Check for correct use of industry terms, realistic process descriptions.\n"
            "Respond with JSON only: {\"score\": <0-10>, \"reasoning\": \"<one sentence>\"}"
        ),
    },
}


def _judge_multi(client: anthropic.Anthropic, judge_model: str,
                 actual_output: str, expected_output: str,
                 user_message: str) -> tuple[float, str, dict]:
    """Score output across 3 logistics-specific dimensions. Returns (weighted_score, combined_reasoning, breakdown)."""
    scores = {}
    reasonings = {}

    judge_user = (
        f"User message: {user_message}\n\n"
        f"Expected output: {expected_output}\n\n"
        f"Actual output: {actual_output}"
    )

    for dim, cfg in JUDGE_DIMENSIONS.items():
        try:
            response = client.messages.create(
                model=judge_model,
                max_tokens=200,
                system=cfg['system'],
                messages=[{"role": "user", "content": judge_user}]
            )
            text = response.content[0].text.strip()
            data = json.loads(text)
            scores[dim] = round(float(data['score']), 1)
            reasonings[dim] = data.get('reasoning', '')
        except Exception as e:
            match = re.search(r'"score"\s*:\s*(\d+(?:\.\d+)?)', text if 'text' in dir() else '')
            scores[dim] = float(match.group(1)) if match else 5.0
            reasonings[dim] = str(e)

    weighted = sum(scores[d] * JUDGE_DIMENSIONS[d]['weight'] for d in scores)
    final_score = round(weighted, 2)
    combined_reasoning = ' | '.join(f"{d.replace('_', ' ').title()}: {reasonings[d]}" for d in reasonings)

    breakdown = {d: {'score': scores[d], 'reasoning': reasonings[d]} for d in scores}
    return final_score, combined_reasoning, breakdown


def run_evaluation(eval_id: int):
    """Run in a background thread. Multi-agent scoring per test case."""
    from .models import Evaluation, EvaluationResult

    eval_obj = Evaluation.objects.get(pk=eval_id)
    eval_obj.status = 'running'
    test_cases = list(eval_obj.dataset.test_cases.all())
    eval_obj.total = len(test_cases)
    eval_obj.save(update_fields=['status', 'total'])

    push_event(eval_id, {'type': 'start', 'total': len(test_cases)})

    if not settings.ANTHROPIC_API_KEY:
        eval_obj.status = 'error'
        eval_obj.error_message = 'ANTHROPIC_API_KEY not configured'
        eval_obj.save(update_fields=['status', 'error_message'])
        push_event(eval_id, {'type': 'error', 'message': eval_obj.error_message})
        return

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    prompt_version = eval_obj.prompt_version
    system_with_cache = [
        {
            "type": "text",
            "text": prompt_version.system_prompt,
            "cache_control": {"type": "ephemeral"}
        }
    ]

    scores = []
    dimension_scores: dict[str, list[float]] = {d: [] for d in JUDGE_DIMENSIONS}
    errors = 0

    for i, tc in enumerate(test_cases):
        try:
            user_message = _render_template(prompt_version.user_template, tc.input_variables)

            t0 = time.monotonic()
            response = client.messages.create(
                model=eval_obj.model,
                max_tokens=1024,
                system=system_with_cache,
                messages=[{"role": "user", "content": user_message}],
                extra_headers={"anthropic-beta": "prompt-caching-2024-07-31"}
            )
            latency_ms = int((time.monotonic() - t0) * 1000)

            actual_output = response.content[0].text if response.content else ''
            usage = response.usage

            score, reasoning, breakdown = None, '', None
            if tc.expected_output:
                score, reasoning, breakdown = _judge_multi(
                    client, eval_obj.judge_model,
                    actual_output, tc.expected_output, user_message
                )
                scores.append(score)
                for d in JUDGE_DIMENSIONS:
                    if d in breakdown:
                        dimension_scores[d].append(breakdown[d]['score'])

            EvaluationResult.objects.create(
                evaluation=eval_obj,
                test_case=tc,
                actual_output=actual_output,
                score=score,
                judge_reasoning=reasoning,
                score_breakdown=breakdown,
                latency_ms=latency_ms,
                input_tokens=usage.input_tokens,
                output_tokens=usage.output_tokens,
                cache_read_tokens=getattr(usage, 'cache_read_input_tokens', 0) or 0,
            )

            eval_obj.progress = i + 1
            eval_obj.save(update_fields=['progress'])

            push_event(eval_id, {
                'type': 'progress',
                'index': i + 1,
                'total': len(test_cases),
                'score': score,
                'breakdown': {d: breakdown[d]['score'] for d in breakdown} if breakdown else None,
                'latency_ms': latency_ms,
                'cache_read_tokens': getattr(usage, 'cache_read_input_tokens', 0) or 0,
            })

        except Exception as e:
            errors += 1
            EvaluationResult.objects.create(evaluation=eval_obj, test_case=tc, error=str(e))
            push_event(eval_id, {'type': 'error_item', 'index': i + 1, 'message': str(e)})

    dim_avgs = {
        d: round(sum(dimension_scores[d]) / len(dimension_scores[d]), 2)
        for d in JUDGE_DIMENSIONS if dimension_scores[d]
    }

    summary = {
        'avg_score': round(sum(scores) / len(scores), 2) if scores else None,
        'min_score': round(min(scores), 2) if scores else None,
        'max_score': round(max(scores), 2) if scores else None,
        'total_cases': len(test_cases),
        'scored_cases': len(scores),
        'errors': errors,
        'score_distribution': _score_distribution(scores),
        'dimension_averages': dim_avgs,
    }

    eval_obj.status = 'done'
    eval_obj.summary = summary
    eval_obj.completed_at = timezone.now()
    eval_obj.save(update_fields=['status', 'summary', 'completed_at'])

    push_event(eval_id, {'type': 'done', 'summary': summary})


def _score_distribution(scores: list[float]) -> dict:
    buckets = {'0-2': 0, '2-4': 0, '4-6': 0, '6-8': 0, '8-10': 0}
    for s in scores:
        if s < 2: buckets['0-2'] += 1
        elif s < 4: buckets['2-4'] += 1
        elif s < 6: buckets['4-6'] += 1
        elif s < 8: buckets['6-8'] += 1
        else: buckets['8-10'] += 1
    return buckets
