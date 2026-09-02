# Chromium only (~1GB total), not the full playwright image (~3.5GB extracted) —
# the box shares an 11GB disk with job-worker + site-host.
FROM python:3.12-slim

WORKDIR /app
RUN pip install --no-cache-dir playwright==1.55.0 \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.cache

COPY server.py .

ENV PDF_RENDER_PORT=8095
EXPOSE 8095
CMD ["python", "server.py"]
