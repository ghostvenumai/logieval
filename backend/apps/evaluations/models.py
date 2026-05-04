from django.db import models


class Evaluation(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('done', 'Done'),
        ('error', 'Error'),
    ]

    name = models.CharField(max_length=200)
    prompt_version = models.ForeignKey(
        'prompts.PromptVersion', on_delete=models.CASCADE, related_name='evaluations'
    )
    dataset = models.ForeignKey(
        'datasets.Dataset', on_delete=models.CASCADE, related_name='evaluations'
    )
    model = models.CharField(max_length=100, default='claude-opus-4-7')
    judge_model = models.CharField(max_length=100, default='claude-haiku-4-5')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.IntegerField(default=0)
    total = models.IntegerField(default=0)
    summary = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def avg_score(self):
        results = self.results.filter(score__isnull=False)
        if not results.exists():
            return None
        return round(sum(r.score for r in results) / results.count(), 2)


class EvaluationResult(models.Model):
    evaluation = models.ForeignKey(Evaluation, on_delete=models.CASCADE, related_name='results')
    test_case = models.ForeignKey('datasets.TestCase', on_delete=models.CASCADE)
    actual_output = models.TextField(blank=True)
    score = models.FloatField(null=True, blank=True)
    judge_reasoning = models.TextField(blank=True)
    latency_ms = models.IntegerField(null=True, blank=True)
    input_tokens = models.IntegerField(null=True, blank=True)
    output_tokens = models.IntegerField(null=True, blank=True)
    cache_read_tokens = models.IntegerField(default=0)
    score_breakdown = models.JSONField(null=True, blank=True)
    error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
