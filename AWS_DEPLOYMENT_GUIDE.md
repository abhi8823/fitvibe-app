# AWS Deployment & VS Code Runner Guide: FitVibe.AI

This guide details how to run the project locally inside **VS Code** and deploy it to **AWS App Runner** using the pre-configured Docker setup.

---

## Part 1: How to Run in VS Code (Local Testing)

Follow these steps to run the application inside VS Code:

### Step 1: Open the Project
1. Open VS Code.
2. Go to **File > Open Folder...** and select `D:\IBM2`.

### Step 2: Configure Environment Keys
1. In the VS Code explorer, go to the `backend/` folder.
2. Rename `.env.example` to `.env` (or create a file named `.env` in `backend/`).
3. Add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Step 3: Run the Backend (FastAPI)
1. Open a new terminal in VS Code: **Terminal > New Terminal** (or press ``Ctrl + ` ``).
2. Create and activate a Python virtual environment (recommended):
   - **Windows (PowerShell):**
     ```powershell
     cd backend
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD):**
     ```cmd
     cd backend
     python -m venv venv
     .\venv\Scripts\activate.bat
     ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
   *The backend will be running at `http://127.0.0.1:8000`.*

### Step 4: Run the Frontend (React + Vite)
1. Split the terminal in VS Code or open a **second terminal**.
2. Navigate to the `frontend/` directory and start the dev server:
   ```bash
   cd frontend
   npm run dev
   ```
3. Open your browser and go to `http://localhost:5173`.
4. Now you can select your metrics, click **Generate Plan**, and test the chat!

---

## Part 2: AWS Connectivity & Deployment (via AWS App Runner)

**AWS App Runner** is the recommended service for containerized applications. It automatically builds your Docker image, manages SSL (HTTPS), handles load balancing, and deploys it live.

### Option A: Deployment via GitHub (Easiest - Continuous Deployment)

This is the recommended method. When you push updates to GitHub, AWS App Runner will automatically redeploy the new code.

#### Step 1: Push Code to GitHub
1. Create a repository on GitHub (e.g., `fitvibe-app`).
2. Run these commands in the root of your project (`D:\IBM2`):
   ```bash
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/your-username/fitvibe-app.git
   git push -u origin main
   ```

#### Step 2: Create AWS App Runner Service
1. Log into your **AWS Management Console**.
2. Search for and select **AWS App Runner**.
3. Click **Create service**.
4. Set up the source connection:
   - **Repository type:** Source code repository.
   - **Provider:** GitHub.
   - Click **Add new** to authorize AWS to access your GitHub account, then select your `fitvibe-app` repository and `main` branch.
5. In **Deployment settings**, select **Automatic** (so code changes trigger auto-deployments) and click **Next**.
6. Set up build configurations:
   - Select **Configure all settings here**.
   - **Runtime:** `Docker` (App Runner will read our `Dockerfile`).
   - Click **Next**.
7. Configure service:
   - **Service name:** `fitvibe-coach`.
   - **Virtual CPU & Memory:** `1 vCPU & 2 GB` (App Runner Free Tier/basic sizes are sufficient).
   - **Port:** `8000` (FastAPI runs on 8000).
   - **Environment variables:**
     - Key: `GEMINI_API_KEY`
     - Value: `[Your Actual Google Gemini API Key]`
8. Click **Next**, review the settings, and click **Create & Deploy**.

Within 3 to 5 minutes, AWS will provision your container, configure HTTPS, and give you a **Default domain URL** (e.g., `https://xxxxxx.us-east-1.awsapprunner.com`). 
*Open this link to access your live AI application!*

---

### Option B: Local Docker Build + AWS ECR (Elastic Container Registry)

If you prefer to build the container locally and upload it:

1. **Create an ECR Repository:**
   Go to AWS ECR Console and create a private repository named `fitvibe`.
2. **Authenticate Docker to ECR:**
   ```bash
   aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com
   ```
3. **Build and Tag Image:**
   ```bash
   docker build -t fitvibe .
   docker tag fitvibe:latest <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/fitvibe:latest
   ```
4. **Push to ECR:**
   ```bash
   docker push <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/fitvibe:latest
   ```
5. **Create App Runner Service:**
   Select **Container registry** -> **Amazon ECR**, choose the image, specify `GEMINI_API_KEY` in environment variables, set port to `8000`, and deploy.
