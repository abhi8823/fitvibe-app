# --- Stage 1: Build Frontend Assets ---
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend

# Copy dependencies first to utilize cache
COPY frontend/package.json ./
RUN npm install

# Copy source and build
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Serve Backend & Frontend ---
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies if needed (none are strictly required for our standard stack, keeping it slim)
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Copy python dependencies list and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code to the container
COPY backend/ ./

# Copy frontend static build assets from Stage 1 into the correct directory
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port 8000 for App Runner / Elastic Beanstalk
EXPOSE 8000

# Run FastAPI using uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
