from django.db import models


class Dataset(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def test_case_count(self):
        return self.test_cases.count()


class TestCase(models.Model):
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name='test_cases')
    input_variables = models.JSONField(default=dict, help_text='Variables to fill into the prompt template')
    expected_output = models.TextField(blank=True)
    tags = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'TestCase #{self.id} ({self.dataset.name})'
