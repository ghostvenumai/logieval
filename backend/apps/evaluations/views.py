import re
import json
import time
import threading
from django.http import StreamingHttpResponse
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Evaluation, EvaluationResult
from .serializers import EvaluationSerializer, EvaluationDetailSerializer, EvaluationResultSerializer
from .runner import run_evaluation, pop_events


class EvaluationViewSet(viewsets.ModelViewSet):
    queryset = Evaluation.objects.all()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return EvaluationDetailSerializer
        return EvaluationSerializer

    def create(self, request, *args, **kwargs):
        serializer = EvaluationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        eval_obj = serializer.save()
        t = threading.Thread(target=run_evaluation, args=(eval_obj.pk,), daemon=True)
        t.start()
        return Response(EvaluationSerializer(eval_obj).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def results(self, request, pk=None):
        evaluation = self.get_object()
        return Response(EvaluationResultSerializer(evaluation.results.all(), many=True).data)

    @action(detail=True, methods=['get'])
    def stream(self, request, pk=None):
        eval_id = int(pk)

        def event_generator():
            yield 'data: {"type":"connected"}\n\n'
            timeout = 300
            start = time.time()
            while time.time() - start < timeout:
                events = pop_events(eval_id)
                for event in events:
                    yield f'data: {json.dumps(event)}\n\n'
                    if event.get('type') in ('done', 'error'):
                        return
                if not events:
                    time.sleep(0.3)

        response = StreamingHttpResponse(event_generator(), content_type='text/event-stream')
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response

    @action(detail=True, methods=['post'])
    def auto_improve(self, request, pk=None):
        """Agent analyses low-scoring results and proposes an improved prompt version."""
        from django.conf import settings
        import anthropic as _anthropic

        evaluation = self.get_object()
        if evaluation.status != 'done':
            return Response({'error': 'Evaluation must be completed first.'}, status=400)

        if not settings.ANTHROPIC_API_KEY:
            return Response({'error': 'ANTHROPIC_API_KEY not configured'}, status=503)

        low_results = list(
            evaluation.results.filter(score__lt=7).select_related('test_case')
        )
        all_results = evaluation.results.all()

        if not low_results:
            return Response({
                'message': 'All scores ≥ 7 — no improvements needed!',
                'suggestion': None
            })

        prompt_version = evaluation.prompt_version
        failures = [
            {
                'input': r.test_case.input_variables,
                'expected': r.test_case.expected_output,
                'actual': r.actual_output,
                'score': r.score,
                'breakdown': r.score_breakdown,
                'reasoning': r.judge_reasoning,
            }
            for r in low_results
        ]

        improve_system = (
            "You are a senior prompt engineer specializing in logistics customer service AI systems.\n"
            "You receive a system prompt and a set of failed test cases with their multi-dimensional scores "
            "(accuracy, helpfulness, logistics_expertise).\n"
            "Your task: analyze the failure patterns and write an improved system prompt.\n"
            "Use your logistics domain knowledge. Be specific — vague instructions don't help.\n"
            "Respond with JSON only, no markdown."
        )

        improve_user = (
            f"Current system prompt:\n---\n{prompt_version.system_prompt}\n---\n\n"
            f"User template: {prompt_version.user_template}\n\n"
            f"Overall stats: avg_score={evaluation.avg_score}, "
            f"{len(low_results)} of {all_results.count()} cases scored < 7\n\n"
            f"Failed test cases:\n{json.dumps(failures, indent=2, ensure_ascii=False)}\n\n"
            "Analyze the failure patterns across all three dimensions and write an improved system prompt.\n\n"
            "Respond with JSON:\n"
            "{\n"
            '  "analysis": "2-3 sentences: what patterns caused the failures",\n'
            '  "improved_prompt": "the complete improved system prompt",\n'
            '  "changes": ["specific change 1", "specific change 2", ...]\n'
            "}"
        )

        client = _anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        try:
            response = client.messages.create(
                model='claude-opus-4-7',
                max_tokens=2048,
                system=improve_system,
                messages=[{"role": "user", "content": improve_user}]
            )
            text = response.content[0].text.strip()
            # Strip markdown code fences if present
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

            suggestion = json.loads(text)
            return Response({
                'suggestion': suggestion,
                'prompt_id': prompt_version.prompt_id,
                'user_template': prompt_version.user_template,
                'based_on': {
                    'total_cases': all_results.count(),
                    'failed_cases': len(low_results),
                    'avg_score': evaluation.avg_score,
                },
            })

        except json.JSONDecodeError as e:
            return Response({'error': f'Could not parse agent response: {e}', 'raw': text}, status=500)
        except Exception as e:
            return Response({'error': str(e)}, status=500)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        from apps.prompts.models import Prompt
        from apps.datasets.models import Dataset
        evals = Evaluation.objects.all()
        return Response({
            'total_prompts': Prompt.objects.count(),
            'total_datasets': Dataset.objects.count(),
            'total_evaluations': evals.count(),
            'evaluations_done': evals.filter(status='done').count(),
            'evaluations_running': evals.filter(status='running').count(),
            'recent_evaluations': EvaluationSerializer(evals[:5], many=True).data,
        })
