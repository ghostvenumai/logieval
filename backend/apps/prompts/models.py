from django.db import models


class Prompt(models.Model):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def latest_version(self):
        return self.versions.order_by('-version_number').first()

    @property
    def version_count(self):
        return self.versions.count()


class PromptVersion(models.Model):
    prompt = models.ForeignKey(Prompt, on_delete=models.CASCADE, related_name='versions')
    version_number = models.PositiveIntegerField()
    system_prompt = models.TextField()
    user_template = models.TextField(help_text='Use {{variable}} for placeholders')
    notes = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version_number']
        unique_together = [('prompt', 'version_number')]

    def __str__(self):
        return f'{self.prompt.name} v{self.version_number}'

    def save(self, *args, **kwargs):
        if not self.pk:
            last = self.prompt.versions.order_by('-version_number').first()
            self.version_number = (last.version_number + 1) if last else 1
        super().save(*args, **kwargs)
