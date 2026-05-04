from rest_framework import serializers
from .models import Evaluation, EvaluationResult


class EvaluationResultSerializer(serializers.ModelSerializer):
    test_case_input = serializers.JSONField(source='test_case.input_variables', read_only=True)
    test_case_expected = serializers.CharField(source='test_case.expected_output', read_only=True)

    class Meta:
        model = EvaluationResult
        fields = [
            'id', 'test_case', 'test_case_input', 'test_case_expected',
            'actual_output', 'score', 'score_breakdown', 'judge_reasoning',
            'latency_ms', 'input_tokens', 'output_tokens', 'cache_read_tokens',
            'error', 'created_at'
        ]
        read_only_fields = ['created_at']


class EvaluationSerializer(serializers.ModelSerializer):
    prompt_version_label = serializers.SerializerMethodField()
    dataset_name = serializers.CharField(source='dataset.name', read_only=True)
    avg_score = serializers.FloatField(read_only=True)
    result_count = serializers.SerializerMethodField()

    class Meta:
        model = Evaluation
        fields = [
            'id', 'name', 'prompt_version', 'prompt_version_label',
            'dataset', 'dataset_name', 'model', 'judge_model',
            'status', 'progress', 'total', 'summary', 'error_message',
            'avg_score', 'result_count', 'created_at', 'completed_at'
        ]
        read_only_fields = ['status', 'progress', 'total', 'summary', 'created_at', 'completed_at']

    def get_prompt_version_label(self, obj):
        return str(obj.prompt_version)

    def get_result_count(self, obj):
        return obj.results.count()


class EvaluationDetailSerializer(EvaluationSerializer):
    results = EvaluationResultSerializer(many=True, read_only=True)

    class Meta(EvaluationSerializer.Meta):
        fields = EvaluationSerializer.Meta.fields + ['results']
